import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usuarioActual } from "@/lib/auth";
import { validarParametrosAlerta, type TipoAlerta } from "@/lib/alertas";

export const dynamic = "force-dynamic";

type AlertaRow = {
  id: number;
  tipo: TipoAlerta;
  parametros_json: string;
  usuario_id_destino: number | null;
  activo: number;
};

// PUT /api/alertas-config/5 -> edita parámetros, destinatario y/o activo.
// body (todo opcional): { parametros?, usuarioIdDestino?, activo? }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
  }
  if (usuario.rol !== "dueño") {
    return NextResponse.json({ error: "Sólo el dueño puede configurar alertas" }, { status: 403 });
  }

  const { id: idParam } = await params;
  const id = Number(idParam);
  const actual = db.prepare(`SELECT * FROM alertas_config WHERE id = ?`).get(id) as
    | AlertaRow
    | undefined;
  if (!actual) {
    return NextResponse.json({ error: "Alerta no encontrada" }, { status: 404 });
  }

  const body = await req.json();

  let parametrosJson = actual.parametros_json;
  if (body.parametros !== undefined) {
    const validacion = validarParametrosAlerta(actual.tipo, body.parametros ?? {});
    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }
    parametrosJson = JSON.stringify(validacion.parametros);
  }

  let usuarioIdDestino = actual.usuario_id_destino;
  if (body.usuarioIdDestino !== undefined) {
    if (body.usuarioIdDestino == null) {
      usuarioIdDestino = null;
    } else {
      const destino = db
        .prepare(`SELECT id FROM usuarios WHERE id = ? AND activo = 1`)
        .get(Number(body.usuarioIdDestino));
      if (!destino) {
        return NextResponse.json(
          { error: "El destinatario no existe o está inactivo" },
          { status: 400 }
        );
      }
      usuarioIdDestino = Number(body.usuarioIdDestino);
    }
  }

  const activo = typeof body.activo === "boolean" ? (body.activo ? 1 : 0) : actual.activo;

  db.prepare(
    `UPDATE alertas_config SET parametros_json = ?, usuario_id_destino = ?, activo = ? WHERE id = ?`
  ).run(parametrosJson, usuarioIdDestino, activo, id);

  return NextResponse.json({ ok: true });
}

// DELETE /api/alertas-config/5
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
  }
  if (usuario.rol !== "dueño") {
    return NextResponse.json({ error: "Sólo el dueño puede configurar alertas" }, { status: 403 });
  }

  const { id: idParam } = await params;
  const id = Number(idParam);
  const resultado = db.prepare(`DELETE FROM alertas_config WHERE id = ?`).run(id);
  if (resultado.changes === 0) {
    return NextResponse.json({ error: "Alerta no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
