import { NextRequest, NextResponse } from "next/server";
import { conUsuario, leerBody, errorJson } from "@/lib/api";
import { generarKits } from "@/lib/generador";
import { ROLES, TIPOS_KIT, type Rol, type Seleccion, type TipoKit } from "@/lib/generador-datos";

export const dynamic = "force-dynamic";

const largos = (v: unknown): number[] =>
  Array.isArray(v) ? v.map(Number).filter((n) => Number.isFinite(n) && n > 0) : [];

// POST /api/generador
// { selecciones: [{ tipo, enteros: [..], plegados: [..], doble }],
//   materiales: { <rol>: insumoId | null }, aplicar: boolean }
// Con aplicar = false sólo devuelve qué se crearía (vista previa).
export async function POST(req: NextRequest) {
  return conUsuario(async () => {
    const body = await leerBody(req);
    const crudas = Array.isArray(body.selecciones) ? body.selecciones : [];
    const selecciones: Seleccion[] = [];
    for (const s of crudas as Record<string, unknown>[]) {
      const tipo = String(s?.tipo) as TipoKit;
      if (!(tipo in TIPOS_KIT)) return errorJson(`Tipo de kit desconocido: ${tipo}`);
      selecciones.push({
        tipo,
        enteros: largos(s.enteros),
        plegados: largos(s.plegados),
        doble: s.doble === true,
      });
    }

    const materiales: Partial<Record<Rol, number | null>> = {};
    const m = (body.materiales ?? {}) as Record<string, unknown>;
    for (const rol of Object.keys(ROLES) as Rol[]) {
      const v = Number(m[rol]);
      if (Number.isInteger(v) && v > 0) materiales[rol] = v;
    }

    try {
      const resumen = generarKits({ selecciones, materiales, aplicar: body.aplicar === true });
      return NextResponse.json(resumen);
    } catch (e) {
      return errorJson(e instanceof Error ? e.message : "No se pudo generar", 422);
    }
  }, { escritura: true });
}
