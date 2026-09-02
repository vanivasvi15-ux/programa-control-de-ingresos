import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { autorizarBridge } from "@/lib/bot-auth";

export const dynamic = "force-dynamic";

// PUT /api/bot-whatsapp/comandos/123 -> el bot marca si pudo mandarlo.
// body: { estado: "enviado"|"error", error? }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { comoBot } = await autorizarBridge(req);
  if (!comoBot) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id: idParam } = await params;
  const id = Number(idParam);
  const body = await req.json();
  if (!body.estado) {
    return NextResponse.json({ error: "Falta el campo estado" }, { status: 400 });
  }

  const r = db
    .prepare(
      `UPDATE bot_comandos SET estado = ?, error = ?, enviado = datetime('now', 'localtime') WHERE id = ?`
    )
    .run(body.estado, body.error ?? null, id);

  if (r.changes === 0) {
    return NextResponse.json({ error: "Comando no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
