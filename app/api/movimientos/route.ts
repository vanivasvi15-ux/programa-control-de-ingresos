import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usuarioActual } from "@/lib/auth";
import {
  SELECT_CON_JOINS,
  obtenerMovimiento,
  serializarMovimiento,
  validarDatosMovimiento,
  type MovimientoRow,
} from "@/lib/movimientos";

export const dynamic = "force-dynamic";

// GET /api/movimientos -> listado con filtros.
// Querystring (todos opcionales):
//   ?desde=AAAA-MM-DD  ?hasta=AAAA-MM-DD   (rango de fecha, inclusive)
//   ?tipo=ingreso|gasto
//   ?categoria_id=3
//   ?usuario_id=2      (lo ignora el rol "encargado": siempre ve sólo lo suyo)
//   ?estado=activo|pausado|anulado
//   ?recurrencia=unico|fijo|variable_recurrente
export async function GET(req: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const condiciones: string[] = [];
  const valores: (string | number)[] = [];

  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  if (desde) {
    condiciones.push("m.fecha >= ?");
    valores.push(desde);
  }
  if (hasta) {
    condiciones.push("m.fecha <= ?");
    valores.push(hasta);
  }

  const tipo = searchParams.get("tipo");
  if (tipo === "ingreso" || tipo === "gasto") {
    condiciones.push("m.tipo = ?");
    valores.push(tipo);
  }

  const categoriaId = searchParams.get("categoria_id");
  if (categoriaId && Number.isInteger(Number(categoriaId))) {
    condiciones.push("m.categoria_id = ?");
    valores.push(Number(categoriaId));
  }

  const estado = searchParams.get("estado");
  if (estado === "activo" || estado === "pausado" || estado === "anulado") {
    condiciones.push("m.estado = ?");
    valores.push(estado);
  }

  const recurrencia = searchParams.get("recurrencia");
  if (
    recurrencia === "unico" ||
    recurrencia === "fijo" ||
    recurrencia === "variable_recurrente"
  ) {
    condiciones.push("m.recurrencia = ?");
    valores.push(recurrencia);
  }

  // Alcance por rol: el encargado sólo ve lo que cargó él, sin importar
  // qué usuario_id pida. Dueño y contador ven todo y pueden filtrar.
  if (usuario.rol === "encargado") {
    condiciones.push("m.usuario_id = ?");
    valores.push(usuario.id);
  } else {
    const usuarioId = searchParams.get("usuario_id");
    if (usuarioId && Number.isInteger(Number(usuarioId))) {
      condiciones.push("m.usuario_id = ?");
      valores.push(Number(usuarioId));
    }
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  const filas = db
    .prepare(`${SELECT_CON_JOINS} ${where} ORDER BY m.fecha DESC, m.id DESC`)
    .all(...valores) as MovimientoRow[];

  return NextResponse.json(filas.map(serializarMovimiento));
}

// POST /api/movimientos -> carga un movimiento nuevo.
// body: { tipo, monto, categoria_id, fecha, recurrencia?, proxima_fecha?, nota? }
// - "contador" no puede cargar (sólo lectura).
// - origen se fija en 'panel' y usuario_id en el usuario logueado. El
//   canal de WhatsApp (fase 3) va a cargar con origen 'whatsapp' por su
//   propia vía; este endpoint es el del panel.
export async function POST(req: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
  }
  if (usuario.rol === "contador") {
    return NextResponse.json({ error: "El rol contador es de sólo lectura" }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const validacion = validarDatosMovimiento(body);
  if (!validacion.ok) {
    return NextResponse.json({ error: validacion.error }, { status: 400 });
  }
  const d = validacion.datos;

  const resultado = db
    .prepare(
      `INSERT INTO movimientos
         (tipo, monto, categoria_id, fecha, recurrencia, proxima_fecha, frecuencia, origen, usuario_id, estado, nota)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'panel', ?, ?, ?)`
    )
    .run(
      d.tipo,
      d.monto,
      d.categoria_id,
      d.fecha,
      d.recurrencia,
      d.proxima_fecha,
      d.frecuencia,
      usuario.id,
      d.estado,
      d.nota
    );

  const creado = obtenerMovimiento(Number(resultado.lastInsertRowid))!;
  return NextResponse.json(serializarMovimiento(creado), { status: 201 });
}
