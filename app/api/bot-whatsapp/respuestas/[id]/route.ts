import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { autorizarBridge } from "@/lib/bot-auth";

export const dynamic = "force-dynamic";

// PUT -> edita etiqueta/texto/orden. DELETE -> borra. Sólo el dueño.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { comoDueno } = await autorizarBridge(req);
  if (!comoDueno) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id: idParam } = await params;
  const id = Number(idParam);
  const body = await req.json();
  const campos: string[] = [];
  const valores: (string | number)[] = [];

  if (typeof body.etiqueta === "string" && body.etiqueta.trim()) {
    campos.push("etiqueta = ?");
    valores.push(body.etiqueta.trim());
  }
  if (typeof body.texto === "string" && body.texto.trim()) {
    campos.push("texto = ?");
    valores.push(body.texto.trim());
  }
  if (typeof body.orden === "number") {
    campos.push("orden = ?");
    valores.push(body.orden);
  }
  if (campos.length === 0) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  }

  db.prepare(`UPDATE bot_respuestas_predeterminadas SET ${campos.join(", ")} WHERE id = ?`).run(
    ...valores,
    id
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { comoDueno } = await autorizarBridge(req);
  if (!comoDueno) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id: idParam } = await params;
  const r = db.prepare(`DELETE FROM bot_respuestas_predeterminadas WHERE id = ?`).run(Number(idParam));
  if (r.changes === 0) {
    return NextResponse.json({ error: "No se encontró ese mensaje" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
