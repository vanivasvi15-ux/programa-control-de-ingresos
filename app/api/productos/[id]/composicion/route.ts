import { NextRequest, NextResponse } from "next/server";
import { db, transaccion } from "@/lib/db";
import { conUsuario, leerBody, errorJson } from "@/lib/api";
import { validarComposicion, recalcularCostos } from "@/lib/stock";

export const dynamic = "force-dynamic";

// Renglones de la composición con el nombre del componente resuelto.
function leerComposicion(productoId: number) {
  return db
    .prepare(
      `SELECT c.item_tipo AS itemTipo, c.item_id AS itemId, c.cantidad,
              CASE c.item_tipo
                WHEN 'base' THEN (SELECT nombre FROM productos_base WHERE id = c.item_id)
                ELSE (SELECT nombre FROM insumos WHERE id = c.item_id)
              END AS nombre,
              CASE c.item_tipo
                WHEN 'base' THEN 'u'
                ELSE (SELECT unidad_consumo FROM insumos WHERE id = c.item_id)
              END AS unidad
       FROM composicion_producto c
       WHERE c.producto_id = ?
       ORDER BY c.item_tipo DESC, nombre`
    )
    .all(productoId);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async () => {
    const { id } = await params;
    const prod = db.prepare(`SELECT id FROM productos WHERE id = ?`).get(Number(id));
    if (!prod) return errorJson("Producto no encontrado", 404);
    return NextResponse.json(leerComposicion(Number(id)));
  });
}

// PUT -> reemplaza la composición ENTERA.
// body: { lineas: [{ itemTipo: 'base'|'insumo', itemId, cantidad }] }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async () => {
    const { id } = await params;
    const productoId = Number(id);
    const prod = db.prepare(`SELECT id FROM productos WHERE id = ?`).get(productoId);
    if (!prod) return errorJson("Producto no encontrado", 404);

    const body = await leerBody(req);
    const v = validarComposicion(body.lineas);
    if (!v.ok) return errorJson(v.error);

    transaccion(() => {
      db.prepare(`DELETE FROM composicion_producto WHERE producto_id = ?`).run(productoId);
      const ins = db.prepare(
        `INSERT INTO composicion_producto (producto_id, item_tipo, item_id, cantidad) VALUES (?, ?, ?, ?)`
      );
      for (const l of v.datos) ins.run(productoId, l.item_tipo, l.item_id, l.cantidad);
    });
    recalcularCostos();
    return NextResponse.json(leerComposicion(productoId));
  }, { escritura: true });
}
