import { NextRequest, NextResponse } from "next/server";
import { conUsuario, errorJson } from "@/lib/api";
import { deshacerEscaneo } from "@/lib/stock";

export const dynamic = "force-dynamic";

// DELETE /api/escaneos/12 → deshace ese escaneo (devuelve materiales y saca
// las piezas que había sumado). 409 si esas piezas ya no están en stock.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async (usuario) => {
    const { id } = await params;
    try {
      deshacerEscaneo(Number(id), usuario.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo deshacer";
      if (msg.includes("no encontrado")) return errorJson(msg, 404);
      if (msg.includes("negativo")) {
        return errorJson(
          "No se puede deshacer: esas piezas ya no están en stock (se vendieron o se usaron).",
          409
        );
      }
      return errorJson(msg, 409);
    }
    return NextResponse.json({ ok: true });
  }, { escritura: true });
}
