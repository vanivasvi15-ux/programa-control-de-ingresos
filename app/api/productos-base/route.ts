import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conUsuario, leerBody, errorJson } from "@/lib/api";
import { serializarPiezaBase, validarPiezaBase, codigoEnUso, asegurarCodigo, type ProductoBaseRow } from "@/lib/stock";

export const dynamic = "force-dynamic";

// GET /api/productos-base -> listado. Filtro: ?activo=1|0
export async function GET(req: NextRequest) {
  return conUsuario(() => {
    const { searchParams } = new URL(req.url);
    const activo = searchParams.get("activo");
    const where = activo === "1" || activo === "0" ? `WHERE activo = ${Number(activo)}` : "";
    const filas = db
      .prepare(`SELECT * FROM productos_base ${where} ORDER BY nombre`)
      .all() as ProductoBaseRow[];
    return NextResponse.json(filas.map(serializarPiezaBase));
  });
}

// POST /api/productos-base -> alta (sin receta; la receta se carga aparte).
export async function POST(req: NextRequest) {
  return conUsuario(async () => {
    const body = await leerBody(req);
    const v = validarPiezaBase(body);
    if (!v.ok) return errorJson(v.error);
    const d = v.datos;

    const yaExiste = db.prepare(`SELECT id FROM productos_base WHERE nombre = ?`).get(d.nombre);
    if (yaExiste) return errorJson("Ya hay una pieza con ese nombre", 409);

    if (d.codigo_barras) {
      const choca = codigoEnUso(d.codigo_barras);
      if (choca) return errorJson(`Ese código de barras ya lo tiene "${choca.nombre}"`, 409);
    }

    const r = db
      .prepare(
        `INSERT INTO productos_base (nombre, mano_obra_minutos, codigo_barras, activo, nota) VALUES (?, ?, ?, ?, ?)`
      )
      .run(d.nombre, d.mano_obra_minutos, d.codigo_barras, d.activo, d.nota);
    const id = Number(r.lastInsertRowid);
    asegurarCodigo("base", id);
    const creado = db.prepare(`SELECT * FROM productos_base WHERE id = ?`).get(id) as ProductoBaseRow;
    return NextResponse.json(serializarPiezaBase(creado), { status: 201 });
  }, { escritura: true });
}
