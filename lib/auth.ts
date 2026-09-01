// lib/auth.ts
//
// Todo lo relacionado al login vive acá: hashear contraseñas, crear
// sesiones cuando alguien inicia sesión, y validar el token de sesión que
// llega en la cookie del navegador. Mismo patrón que el POS de Steve's
// Burger.
//
// Usa "scrypt", que viene incluido en Node (módulo "crypto"), así que no
// hace falta instalar ni compilar nada extra.

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "./db";

export const COOKIE_NAME = "vyv_session";
const DIAS_DURACION_SESION = 7;

export type Rol = "dueño" | "encargado" | "contador";

export type Usuario = {
  id: number;
  nombre: string;
  nombre_usuario: string;
  rol: Rol;
};

// Convierte una contraseña en texto plano en hash + salt para guardar.
export function hashearPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

// Compara una contraseña ingresada contra el hash guardado. Usa
// timingSafeEqual para que no se pueda "adivinar" midiendo cuánto tarda.
function passwordCoincide(password: string, hashGuardado: string, salt: string) {
  const hashIngresado = scryptSync(password, salt, 64);
  const bufferGuardado = Buffer.from(hashGuardado, "hex");
  if (hashIngresado.length !== bufferGuardado.length) return false;
  return timingSafeEqual(hashIngresado, bufferGuardado);
}

// Verifica usuario + contraseña contra la base. Devuelve el usuario si es
// correcto, o null si no existe / está inactivo / la clave no coincide.
export function verificarLogin(nombreUsuario: string, password: string): Usuario | null {
  const fila = db
    .prepare(
      `SELECT id, nombre, nombre_usuario, password_hash, password_salt, rol
       FROM usuarios WHERE nombre_usuario = ? AND activo = 1`
    )
    .get(nombreUsuario) as
    | {
        id: number;
        nombre: string;
        nombre_usuario: string;
        password_hash: string;
        password_salt: string;
        rol: Rol;
      }
    | undefined;

  if (!fila) return null;
  if (!passwordCoincide(password, fila.password_hash, fila.password_salt)) return null;

  return { id: fila.id, nombre: fila.nombre, nombre_usuario: fila.nombre_usuario, rol: fila.rol };
}

// Crea una sesión nueva y devuelve el token para guardar en la cookie.
export function crearSesion(usuarioId: number): string {
  const token = randomBytes(32).toString("hex");
  const expira = new Date(Date.now() + DIAS_DURACION_SESION * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`INSERT INTO sesiones (token, usuario_id, expira) VALUES (?, ?, ?)`).run(
    token,
    usuarioId,
    expira
  );
  return token;
}

// Dado el token de la cookie, devuelve el usuario dueño de esa sesión, o
// null si el token no existe o ya venció.
export function obtenerUsuarioDeSesion(token: string | undefined): Usuario | null {
  if (!token) return null;

  const fila = db
    .prepare(
      `SELECT usuarios.id, usuarios.nombre, usuarios.nombre_usuario, usuarios.rol, sesiones.expira
       FROM sesiones
       JOIN usuarios ON usuarios.id = sesiones.usuario_id
       WHERE sesiones.token = ? AND usuarios.activo = 1`
    )
    .get(token) as
    | { id: number; nombre: string; nombre_usuario: string; rol: Rol; expira: string }
    | undefined;

  if (!fila) return null;
  if (new Date(fila.expira).getTime() < Date.now()) {
    db.prepare(`DELETE FROM sesiones WHERE token = ?`).run(token);
    return null;
  }

  return { id: fila.id, nombre: fila.nombre, nombre_usuario: fila.nombre_usuario, rol: fila.rol };
}

export function borrarSesion(token: string | undefined) {
  if (!token) return;
  db.prepare(`DELETE FROM sesiones WHERE token = ?`).run(token);
}

// Atajo para las API Routes: lee la cookie de la request actual y
// devuelve el usuario logueado (o null). Con esto cada endpoint resuelve
// permisos del lado del servidor sin confiar en nada que mande el cliente.
export async function usuarioActual(): Promise<Usuario | null> {
  const cookieStore = await cookies();
  return obtenerUsuarioDeSesion(cookieStore.get(COOKIE_NAME)?.value);
}
