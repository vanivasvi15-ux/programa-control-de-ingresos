import { NextRequest, NextResponse } from "next/server";
import { transaccion } from "@/lib/db";
import { conUsuario, leerBody, errorJson } from "@/lib/api";
import { validarVenta, ESTADOS_VENTA, type EstadoVenta } from "@/lib/despacho-datos";
import { armarVentas, borrarVenta, cambiarEstadoVenta, editarVenta, traerVenta } from "@/lib/despacho";
import { FaltaMaterial } from "@/lib/stock";

export const dynamic = "force-dynamic";

function respuesta(id: number) {
  const fila = traerVenta(id);
  return fila ? NextResponse.json(armarVentas([fila])[0]) : errorJson("Venta no encontrada", 404);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async () => {
    const { id } = await params;
    return respuesta(Number(id));
  });
}

// PUT /api/ventas/5
// body: campos de la venta a corregir (cliente, dirección, seguimiento,
//       bultos, items…) y/o { estado, descontarStock? }.
// - estado='despachado' descuenta el stock de lo vendido (o 422 con lo que
//   falta). descontarStock=false despacha sin tocar el stock.
// - sacarla de 'despachado' devuelve el stock descontado.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async (usuario) => {
    const { id: idTxt } = await params;
    const id = Number(idTxt);
    if (!traerVenta(id)) return errorJson("Venta no encontrada", 404);

    const body = await leerBody(req);
    const { estado, descontarStock, ...resto } = body;

    const r = validarVenta(resto, true);
    if (!r.ok) return errorJson(r.error);

    if (estado !== undefined && !(ESTADOS_VENTA as readonly string[]).includes(String(estado))) {
      return errorJson("Estado inválido");
    }

    try {
      // todo o nada: si no alcanza el stock para despachar, tampoco se
      // guardan las correcciones de ese mismo envío
      transaccion(() => {
        if (Object.keys(r.datos).length) editarVenta(id, r.datos);
        if (estado !== undefined) {
          cambiarEstadoVenta(id, estado as EstadoVenta, usuario.id, descontarStock !== false);
        }
      });
    } catch (e) {
      if (e instanceof FaltaMaterial) {
        return NextResponse.json(
          { error: "No hay stock para despachar esta venta", faltan: e.faltan },
          { status: 422 }
        );
      }
      const msg = e instanceof Error ? e.message : "No se pudo guardar";
      if (msg.includes("UNIQUE") && msg.includes("numero_externo")) {
        return errorJson("Ya hay una venta con ese número de orden en ese canal", 409);
      }
      return errorJson(msg);
    }
    return respuesta(id);
  }, { escritura: true });
}

// DELETE -> borra la venta si todavía no salió; si ya se despachó la anula
// (y devuelve el stock) para no perder el rastro.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async (usuario) => {
    const { id } = await params;
    if (!traerVenta(Number(id))) return errorJson("Venta no encontrada", 404);
    const resultado = borrarVenta(Number(id), usuario.id);
    return NextResponse.json({ ok: true, [resultado]: true });
  }, { escritura: true });
}
