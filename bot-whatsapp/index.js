// bot-whatsapp/index.js
//
// Bot de WhatsApp de Herrería VyV. Proceso Node aparte (Baileys + IA).
// - Escucha mensajes. Si el que escribe está habilitado y el mensaje
//   describe un gasto o un ingreso ("gasté 15000 en nafta", "cobré 45000
//   de una venta"), la IA extrae tipo + monto + categoría y lo carga en
//   la app llamando a /api/bot-whatsapp/movimiento.
// - Si la IA NO entiende el monto o la categoría, NO inventa: marca la
//   conversación como "escalada" (aparece en el panel) y espera a que una
//   persona responda con un mensaje predeterminado.
// - Le reporta TODO a la app por HTTP (/api/bot-whatsapp/*). Nunca toca
//   la base directamente. El panel nunca se conecta a WhatsApp: sólo lee
//   y escribe esa base.
//
// Correr con:  npm start   (usa node --env-file=.env)

import { existsSync, rmSync } from "node:fs";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "baileys";
import pino from "pino";
import QRCode from "qrcode";
import Anthropic from "@anthropic-ai/sdk";

// ----------------------------- Config -----------------------------
const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const BOT_TOKEN = process.env.BOT_TOKEN || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
const INTERVALO_COMANDOS_MS = Number(process.env.INTERVALO_COMANDOS_MS || 8000);
const CONFIANZA_MINIMA = Number(process.env.CONFIANZA_MINIMA || 0.6);
const AUTH_DIR = "./auth";

const log = pino({ level: "info", transport: { target: "pino-pretty", options: { colorize: true } } }).child(
  { mod: "bot" }
);

if (!ANTHROPIC_API_KEY) {
  log.warn("Falta ANTHROPIC_API_KEY — el bot va a escalar TODO hasta que la cargues en .env");
}
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

// Conversaciones cuya IA está bloqueada en memoria (por escalar, por
// respuesta manual, o por un comando "bloquear" del panel).
const bloqueadas = new Set();

// --------------------------- API helper ---------------------------
async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(APP_URL + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(BOT_TOKEN ? { "x-bot-token": BOT_TOKEN } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  let data;
  try {
    data = txt ? JSON.parse(txt) : null;
  } catch {
    data = txt;
  }
  return { ok: res.ok, status: res.status, data };
}

const reportarEstado = (campos) => api("/api/bot-whatsapp/estado", { method: "PUT", body: campos });
const logMensaje = (payload) => api("/api/bot-whatsapp/mensajes", { method: "POST", body: payload });

// --------------------------- IA (extracción) ---------------------------
async function interpretarMensaje(texto, categorias) {
  if (!anthropic) return { esMovimiento: false, motivo: "sin_ia" };

  const lista = categorias.map((c) => `- ${c.nombre} (${c.tipo})`).join("\n");
  const system =
    "Sos un asistente que registra la caja de una herrería. Te pasan un mensaje de WhatsApp " +
    "y tenés que decidir si describe UN gasto o UN ingreso de plata, y extraer los datos.\n\n" +
    "Categorías disponibles (elegí SIEMPRE una de esta lista, con el nombre EXACTO):\n" +
    lista +
    "\n\nReglas:\n" +
    "- Si el mensaje no habla de plata que entró o salió (saludos, preguntas, etc.), esMovimiento = false.\n" +
    "- monto: entero en pesos argentinos, sin signos ni puntos. Si no hay un monto claro, monto = null.\n" +
    "- categoria: el nombre exacto de la lista que mejor corresponda. Si ninguna encaja con confianza, categoria = null.\n" +
    "- tipo: 'gasto' si salió plata, 'ingreso' si entró.\n" +
    "- confianza: 0 a 1, qué tan seguro estás del conjunto tipo+monto+categoria.\n" +
    'Respondé SOLO un JSON: {"esMovimiento":boolean,"tipo":"gasto"|"ingreso"|null,"monto":number|null,"categoria":string|null,"confianza":number}';

  try {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 200,
      system,
      messages: [{ role: "user", content: texto }],
    });
    const raw = resp.content?.[0]?.type === "text" ? resp.content[0].text : "";
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    return JSON.parse(json);
  } catch (e) {
    log.error({ err: String(e) }, "falló la IA");
    return { esMovimiento: false, motivo: "error_ia" };
  }
}

