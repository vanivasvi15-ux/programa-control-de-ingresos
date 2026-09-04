import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conUsuario } from "@/lib/api";

export const dynamic = "force-dynamic";

type MovStockRow = {
  id: number;
  item_tipo: "insumo" | "base";
  item_id: number;
  delta: number;
  stock_resultante: number;
  motivo: string;
  referencia_tipo: string | null;
  referencia_id: number | null;
  costo_unitario_momento: number | null;
  usuario_id: number | null;
  nota: string | null;
  creado: string;
};

// GET /api/movimientos-stock -> historial. Filtros:
//   ?item_tipo=insumo|base  ?item_id=3  ?motivo=compra|...  ?desde ?hasta  ?limite
export async function GET(req: NextRequest) {
  return conUsuario(() => {
    const { searchParams } = new URL(req.url);
    const cond: string[] = [];
    const val: (string | number)[] = [];

    const itemTipo = searchParams.get("item_tipo");
    if (itemTipo === "insumo" || itemTipo === "base") {
      cond.push("m.item_tipo = ?");
      val.push(itemTipo);
    }
    const itemId = searchParams.get("item_id");
    if (itemId && Number.isInteger(Number(itemId))) {
      cond.push("m.item_id = ?");
      val.push(Number(itemId));
    }
    const motivo = searchParams.get("motivo");
    if (motivo) {
      cond.push("m.motivo = ?");
      val.push(motivo);
    }
    const desde = searchParams.get("desde");
    if (desde) {
      cond.push("m.creado >= ?");
      val.push(desde);
    }
    const hasta = searchParams.get("hasta");
    if (hasta) {
      cond.push("m.creado <= ?");
      val.push(hasta + " 23:59:59");
    }

    const limite = Math.min(Number(searchParams.get("limite")) || 200, 1000);
    const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
    const filas = db
      .prepare(
        `SELECT m.*, u.nombre AS usuario_nombre,
                CASE m.item_tipo
                  WHEN 'insumo' THEN (SELECT nombre FROM insumos WHERE id = m.item_id)
                  ELSE (SELECT nombre FROM productos_base WHERE id = m.item_id)
                END AS item_nombre
         FROM movimientos_stock m
         LEFT JOIN usuarios u ON u.id = m.usuario_id
         ${where}
         ORDER BY m.id DESC
         LIMIT ${limite}`
      )
      .all(...val) as (MovStockRow & { usuario_nombre: string | null; item_nombre: string | null })[];

    return NextResponse.json(
      filas.map((m) => ({
        id: m.id,
        itemTipo: m.item_tipo,
        itemId: m.item_id,
        itemNombre: m.item_nombre,
        delta: m.delta,
        stockResultante: m.stock_resultante,
        motivo: m.motivo,
        referenciaTipo: m.referencia_tipo,
        referenciaId: m.referencia_id,
        costoUnitarioMomento: m.costo_unitario_momento,
        usuarioId: m.usuario_id,
        usuarioNombre: m.usuario_nombre,
        nota: m.nota,
        creado: m.creado,
      }))
    );
  });
}
