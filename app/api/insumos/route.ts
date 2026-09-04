import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conUsuario, leerBody, errorJson } from "@/lib/api";
import { serializarInsumo, validarInsumo, type InsumoRow } from "@/lib/stock";

export const dynamic = "force-dynamic";

// GET /api/insumos -> listado. Filtros: ?tipo ?activo=1|0 ?bajo_minimo=1
export async function GET(req: NextRequest) {
  return conUsuario(() => {
    const { searchParams } = new URL(req.url);
    const cond: string[] = [];
    const val: (string | number)[] = [];

    const tipo = searchParams.get("tipo");
    if (tipo === "materia_prima" || tipo === "herraje" || tipo === "consumible") {
      cond.push("tipo = ?");
      val.push(tipo);
    }
    const activo = searchParams.get("activo");
    if (activo === "1" || activo === "0") {
      cond.push("activo = ?");
      val.push(Number(activo));
    }

    const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
    let filas = db
      .prepare(`SELECT * FROM insumos ${where} ORDER BY tipo, nombre`)
      .all(...val) as InsumoRow[];

    if (searchParams.get("bajo_minimo") === "1") {
      filas = filas.filter((i) => i.alerta_minimo != null && i.stock < i.alerta_minimo);
    }
    return NextResponse.json(filas.map(serializarInsumo));
  });
}

// POST /api/insumos -> alta.
export async function POST(req: NextRequest) {
  return conUsuario(async () => {
    const body = await leerBody(req);
    const v = validarInsumo(body);
    if (!v.ok) return errorJson(v.error);
    const d = v.datos;
    const r = db
      .prepare(
        `INSERT INTO insumos
           (nombre, tipo, unidad_compra, unidad_consumo, factor_compra, alerta_minimo,
            costo_unitario, activo, nota)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        d.nombre,
        d.tipo,
        d.unidad_compra,
        d.unidad_consumo,
        d.factor_compra,
        d.alerta_minimo,
        d.costo_unitario,
        d.activo,
        d.nota
      );
    const creado = db
      .prepare(`SELECT * FROM insumos WHERE id = ?`)
      .get(Number(r.lastInsertRowid)) as InsumoRow;
    return NextResponse.json(serializarInsumo(creado), { status: 201 });
  }, { escritura: true });
}
