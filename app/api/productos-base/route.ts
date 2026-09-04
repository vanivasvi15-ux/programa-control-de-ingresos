import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conUsuario, leerBody, errorJson } from "@/lib/api";
import { serializarPiezaBase, validarPiezaBase, type ProductoBaseRow } from "@/lib/stock";

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

    const r = db
      .prepare(
        `INSERT INTO productos_base (nombre, mano_obra_minutos, activo, nota) VALUES (?, ?, ?, ?)`
      )
      .run(d.nombre, d.mano_obra_minutos, d.activo, d.nota);
    const creado = db
      .prepare(`SELECT * FROM productos_base WHERE id = ?`)
      .get(Number(r.lastInsertRowid)) as ProductoBaseRow;
    return NextResponse.json(serializarPiezaBase(creado), { status: 201 });
  }, { escritura: true });
}
