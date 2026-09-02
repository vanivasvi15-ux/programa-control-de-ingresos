// scripts/cron-alertas.js
//
// Tarea programada — se corre UNA vez por día (Programador de tareas de
// Windows, o cron). Revisa alertas_config y, para las que corresponde,
// ENCOLA un mensaje en bot_comandos (tipo "aviso"). NUNCA le pega directo
// a WhatsApp: el bot (proceso aparte) es el que después lo manda.
//
//   node scripts/cron-alertas.js
//
// Anti-duplicado: bot_avisos_log guarda (clave, fecha) — si ya se encoló
// ese aviso hoy, no se repite.

const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const db = new DatabaseSync(path.join(process.cwd(), "data.db"));
db.exec("PRAGMA busy_timeout = 5000;");

// --- helpers de fecha ---
const ahora = new Date();
const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(
  ahora.getDate()
).padStart(2, "0")}`;
const mesYM = hoy.slice(0, 7);
const diaSemana = ahora.getDay(); // 0 = domingo, 1 = lunes...
const diaMes = ahora.getDate();

function pesos(n) {
  return "$ " + Math.round(n).toLocaleString("es-AR");
}
function diasEntre(desde, hasta) {
  const [a1, m1, d1] = desde.split("-").map(Number);
  const [a2, m2, d2] = hasta.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}
function textoDias(d) {
  if (d === 0) return "vence hoy";
  if (d === 1) return "vence mañana";
  if (d > 1) return `en ${d} días`;
  if (d === -1) return "venció ayer";
  return `venció hace ${Math.abs(d)} días`;
}
function restarDias(n) {
  const d = new Date(ahora);
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// --- cola ---
const yaEncolado = db.prepare(`SELECT 1 FROM bot_avisos_log WHERE clave = ? AND fecha = ?`);
const marcarEncolado = db.prepare(
  `INSERT OR IGNORE INTO bot_avisos_log (clave, fecha) VALUES (?, ?)`
);
const jidDeNumero = db.prepare(
  `SELECT jid FROM bot_conversaciones WHERE jid LIKE ? ORDER BY actualizado DESC LIMIT 1`
);
const insertarComando = db.prepare(
  `INSERT INTO bot_comandos (telefono, mensaje, tipo) VALUES (?, ?, 'aviso')`
);

function encolar(clave, numeroWhatsapp, mensaje) {
  if (!numeroWhatsapp) {
    console.log(
      `  · [skip] "${clave}": sin destinatario con WhatsApp (asigná uno en Configuración → Alertas)`
    );
    return;
  }
  if (yaEncolado.get(clave, hoy)) {
    console.log(`  · [ya estaba] "${clave}"`);
    return;
  }
  const digitos = String(numeroWhatsapp).replace(/\D/g, "");
  const conv = jidDeNumero.get(`${digitos}@%`);
  const destino = conv ? conv.jid : digitos;
  insertarComando.run(destino, mensaje);
  marcarEncolado.run(clave, hoy);
  console.log(`  · ENCOLADO "${clave}" -> ${destino}`);
}

// --- datos de referencia ---
const alertas = db
  .prepare(`SELECT * FROM alertas_config WHERE activo = 1 ORDER BY id`)
  .all();
const usuarioWpp = db.prepare(`SELECT numero_whatsapp FROM usuarios WHERE id = ? AND activo = 1`);

console.log(`Cron de alertas — ${hoy} (${alertas.length} alertas activas)`);

for (const a of alertas) {
  let params = {};
  try {
    params = JSON.parse(a.parametros_json || "{}");
  } catch {
    params = {};
  }
  const destino = a.usuario_id_destino ? usuarioWpp.get(a.usuario_id_destino)?.numero_whatsapp : null;

  if (a.tipo === "limite_categoria") {
    const cat = db.prepare(`SELECT nombre FROM categorias WHERE id = ?`).get(params.categoriaId);
    if (!cat || !params.monto) continue;
    const g = db
      .prepare(
        `SELECT COALESCE(SUM(monto), 0) AS t FROM movimientos
         WHERE recurrencia = 'unico' AND estado = 'activo' AND tipo = 'gasto'
           AND categoria_id = ? AND fecha LIKE ?`
      )
      .get(params.categoriaId, `${mesYM}-%`).t;
    const pct = Math.round((g / params.monto) * 100);
    if (g >= params.monto) {
      encolar(
        `limite:${a.id}`,
        destino,
        `⚠️ Límite de "${cat.nombre}": llevás ${pesos(g)} este mes, el tope es ${pesos(
          params.monto
        )} (${pct}%).`
      );
    }
  } else if (a.tipo === "fijo_por_vencer") {
    const diasAntes = Number(params.diasAntes ?? 3);
    const fijos = db
      .prepare(
        `SELECT m.id, m.tipo, m.monto, m.proxima_fecha, c.nombre AS cat
         FROM movimientos m JOIN categorias c ON c.id = m.categoria_id
         WHERE m.recurrencia != 'unico' AND m.estado = 'activo' AND m.proxima_fecha IS NOT NULL`
      )
      .all();
    for (const f of fijos) {
      const dr = diasEntre(hoy, f.proxima_fecha);
      if (dr > diasAntes) continue;
      const registrado = db
        .prepare(
          `SELECT 1 FROM movimientos WHERE generado_por_fijo_id = ? AND fecha LIKE ? LIMIT 1`
        )
        .get(f.id, `${mesYM}-%`);
      if (registrado) continue;
      const signo = f.tipo === "ingreso" ? "cobrar" : "pagar";
      encolar(
        `fijo:${f.id}:${f.proxima_fecha}`,
        destino,
        `🔔 Fijo por ${signo}: "${f.cat}" ${pesos(f.monto)} — ${textoDias(dr)} (${f.proxima_fecha}).`
      );
    }
  } else if (a.tipo === "resumen_periodico") {
    const esSemanal = params.periodo === "semanal";
    const corresponde = esSemanal ? diaSemana === 1 : diaMes === 1;
    if (!corresponde) continue;
    const desde = esSemanal ? restarDias(7) : restarDias(30);
    const r = db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto END),0) AS ing,
           COALESCE(SUM(CASE WHEN tipo='gasto'   THEN monto END),0) AS gas
         FROM movimientos
         WHERE recurrencia='unico' AND estado='activo' AND fecha >= ? AND fecha <= ?`
      )
      .get(desde, hoy);
    const bal = r.ing - r.gas;
    encolar(
      `resumen:${a.id}:${hoy}`,
      destino,
      `📊 Resumen ${esSemanal ? "de la semana" : "del mes"} (${desde} a ${hoy}):\n` +
        `Ingresos: ${pesos(r.ing)}\nGastos: ${pesos(r.gas)}\nBalance: ${pesos(bal)}`
    );
  } else if (a.tipo === "inactividad") {
    const dias = Number(params.dias ?? 7);
    const ultima = db
      .prepare(
        `SELECT MAX(fecha) AS f FROM movimientos WHERE recurrencia='unico' AND estado='activo'`
      )
      .get().f;
    const sinCargarHace = ultima ? diasEntre(ultima, hoy) : 9999;
    if (sinCargarHace >= dias) {
      encolar(
        `inactividad:${a.id}`,
        destino,
        `📭 Hace ${
          ultima ? sinCargarHace + " días" : "un buen rato"
        } que no se carga ningún movimiento en la caja.`
      );
    }
  }
}

console.log("Listo.");