// --------------------------- Manejo de un mensaje ---------------------------
async function manejarMensaje(sock, jid, texto, pushName) {
  await logMensaje({ jid, rol: "cliente", texto, cliente: pushName || null });

  const estado = (await api("/api/bot-whatsapp/estado")).data;
  if (estado?.pausado) {
    log.info({ jid }, "IA pausada — sólo se registró el mensaje");
    return;
  }
  if (bloqueadas.has(jid)) {
    log.info({ jid }, "conversación bloqueada — la maneja una persona");
    return;
  }

  const ctx = (await api(`/api/bot-whatsapp/contexto?numero=${encodeURIComponent(jid)}`)).data;
  const categorias = ctx?.categorias || [];

  if (!ctx?.usuario || !ctx.usuario.puedeCargar) {
    await responder(sock, jid, "rol de sistema",
      "Este número todavía no está habilitado para cargar movimientos. Pedile al dueño que lo dé de alta en el panel.");
    return;
  }

  const r = await interpretarMensaje(texto, categorias);

  if (!r || !r.esMovimiento) {
    await responder(sock, jid, "bot",
      "Puedo anotar gastos e ingresos de la caja. Escribime algo como \"gasté 15000 en nafta\" o \"cobré 45000 de una venta\".");
    return;
  }

  const faltaAlgo =
    !r.tipo || !Number.isFinite(r.monto) || r.monto <= 0 || !r.categoria || (r.confianza ?? 0) < CONFIANZA_MINIMA;

  if (faltaAlgo) {
    const motivo = !Number.isFinite(r.monto) || r.monto <= 0
      ? "no se entendió el monto"
      : !r.categoria
      ? "no se entendió la categoría"
      : "los datos no son claros";
    await escalar(jid, motivo);
    return;
  }

  const alta = await api("/api/bot-whatsapp/movimiento", {
    method: "POST",
    body: {
      numero: jid,
      tipo: r.tipo,
      monto: Math.round(r.monto),
      categoriaNombre: r.categoria,
      nota: texto.slice(0, 200),
    },
  });

  if (alta.status === 403) {
    await responder(sock, jid, "rol de sistema",
      "Este número no está habilitado para cargar movimientos.");
    return;
  }
  if (!alta.ok) {
    await escalar(jid, alta.data?.motivo || "no se pudo registrar");
    return;
  }

  const mov = alta.data.movimiento;
  const signo = mov.tipo === "ingreso" ? "+" : "−";
  const montoTxt = "$ " + Math.round(mov.monto).toLocaleString("es-AR");
  await responder(
    sock,
    jid,
    "bot",
    `✅ Anotado: ${signo}${montoTxt} en ${alta.data.categoria}.`,
    { movimientoId: mov.id }
  );
}

async function responder(sock, jid, rol, texto, extra = {}) {
  try {
    await sock.sendMessage(jid, { text: texto });
  } catch (e) {
    log.error({ err: String(e), jid }, "no se pudo enviar la respuesta");
  }
  await logMensaje({ jid, rol: rol === "rol de sistema" ? "bot" : rol, texto, ...extra });
}

async function escalar(jid, motivo) {
  bloqueadas.add(jid);
  await logMensaje({ jid, rol: "bot", texto: `(escalado: ${motivo})`, estado: "escalada", motivoEscalado: motivo });
  log.warn({ jid, motivo }, "conversación escalada");
}

// --------------------------- Cola de comandos ---------------------------
function jidDeComando(telefono) {
  const t = String(telefono);
  if (t.includes("@")) return t;
  return `${t.replace(/\D/g, "")}@s.whatsapp.net`;
}

