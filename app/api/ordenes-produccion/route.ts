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

const SELECT_JOIN = `
  SELECT o.*, b.nombre AS pieza_nombre, u.nombre AS usuario_nombre
  FROM ordenes_produccion o
  JOIN productos_base b ON b.id = o.producto_base_id
  LEFT JOIN usuarios u ON u.id = o.usuario_id
`;

// GET /api/ordenes-produccion -> ?estado ?producto_base_id ?desde ?hasta
export async function GET(req: NextRequest) {
  return conUsuario(() => {
    const { searchParams } = new URL(req.url);
    const cond: string[] = [];
    const val: (string | number)[] = [];

    const estado = searchParams.get("estado");
    if (estado === "planificada" || estado === "realizada" || estado === "anulada") {
      cond.push("o.estado = ?");
      val.push(estado);
    }
    const pbid = searchParams.get("producto_base_id");
    if (pbid && Number.isInteger(Number(pbid))) {
      cond.push("o.producto_base_id = ?");
      val.push(Number(pbid));
    }
    const desde = searchParams.get("desde");
    if (desde) {
      cond.push("o.fecha >= ?");
      val.push(desde);
    }
    const hasta = searchParams.get("hasta");
    if (hasta) {
      cond.push("o.fecha <= ?");
      val.push(hasta);
    }
    const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
    const filas = db
      .prepare(`${SELECT_JOIN} ${where} ORDER BY o.fecha DESC, o.id DESC`)
      .all(...val) as (OrdenRow & { pieza_nombre: string; usuario_nombre: string | null })[];
    return NextResponse.json(filas.map(serializar));
  });
}

// POST /api/ordenes-produccion
// body: { productoBaseId, cantidad, fecha?, nota?, realizar? }
// Si realizar=true, se crea y se marca realizada de una (descuenta stock).
export async function POST(req: NextRequest) {
  return conUsuario(async (usuario) => {
    const body = await leerBody(req);
    const piezaId = Number(body.productoBaseId);
    const pieza = db.prepare(`SELECT id FROM productos_base WHERE id = ?`).get(piezaId);
    if (!pieza) return errorJson("La pieza no existe");

    const cantidad = Number(body.cantidad);
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      return errorJson("La cantidad tiene que ser un entero mayor a 0");
    }
    const fecha =
      typeof body.fecha === "string" && esFechaValida(body.fecha)
        ? body.fecha
        : new Date().toISOString().slice(0, 10);
    const nota = typeof body.nota === "string" && body.nota.trim() ? body.nota.trim() : null;

    const r = db
      .prepare(
        `INSERT INTO ordenes_produccion (producto_base_id, cantidad, fecha, usuario_id, nota) VALUES (?, ?, ?, ?, ?)`
      )
      .run(piezaId, cantidad, fecha, usuario.id, nota);
    const ordenId = Number(r.lastInsertRowid);

    if (body.realizar === true) {
      try {
        realizarOrden(ordenId, usuario.id);
      } catch (e) {
        if (e instanceof FaltaMaterial) {
          // deshacer la orden recién creada para no dejarla colgada
          anularOrden(ordenId, usuario.id);
          db.prepare(`DELETE FROM ordenes_produccion WHERE id = ? AND estado = 'anulada'`).run(ordenId);
          return NextResponse.json(
            { error: "Falta material para fabricar esa cantidad", faltan: e.faltan },
            { status: 422 }
          );
        }
        throw e;
      }
    }

    const creada = db
      .prepare(`${SELECT_JOIN} WHERE o.id = ?`)
      .get(ordenId) as OrdenRow & { pieza_nombre: string; usuario_nombre: string | null };
    return NextResponse.json(serializar(creada), { status: 201 });
  }, { escritura: true });
}
