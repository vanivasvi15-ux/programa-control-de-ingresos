import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conUsuario, leerBody, errorJson } from "@/lib/api";
import { responderRecuento } from "@/lib/stock";

export const dynamic = "force-dynamic";

// POST /api/recuento-listas/5/responder
// body: { conteos: [{ insumoId, stock }] }
// Ajusta el stock de cada insumo a lo contado (motivo 'recuento') y marca la
// lista como revisada hoy.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async (usuario) => {
    const { id } = await params;
    const listaId = Number(id);
    if (!db.prepare(`SELECT id FROM recuento_listas WHERE id = ?`).get(listaId)) {
      return errorJson("Lista no encontrada", 404);
    }

    const body = await leerBody(req);
    if (!Array.isArray(body.conteos)) return errorJson("Faltan los conteos");

    const conteos: { insumoId: number; stock: number }[] = [];
    for (const c of body.conteos as { insumoId: unknown; stock: unknown }[]) {
      const insumoId = Number(c?.insumoId);
      const stock = Number(c?.stock);
      if (!Number.isInteger(insumoId) || insumoId <= 0) return errorJson("Conteo con insumo inválido");
      if (!Number.isFinite(stock) || stock < 0) return errorJson("El stock contado no puede ser negativo");
      conteos.push({ insumoId, stock });
    }

    responderRecuento(listaId, conteos, usuario.id);

    const lista = db.prepare(`SELECT ultima_revision FROM recuento_listas WHERE id = ?`).get(listaId) as {
      ultima_revision: string | null;
    };
    return NextResponse.json({ ok: true, ultimaRevision: lista.ultima_revision, ajustados: conteos.length });
  }, { escritura: true });
}
