import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usuarioActual } from "@/lib/auth";

export const dynamic = "force-dynamic";

type CategoriaRow = {
  id: number;
  nombre: string;
  tipo: "ingreso" | "gasto";
  activo: number;
  creado: string;
};

// PUT /api/categorias/5 -> renombrar y/o activar/desactivar (sólo dueño).
// body esperado (todo opcional): { nombre?: string, activo?: boolean }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
  }
  if (usuario.rol !== "dueño") {
    return NextResponse.json({ error: "Sólo el dueño puede administrar categorías" }, { status: 403 });
  }

  const { id: idParam } = await params;
  const id = Number(idParam);
  const body = await req.json();

  const actual = db
    .prepare(`SELECT id, nombre, tipo, activo, creado FROM categorias WHERE id = ?`)
    .get(id) as CategoriaRow | undefined;
  if (!actual) {
    return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
  }

  const nombre =
    typeof body.nombre === "string" && body.nombre.trim() ? body.nombre.trim() : actual.nombre;
  const activo = typeof body.activo === "boolean" ? (body.activo ? 1 : 0) : actual.activo;

  // Si se cambia el nombre, que no choque con otra categoría del mismo tipo.
  if (nombre !== actual.nombre) {
    const choca = db
      .prepare(`SELECT id FROM categorias WHERE nombre = ? AND tipo = ? AND id != ?`)
      .get(nombre, actual.tipo, id);
    if (choca) {
      return NextResponse.json(
        { error: "Ya existe otra categoría con ese nombre y tipo" },
        { status: 409 }
      );
    }
  }

  db.prepare(`UPDATE categorias SET nombre = ?, activo = ? WHERE id = ?`).run(nombre, activo, id);

  return NextResponse.json({
    id,
    nombre,
    tipo: actual.tipo,
    activo: !!activo,
    creado: actual.creado,
  });
}

// DELETE /api/categorias/5 (sólo dueño).
// Si la categoría tiene movimientos, no se borra (perderíamos historial):
// se desactiva (activo = 0). Si no la usa nadie, se borra de verdad.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
  }
  if (usuario.rol !== "dueño") {
    return NextResponse.json({ error: "Sólo el dueño puede administrar categorías" }, { status: 403 });
  }

  const { id: idParam } = await params;
  const id = Number(idParam);

  const actual = db.prepare(`SELECT id FROM categorias WHERE id = ?`).get(id);
  if (!actual) {
    return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
  }

  const enUso = db
    .prepare(`SELECT COUNT(*) AS c FROM movimientos WHERE categoria_id = ?`)
    .get(id) as { c: number };

  if (enUso.c > 0) {
    db.prepare(`UPDATE categorias SET activo = 0 WHERE id = ?`).run(id);
    return NextResponse.json({
      ok: true,
      desactivada: true,
      mensaje: `La categoría tiene ${enUso.c} movimiento(s), así que se desactivó en vez de borrarse.`,
    });
  }

  db.prepare(`DELETE FROM categorias WHERE id = ?`).run(id);
  return NextResponse.json({ ok: true, borrada: true });
}
