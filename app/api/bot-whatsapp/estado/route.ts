import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { autorizarBridge } from "@/lib/bot-auth";

export const dynamic = "force-dynamic";

type Fila = {
  pausado: number;
  conectado: number;
  qr: string | null;
  conectar: number;
  cambiar_numero_solicitado: number;
};

function obtenerOCrear(): Fila {
  let fila = db.prepare(`SELECT * FROM bot_whatsapp_estado WHERE id = 1`).get() as Fila | undefined;
  if (!fila) {
    db.prepare(`INSERT INTO bot_whatsapp_estado (id) VALUES (1)`).run();
    fila = db.prepare(`SELECT * FROM bot_whatsapp_estado WHERE id = 1`).get() as Fila;
  }
  return fila;
}

function aRespuesta(f: Fila) {
  return {
    pausado: !!f.pausado,
    conectado: !!f.conectado,
    qr: f.qr,
    conectar: !!f.conectar,
    cambiarNumeroSolicitado: !!f.cambiar_numero_solicitado,
  };
}

// GET -> estado del bot (lo lee el panel y el propio bot).
export async function GET(req: NextRequest) {
  const { comoDueno, comoBot } = await autorizarBridge(req);
  if (!comoDueno && !comoBot) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.json(aRespuesta(obtenerOCrear()));
}

// PUT -> el bot reporta conexión/QR; el panel pausa/reactiva, prende/apaga
// y pide cambiar de número. body: subconjunto de
// { pausado?, conectado?, qr?, conectar?, cambiarNumeroSolicitado? }
export async function PUT(req: NextRequest) {
  const { comoDueno, comoBot } = await autorizarBridge(req);
  if (!comoDueno && !comoBot) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  obtenerOCrear();
  const body = await req.json();
  const campos: string[] = [];
  const valores: (string | number | null)[] = [];

  if ("pausado" in body) {
    campos.push("pausado = ?");
    valores.push(body.pausado ? 1 : 0);
  }
  if ("conectado" in body) {
    campos.push("conectado = ?");
    valores.push(body.conectado ? 1 : 0);
  }
  if ("qr" in body) {
    campos.push("qr = ?");
    valores.push(body.qr ?? null);
  }
  if ("conectar" in body) {
    campos.push("conectar = ?");
    valores.push(body.conectar ? 1 : 0);
  }
  if ("cambiarNumeroSolicitado" in body) {
    campos.push("cambiar_numero_solicitado = ?");
    valores.push(body.cambiarNumeroSolicitado ? 1 : 0);
  }

  if (campos.length === 0) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  }

  db.prepare(`UPDATE bot_whatsapp_estado SET ${campos.join(", ")} WHERE id = 1`).run(...valores);
  return NextResponse.json(aRespuesta(db.prepare(`SELECT * FROM bot_whatsapp_estado WHERE id = 1`).get() as Fila));
}
