import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conUsuario } from "@/lib/api";
import { serializarPiezaBase, serializarProducto, tarifaManoObraMinuto, type ProductoBaseRow, type ProductoRow } from "@/lib/stock";

export const dynamic = "force-dynamic";

// GET /api/stock/costos -> costo calculado de cada pieza y cada producto,
// más la tarifa de mano de obra vigente.
export async function GET() {
  return conUsuario(() => {
    const piezas = db.prepare(`SELECT * FROM productos_base ORDER BY nombre`).all() as ProductoBaseRow[];
    const productos = db.prepare(`SELECT * FROM productos ORDER BY nombre`).all() as ProductoRow[];
    return NextResponse.json({
      tarifaManoObraMinuto: tarifaManoObraMinuto(),
      piezas: piezas.map(serializarPiezaBase),
      productos: productos.map(serializarProducto),
    });
  });
}
