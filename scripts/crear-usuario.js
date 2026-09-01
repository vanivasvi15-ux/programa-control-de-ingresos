// scripts/crear-usuario.js
//
// Crea un usuario para poder entrar al panel (/login).
// Uso:
//
//   node scripts/crear-usuario.js "<nombre para mostrar>" <usuario> <contraseña> [rol]
//
// Ejemplos:
//   node scripts/crear-usuario.js "Vani" vani "miClaveSegura123" dueño
//   node scripts/crear-usuario.js "Encargado Taller" taller "otraClave123" encargado
//
// rol: dueño (default) | encargado | contador
// Se puede correr varias veces, uno por persona.

const { DatabaseSync } = require("node:sqlite");
const { randomBytes, scryptSync } = require("crypto");
const path = require("path");

const [, , nombre, nombreUsuario, password, rolArg] = process.argv;
const ROLES = ["dueño", "encargado", "contador"];
const rol = rolArg || "dueño";

if (!nombre || !nombreUsuario || !password) {
  console.log(
    'Uso: node scripts/crear-usuario.js "<nombre>" <usuario> <contraseña> [dueño|encargado|contador]'
  );
  process.exit(1);
}
if (!ROLES.includes(rol)) {
  console.log(`Rol inválido: "${rol}". Tiene que ser uno de: ${ROLES.join(", ")}`);
  process.exit(1);
}
if (password.length < 6) {
  console.log("La contraseña tiene que tener al menos 6 caracteres.");
  process.exit(1);
}

const db = new DatabaseSync(path.join(process.cwd(), "data.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    nombre_usuario TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'encargado'
      CHECK (rol IN ('dueño', 'encargado', 'contador')),
    numero_whatsapp TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    creado TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`);

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64).toString("hex");

try {
  db.prepare(
    `INSERT INTO usuarios (nombre, nombre_usuario, password_hash, password_salt, rol)
     VALUES (?, ?, ?, ?, ?)`
  ).run(nombre, nombreUsuario, hash, salt, rol);
  console.log(
    `Usuario "${nombreUsuario}" (${rol}) creado. Ya podés entrar en /login con esa clave.`
  );
} catch (error) {
  if (String(error).includes("UNIQUE")) {
    console.log(`Ya existe un usuario con el nombre "${nombreUsuario}". Elegí otro.`);
  } else {
    throw error;
  }
}
