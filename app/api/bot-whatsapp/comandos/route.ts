import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { autorizarBridge } from "@/lib/bot-auth";

export const dynamic = "force-dynamic";

const MAX_INTENTOS = 5;
const TIPOS_VALIDOS = ["mensaje", "manual", "control", "aviso"];

// GET ?estado=pendiente -> el bot consulta qué mensajes tiene que mandar.
// Descarta los que ya se intentaron demasiadas veces (MAX_INTENTOS) y
// suma 1 a "intentos" de los que devuelve ANTES de dárselos al bot (para
// que el conteo sea correcto aunque el bot se caiga a mitad de mandar).
export async function GET(req: NextRequest) {
  const { comoBot } = await autorizarBridge(req);
  if (!comoBot) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const estado = new URL(req.url).searchParams.get("estado") || "pendiente";

  if (estado === "pendiente") {
    db.prepare(
      `UPDATE bot_comandos SET estado = 'error',
         error = 'Demasiados intentos fallidos, se dejó de reintentar'
       WHERE estado = 'pendiente' AND intentos >= ?`
    ).run(MAX_INTENTOS);
  }

  const comandos = db
    .prepare(
      `SELECT id, telefono, mensaje, tipo, estado, intentos, creado
       FROM bot_comandos WHERE estado = ? ORDER BY id ASC`
    )
    .all(estado) as { id: number }[];

  if (estado === "pendiente" && comandos.length > 0) {
    const sumar = db.prepare(`UPDATE bot_comandos SET intentos = intentos + 1 WHERE id = ?`);
    for (const c of comandos) sumar.run(c.id);
  }

  return NextResponse.json(comandos);
}

// POST -> encola un mensaje para que el bot lo mande.
// body: { telefono, mensaje, tipo? }
//   - lo usa el panel para respuestas a mano (tipo "manual") y para
//     cambiar el estado en memoria del bot (tipo "control").
//   - lo usa el cron de alertas (tipo "aviso").
export async function POST(req: NextRequest) {
  const { comoDueno, comoBot } = await autorizarBridge(req);
  if (!comoDueno && !comoBot) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { telefono, mensaje, tipo } = body;
  if (!telefono || !mensaje) {
    return NextResponse.json({ error: "Faltan telefono y mensaje" }, { status: 400 });
  }

  // Si llegó un número pelado, buscar el jid exacto de una conversación ya
  // registrada (WhatsApp a veces usa el formato "@lid" en vez de
  // "numero@s.whatsapp.net" para el mismo contacto).
  let destino = String(telefono);
  if (!destino.includes("@")) {
    const digitos = destino.replace(/\D/g, "");
    const conv = db
      .prepare(
        `SELECT jid FROM bot_conversaciones WHERE jid LIKE ? ORDER BY actualizado DESC LIMIT 1`
      )
      .get(`${digitos}@%`) as { jid: string } | undefined;
    if (conv) destino = conv.jid;
  }

  const r = db
    .prepare(`INSERT INTO bot_comandos (telefono, mensaje, tipo) VALUES (?, ?, ?)`)
    .run(destino, mensaje, TIPOS_VALIDOS.includes(tipo) ? tipo : "mensaje");

  return NextResponse.json({ id: Number(r.lastInsertRowid) }, { status: 201 });
}
