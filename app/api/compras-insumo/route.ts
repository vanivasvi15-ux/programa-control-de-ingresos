import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conUsuario, leerBody, errorJson } from "@/lib/api";
import { aplicarCompra } from "@/lib/stock";
import { esFechaValida } from "@/lib/movimientos-datos";

export const dynamic = "force-dynamic";

type CompraRow = {
  id: number;
  insumo_id: number;
  cantidad_compra: number;
  costo_unitario: number;
  costo_total: number;
  actualiza_costo: number;
  movimiento_id: number | null;
  proveedor: string | null;
  fecha: string;
  usuario_id: number | null;
  nota: string | null;
  creado: string;
};

function serializar(c: CompraRow & { insumo_nombre?: string; usuario_nombre?: string | null }) {
  return {
    id: c.id,
    insumoId: c.insumo_id,
    insumoNombre: c.insumo_nombre ?? null,
    cantidadCompra: c.cantidad_compra,
    costoUnitario: c.costo_unitario,
    costoTotal: c.costo_total,
    actualizaCosto: !!c.actualiza_costo,
    movimientoId: c.movimiento_id,
    proveedor: c.proveedor,
    fecha: c.fecha,
    usuarioId: c.usuario_id,
    usuarioNombre: c.usuario_nombre ?? null,
    nota: c.nota,
    creado: c.creado,
  };
}

const SELECT_JOIN = `
  SELECT c.*, i.nombre AS insumo_nombre, u.nombre AS usuario_nombre
  FROM compras_insumo c
  JOIN insumos i ON i.id = c.insumo_id
  LEFT JOIN usuarios u ON u.id = c.usuario_id
`;

// GET /api/compras-insumo -> ?insumo_id ?desde ?hasta
export async function GET(req: NextRequest) {
  return conUsuario(() => {
    const { searchParams } = new URL(req.url);
    const cond: string[] = [];
    const val: (string | number)[] = [];
    const iid = searchParams.get("insumo_id");
    if (iid && Number.isInteger(Number(iid))) {
      cond.push("c.insumo_id = ?");
      val.push(Number(iid));
    }
    const desde = searchParams.get("desde");
    if (desde) {
      cond.push("c.fecha >= ?");
      val.push(desde);
    }
    const hasta = searchParams.get("hasta");
    if (hasta) {
      cond.push("c.fecha <= ?");
      val.push(hasta);
    }
    const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
    const filas = db
      .prepare(`${SELECT_JOIN} ${where} ORDER BY c.fecha DESC, c.id DESC`)
      .all(...val) as (CompraRow & { insumo_nombre: string; usuario_nombre: string | null })[];
    return NextResponse.json(filas.map(serializar));
  });
}

// POST /api/compras-insumo
// body: { insumoId, cantidadCompra, costoUnitario, actualizaCosto?, proveedor?, fecha?, nota? }
export async function POST(req: NextRequest) {
  return conUsuario(async (usuario) => {
    const body = await leerBody(req);
    const insumoId = Number(body.insumoId);
    if (!db.prepare(`SELECT id FROM insumos WHERE id = ?`).get(insumoId)) {
      return errorJson("El insumo no existe");
    }
    const cantidadCompra = Number(body.cantidadCompra);
    if (!Number.isFinite(cantidadCompra) || cantidadCompra <= 0) {
      return errorJson("La cantidad comprada tiene que ser mayor a 0");
    }
    const costoUnitario = Math.round(Number(body.costoUnitario));
    if (!Number.isInteger(costoUnitario) || costoUnitario < 0) {
      return errorJson("El costo unitario tiene que ser un entero de pesos ≥ 0");
    }
    const fecha =
      typeof body.fecha === "string" && esFechaValida(body.fecha)
        ? body.fecha
        : new Date().toISOString().slice(0, 10);
    const proveedor =
      typeof body.proveedor === "string" && body.proveedor.trim() ? body.proveedor.trim() : null;
    const nota = typeof body.nota === "string" && body.nota.trim() ? body.nota.trim() : null;
    const actualizaCosto = body.actualizaCosto === false ? false : true;

    const compraId = aplicarCompra({
      insumoId,
      cantidadCompra,
      costoUnitario,
      actualizaCosto,
      proveedor,
      fecha,
      nota,
      usuarioId: usuario.id,
    });

    const creada = db
      .prepare(`${SELECT_JOIN} WHERE c.id = ?`)
      .get(compraId) as CompraRow & { insumo_nombre: string; usuario_nombre: string | null };
    return NextResponse.json(
      { ...serializar(creada), aviso: "El gasto en el Control de Caja se engancha en el Paso 2." },
      { status: 201 }
    );
  }, { escritura: true });
}
