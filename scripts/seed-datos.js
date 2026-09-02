// scripts/seed-datos.js
//
// BORRA TODOS LOS DATOS de data.db (movimientos, categorías, alertas,
// usuarios, conversaciones del bot) y los reemplaza por los de un archivo
// JSON de semilla (por defecto scripts/seed-agosto-2026.json).
//
//   node scripts/seed-datos.js --reset
//   node scripts/seed-datos.js --reset scripts/otro-seed.json
//
// El schema NO se toca (lo crea lib/db.ts al arrancar la app). Este
// script sólo vacía y vuelve a llenar las tablas de datos.

const { DatabaseSync } = require("node:sqlite");
const { randomBytes, scryptSync } = require("crypto");
const path = require("path");
const fs = require("fs");

const args = process.argv.slice(2);
if (!args.includes("--reset")) {
  console.log(
    "Esto BORRA todos los datos actuales. Si estás seguro:\n" +
      "  node scripts/seed-datos.js --reset [ruta-del-json]"
  );
  process.exit(1);
}
const jsonPath = args.find((a) => a.endsWith(".json")) || "scripts/seed-agosto-2026.json";
const abs = path.isAbsolute(jsonPath) ? jsonPath : path.join(process.cwd(), jsonPath);
if (!fs.existsSync(abs)) {
  console.log(`No encontré el JSON: ${abs}`);
  process.exit(1);
}
const seed = JSON.parse(fs.readFileSync(abs, "utf-8"));

const db = new DatabaseSync(path.join(process.cwd(), "data.db"));
db.exec("PRAGMA busy_timeout = 5000;");

function hashearClave(clave) {
  const salt = randomBytes(16).toString("hex");
  return { hash: scryptSync(clave, salt, 64).toString("hex"), salt };
}

db.exec("BEGIN");
try {
  // --- vaciar (orden respetando foreign keys) ---
  for (const t of [
    "bot_conversaciones",
    "bot_mensajes",
    "bot_comandos",
    "bot_avisos_log",
    "movimientos",
    "alertas_config",
    "sesiones",
    "categorias",
    "usuarios",
  ]) {
    db.exec(`DELETE FROM ${t}`);
  }
  db.exec("DELETE FROM sqlite_sequence"); // reinicia los AUTOINCREMENT
  db.exec("UPDATE bot_whatsapp_estado SET pausado = 0, conectado = 0, qr = NULL");

  // --- usuarios ---
  const claveProvisoria = seed.meta?.clave_provisoria || "cambiar123";
  const insUsuario = db.prepare(
    `INSERT INTO usuarios (nombre, nombre_usuario, password_hash, password_salt, rol)
     VALUES (?, ?, ?, ?, ?)`
  );
  const usuarioId = {};
  for (const u of seed.usuarios) {
    const { hash: h, salt } = hashearClave(claveProvisoria);
    const r = insUsuario.run(u.nombre, u.nombre_usuario, h, salt, u.rol || "encargado");
    usuarioId[u.nombre_usuario] = Number(r.lastInsertRowid);
  }

  // --- categorías ---
  const insCat = db.prepare(`INSERT INTO categorias (nombre, tipo) VALUES (?, ?)`);
  const catId = {};
  for (const c of seed.categorias) {
    const r = insCat.run(c.nombre, c.tipo);
    catId[`${c.nombre}||${c.tipo}`] = Number(r.lastInsertRowid);
  }

  // --- movimientos ---
  const insMov = db.prepare(
    `INSERT INTO movimientos (tipo, monto, categoria_id, fecha, recurrencia, origen, usuario_id, estado, nota)
     VALUES (?, ?, ?, ?, 'unico', 'panel', ?, 'activo', ?)`
  );
  let n = 0;
  for (const m of seed.movimientos) {
    const cid = catId[`${m.categoria}||${m.tipo}`];
    const uid = usuarioId[m.usuario] ?? null;
    if (!cid) throw new Error(`Categoría sin id: ${m.categoria} (${m.tipo})`);
    insMov.run(m.tipo, Math.round(m.monto), cid, m.fecha, uid, m.nota ?? null);
    n++;
  }

  db.exec("COMMIT");
  console.log("Datos reemplazados ✔");
  console.log(`  usuarios:     ${seed.usuarios.length}  (clave provisoria: ${claveProvisoria})`);
  console.log(`  categorías:   ${seed.categorias.length}`);
  console.log(`  movimientos:  ${n}`);
  const tot = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto END),0) AS ing,
         COALESCE(SUM(CASE WHEN tipo='gasto'   THEN monto END),0) AS gas
       FROM movimientos`
    )
    .get();
  console.log(`  ingresos:     ${tot.ing.toLocaleString("es-AR")}`);
  console.log(`  gastos:       ${tot.gas.toLocaleString("es-AR")}`);
  console.log(`  neto:         ${(tot.ing - tot.gas).toLocaleString("es-AR")}`);
} catch (e) {
  db.exec("ROLLBACK");
  console.error("Falló, no se cambió nada:", e);
  process.exit(1);
}
