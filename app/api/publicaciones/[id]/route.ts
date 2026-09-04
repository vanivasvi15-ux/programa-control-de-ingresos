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

function traer(id: number) {
  return db.prepare(`SELECT * FROM publicaciones WHERE id = ?`).get(id) as PublicacionRow | undefined;
}

function serializar(p: PublicacionRow) {
  return {
    id: p.id,
    productoId: p.producto_id,
    canal: p.canal,
    mlItemId: p.ml_item_id,
    cuenta: p.cuenta,
    titulo: p.titulo,
    url: p.url,
    activo: !!p.activo,
    creado: p.creado,
  };
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async () => {
    const { id } = await params;
    const actual = traer(Number(id));
    if (!actual) return errorJson("Publicación no encontrada", 404);

    const body = await leerBody(req);
    const v = validarPublicacion(body, actual);
    if (!v.ok) return errorJson(v.error);
    const d = v.datos;

    if (d.ml_item_id && (d.ml_item_id !== actual.ml_item_id || d.canal !== actual.canal)) {
      const choca = db
        .prepare(`SELECT id FROM publicaciones WHERE canal = ? AND ml_item_id = ? AND id != ?`)
        .get(d.canal, d.ml_item_id, actual.id);
      if (choca) return errorJson("Ese aviso ya está vinculado", 409);
    }

    db.prepare(
      `UPDATE publicaciones SET producto_id = ?, canal = ?, ml_item_id = ?, cuenta = ?, titulo = ?, url = ?, activo = ?
       WHERE id = ?`
    ).run(d.producto_id, d.canal, d.ml_item_id, d.cuenta, d.titulo, d.url, d.activo, actual.id);
    return NextResponse.json(serializar(traer(actual.id)!));
  }, { escritura: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async () => {
    const { id } = await params;
    const actual = traer(Number(id));
    if (!actual) return errorJson("Publicación no encontrada", 404);
    db.prepare(`DELETE FROM publicaciones WHERE id = ?`).run(actual.id);
    return NextResponse.json({ ok: true, borrado: true });
  }, { escritura: true });
}
