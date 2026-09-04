import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conUsuario, errorJson } from "@/lib/api";
import { revertirCompra } from "@/lib/stock";

export const dynamic = "force-dynamic";

// DELETE /api/compras-insumo/5 -> revierte la compra (compensa el stock y
// borra la fila; los movimientos de stock quedan como rastro).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async (usuario) => {
    const { id } = await params;
    const compra = db.prepare(`SELECT id, movimiento_id FROM compras_insumo WHERE id = ?`).get(Number(id)) as
      | { id: number; movimiento_id: number | null }
      | undefined;
    if (!compra) return errorJson("Compra no encontrada", 404);
    if (compra.movimiento_id) {
      return errorJson(
        "Esta compra ya generó un gasto en el Control de Caja; anulá primero ese movimiento (Paso 2).",
        409
      );
    }
    revertirCompra(compra.id, usuario.id);
    return NextResponse.json({ ok: true, revertida: true });
  }, { escritura: true });
}
