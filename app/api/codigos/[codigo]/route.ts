import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conUsuario, errorJson } from "@/lib/api";
import {
  composicionDe,
  mapaInsumosCalc,
  mapaPiezasCalc,
  recetaDe,
  type ProductoBaseRow,
  type ProductoRow,
} from "@/lib/stock";
import { faltantesDeProducto, type RecetaLinea } from "@/lib/stock-datos";

export const dynamic = "force-dynamic";

// GET /api/codigos/PB00012
// Busca una pieza o un producto por su código de barras (lo que escribe el
// lector USB). Para un producto dice además si hoy se puede armar con el
// stock que hay. Si no lo encuentra → 404 (el panel avisa "código nuevo").
export async function GET(_req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  return conUsuario(async () => {
    const { codigo: crudo } = await params;
    const codigo = decodeURIComponent(crudo).trim();
    if (!codigo) return errorJson("Falta el código");

    const pieza = db.prepare(`SELECT * FROM productos_base WHERE codigo_barras = ?`).get(codigo) as
      | ProductoBaseRow
      | undefined;
    if (pieza) {
      return NextResponse.json({
        tipo: "base",
        id: pieza.id,
        nombre: pieza.nombre,
        codigo: pieza.codigo_barras,
        activo: !!pieza.activo,
        stock: pieza.stock,
        costo: pieza.costo_calculado,
      });
    }

    const producto = db.prepare(`SELECT * FROM productos WHERE codigo_barras = ?`).get(codigo) as
      | ProductoRow
      | undefined;
    if (producto) {
      const composicion = composicionDe(producto.id);
      const recetas = new Map<number, RecetaLinea[]>();
      for (const l of composicion) {
        if (l.item_tipo === "base" && !recetas.has(l.item_id)) recetas.set(l.item_id, recetaDe(l.item_id));
      }
      const r = faltantesDeProducto({
        cantidad: 1,
        composicion,
        piezas: mapaPiezasCalc(),
        recetas,
        insumos: mapaInsumosCalc(),
      });
      return NextResponse.json({
        tipo: "producto",
        id: producto.id,
        nombre: producto.nombre,
        codigo: producto.codigo_barras,
        activo: !!producto.activo,
        precio: producto.precio,
        costo: producto.costo_calculado,
        armable: r.listo,
        faltantes: r.faltantes,
        aFabricar: r.aFabricar,
      });
    }

    return errorJson("No hay nada con ese código", 404);
  });
}
