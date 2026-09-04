import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conUsuario, leerBody, errorJson } from "@/lib/api";
import {
  serializarInsumo,
  validarInsumo,
  recalcularCostos,
  type InsumoRow,
} from "@/lib/stock";

export const dynamic = "force-dynamic";

function traer(id: number) {
  return db.prepare(`SELECT * FROM insumos WHERE id = ?`).get(id) as InsumoRow | undefined;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async () => {
    const { id } = await params;
    const fila = traer(Number(id));
    if (!fila) return errorJson("Insumo no encontrado", 404);
    return NextResponse.json(serializarInsumo(fila));
  });
}

// PUT /api/insumos/5 -> editar. Si cambia el costo_unitario, recalcula los
// costos de las piezas y productos que usan este insumo.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async () => {
    const { id } = await params;
    const actual = traer(Number(id));
    if (!actual) return errorJson("Insumo no encontrado", 404);

    const body = await leerBody(req);
    const v = validarInsumo(body, actual);
    if (!v.ok) return errorJson(v.error);
    const d = v.datos;

    db.prepare(
      `UPDATE insumos SET nombre = ?, tipo = ?, unidad_compra = ?, unidad_consumo = ?,
         factor_compra = ?, alerta_minimo = ?, costo_unitario = ?, activo = ?, nota = ?,
         actualizado = datetime('now','localtime')
       WHERE id = ?`
    ).run(
      d.nombre,
      d.tipo,
      d.unidad_compra,
      d.unidad_consumo,
      d.factor_compra,
      d.alerta_minimo,
      d.costo_unitario,
      d.activo,
      d.nota,
      actual.id
    );

    if (d.costo_unitario !== actual.costo_unitario || d.factor_compra !== actual.factor_compra) {
      recalcularCostos();
    }
    return NextResponse.json(serializarInsumo(traer(actual.id)!));
  }, { escritura: true });
}

// DELETE /api/insumos/5 -> si está en alguna receta/composición/compra se
// desactiva; si no lo usa nadie, se borra de verdad.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async () => {
    const { id } = await params;
    const actual = traer(Number(id));
    if (!actual) return errorJson("Insumo no encontrado", 404);

    const usos =
      (db.prepare(`SELECT COUNT(*) c FROM receta_base WHERE insumo_id = ?`).get(actual.id) as { c: number }).c +
      (db.prepare(`SELECT COUNT(*) c FROM composicion_producto WHERE item_tipo='insumo' AND item_id = ?`).get(actual.id) as { c: number }).c +
      (db.prepare(`SELECT COUNT(*) c FROM compras_insumo WHERE insumo_id = ?`).get(actual.id) as { c: number }).c +
      (db.prepare(`SELECT COUNT(*) c FROM movimientos_stock WHERE item_tipo='insumo' AND item_id = ?`).get(actual.id) as { c: number }).c;

    if (usos > 0) {
      db.prepare(`UPDATE insumos SET activo = 0, actualizado = datetime('now','localtime') WHERE id = ?`).run(actual.id);
      return NextResponse.json({ ok: true, desactivado: true, mensaje: "El insumo está en uso, se desactivó." });
    }
    db.prepare(`DELETE FROM insumos WHERE id = ?`).run(actual.id);
    return NextResponse.json({ ok: true, borrado: true });
  }, { escritura: true });
}
