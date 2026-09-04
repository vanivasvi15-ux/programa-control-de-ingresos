import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conUsuario, leerBody, errorJson } from "@/lib/api";
import { validarPublicacion } from "@/lib/stock";

export const dynamic = "force-dynamic";

type PublicacionRow = {
  id: number;
  producto_id: number;
  canal: string;
  ml_item_id: string | null;
  cuenta: string | null;
  titulo: string | null;
  url: string | null;
  activo: number;
  creado: string;
};

function serializar(p: PublicacionRow & { producto_nombre?: string }) {
  return {
    id: p.id,
    productoId: p.producto_id,
    productoNombre: p.producto_nombre ?? null,
    canal: p.canal,
    mlItemId: p.ml_item_id,
    cuenta: p.cuenta,
    titulo: p.titulo,
    url: p.url,
    activo: !!p.activo,
    creado: p.creado,
  };
}

// GET /api/publicaciones -> ?producto_id ?canal
export async function GET(req: NextRequest) {
  return conUsuario(() => {
    const { searchParams } = new URL(req.url);
    const cond: string[] = [];
    const val: (string | number)[] = [];
    const pid = searchParams.get("producto_id");
    if (pid && Number.isInteger(Number(pid))) {
      cond.push("pub.producto_id = ?");
      val.push(Number(pid));
    }
    const canal = searchParams.get("canal");
    if (canal === "mercadolibre" || canal === "tienda" || canal === "otro") {
      cond.push("pub.canal = ?");
      val.push(canal);
    }
    const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
    const filas = db
      .prepare(
        `SELECT pub.*, p.nombre AS producto_nombre
         FROM publicaciones pub JOIN productos p ON p.id = pub.producto_id
         ${where} ORDER BY p.nombre, pub.canal`
      )
      .all(...val) as (PublicacionRow & { producto_nombre: string })[];
    return NextResponse.json(filas.map(serializar));
  });
}

// POST /api/publicaciones -> vincular un aviso a un producto.
export async function POST(req: NextRequest) {
  return conUsuario(async () => {
    const body = await leerBody(req);
    const v = validarPublicacion(body);
    if (!v.ok) return errorJson(v.error);
    const d = v.datos;

    if (d.ml_item_id) {
      const choca = db
        .prepare(`SELECT id FROM publicaciones WHERE canal = ? AND ml_item_id = ?`)
        .get(d.canal, d.ml_item_id);
      if (choca) return errorJson("Ese aviso ya está vinculado", 409);
    }

    const r = db
      .prepare(
        `INSERT INTO publicaciones (producto_id, canal, ml_item_id, cuenta, titulo, url, activo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(d.producto_id, d.canal, d.ml_item_id, d.cuenta, d.titulo, d.url, d.activo);
    const creado = db
      .prepare(
        `SELECT pub.*, p.nombre AS producto_nombre FROM publicaciones pub
         JOIN productos p ON p.id = pub.producto_id WHERE pub.id = ?`
      )
      .get(Number(r.lastInsertRowid)) as PublicacionRow & { producto_nombre: string };
    return NextResponse.json(serializar(creado), { status: 201 });
  }, { escritura: true });
}
