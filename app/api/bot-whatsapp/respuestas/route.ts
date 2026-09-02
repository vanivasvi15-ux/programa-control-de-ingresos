import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { autorizarBridge } from "@/lib/bot-auth";

export const dynamic = "force-dynamic";

// GET -> mensajes predeterminados para responder a mano desde el panel.
export async function GET(req: NextRequest) {
  const { comoDueno } = await autorizarBridge(req);
  if (!comoDueno) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const filas = db
    .prepare(`SELECT id, etiqueta, texto, orden FROM bot_respuestas_predeterminadas ORDER BY orden, id`)
    .all();
  return NextResponse.json(filas);
}

// POST -> crea uno. body: { etiqueta, texto }
export async function POST(req: NextRequest) {
  const { comoDueno } = await autorizarBridge(req);
  if (!comoDueno) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const etiqueta = typeof body.etiqueta === "string" ? body.etiqueta.trim() : "";
  const texto = typeof body.texto === "string" ? body.texto.trim() : "";
  if (!etiqueta || !texto) {
    return NextResponse.json({ error: "Faltan etiqueta y texto" }, { status: 400 });
  }

  const max = db.prepare(`SELECT MAX(orden) AS m FROM bot_respuestas_predeterminadas`).get() as {
    m: number | null;
  };
  const r = db
    .prepare(`INSERT INTO bot_respuestas_predeterminadas (etiqueta, texto, orden) VALUES (?, ?, ?)`)
    .run(etiqueta, texto, (max.m ?? -1) + 1);

  return NextResponse.json({ id: Number(r.lastInsertRowid) }, { status: 201 });
}
