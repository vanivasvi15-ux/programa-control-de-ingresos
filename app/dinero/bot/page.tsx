"use client";
// app/dinero/bot/page.tsx
//
// Panel para ver y controlar el bot de WhatsApp (proceso aparte
// "bot-whatsapp", Baileys + IA). El bot le reporta acá su conexión/QR y
// cada mensaje por HTTP (/api/bot-whatsapp/*); este panel sólo lee y
// escribe esa base, nunca se conecta directo a WhatsApp.

import { useCallback, useEffect, useRef, useState } from "react";
import Encabezado from "@/components/Encabezado";
import Icono from "@/components/Icono";
import { Tarjeta, Boton, Chip, EstadoVacio, Modal, Campo, inputClase } from "@/components/ui";
import Switch from "@/components/Switch";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useUsuario } from "@/components/UsuarioContext";
import { formatearPesos } from "@/lib/formato";

type Estado = {
  pausado: boolean;
  conectado: boolean;
  qr: string | null;
  conectar: boolean;
  cambiarNumeroSolicitado: boolean;
};
type Conversacion = {
  jid: string;
  cliente: string | null;
  estado: "activa" | "escalada" | "finalizada";
  motivoEscalado: string | null;
  movimientoId: number | null;
  movimiento: { id: number; tipo: string; monto: number; fecha: string; categoriaNombre: string } | null;
  ultimoMensaje: { rol: string; texto: string; creado: string } | null;
  creado: string;
  actualizado: string;
};
type Mensaje = { id: number; rol: "cliente" | "bot" | "empleado"; texto: string; creado: string };
type Respuesta = { id: number; etiqueta: string; texto: string; orden: number };

const ETIQUETA_ESTADO: Record<Conversacion["estado"], { txt: string; color: "verde" | "rojo" | "neutro" }> = {
  activa: { txt: "Activa", color: "verde" },
  escalada: { txt: "Necesita atención", color: "rojo" },
  finalizada: { txt: "Finalizada", color: "neutro" },
};

function numeroLegible(jid: string) {
  return "+" + jid.split("@")[0].replace(/\D/g, "");
}
function hora(iso: string) {
  return iso?.slice(11, 16) ?? "";
}

