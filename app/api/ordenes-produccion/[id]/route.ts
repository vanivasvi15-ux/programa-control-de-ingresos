import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conUsuario, leerBody, errorJson } from "@/lib/api";
import { realizarOrden, anularOrden, FaltaMaterial } from "@/lib/stock";
import { esFechaValida } from "@/lib/movimientos-datos";

export const dynamic = "force-dynamic";

type OrdenRow = {
  id: number;
  producto_base_id: number;
  cantidad: number;
  estado: string;
  fecha: string;
  costo_total: number | null;
  usuario_id: number | null;
  nota: string | null;
  creado: string;
  actualizado: string;
};

const SELECT_JOIN = `
  SELECT o.*, b.nombre AS pieza_nombre, u.nombre AS usuario_nombre
  FROM ordenes_produccion o
  JOIN productos_base b ON b.id = o.producto_base_id
  LEFT JOIN usuarios u ON u.id = o.usuario_id
`;

function serializar(o: OrdenRow & { pieza_nombre?: string; usuario_nombre?: string | null }) {
  return {
    id: o.id,
    productoBaseId: o.producto_base_id,
    piezaNombre: o.pieza_nombre ?? null,
    cantidad: o.cantidad,
    estado: o.estado,
    fecha: o.fecha,
    costoTotal: o.costo_total,
    usuarioId: o.usuario_id,
    usuarioNombre: o.usuario_nombre ?? null,
    nota: o.nota,
    creado: o.creado,
    actualizado: o.actualizado,
  };
}

function traer(id: number) {
  return db.prepare(`${SELECT_JOIN} WHERE o.id = ?`).get(id) as
    | (OrdenRow & { pieza_nombre: string; usuario_nombre: string | null })
    | undefined;
}

// PUT /api/ordenes-produccion/5
// body: { estado?: 'realizada'|'anulada', cantidad?, fecha?, nota? }
// - estado='realizada' descuenta insumos y suma piezas (o 422 si falta material).
// - estado='anulada' revierte si estaba realizada.
// - cantidad/fecha/nota sólo se editan si la orden sigue 'planificada'.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async (usuario) => {
    const { id } = await params;
    const orden = traer(Number(id));
    if (!orden) return errorJson("Orden no encontrada", 404);

    const body = await leerBody(req);

    if (body.estado === "realizada") {
      if (orden.estado !== "planificada") return errorJson(`La orden ya está '${orden.estado}'`);
      try {
        realizarOrden(orden.id, usuario.id);
      } catch (e) {
        if (e instanceof FaltaMaterial) {
          return NextResponse.json(
            { error: "Falta material para fabricar esa cantidad", faltan: e.faltan },
            { status: 422 }
          );
        }
        throw e;
      }
      return NextResponse.json(serializar(traer(orden.id)!));
    }

    if (body.estado === "anulada") {
      anularOrden(orden.id, usuario.id);
      return NextResponse.json(serializar(traer(orden.id)!));
    }

    // edición de campos (sólo planificada)
    if (orden.estado !== "planificada") {
      return errorJson("Sólo se puede editar una orden que sigue planificada");
    }
    const cambios: string[] = [];
    const val: (string | number)[] = [];
    if (body.cantidad !== undefined) {
      const c = Number(body.cantidad);
      if (!Number.isInteger(c) || c <= 0) return errorJson("Cantidad inválida");
      cambios.push("cantidad = ?");
      val.push(c);
    }
    if (body.fecha !== undefined) {
      if (typeof body.fecha !== "string" || !esFechaValida(body.fecha)) return errorJson("Fecha inválida");
      cambios.push("fecha = ?");
      val.push(body.fecha);
    }
    if (body.nota !== undefined) {
      cambios.push("nota = ?");
      val.push(typeof body.nota === "string" && body.nota.trim() ? body.nota.trim() : "");
    }
    if (cambios.length) {
      cambios.push("actualizado = datetime('now','localtime')");
      db.prepare(`UPDATE ordenes_produccion SET ${cambios.join(", ")} WHERE id = ?`).run(...val, orden.id);
    }
    return NextResponse.json(serializar(traer(orden.id)!));
  }, { escritura: true });
}

// DELETE -> anula (misma lógica que estado='anulada'; no borra físico si
// tuvo movimientos de stock).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async (usuario) => {
    const { id } = await params;
    const orden = traer(Number(id));
    if (!orden) return errorJson("Orden no encontrada", 404);

    if (orden.estado === "planificada") {
      db.prepare(`DELETE FROM ordenes_produccion WHERE id = ?`).run(orden.id);
      return NextResponse.json({ ok: true, borrada: true });
    }
    anularOrden(orden.id, usuario.id);
    return NextResponse.json({ ok: true, anulada: true });
  }, { escritura: true });
}
