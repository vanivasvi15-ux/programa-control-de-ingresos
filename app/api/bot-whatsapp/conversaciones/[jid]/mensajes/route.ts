import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { autorizarBridge } from "@/lib/bot-auth";

export const dynamic = "force-dynamic";

// GET -> historial completo de una conversación, en orden. Sólo el dueño.
export async function GET(req: NextRequest, { params }: { params: Promise<{ jid: string }> }) {
  const { comoDueno } = await autorizarBridge(req);
  if (!comoDueno) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { jid } = await params;
  const mensajes = db
    .prepare(`SELECT id, rol, texto, creado FROM bot_mensajes WHERE jid = ? ORDER BY id ASC`)
    .all(decodeURIComponent(jid));
  return NextResponse.json(mensajes);
}
