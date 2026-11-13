import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conUsuario, leerBody, errorJson } from "@/lib/api";
import { validarVenta, ESTADOS_VENTA } from "@/lib/despacho-datos";
import { armarVentas, crearVenta, type VentaRow } from "@/lib/despacho";
import { esFechaValida } from "@/lib/movimientos-datos";

export const dynamic = "force-dynamic";

// GET /api/ventas
// Filtros: ?fecha=AAAA-MM-DD (ese día)  ?desde ?hasta  ?estado=pendiente
//          ?abiertas=1 (pendiente + preparado)  ?ids=1,2,3
// Devuelve las ventas con sus renglones y, para las que no salieron, el
// estado de stock (listo / fabricar / faltan).
export async function GET(req: NextRequest) {
  return conUsuario(() => {
    const { searchParams } = new URL(req.url);
    const where: string[] = [];
    const val: (string | number)[] = [];

    const fecha = searchParams.get("fecha");
    if (fecha) {
      if (!esFechaValida(fecha)) return errorJson("Fecha inválida");
      where.push("fecha = ?");
      val.push(fecha);
    }
    const desde = searchParams.get("desde");
    if (desde) {
      if (!esFechaValida(desde)) return errorJson("Fecha 'desde' inválida");
      where.push("fecha >= ?");
      val.push(desde);
    }
    const hasta = searchParams.get("hasta");
    if (hasta) {
      if (!esFechaValida(hasta)) return errorJson("Fecha 'hasta' inválida");
      where.push("fecha <= ?");
      val.push(hasta);
    }
    const estado = searchParams.get("estado");
    if (estado) {
      if (!(ESTADOS_VENTA as readonly string[]).includes(estado)) return errorJson("Estado inválido");
      where.push("estado = ?");
      val.push(estado);
    }
    if (searchParams.get("abiertas") === "1") {
      where.push("estado IN ('pendiente','preparado')");
    }
    const ids = searchParams.get("ids");
    if (ids) {
      const lista = ids.split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
      if (lista.length === 0) return NextResponse.json([]);
      where.push(`id IN (${lista.map(() => "?").join(",")})`);
      val.push(...lista);
    }

    const sql = `SELECT * FROM ventas ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY fecha DESC, id`;
    const rows = db.prepare(sql).all(...val) as VentaRow[];
    return NextResponse.json(armarVentas(rows));
  });
}

// POST /api/ventas -> carga una venta a mano (las de Mercado Libre y la
// tienda entrarán por acá también cuando se conecten).
export async function POST(req: NextRequest) {
  return conUsuario(async (usuario) => {
    const body = await leerBody(req);
    const r = validarVenta(body, false);
    if (!r.ok) return errorJson(r.error);

    try {
      const id = crearVenta(r.datos, usuario.id);
      const fila = db.prepare(`SELECT * FROM ventas WHERE id = ?`).get(id) as VentaRow;
      return NextResponse.json(armarVentas([fila])[0], { status: 201 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo crear la venta";
      if (msg.includes("UNIQUE") && msg.includes("numero_externo")) {
        return errorJson("Ya hay una venta con ese número de orden en ese canal", 409);
      }
      return errorJson(msg);
    }
  }, { escritura: true });
}
