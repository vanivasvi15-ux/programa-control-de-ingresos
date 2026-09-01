import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usuarioActual, type Usuario } from "@/lib/auth";
import {
  obtenerMovimiento,
  serializarMovimiento,
  validarDatosMovimiento,
  type MovimientoRow,
} from "@/lib/movimientos";

export const dynamic = "force-dynamic";

// Reglas de acceso a un movimiento puntual:
//   dueño     -> cualquiera
//   encargado -> sólo los que cargó él
//   contador  -> ninguno para escribir (sólo lectura)
function puedeEscribir(usuario: Usuario, mov: MovimientoRow): { ok: true } | { ok: false; status: number; error: string } {
  if (usuario.rol === "contador") {
    return { ok: false, status: 403, error: "El rol contador es de sólo lectura" };
  }
  if (usuario.rol === "encargado" && mov.usuario_id !== usuario.id) {
    return { ok: false, status: 403, error: "Sólo podés modificar los movimientos que cargaste vos" };
  }
  return { ok: true };
}

// PUT /api/movimientos/5 -> edita un movimiento.
// body (todo opcional, lo que no venga se deja como está):
//   { tipo, monto, categoria_id, fecha, recurrencia, proxima_fecha, estado, nota }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
  }

  const { id: idParam } = await params;
  const id = Number(idParam);
  const actual = obtenerMovimiento(id);
  if (!actual) {
    return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
  }

  const permiso = puedeEscribir(usuario, actual);
  if (!permiso.ok) {
    return NextResponse.json({ error: permiso.error }, { status: permiso.status });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const validacion = validarDatosMovimiento(body, actual);
  if (!validacion.ok) {
    return NextResponse.json({ error: validacion.error }, { status: 400 });
  }
  const d = validacion.datos;

  db.prepare(
    `UPDATE movimientos SET
       tipo = ?, monto = ?, categoria_id = ?, fecha = ?, recurrencia = ?,
       proxima_fecha = ?, estado = ?, nota = ?,
       actualizado = datetime('now', 'localtime')
     WHERE id = ?`
  ).run(
    d.tipo,
    d.monto,
    d.categoria_id,
    d.fecha,
    d.recurrencia,
    d.proxima_fecha,
    d.estado,
    d.nota,
    id
  );

  return NextResponse.json(serializarMovimiento(obtenerMovimiento(id)!));
}

// DELETE /api/movimientos/5 -> NO borra la fila: la anula (estado =
// 'anulado'). Es plata, queremos que quede el registro. Para dar de baja
// temporalmente un fijo está el estado 'pausado' (vía PUT).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
  }

  const { id: idParam } = await params;
  const id = Number(idParam);
  const actual = obtenerMovimiento(id);
  if (!actual) {
    return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
  }

  const permiso = puedeEscribir(usuario, actual);
  if (!permiso.ok) {
    return NextResponse.json({ error: permiso.error }, { status: permiso.status });
  }

  db.prepare(
    `UPDATE movimientos SET estado = 'anulado', actualizado = datetime('now', 'localtime') WHERE id = ?`
  ).run(id);

  return NextResponse.json({ ok: true, anulado: true });
}
