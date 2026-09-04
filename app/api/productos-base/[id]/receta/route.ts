import { NextRequest, NextResponse } from "next/server";
import { db, transaccion } from "@/lib/db";
import { conUsuario, leerBody, errorJson } from "@/lib/api";
import { validarReceta, recalcularCostos } from "@/lib/stock";

export const dynamic = "force-dynamic";

// GET /api/productos-base/5/receta -> renglones con el nombre del insumo.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async () => {
    const { id } = await params;
    const pieza = db.prepare(`SELECT id FROM productos_base WHERE id = ?`).get(Number(id));
    if (!pieza) return errorJson("Pieza no encontrada", 404);

    const filas = db
      .prepare(
        `SELECT r.insumo_id AS insumoId, r.cantidad, r.bloqueante,
                i.nombre AS insumoNombre, i.tipo AS insumoTipo, i.unidad_consumo AS unidad
         FROM receta_base r
         JOIN insumos i ON i.id = r.insumo_id
         WHERE r.producto_base_id = ?
         ORDER BY i.nombre`
      )
      .all(Number(id)) as Record<string, unknown>[];
    return NextResponse.json(
      filas.map((f) => ({ ...f, bloqueante: !!(f.bloqueante as number) }))
    );
  });
}

// PUT /api/productos-base/5/receta -> reemplaza la receta ENTERA.
// body: { lineas: [{ insumoId, cantidad, bloqueante? }] }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async () => {
    const { id } = await params;
    const piezaId = Number(id);
    const pieza = db.prepare(`SELECT id FROM productos_base WHERE id = ?`).get(piezaId);
    if (!pieza) return errorJson("Pieza no encontrada", 404);

    const body = await leerBody(req);
    const v = validarReceta(body.lineas);
    if (!v.ok) return errorJson(v.error);

    transaccion(() => {
      db.prepare(`DELETE FROM receta_base WHERE producto_base_id = ?`).run(piezaId);
      const ins = db.prepare(
        `INSERT INTO receta_base (producto_base_id, insumo_id, cantidad, bloqueante) VALUES (?, ?, ?, ?)`
      );
      for (const l of v.datos) ins.run(piezaId, l.insumo_id, l.cantidad, l.bloqueante);
    });
    recalcularCostos();

    const filas = db
      .prepare(
        `SELECT r.insumo_id AS insumoId, r.cantidad, r.bloqueante,
                i.nombre AS insumoNombre, i.tipo AS insumoTipo, i.unidad_consumo AS unidad
         FROM receta_base r JOIN insumos i ON i.id = r.insumo_id
         WHERE r.producto_base_id = ? ORDER BY i.nombre`
      )
      .all(piezaId) as Record<string, unknown>[];
    return NextResponse.json(filas.map((f) => ({ ...f, bloqueante: !!(f.bloqueante as number) })));
  }, { escritura: true });
}
