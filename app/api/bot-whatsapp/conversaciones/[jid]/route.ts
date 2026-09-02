import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { autorizarBridge } from "@/lib/bot-auth";

export const dynamic = "force-dynamic";

const ESTADOS = ["activa", "escalada", "finalizada"];

// PUT /api/bot-whatsapp/conversaciones/[jid] -> cambia el estado a mano
// desde el panel. Además encola un comando "control" para que el bot
// actualice su estado en memoria (reactivar / bloquear). Sólo el dueño.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ jid: string }> }) {
  const { comoDueno } = await autorizarBridge(req);
  if (!comoDueno) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { jid: jidParam } = await params;
  const jid = decodeURIComponent(jidParam);
  const { estado } = await req.json();
  if (!ESTADOS.includes(estado)) {
    return NextResponse.json({ error: `estado inválido: ${ESTADOS.join(", ")}` }, { status: 400 });
  }

  db.prepare(
    `UPDATE bot_conversaciones SET estado = ?, actualizado = datetime('now', 'localtime') WHERE jid = ?`
  ).run(estado, jid);

  const accion = estado === "activa" ? "reactivar" : "bloquear";
  db.prepare(`INSERT INTO bot_comandos (telefono, mensaje, tipo) VALUES (?, ?, 'control')`).run(
    jid,
    accion
  );

  return NextResponse.json({ ok: true });
}

// DELETE -> borra la conversación y su historial (no toca la memoria en
// vivo del bot). Sólo el dueño.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ jid: string }> }) {
  const { comoDueno } = await autorizarBridge(req);
  if (!comoDueno) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { jid: jidParam } = await params;
  const jid = decodeURIComponent(jidParam);
  db.prepare(`DELETE FROM bot_mensajes WHERE jid = ?`).run(jid);
  const r = db.prepare(`DELETE FROM bot_conversaciones WHERE jid = ?`).run(jid);
  if (r.changes === 0) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
