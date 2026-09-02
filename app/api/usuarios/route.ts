import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashearPassword, usuarioActual, type Rol } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ROLES: Rol[] = ["dueño", "encargado", "contador"];

// GET /api/usuarios -> lista el personal. Nunca devuelve hash/salt.
// Cualquiera logueado puede leerla (el panel la usa para el filtro "por
// usuario" y para elegir destinatario de alertas).
export async function GET() {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
  }
  const usuarios = db
    .prepare(
      `SELECT id, nombre, nombre_usuario, rol, numero_whatsapp, activo, creado
       FROM usuarios ORDER BY activo DESC, nombre`
    )
    .all() as Record<string, unknown>[];
  return NextResponse.json(
    usuarios.map((u) => ({
      id: u.id,
      nombre: u.nombre,
      nombreUsuario: u.nombre_usuario,
      rol: u.rol,
      numeroWhatsapp: u.numero_whatsapp,
      activo: !!u.activo,
      creado: u.creado,
    }))
  );
}

// POST /api/usuarios -> crea un usuario (sólo dueño).
// body: { nombre, nombreUsuario, password, rol?, numeroWhatsapp? }
export async function POST(req: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
  }
  if (usuario.rol !== "dueño") {
    return NextResponse.json({ error: "Sólo el dueño puede administrar usuarios" }, { status: 403 });
  }

  const body = await req.json();
  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  const nombreUsuario = typeof body.nombreUsuario === "string" ? body.nombreUsuario.trim() : "";
  const password = body.password;
  const rol: Rol = ROLES.includes(body.rol) ? body.rol : "encargado";
  const numeroWhatsapp =
    typeof body.numeroWhatsapp === "string" && body.numeroWhatsapp.trim()
      ? body.numeroWhatsapp.trim()
      : null;

  if (!nombre || !nombreUsuario || !password) {
    return NextResponse.json(
      { error: "Faltan datos: nombre, usuario y contraseña son obligatorios" },
      { status: 400 }
    );
  }
  if (String(password).length < 6) {
    return NextResponse.json(
      { error: "La contraseña tiene que tener al menos 6 caracteres" },
      { status: 400 }
    );
  }

  const yaExiste = db.prepare(`SELECT id FROM usuarios WHERE nombre_usuario = ?`).get(nombreUsuario);
  if (yaExiste) {
    return NextResponse.json({ error: "Ya existe un usuario con ese nombre de usuario" }, { status: 409 });
  }

  const { hash, salt } = hashearPassword(String(password));
  const resultado = db
    .prepare(
      `INSERT INTO usuarios (nombre, nombre_usuario, password_hash, password_salt, rol, numero_whatsapp)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(nombre, nombreUsuario, hash, salt, rol, numeroWhatsapp);

  return NextResponse.json(
    { id: Number(resultado.lastInsertRowid), nombre, nombreUsuario, rol, numeroWhatsapp, activo: true },
    { status: 201 }
  );
}
