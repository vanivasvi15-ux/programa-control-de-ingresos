import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conUsuario, leerBody, errorJson } from "@/lib/api";
import { serializarPiezaBase, validarPiezaBase, recalcularCostos, type ProductoBaseRow } from "@/lib/stock";

export const dynamic = "force-dynamic";

function traer(id: number) {
  return db.prepare(`SELECT * FROM productos_base WHERE id = ?`).get(id) as ProductoBaseRow | undefined;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async () => {
    const { id } = await params;
    const fila = traer(Number(id));
    if (!fila) return errorJson("Pieza no encontrada", 404);
    return NextResponse.json(serializarPiezaBase(fila));
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async () => {
    const { id } = await params;
    const actual = traer(Number(id));
    if (!actual) return errorJson("Pieza no encontrada", 404);

    const body = await leerBody(req);
    const v = validarPiezaBase(body, actual);
    if (!v.ok) return errorJson(v.error);
    const d = v.datos;

    if (d.nombre !== actual.nombre) {
      const choca = db.prepare(`SELECT id FROM productos_base WHERE nombre = ? AND id != ?`).get(d.nombre, actual.id);
      if (choca) return errorJson("Ya hay otra pieza con ese nombre", 409);
    }

    db.prepare(
      `UPDATE productos_base SET nombre = ?, mano_obra_minutos = ?, activo = ?, nota = ?,
         actualizado = datetime('now','localtime') WHERE id = ?`
    ).run(d.nombre, d.mano_obra_minutos, d.activo, d.nota, actual.id);

    if (d.mano_obra_minutos !== actual.mano_obra_minutos) recalcularCostos();
    return NextResponse.json(serializarPiezaBase(traer(actual.id)!));
  }, { escritura: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async () => {
    const { id } = await params;
    const actual = traer(Number(id));
    if (!actual) return errorJson("Pieza no encontrada", 404);

    const usos =
      (db.prepare(`SELECT COUNT(*) c FROM composicion_producto WHERE item_tipo='base' AND item_id = ?`).get(actual.id) as { c: number }).c +
      (db.prepare(`SELECT COUNT(*) c FROM ordenes_produccion WHERE producto_base_id = ?`).get(actual.id) as { c: number }).c +
      (db.prepare(`SELECT COUNT(*) c FROM movimientos_stock WHERE item_tipo='base' AND item_id = ?`).get(actual.id) as { c: number }).c;

    if (usos > 0) {
      db.prepare(`UPDATE productos_base SET activo = 0, actualizado = datetime('now','localtime') WHERE id = ?`).run(actual.id);
      return NextResponse.json({ ok: true, desactivado: true, mensaje: "La pieza está en uso, se desactivó." });
    }
    // borrar receta huérfana y la pieza
    db.prepare(`DELETE FROM receta_base WHERE producto_base_id = ?`).run(actual.id);
    db.prepare(`DELETE FROM productos_base WHERE id = ?`).run(actual.id);
    return NextResponse.json({ ok: true, borrado: true });
  }, { escritura: true });
}
