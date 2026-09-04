import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conUsuario, leerBody, errorJson } from "@/lib/api";
import { serializarProducto, validarProducto, type ProductoRow } from "@/lib/stock";

export const dynamic = "force-dynamic";

// GET /api/productos -> listado con la cantidad de publicaciones. ?activo=1|0
export async function GET(req: NextRequest) {
  return conUsuario(() => {
    const { searchParams } = new URL(req.url);
    const activo = searchParams.get("activo");
    const where = activo === "1" || activo === "0" ? `WHERE p.activo = ${Number(activo)}` : "";
    const filas = db
      .prepare(
        `SELECT p.*, (SELECT COUNT(*) FROM publicaciones pub WHERE pub.producto_id = p.id) AS publicaciones
         FROM productos p ${where} ORDER BY p.nombre`
      )
      .all() as (ProductoRow & { publicaciones: number })[];
    return NextResponse.json(
      filas.map((f) => ({ ...serializarProducto(f), publicaciones: f.publicaciones }))
    );
  });
}

// POST /api/productos -> alta (sin composición; se carga aparte).
export async function POST(req: NextRequest) {
  return conUsuario(async () => {
    const body = await leerBody(req);
    const v = validarProducto(body);
    if (!v.ok) return errorJson(v.error);
    const d = v.datos;

    if (d.sku) {
      const choca = db.prepare(`SELECT id FROM productos WHERE sku = ?`).get(d.sku);
      if (choca) return errorJson("Ya hay un producto con ese código (SKU)", 409);
    }

    const r = db
      .prepare(
        `INSERT INTO productos (nombre, sku, precio, imagen, activo, nota) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(d.nombre, d.sku, d.precio, d.imagen, d.activo, d.nota);
    const creado = db
      .prepare(`SELECT * FROM productos WHERE id = ?`)
      .get(Number(r.lastInsertRowid)) as ProductoRow;
    return NextResponse.json(serializarProducto(creado), { status: 201 });
  }, { escritura: true });
}
