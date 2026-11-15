import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conUsuario, leerBody, errorJson } from "@/lib/api";
import { ingresarPorEscaneo, type ProductoBaseRow, type ProductoRow } from "@/lib/stock";

export const dynamic = "force-dynamic";

// POST /api/escaneos   body: { codigo, cantidad? }
// Ingreso de piezas terminadas por escaneo: suma `cantidad` (default 1) al
// stock de la pieza dueña del código y descuenta los materiales de su receta.
// - código de un PRODUCTO (kit) → 422: ahí se escanean piezas, no kits.
// - código desconocido → 404.
// Nunca se frena por falta de material: avisa en `enRojo`.
export async function POST(req: NextRequest) {
  return conUsuario(async (usuario) => {
    const body = await leerBody(req);
    const codigo = String(body.codigo ?? "").trim();
    if (!codigo) return errorJson("Falta el código");

    const cantidad = body.cantidad === undefined ? 1 : Number(body.cantidad);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 500) {
      return errorJson("La cantidad tiene que ser un número entero entre 1 y 500");
    }

    const pieza = db.prepare(`SELECT * FROM productos_base WHERE codigo_barras = ?`).get(codigo) as
      | ProductoBaseRow
      | undefined;
    if (!pieza) {
      const producto = db.prepare(`SELECT id, nombre FROM productos WHERE codigo_barras = ?`).get(codigo) as
        | Pick<ProductoRow, "id" | "nombre">
        | undefined;
      if (producto) {
        return NextResponse.json(
          { error: `"${producto.nombre}" es un producto (kit), no una pieza. Acá se escanean las piezas.` },
          { status: 422 }
        );
      }
      return errorJson(`No hay ninguna pieza con el código ${codigo}`, 404);
    }
    if (!pieza.activo) {
      return NextResponse.json({ error: `La pieza "${pieza.nombre}" está desactivada` }, { status: 422 });
    }

    const r = ingresarPorEscaneo({ piezaId: pieza.id, codigo, cantidad, usuarioId: usuario.id });
    return NextResponse.json({ ok: true, codigo, cantidad, ...r }, { status: 201 });
  }, { escritura: true });
}

// GET /api/escaneos → { recientes: [...últimos 30], hoy: [{ piezaId, nombre, total }] }
export async function GET() {
  return conUsuario(() => {
    const recientes = db
      .prepare(
        `SELECT e.id, e.codigo, e.cantidad, e.estado, e.creado, e.deshecho_en AS deshechoEn,
                b.id AS piezaId, b.nombre AS pieza, u.nombre AS usuario
         FROM escaneos e
         JOIN productos_base b ON b.id = e.item_id
         LEFT JOIN usuarios u ON u.id = e.usuario_id
         ORDER BY e.id DESC LIMIT 30`
      )
      .all();
    const hoy = db
      .prepare(
        `SELECT b.id AS piezaId, b.nombre, SUM(e.cantidad) AS total
         FROM escaneos e JOIN productos_base b ON b.id = e.item_id
         WHERE e.estado = 'activo' AND date(e.creado) = date('now','localtime')
         GROUP BY b.id ORDER BY total DESC, b.nombre`
      )
      .all();
    return NextResponse.json({ recientes, hoy });
  });
}
