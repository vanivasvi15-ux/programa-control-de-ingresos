import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conUsuario } from "@/lib/api";
import { costoInsumoPorConsumo } from "@/lib/stock-datos";
import { serializarProducto, type ProductoRow } from "@/lib/stock";

export const dynamic = "force-dynamic";

// GET /api/stock/resumen -> todo lo del panel /stock ya agregado.
export async function GET() {
  return conUsuario(() => {
    const insumos = db
      .prepare(`SELECT * FROM insumos WHERE activo = 1`)
      .all() as {
      id: number;
      nombre: string;
      tipo: string;
      stock: number;
      alerta_minimo: number | null;
      costo_unitario: number;
      factor_compra: number;
      unidad_consumo: string;
    }[];

    const bajoMinimo = insumos
      .filter((i) => i.alerta_minimo != null && i.stock < i.alerta_minimo)
      .map((i) => ({
        id: i.id,
        nombre: i.nombre,
        stock: i.stock,
        alertaMinimo: i.alerta_minimo,
        unidad: i.unidad_consumo,
      }))
      .sort((a, b) => a.stock / (a.alertaMinimo || 1) - b.stock / (b.alertaMinimo || 1));

    const piezas = db
      .prepare(`SELECT id, nombre, stock, costo_calculado FROM productos_base WHERE activo = 1`)
      .all() as { id: number; nombre: string; stock: number; costo_calculado: number | null }[];

    const productos = db.prepare(`SELECT * FROM productos WHERE activo = 1 ORDER BY nombre`).all() as ProductoRow[];

    // valor aproximado del stock: insumos + piezas fabricadas
    const valorInsumos = insumos.reduce(
      (s, i) => s + i.stock * costoInsumoPorConsumo({ costo_unitario: i.costo_unitario, factor_compra: i.factor_compra }),
      0
    );
    const valorPiezas = piezas.reduce((s, p) => s + p.stock * (p.costo_calculado ?? 0), 0);

    // recuentos que tocan revisar
    const listas = db.prepare(`SELECT * FROM recuento_listas WHERE activo = 1`).all() as {
      id: number;
      nombre: string;
      dias_cada: number;
      ultima_revision: string | null;
    }[];
    const hoy = Date.now();
    const recuentosPendientes = listas
      .filter((l) => {
        if (!l.ultima_revision) return true;
        const t = Date.parse(l.ultima_revision + "T00:00:00");
        return Number.isNaN(t) || (hoy - t) / 86400000 >= l.dias_cada;
      })
      .map((l) => ({ id: l.id, nombre: l.nombre, ultimaRevision: l.ultima_revision }));

    const ultimasOrdenes = db
      .prepare(
        `SELECT o.id, o.cantidad, o.estado, o.fecha, o.costo_total AS costoTotal, b.nombre AS pieza
         FROM ordenes_produccion o JOIN productos_base b ON b.id = o.producto_base_id
         ORDER BY o.id DESC LIMIT 6`
      )
      .all();

    const ultimasCompras = db
      .prepare(
        `SELECT c.id, c.cantidad_compra AS cantidad, c.costo_total AS costoTotal, c.fecha, i.nombre AS insumo
         FROM compras_insumo c JOIN insumos i ON i.id = c.insumo_id
         ORDER BY c.id DESC LIMIT 6`
      )
      .all();

    // avisos de datos incompletos
    const piezasSinReceta = db
      .prepare(
        `SELECT b.nombre FROM productos_base b
         WHERE b.activo = 1 AND NOT EXISTS (SELECT 1 FROM receta_base r WHERE r.producto_base_id = b.id)`
      )
      .all() as { nombre: string }[];
    const productosSinComposicion = db
      .prepare(
        `SELECT p.nombre FROM productos p
         WHERE p.activo = 1 AND NOT EXISTS (SELECT 1 FROM composicion_producto c WHERE c.producto_id = p.id)`
      )
      .all() as { nombre: string }[];

    return NextResponse.json({
      contadores: {
        insumos: insumos.length,
        bajoMinimo: bajoMinimo.length,
        piezas: piezas.length,
        productos: productos.length,
      },
      valorStock: Math.round(valorInsumos + valorPiezas),
      valorInsumos: Math.round(valorInsumos),
      valorPiezas: Math.round(valorPiezas),
      bajoMinimo,
      recuentosPendientes,
      ultimasOrdenes,
      ultimasCompras,
      productos: productos.map(serializarProducto),
      avisos: {
        piezasSinReceta: piezasSinReceta.map((x) => x.nombre),
        productosSinComposicion: productosSinComposicion.map((x) => x.nombre),
      },
    });
  });
}
