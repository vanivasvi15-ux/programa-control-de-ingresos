import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { autorizarBridge } from "@/lib/bot-auth";

export const dynamic = "force-dynamic";

// GET -> todas las conversaciones del bot, con el último mensaje de cada
// una y el movimiento que generó (si llegó a registrarse). Más recientes
// primero. Sólo el dueño.
export async function GET(req: NextRequest) {
  const { comoDueno } = await autorizarBridge(req);
  if (!comoDueno) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const conversaciones = db
    .prepare(
      `SELECT jid, cliente, estado, motivo_escalado AS motivoEscalado,
              movimiento_id AS movimientoId, creado, actualizado
       FROM bot_conversaciones ORDER BY actualizado DESC`
    )
    .all() as {
    jid: string;
    cliente: string | null;
    estado: string;
    motivoEscalado: string | null;
    movimientoId: number | null;
    creado: string;
    actualizado: string;
  }[];

  const ultimoMensaje = db.prepare(
    `SELECT rol, texto, creado FROM bot_mensajes WHERE jid = ? ORDER BY id DESC LIMIT 1`
  );
  const movPorId = db.prepare(
    `SELECT m.id, m.tipo, m.monto, m.fecha, c.nombre AS categoriaNombre
     FROM movimientos m JOIN categorias c ON c.id = m.categoria_id WHERE m.id = ?`
  );

  return NextResponse.json(
    conversaciones.map((c) => ({
      ...c,
      ultimoMensaje: ultimoMensaje.get(c.jid) ?? null,
      movimiento: c.movimientoId ? movPorId.get(c.movimientoId) ?? null : null,
    }))
  );
}
