import { NextRequest, NextResponse } from "next/server";
import { db, transaccion } from "@/lib/db";
import { usuarioActual } from "@/lib/auth";
import {
  avanzarFecha,
  esFechaValida,
  obtenerMovimiento,
  serializarMovimiento,
} from "@/lib/movimientos";

export const dynamic = "force-dynamic";

// POST /api/movimientos/5/registrar
// "Registra" un fijo / variable recurrente: crea un movimiento único con
// los datos del fijo y corre su proxima_fecha hacia adelante según la
// frecuencia. El movimiento nuevo queda enlazado por generado_por_fijo_id.
//
// body (opcional):
//   { monto?: number, fecha?: "AAAA-MM-DD", nota?: string }
//   - monto: para variable_recurrente, cuánto salió esta vez (si no viene,
//     usa el monto del fijo).
//   - fecha: cuándo se pagó/cobró (si no viene, usa la proxima_fecha del fijo).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
  }
  if (usuario.rol === "contador") {
    return NextResponse.json({ error: "El rol contador es de sólo lectura" }, { status: 403 });
  }

  const { id: idParam } = await params;
  const id = Number(idParam);
  const fijo = obtenerMovimiento(id);
  if (!fijo) {
    return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
  }
  if (usuario.rol === "encargado" && fijo.usuario_id !== usuario.id) {
    return NextResponse.json(
      { error: "Sólo podés registrar los fijos que cargaste vos" },
      { status: 403 }
    );
  }
  if (fijo.recurrencia === "unico") {
    return NextResponse.json({ error: "Ese movimiento no es un fijo" }, { status: 400 });
  }
  if (fijo.estado !== "activo") {
    return NextResponse.json(
      { error: "El fijo está pausado o anulado; reactivalo antes de registrarlo" },
      { status: 400 }
    );
  }
  if (!fijo.proxima_fecha || !fijo.frecuencia) {
    return NextResponse.json(
      { error: "El fijo no tiene próxima fecha o frecuencia cargada" },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const fecha = body.fecha !== undefined ? body.fecha : fijo.proxima_fecha;
  if (!esFechaValida(fecha)) {
    return NextResponse.json({ error: "Fecha inválida (AAAA-MM-DD)" }, { status: 400 });
  }

  const monto = body.monto !== undefined ? Number(body.monto) : fijo.monto;
  if (!Number.isInteger(monto) || monto <= 0) {
    return NextResponse.json({ error: "El monto tiene que ser un entero mayor a 0" }, { status: 400 });
  }

  const nota =
    typeof body.nota === "string" && body.nota.trim()
      ? body.nota.trim()
      : fijo.nota;

  const nuevaProxima = avanzarFecha(fijo.proxima_fecha, fijo.frecuencia);

  try {
    const nuevoId = transaccion(() => {
      const resultado = db
        .prepare(
          `INSERT INTO movimientos
             (tipo, monto, categoria_id, fecha, recurrencia, proxima_fecha, frecuencia,
              generado_por_fijo_id, origen, usuario_id, estado, nota)
           VALUES (?, ?, ?, ?, 'unico', NULL, NULL, ?, 'panel', ?, 'activo', ?)`
        )
        .run(fijo.tipo, monto, fijo.categoria_id, fecha, fijo.id, usuario.id, nota);

      db.prepare(
        `UPDATE movimientos SET proxima_fecha = ?, actualizado = datetime('now', 'localtime') WHERE id = ?`
      ).run(nuevaProxima, fijo.id);

      return Number(resultado.lastInsertRowid);
    });

    const creado = obtenerMovimiento(nuevoId)!;
    return NextResponse.json(
      { movimiento: serializarMovimiento(creado), proximaFecha: nuevaProxima },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "No se pudo registrar el fijo" }, { status: 500 });
  }
}
