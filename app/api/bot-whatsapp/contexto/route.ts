import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { autorizarBridge } from "@/lib/bot-auth";
import { resolverUsuarioPorNumero } from "@/lib/bot-numero";

export const dynamic = "force-dynamic";

// GET /api/bot-whatsapp/contexto?numero=<numero o jid>
// El bot lo llama al recibir un mensaje: le dice quién está escribiendo
// (para el permiso) y la lista de categorías activas (para que la IA
// clasifique el gasto/ingreso). Sólo el bot.
export async function GET(req: NextRequest) {
  const { comoBot } = await autorizarBridge(req);
  if (!comoBot) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const numero = new URL(req.url).searchParams.get("numero") ?? "";
  const usuario = numero ? resolverUsuarioPorNumero(numero) : null;

  const categorias = db
    .prepare(`SELECT id, nombre, tipo FROM categorias WHERE activo = 1 ORDER BY tipo, nombre`)
    .all();

  return NextResponse.json({ usuario, categorias });
}
