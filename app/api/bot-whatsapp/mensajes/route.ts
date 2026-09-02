import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { autorizarBridge } from "@/lib/bot-auth";

export const dynamic = "force-dynamic";

// POST -> el bot loguea acá cada mensaje (del cliente o propio) y de paso
// mantiene bot_conversaciones al día (crea la fila la primera vez que ve
// ese jid, actualiza cliente/estado/movimiento_id).
// body: { jid, rol: "cliente"|"bot"|"empleado", texto, cliente?, estado?,
//         motivoEscalado?, movimientoId? }
export async function POST(req: NextRequest) {
  const { comoBot, comoDueno } = await autorizarBridge(req);
  if (!comoBot && !comoDueno) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { jid, rol, texto, cliente, estado, motivoEscalado, movimientoId } = body;

  if (!jid || !["cliente", "bot", "empleado"].includes(rol) || typeof texto !== "string") {
    return NextResponse.json(
      { error: "Faltan datos: jid, rol (cliente|bot|empleado) y texto" },
      { status: 400 }
    );
  }

  db.prepare(`INSERT INTO bot_mensajes (jid, rol, texto) VALUES (?, ?, ?)`).run(jid, rol, texto);

  const existe = db.prepare(`SELECT jid FROM bot_conversaciones WHERE jid = ?`).get(jid);
  if (existe) {
    const campos = ["actualizado = datetime('now', 'localtime')"];
    const valores: (string | number | null)[] = [];
    if (cliente !== undefined) {
      campos.push("cliente = ?");
      valores.push(cliente);
    }
    if (estado !== undefined && ["activa", "escalada", "finalizada"].includes(estado)) {
      campos.push("estado = ?", "motivo_escalado = ?");
      valores.push(estado, estado === "escalada" ? motivoEscalado ?? null : null);
    }
    if (movimientoId !== undefined) {
      campos.push("movimiento_id = ?");
      valores.push(movimientoId);
    }
    db.prepare(`UPDATE bot_conversaciones SET ${campos.join(", ")} WHERE jid = ?`).run(...valores, jid);
  } else {
    db.prepare(
      `INSERT INTO bot_conversaciones (jid, cliente, estado, motivo_escalado, movimiento_id)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      jid,
      cliente ?? null,
      ["activa", "escalada", "finalizada"].includes(estado) ? estado : "activa",
      estado === "escalada" ? motivoEscalado ?? null : null,
      movimientoId ?? null
    );
  }

  return NextResponse.json({ ok: true });
}
