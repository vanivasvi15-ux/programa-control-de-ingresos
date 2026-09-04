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

function diasDesde(fecha: string | null): number | null {
  if (!fecha) return null;
  const t = Date.parse(fecha + "T00:00:00");
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

function serializar(l: ListaRow, items: { insumoId: number; nombre: string; stock: number; unidad: string }[]) {
  const dias = diasDesde(l.ultima_revision);
  return {
    id: l.id,
    nombre: l.nombre,
    diasCada: l.dias_cada,
    ultimaRevision: l.ultima_revision,
    diasDesdeRevision: dias,
    venceRevision: dias == null || dias >= l.dias_cada,
    activo: !!l.activo,
    creado: l.creado,
    items,
  };
}

function itemsDe(listaId: number) {
  return db
    .prepare(
      `SELECT ri.insumo_id AS insumoId, i.nombre, i.stock, i.unidad_consumo AS unidad
       FROM recuento_items ri JOIN insumos i ON i.id = ri.insumo_id
       WHERE ri.lista_id = ? ORDER BY i.nombre`
    )
    .all(listaId) as { insumoId: number; nombre: string; stock: number; unidad: string }[];
}

export async function GET() {
  return conUsuario(() => {
    const listas = db.prepare(`SELECT * FROM recuento_listas ORDER BY nombre`).all() as ListaRow[];
    return NextResponse.json(listas.map((l) => serializar(l, itemsDe(l.id))));
  });
}

// POST /api/recuento-listas
// body: { nombre, diasCada?, insumoIds?: number[] }
export async function POST(req: NextRequest) {
  return conUsuario(async () => {
    const body = await leerBody(req);
    const nombre = String(body.nombre ?? "").trim();
    if (!nombre) return errorJson("Falta el nombre de la lista");
    const diasCada = body.diasCada !== undefined ? Number(body.diasCada) : 3;
    if (!Number.isInteger(diasCada) || diasCada <= 0) return errorJson("Los días tienen que ser un entero mayor a 0");

    const insumoIds = Array.isArray(body.insumoIds) ? body.insumoIds.map(Number).filter((n) => Number.isInteger(n)) : [];

    const listaId = transaccion(() => {
      const r = db.prepare(`INSERT INTO recuento_listas (nombre, dias_cada) VALUES (?, ?)`).run(nombre, diasCada);
      const lid = Number(r.lastInsertRowid);
      const ins = db.prepare(`INSERT OR IGNORE INTO recuento_items (lista_id, insumo_id) VALUES (?, ?)`);
      for (const iid of insumoIds) {
        if (db.prepare(`SELECT id FROM insumos WHERE id = ?`).get(iid)) ins.run(lid, iid);
      }
      return lid;
    });

    const lista = db.prepare(`SELECT * FROM recuento_listas WHERE id = ?`).get(listaId) as ListaRow;
    return NextResponse.json(serializar(lista, itemsDe(listaId)), { status: 201 });
  }, { escritura: true });
}
