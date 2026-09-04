import { NextRequest, NextResponse } from "next/server";
import { db, transaccion } from "@/lib/db";
import { conUsuario, leerBody, errorJson } from "@/lib/api";

export const dynamic = "force-dynamic";

type ListaRow = {
  id: number;
  nombre: string;
  dias_cada: number;
  ultima_revision: string | null;
  activo: number;
  creado: string;
};

function itemsDe(listaId: number) {
  return db
    .prepare(
      `SELECT ri.insumo_id AS insumoId, i.nombre, i.stock, i.unidad_consumo AS unidad
       FROM recuento_items ri JOIN insumos i ON i.id = ri.insumo_id
       WHERE ri.lista_id = ? ORDER BY i.nombre`
    )
    .all(listaId);
}

function armar(l: ListaRow) {
  return {
    id: l.id,
    nombre: l.nombre,
    diasCada: l.dias_cada,
    ultimaRevision: l.ultima_revision,
    activo: !!l.activo,
    creado: l.creado,
    items: itemsDe(l.id),
  };
}

// PUT /api/recuento-listas/5
// body: { nombre?, diasCada?, activo?, insumoIds?: number[] (reemplaza los items) }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async () => {
    const { id } = await params;
    const lista = db.prepare(`SELECT * FROM recuento_listas WHERE id = ?`).get(Number(id)) as ListaRow | undefined;
    if (!lista) return errorJson("Lista no encontrada", 404);

    const body = await leerBody(req);
    const nombre =
      typeof body.nombre === "string" && body.nombre.trim() ? body.nombre.trim() : lista.nombre;
    const diasCada = body.diasCada !== undefined ? Number(body.diasCada) : lista.dias_cada;
    if (!Number.isInteger(diasCada) || diasCada <= 0) return errorJson("Los días tienen que ser un entero mayor a 0");
    const activo = typeof body.activo === "boolean" ? (body.activo ? 1 : 0) : lista.activo;

    transaccion(() => {
      db.prepare(`UPDATE recuento_listas SET nombre = ?, dias_cada = ?, activo = ? WHERE id = ?`).run(
        nombre,
        diasCada,
        activo,
        lista.id
      );
      if (Array.isArray(body.insumoIds)) {
        const ids = body.insumoIds.map(Number).filter((n) => Number.isInteger(n));
        db.prepare(`DELETE FROM recuento_items WHERE lista_id = ?`).run(lista.id);
        const ins = db.prepare(`INSERT OR IGNORE INTO recuento_items (lista_id, insumo_id) VALUES (?, ?)`);
        for (const iid of ids) {
          if (db.prepare(`SELECT id FROM insumos WHERE id = ?`).get(iid)) ins.run(lista.id, iid);
        }
      }
    });

    const actualizada = db.prepare(`SELECT * FROM recuento_listas WHERE id = ?`).get(lista.id) as ListaRow;
    return NextResponse.json(armar(actualizada));
  }, { escritura: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async () => {
    const { id } = await params;
    const lista = db.prepare(`SELECT id FROM recuento_listas WHERE id = ?`).get(Number(id));
    if (!lista) return errorJson("Lista no encontrada", 404);
    transaccion(() => {
      db.prepare(`DELETE FROM recuento_items WHERE lista_id = ?`).run(Number(id));
      db.prepare(`DELETE FROM recuento_listas WHERE id = ?`).run(Number(id));
    });
    return NextResponse.json({ ok: true, borrada: true });
  }, { escritura: true });
}