export default function BotPage() {
  const usuario = useUsuario();
  const esDueno = usuario.rol === "dueño";
  const [estado, setEstado] = useState<Estado | null>(null);
  const [convs, setConvs] = useState<Conversacion[]>([]);
  const [jidSel, setJidSel] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [respuestas, setRespuestas] = useState<Respuesta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [cambiarNumero, setCambiarNumero] = useState(false);
  const [gestionarRptas, setGestionarRptas] = useState(false);
  const escaladasVistas = useRef<Set<string>>(new Set());

  const cargar = useCallback(async () => {
    const [rE, rC, rR] = await Promise.all([
      fetch("/api/bot-whatsapp/estado"),
      fetch("/api/bot-whatsapp/conversaciones"),
      fetch("/api/bot-whatsapp/respuestas"),
    ]);
    if (rE.ok) setEstado(await rE.json());
    if (rC.ok) {
      const data: Conversacion[] = await rC.json();
      setConvs(data);
      // Notificación del navegador cuando aparece una conversación
      // escalada nueva.
      for (const c of data) {
        if (c.estado === "escalada" && !escaladasVistas.current.has(c.jid)) {
          escaladasVistas.current.add(c.jid);
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification("WhatsApp: necesita atención", {
              body: `${c.cliente ?? numeroLegible(c.jid)} — ${c.motivoEscalado ?? "la IA no entendió algo"}`,
            });
          }
        }
        if (c.estado !== "escalada") escaladasVistas.current.delete(c.jid);
      }
    }
    if (rR.ok) setRespuestas(await rR.json());
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
    const t = setInterval(cargar, 5000);
    return () => clearInterval(t);
  }, [cargar]);

  const cargarMensajes = useCallback(async (jid: string) => {
    const r = await fetch(`/api/bot-whatsapp/conversaciones/${encodeURIComponent(jid)}/mensajes`);
    if (r.ok) setMensajes(await r.json());
  }, []);

  useEffect(() => {
    if (!jidSel) return;
    cargarMensajes(jidSel);
    const t = setInterval(() => cargarMensajes(jidSel), 5000);
    return () => clearInterval(t);
  }, [jidSel, cargarMensajes]);

  async function patchEstado(campos: Partial<Estado>) {
    setTrabajando(true);
    await fetch("/api/bot-whatsapp/estado", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(campos),
    });
    await cargar();
    setTrabajando(false);
  }

  async function responderCon(texto: string) {
    if (!jidSel) return;
    await fetch("/api/bot-whatsapp/comandos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefono: jidSel, mensaje: texto, tipo: "manual" }),
    });
    cargarMensajes(jidSel);
  }

  async function cambiarEstadoConv(jid: string, e: Conversacion["estado"]) {
    await fetch(`/api/bot-whatsapp/conversaciones/${encodeURIComponent(jid)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: e }),
    });
    cargar();
  }

  const convSel = convs.find((c) => c.jid === jidSel) ?? null;
  const escaladas = convs.filter((c) => c.estado === "escalada").length;

  if (!esDueno) {
    return (
      <div>
        <Encabezado titulo="Bot de WhatsApp" />
        <Tarjeta className="p-8 text-center text-sm text-[var(--color-muted)]">
          Esta sección es sólo para el dueño.
        </Tarjeta>
      </div>
    );
  }

  return (
    <div>
      <Encabezado
        titulo="Bot de WhatsApp"
        subtitulo="Carga de gastos e ingresos por mensaje"
        acciones={
          escaladas > 0 && (
            <Chip color="rojo">
              <Icono nombre="alerta" size={12} /> {escaladas} necesita{escaladas > 1 ? "n" : ""} atención
            </Chip>
          )
        }
      />

      {cargando ? (
        <Tarjeta className="h-40 animate-pulse bg-[var(--color-surface-2)]" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          {/* Columna izquierda: estado + lista */}
          <div className="space-y-4">
            {/* Estado / conexión */}
            <Tarjeta className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-bold">Conexión</span>
                <Chip color={estado?.conectado ? "verde" : "neutro"}>
                  {estado?.conectado ? "Conectado" : "Desconectado"}
                </Chip>
              </div>

              {!estado?.conectado && estado?.conectar && estado?.qr && (
                <div className="mb-3 rounded-lg border border-[var(--color-border)] bg-white p-2">
                  {/* El bot reporta el QR ya como imagen (data URL) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={estado.qr} alt="QR para vincular WhatsApp" className="mx-auto h-44 w-44" />
                  <p className="mt-1 text-center text-[11px] text-[var(--color-muted)]">
                    Escanealo desde WhatsApp → Dispositivos vinculados
                  </p>
                </div>
              )}
              {!estado?.conectado && estado?.conectar && !estado?.qr && (
                <p className="mb-3 rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-muted)]">
                  Esperando el QR del bot… (¿está corriendo <code>node index.js</code> en la carpeta
                  <code> bot-whatsapp</code>?)
                </p>
              )}

              <label className="flex items-center justify-between py-2 text-sm">
                <span>
                  Conexión a WhatsApp
                  <span className="block text-[11px] text-[var(--color-muted)]">
                    apagala para desvincular sin perder el número
                  </span>
                </span>
                <Switch
                  activo={!!estado?.conectar}
                  disabled={trabajando}
                  onChange={(v) => patchEstado({ conectar: v })}
                />
              </label>

              <label className="flex items-center justify-between border-t border-[var(--color-border)] py-2 text-sm">
                <span>
                  Pausar la IA
                  <span className="block text-[11px] text-[var(--color-muted)]">
                    sigue conectado y guarda los mensajes, pero no responde solo
                  </span>
                </span>
                <Switch
                  activo={!!estado?.pausado}
                  disabled={trabajando}
                  onChange={(v) => patchEstado({ pausado: v })}
                />
              </label>

              <div className="border-t border-[var(--color-border)] pt-3">
                {estado?.cambiarNumeroSolicitado ? (
                  <p className="text-xs text-[var(--color-warn)]">
                    Pedido enviado. El bot va a cerrar sesión para que puedas vincular otro número.
                  </p>
                ) : (
                  <Boton
                    variante="contorno"
                    tamano="sm"
                    icono="enchufe"
                    onClick={() => setCambiarNumero(true)}
                    className="w-full"
                  >
                    Cambiar de número
                  </Boton>
                )}
              </div>
            </Tarjeta>

            {/* Lista de conversaciones */}
            <Tarjeta className="overflow-hidden">
              <div className="border-b border-[var(--color-border)] px-4 py-2.5 text-sm font-bold">
                Conversaciones
              </div>
              {convs.length === 0 ? (
                <EstadoVacio icono="chat" titulo="Todavía nadie escribió" />
              ) : (
                <div className="max-h-[420px] divide-y divide-[var(--color-border)] overflow-y-auto">
                  {convs.map((c) => (
                    <button
                      key={c.jid}
                      onClick={() => setJidSel(c.jid)}
                      className={`flex w-full flex-col gap-0.5 px-4 py-2.5 text-left transition-colors hover:bg-[var(--color-surface-2)] ${
                        jidSel === c.jid ? "bg-[var(--color-surface-2)]" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">
                          {c.cliente ?? numeroLegible(c.jid)}
                        </span>
                        <Chip color={ETIQUETA_ESTADO[c.estado].color}>
                          {ETIQUETA_ESTADO[c.estado].txt}
                        </Chip>
                      </div>
                      {c.ultimoMensaje && (
                        <span className="truncate text-xs text-[var(--color-muted)]">
                          {c.ultimoMensaje.rol === "cliente" ? "" : "→ "}
                          {c.ultimoMensaje.texto}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </Tarjeta>

            <button
              onClick={() => setGestionarRptas(true)}
              className="text-xs font-medium text-[var(--color-accent)] hover:underline"
            >
              Editar respuestas predeterminadas
            </button>
          </div>

          {/* Columna derecha: conversación */}
          <Tarjeta className="flex min-h-[500px] flex-col overflow-hidden">
            {!convSel ? (
              <EstadoVacio
                icono="chat"
                titulo="Elegí una conversación"
                detalle="Cuando alguien habilitado escriba “gasté 15000 en nafta”, el bot lo anota solo. Si no entiende, la conversación aparece acá para que respondas."
              />
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
                  <div>
                    <p className="text-sm font-bold">{convSel.cliente ?? numeroLegible(convSel.jid)}</p>
                    <p className="text-xs text-[var(--color-muted)]">{numeroLegible(convSel.jid)}</p>
                  </div>
                  <div className="flex gap-1.5">
                    {convSel.estado !== "activa" && (
                      <Boton tamano="sm" variante="contorno" onClick={() => cambiarEstadoConv(convSel.jid, "activa")}>
                        Reactivar IA
                      </Boton>
                    )}
                    {convSel.estado !== "finalizada" && (
                      <Boton tamano="sm" variante="fantasma" onClick={() => cambiarEstadoConv(convSel.jid, "finalizada")}>
                        Finalizar
                      </Boton>
                    )}
                  </div>
                </div>

                {convSel.estado === "escalada" && (
                  <p className="border-b border-[var(--color-border)] bg-[var(--color-expense-soft)] px-4 py-2 text-xs text-[var(--color-expense)]">
                    La IA no entendió: {convSel.motivoEscalado ?? "revisá el mensaje"}. Respondé con
                    un mensaje predeterminado.
                  </p>
                )}
                {convSel.movimiento && (
                  <p className="border-b border-[var(--color-border)] bg-[var(--color-income-soft)] px-4 py-2 text-xs text-[var(--color-income)]">
                    Anotó: {convSel.movimiento.tipo === "ingreso" ? "+" : "−"}
                    {formatearPesos(convSel.movimiento.monto)} en {convSel.movimiento.categoriaNombre} (
                    {convSel.movimiento.fecha})
                  </p>
                )}

                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                  {mensajes.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.rol === "cliente" ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-3 py-1.5 text-sm ${
                          m.rol === "cliente"
                            ? "bg-[var(--color-surface-2)]"
                            : m.rol === "empleado"
                            ? "bg-[var(--color-accent)] text-white"
                            : "bg-[var(--color-income)] text-white"
                        }`}
                      >
                        {m.rol === "empleado" && (
                          <span className="mb-0.5 block text-[10px] opacity-80">respuesta a mano</span>
                        )}
                        <span className="whitespace-pre-wrap">{m.texto}</span>
                        <span className="mt-0.5 block text-right text-[10px] opacity-70">
                          {hora(m.creado)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {mensajes.length === 0 && (
                    <p className="text-sm text-[var(--color-muted)]">Sin mensajes.</p>
                  )}
                </div>

                <div className="border-t border-[var(--color-border)] p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase text-[var(--color-muted)]">
                    Responder con un mensaje predeterminado
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {respuestas.map((r) => (
                      <Boton key={r.id} tamano="sm" variante="contorno" onClick={() => responderCon(r.texto)}>
                        {r.etiqueta}
                      </Boton>
                    ))}
                    {respuestas.length === 0 && (
                      <span className="text-xs text-[var(--color-muted)]">
                        No hay ninguno cargado.
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </Tarjeta>
        </div>
      )}

      {cambiarNumero && (
        <ConfirmDialog
          titulo="Cambiar de número"
          textoConfirmar="Sí, cambiar"
          mensaje="El bot va a cerrar la sesión actual de WhatsApp. Después vas a tener que escanear el QR con el número nuevo. ¿Seguimos?"
          onConfirmar={async () => {
            await patchEstado({ cambiarNumeroSolicitado: true });
            setCambiarNumero(false);
          }}
          onCerrar={() => setCambiarNumero(false)}
        />
      )}

      {gestionarRptas && (
        <RespuestasModal
          respuestas={respuestas}
          onCerrar={() => setGestionarRptas(false)}
          onCambio={cargar}
        />
      )}
    </div>
  );
}

function RespuestasModal({
  respuestas,
  onCerrar,
  onCambio,
}: {
  respuestas: Respuesta[];
  onCerrar: () => void;
  onCambio: () => void;
}) {
  const [etiqueta, setEtiqueta] = useState("");
  const [texto, setTexto] = useState("");

  async function crear() {
    if (!etiqueta.trim() || !texto.trim()) return;
    await fetch("/api/bot-whatsapp/respuestas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ etiqueta, texto }),
    });
    setEtiqueta("");
    setTexto("");
    onCambio();
  }
  async function borrar(id: number) {
    await fetch(`/api/bot-whatsapp/respuestas/${id}`, { method: "DELETE" });
    onCambio();
  }

  return (
    <Modal titulo="Respuestas predeterminadas" onCerrar={onCerrar}>
      <p className="mb-3 text-xs text-[var(--color-muted)]">
        Son los únicos textos que se pueden mandar a mano (no hay caja de texto libre, para evitar
        reenvíos en loop).
      </p>
      <div className="space-y-2">
        {respuestas.map((r) => (
          <div key={r.id} className="rounded-lg border border-[var(--color-border)] p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{r.etiqueta}</span>
              <button
                onClick={() => borrar(r.id)}
                className="text-[var(--color-muted)] hover:text-[var(--color-expense)]"
              >
                <Icono nombre="basura" size={14} />
              </button>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--color-muted)]">{r.texto}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2 border-t border-[var(--color-border)] pt-4">
        <Campo label="Etiqueta (lo que se ve en el botón)">
          <input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} className={inputClase} />
        </Campo>
        <Campo label="Texto del mensaje">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={2}
            className={inputClase}
          />
        </Campo>
        <Boton variante="primario" icono="mas" onClick={crear}>
          Agregar
        </Boton>
      </div>
    </Modal>
  );
}
