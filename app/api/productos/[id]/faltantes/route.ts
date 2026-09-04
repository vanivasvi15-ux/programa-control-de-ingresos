import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conUsuario, errorJson } from "@/lib/api";
import { mapaInsumosCalc, mapaPiezasCalc, composicionDe } from "@/lib/stock";
import { faltantesDeProducto, type RecetaLinea } from "@/lib/stock-datos";

export const dynamic = "force-dynamic";

// GET /api/productos/5/faltantes?cantidad=2
// Dice si se puede armar esa cantidad con el stock actual, o qué falta.
// (Su pantalla es el Paso 3; el endpoint sirve para probar la lógica.)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conUsuario(async () => {
    const { id } = await params;
    const producto = db.prepare(`SELECT id, nombre FROM productos WHERE id = ?`).get(Number(id)) as
      | { id: number; nombre: string }
      | undefined;
    if (!producto) return errorJson("Producto no encontrado", 404);

    const { searchParams } = new URL(req.url);
    const cantidad = Math.max(1, Math.floor(Number(searchParams.get("cantidad")) || 1));

    const composicion = composicionDe(producto.id);
    const insumos = mapaInsumosCalc();
    const piezas = mapaPiezasCalc();

    // recetas sólo de las piezas base que aparecen en la composición
    const recetas = new Map<number, RecetaLinea[]>();
    for (const l of composicion) {
      if (l.item_tipo !== "base" || recetas.has(l.item_id)) continue;
      recetas.set(
        l.item_id,
        db
          .prepare(`SELECT insumo_id, cantidad, bloqueante FROM receta_base WHERE producto_base_id = ?`)
          .all(l.item_id) as RecetaLinea[]
      );
    }

    const r = faltantesDeProducto({ cantidad, composicion, piezas, recetas, insumos });
    return NextResponse.json({ producto: producto.nombre, cantidad, ...r });
  });
}
