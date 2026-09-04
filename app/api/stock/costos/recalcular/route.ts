import { NextResponse } from "next/server";
import { conUsuario } from "@/lib/api";
import { recalcularCostos } from "@/lib/stock";

export const dynamic = "force-dynamic";

// POST /api/stock/costos/recalcular -> rehace todos los costos calculados.
// Normalmente se recalcula solo al cambiar un precio, una receta o una
// composición; esto es el botón manual por si algo quedó desfasado.
export async function POST() {
  return conUsuario(() => {
    recalcularCostos();
    return NextResponse.json({ ok: true });
  }, { escritura: true });
}
