import { NextRequest, NextResponse } from "next/server";
import { db, transaccion } from "@/lib/db";
import { conUsuario, leerBody, errorJson } from "@/lib/api";
import { serializarProducto, recalcularCostos, type ProductoRow, type ProductoBaseRow } from "@/lib/stock";

export const dynamic = "force-dynamic";

// POST /api/productos/desde-pieza
// body: { productoBaseId, precio?, nombre?, cantidad? }
// Crea un producto "envoltorio" para vender una pieza base suelta: su
// composición es cantidad (default 1) de esa pieza.
export async function POST(req: NextRequest) {
  return conUsuario(async () => {
    const body = await leerBody(req);
    const piezaId = Number(body.productoBaseId);
    const pieza = db.prepare(`SELECT * FROM productos_base WHERE id = ?`).get(piezaId) as
      | ProductoBaseRow
      | undefined;
    if (!pieza) return errorJson("La pieza no existe");

    const cantidad = body.cantidad !== undefined ? Number(body.cantidad) : 1;
    if (!Number.isFinite(cantidad) || cantidad <= 0) return errorJson("Cantidad inválida");

    const nombre =
      typeof body.nombre === "string" && body.nombre.trim()
        ? body.nombre.trim()
        : `${pieza.nombre} (repuesto)`;
    const precio = Math.round(Number(body.precio ?? 0));
    if (!Number.isInteger(precio) || precio < 0) return errorJson("Precio inválido");

    if (db.prepare(`SELECT id FROM productos WHERE nombre = ?`).get(nombre)) {
      return errorJson("Ya hay un producto con ese nombre", 409);
    }

    const productoId = transaccion(() => {
      const r = db
        .prepare(`INSERT INTO productos (nombre, precio) VALUES (?, ?)`)
        .run(nombre, precio);
      const pid = Number(r.lastInsertRowid);
      db.prepare(
        `INSERT INTO composicion_producto (producto_id, item_tipo, item_id, cantidad) VALUES (?, 'base', ?, ?)`
      ).run(pid, piezaId, cantidad);
      return pid;
    });
    recalcularCostos();

    const creado = db.prepare(`SELECT * FROM productos WHERE id = ?`).get(productoId) as ProductoRow;
    return NextResponse.json(serializarProducto(creado), { status: 201 });
  }, { escritura: true });
}
