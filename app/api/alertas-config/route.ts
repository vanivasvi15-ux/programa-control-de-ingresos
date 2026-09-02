import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usuarioActual } from "@/lib/auth";
import { TIPOS_ALERTA, validarParametrosAlerta, type TipoAlerta } from "@/lib/alertas";

export const dynamic = "force-dynamic";

type AlertaRow = {
  id: number;
  tipo: TipoAlerta;
  parametros_json: string;
  usuario_id_destino: number | null;
  activo: number;
  creado: string;
};

function serializar(a: AlertaRow) {
  let parametros: Record<string, unknown> = {};
  try {
    parametros = JSON.parse(a.parametros_json || "{}");
  } catch {
    parametros = {};
  }
  return {
    id: a.id,
    tipo: a.tipo,
    parametros,
    usuarioIdDestino: a.usuario_id_destino,
    activo: !!a.activo,
    creado: a.creado,
  };
}

// GET /api/alertas-config -> lista todas las alertas configuradas.
// Sólo el dueño (es configuración sensible).
export async function GET(req: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
  }
  if (usuario.rol !== "dueño") {
    return NextResponse.json({ error: "Sólo el dueño ve la configuración de alertas" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo");
  const filas = (
    tipo && TIPOS_ALERTA.includes(tipo as TipoAlerta)
      ? db.prepare(`SELECT * FROM alertas_config WHERE tipo = ? ORDER BY id`).all(tipo)
      : db.prepare(`SELECT * FROM alertas_config ORDER BY id`).all()
  ) as AlertaRow[];

  return NextResponse.json(filas.map(serializar));
}

// POST /api/alertas-config -> crea una alerta.
// body: { tipo, parametros: {...}, usuarioIdDestino?, activo? }
export async function POST(req: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
  }
  if (usuario.rol !== "dueño") {
    return NextResponse.json({ error: "Sólo el dueño puede configurar alertas" }, { status: 403 });
  }

  const body = await req.json();
  const tipo = body.tipo;
  if (!TIPOS_ALERTA.includes(tipo)) {
    return NextResponse.json({ error: "Tipo de alerta inválido" }, { status: 400 });
  }

  const validacion = validarParametrosAlerta(tipo, body.parametros ?? {});
  if (!validacion.ok) {
    return NextResponse.json({ error: validacion.error }, { status: 400 });
  }

  let usuarioIdDestino: number | null = null;
  if (body.usuarioIdDestino != null) {
    const destino = db
      .prepare(`SELECT id FROM usuarios WHERE id = ? AND activo = 1`)
      .get(Number(body.usuarioIdDestino));
    if (!destino) {
      return NextResponse.json({ error: "El destinatario no existe o está inactivo" }, { status: 400 });
    }
    usuarioIdDestino = Number(body.usuarioIdDestino);
  }

  const activo = typeof body.activo === "boolean" ? (body.activo ? 1 : 0) : 1;

  const resultado = db
    .prepare(
      `INSERT INTO alertas_config (tipo, parametros_json, usuario_id_destino, activo)
       VALUES (?, ?, ?, ?)`
    )
    .run(tipo, JSON.stringify(validacion.parametros), usuarioIdDestino, activo);

  return NextResponse.json({ id: Number(resultado.lastInsertRowid) }, { status: 201 });
}
