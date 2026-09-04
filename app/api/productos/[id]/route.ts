import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conUsuario, leerBody, errorJson } from "@/lib/api";
import { serializarProducto, validarProducto, type ProductoRow } from "@/lib/stock";

export const dynamic = "force-dynamic";

function traer(id: number) {
  return db.prepare(`SELECT * FROM productos WHERE id = ?`).get(id) as ProductoRow | undefined;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async () => {
    const { id } = await params;
    const fila = traer(Number(id));
    if (!fila) return errorJson("Producto no encontrado", 404);
    return NextResponse.json(serializarProducto(fila));
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async () => {
    const { id } = await params;
    const actual = traer(Number(id));
    if (!actual) return errorJson("Producto no encontrado", 404);

    const body = await leerBody(req);
    const v = validarProducto(body, actual);
    if (!v.ok) return errorJson(v.error);
    const d = v.datos;

    if (d.sku && d.sku !== actual.sku) {
      const choca = db.prepare(`SELECT id FROM productos WHERE sku = ? AND id != ?`).get(d.sku, actual.id);
      if (choca) return errorJson("Ya hay otro producto con ese código (SKU)", 409);
    }

    db.prepare(
      `UPDATE productos SET nombre = ?, sku = ?, precio = ?, imagen = ?, activo = ?, nota = ?,
         actualizado = datetime('now','localtime') WHERE id = ?`
    ).run(d.nombre, d.sku, d.precio, d.imagen, d.activo, d.nota, actual.id);
    return NextResponse.json(serializarProducto(traer(actual.id)!));
  }, { escritura: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async () => {
    const { id } = await params;
    const actual = traer(Number(id));
    if (!actual) return errorJson("Producto no encontrado", 404);

    const conPublicaciones = (db
      .prepare(`SELECT COUNT(*) c FROM publicaciones WHERE producto_id = ?`)
      .get(actual.id) as { c: number }).c;

    if (conPublicaciones > 0) {
      db.prepare(`UPDATE productos SET activo = 0, actualizado = datetime('now','localtime') WHERE id = ?`).run(actual.id);
      return NextResponse.json({
        ok: true,
        desactivado: true,
        mensaje: "El producto tiene publicaciones, se desactivó en vez de borrarse.",
      });
    }
    db.prepare(`DELETE FROM composicion_producto WHERE producto_id = ?`).run(actual.id);
    db.prepare(`DELETE FROM productos WHERE id = ?`).run(actual.id);
    return NextResponse.json({ ok: true, borrado: true });
  }, { escritura: true });
}