async function procesarComandos(sock) {
  const { data: comandos } = await api("/api/bot-whatsapp/comandos?estado=pendiente");
  if (!Array.isArray(comandos) || comandos.length === 0) return;

  for (const c of comandos) {
    try {
      if (c.tipo === "control") {
        const jid = jidDeComando(c.telefono);
        if (c.mensaje === "reactivar") bloqueadas.delete(jid);
        else bloqueadas.add(jid); // "bloquear"
        await api(`/api/bot-whatsapp/comandos/${c.id}`, { method: "PUT", body: { estado: "enviado" } });
        continue;
      }

      const jid = jidDeComando(c.telefono);
      await sock.sendMessage(jid, { text: c.mensaje });

      if (c.tipo === "manual") {
        bloqueadas.add(jid); // una persona respondió a mano → la IA no vuelve sola
        await logMensaje({ jid, rol: "empleado", texto: c.mensaje });
      } else {
        await logMensaje({ jid, rol: "bot", texto: c.mensaje });
      }
      await api(`/api/bot-whatsapp/comandos/${c.id}`, { method: "PUT", body: { estado: "enviado" } });
    } catch (e) {
      log.error({ err: String(e), comando: c.id }, "falló un comando");
      await api(`/api/bot-whatsapp/comandos/${c.id}`, {
        method: "PUT",
        body: { estado: "error", error: String(e).slice(0, 300) },
      });
    }
  }
}

// --------------------------- Conexión a WhatsApp ---------------------------
let sockActual = null;

async function conectar() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    markOnlineOnConnect: false,
  });
  sockActual = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (u) => {
    const { connection, lastDisconnect, qr } = u;

    if (qr) {
      const dataUrl = await QRCode.toDataURL(qr);
      await reportarEstado({ qr: dataUrl, conectado: false });
      log.info("QR nuevo — escanealo desde el panel (/dinero/bot)");
    }

    if (connection === "open") {
      await reportarEstado({ conectado: true, qr: null });
      log.info("Conectado a WhatsApp");
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      await reportarEstado({ conectado: false });
      if (code === DisconnectReason.loggedOut) {
        log.warn("Sesión cerrada (logout). Borro credenciales y espero un QR nuevo.");
        try {
          rmSync(AUTH_DIR, { recursive: true, force: true });
        } catch {}
        setTimeout(conectar, 2000);
      } else {
        log.warn({ code }, "Conexión caída, reintentando…");
        setTimeout(conectar, 3000);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      const jid = msg.key.remoteJid || "";
      if (jid.endsWith("@g.us") || jid === "status@broadcast" || jid.endsWith("@broadcast")) continue;
      const texto =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        "";
      if (!texto.trim()) continue;
      try {
        await manejarMensaje(sock, jid, texto.trim(), msg.pushName);
      } catch (e) {
        log.error({ err: String(e), jid }, "error manejando un mensaje");
      }
    }
  });

  return sock;
}

// --------------------------- Bucle de control ---------------------------
async function bucleControl() {
  try {
    const { data: estado } = await api("/api/bot-whatsapp/estado");
    if (!estado) return;

    // El panel pidió apagar la conexión entera.
    if (estado.conectar === false && sockActual) {
      log.info("El panel pidió apagar la conexión.");
      try {
        await sockActual.end(undefined);
      } catch {}
      sockActual = null;
      await reportarEstado({ conectado: false });
    }
    // El panel pidió prenderla de nuevo.
    if (estado.conectar === true && !sockActual) {
      log.info("El panel pidió prender la conexión.");
      await conectar();
    }
    // El panel pidió cambiar de número (logout de verdad).
    if (estado.cambiarNumeroSolicitado && sockActual) {
      log.info("El panel pidió cambiar de número — cerrando sesión.");
      try {
        await sockActual.logout();
      } catch {}
      try {
        rmSync(AUTH_DIR, { recursive: true, force: true });
      } catch {}
      sockActual = null;
      await reportarEstado({ conectado: false, cambiarNumeroSolicitado: false });
      setTimeout(conectar, 1500);
    }
  } catch (e) {
    log.error({ err: String(e) }, "error en el bucle de control");
  }
}

// --------------------------- Arranque ---------------------------
log.info({ APP_URL, modelo: ANTHROPIC_MODEL }, "Iniciando bot de Herrería VyV");
if (!existsSync(AUTH_DIR)) log.info("Primera vez: se va a generar un QR para vincular el número.");

await conectar();

setInterval(() => sockActual && procesarComandos(sockActual), INTERVALO_COMANDOS_MS);
setInterval(bucleControl, 10000);
