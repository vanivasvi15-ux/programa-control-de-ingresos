import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashearPassword, usuarioActual, type Rol } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ROLES: Rol[] = ["dueño", "encargado", "contador"];

type UsuarioRow = {
  id: number;
  nombre: string;
  nombre_usuario: string;
  rol: Rol;
  numero_whatsapp: string | null;
  activo: number;
};

// PUT /api/usuarios/5 -> edita nombre, rol, whatsapp, activo y/o contraseña.
// body (todo opcional): { nombre?, rol?, numeroWhatsapp?, activo?, password? }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
  }
  if (usuario.rol !== "dueño") {
    return NextResponse.json({ error: "Sólo el dueño puede administrar usuarios" }, { status: 403 });
  }

  const { id: idParam } = await params;
  const id = Number(idParam);
  const actual = db.prepare(`SELECT * FROM usuarios WHERE id = ?`).get(id) as UsuarioRow | undefined;
  if (!actual) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const body = await req.json();

  const nombre =
    typeof body.nombre === "string" && body.nombre.trim() ? body.nombre.trim() : actual.nombre;
  const rol: Rol = ROLES.includes(body.rol) ? body.rol : actual.rol;
  const numeroWhatsapp =
    body.numeroWhatsapp !== undefined
      ? typeof body.numeroWhatsapp === "string" && body.numeroWhatsapp.trim()
        ? body.numeroWhatsapp.trim()
        : null
      : actual.numero_whatsapp;
  const activo = typeof body.activo === "boolean" ? (body.activo ? 1 : 0) : actual.activo;

  // No dejar que el dueño se pause/baje de rol a sí mismo si es el único
  // dueño activo (quedaría el sistema sin nadie que administre).
  const seModificaASiMismo = usuario.id === id;
  const dejaDeSerDueno = actual.rol === "dueño" && (rol !== "dueño" || activo === 0);
  if (dejaDeSerDueno) {
    const otrosDuenos = db
      .prepare(`SELECT COUNT(*) AS c FROM usuarios WHERE rol = 'dueño' AND activo = 1 AND id != ?`)
      .get(id) as { c: number };
    if (otrosDuenos.c === 0) {
      return NextResponse.json(
        { error: "Tiene que quedar al menos un dueño activo" },
        { status: 400 }
      );
    }
  }
  if (seModificaASiMismo && activo === 0) {
    return NextResponse.json({ error: "No te podés desactivar a vos mismo" }, { status: 400 });
  }

  let hash = null;
  let salt = null;
  if (typeof body.password === "string" && body.password.length > 0) {
    if (body.password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña tiene que tener al menos 6 caracteres" },
        { status: 400 }
      );
    }
    const nuevo = hashearPassword(body.password);
    hash = nuevo.hash;
    salt = nuevo.salt;
  }

  if (hash && salt) {
    db.prepare(
      `UPDATE usuarios SET nombre = ?, rol = ?, numero_whatsapp = ?, activo = ?, password_hash = ?, password_salt = ? WHERE id = ?`
    ).run(nombre, rol, numeroWhatsapp, activo, hash, salt, id);
  } else {
    db.prepare(
      `UPDATE usuarios SET nombre = ?, rol = ?, numero_whatsapp = ?, activo = ? WHERE id = ?`
    ).run(nombre, rol, numeroWhatsapp, activo, id);
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/usuarios/5
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
  }
  if (usuario.rol !== "dueño") {
    return NextResponse.json({ error: "Sólo el dueño puede administrar usuarios" }, { status: 403 });
  }

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (usuario.id === id) {
    return NextResponse.json({ error: "No te podés borrar a vos mismo" }, { status: 400 });
  }

  const actual = db.prepare(`SELECT rol, activo FROM usuarios WHERE id = ?`).get(id) as
    | { rol: Rol; activo: number }
    | undefined;
  if (!actual) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  // Si tiene movimientos cargados, no se borra (perderíamos el "quién
  // cargó qué"): se desactiva.
  const tieneMovimientos = db
    .prepare(`SELECT COUNT(*) AS c FROM movimientos WHERE usuario_id = ?`)
    .get(id) as { c: number };

  if (tieneMovimientos.c > 0) {
    db.prepare(`UPDATE usuarios SET activo = 0 WHERE id = ?`).run(id);
    return NextResponse.json({
      ok: true,
      desactivado: true,
      mensaje: `El usuario tiene ${tieneMovimientos.c} movimiento(s) cargado(s), así que se desactivó en vez de borrarse.`,
    });
  }

  db.exec("BEGIN");
  try {
    db.prepare(`DELETE FROM sesiones WHERE usuario_id = ?`).run(id);
    db.prepare(`UPDATE alertas_config SET usuario_id_destino = NULL WHERE usuario_id_destino = ?`).run(id);
    db.prepare(`DELETE FROM usuarios WHERE id = ?`).run(id);
    db.exec("COMMIT");
  } catch {
    db.exec("ROLLBACK");
    return NextResponse.json({ error: "No se pudo borrar el usuario" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, borrado: true });
}
