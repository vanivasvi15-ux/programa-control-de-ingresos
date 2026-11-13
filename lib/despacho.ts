// lib/despacho.ts
//
// Ventas a despachar: armado de filas con ítems y estado de stock, alta y
// edición, y el cambio de estado (despachar descuenta stock; deshacer lo
// devuelve). Toca la base: sólo de servidor. Las constantes y la validación
// pura viven en lib/despacho-datos.ts.

import { db, transaccion } from "./db";
import {
  composicionDe,
  mapaInsumosCalc,
  mapaPiezasCalc,
  recetaDe,
  moverStock,
  FaltaMaterial,
} from "./stock";
import { faltantesDeProducto, type RecetaLinea } from "./stock-datos";
import type { EstadoVenta, VentaDatos } from "./despacho-datos";

export type VentaRow = {
  id: number;
  canal: string;
  cuenta: string | null;
  numero_externo: string | null;
  fecha: string;
  cliente_nombre: string;
  cliente_telefono: string | null;
  cliente_email: string | null;
  direccion: string | null;
  localidad: string | null;
  provincia: string | null;
  codigo_postal: string | null;
  entrega: string;
  seguimiento: string | null;
  bultos: number;
  nota: string | null;
  estado: EstadoVenta;
  stock_descontado: number;
  despachado_en: string | null;
  usuario_id: number | null;
  creado: string;
  actualizado: string;
};

type ItemRow = {
  id: number;
  venta_id: number;
  producto_id: number | null;
  titulo: string | null;
  cantidad: number;
  precio_unitario: number;
  producto_nombre: string | null;
};

const ABIERTAS = ["pendiente", "preparado"];

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

export function traerVenta(id: number): VentaRow | undefined {
  return db.prepare(`SELECT * FROM ventas WHERE id = ?`).get(id) as VentaRow | undefined;
}

// Arma las ventas para mostrar: ítems con nombre de producto y, para las que
// todavía no salieron, si hay stock para armarlas (listo / fabricar / faltan).
export function armarVentas(rows: VentaRow[]) {
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const marcas = ids.map(() => "?").join(",");
  const items = db
    .prepare(
      `SELECT i.*, p.nombre AS producto_nombre
       FROM venta_items i LEFT JOIN productos p ON p.id = i.producto_id
       WHERE i.venta_id IN (${marcas}) ORDER BY i.id`
    )
    .all(...ids) as ItemRow[];
  const porVenta = new Map<number, ItemRow[]>();
  for (const it of items) {
    const lista = porVenta.get(it.venta_id) ?? [];
    lista.push(it);
    porVenta.set(it.venta_id, lista);
  }

  const hayAbiertas = rows.some((r) => ABIERTAS.includes(r.estado));
  const insumos = hayAbiertas ? mapaInsumosCalc() : new Map();
  const piezas = hayAbiertas ? mapaPiezasCalc() : new Map();
  const recetas = new Map<number, RecetaLinea[]>();

  return rows.map((v) => {
    const its = porVenta.get(v.id) ?? [];

    let stock: "listo" | "fabricar" | "faltan" | null = null;
    const detalle: string[] = [];
    if (ABIERTAS.includes(v.estado)) {
      stock = "listo";
      for (const it of its) {
        if (it.producto_id === null) continue;
        const composicion = composicionDe(it.producto_id);
        for (const l of composicion) {
          if (l.item_tipo === "base" && !recetas.has(l.item_id)) {
            recetas.set(l.item_id, recetaDe(l.item_id));
          }
        }
        const r = faltantesDeProducto({ cantidad: it.cantidad, composicion, piezas, recetas, insumos });
        for (const f of r.faltantes) {
          stock = "faltan";
          detalle.push(`Falta ${f.faltan} ${f.unidad} de ${f.nombre}`);
        }
        for (const a of r.aFabricar) {
          if (stock === "listo") stock = "fabricar";
          detalle.push(`Fabricar ${a.cantidad} × ${a.nombre}`);
        }
      }
    }

    return {
      id: v.id,
      canal: v.canal,
      cuenta: v.cuenta,
      numeroExterno: v.numero_externo,
      fecha: v.fecha,
      clienteNombre: v.cliente_nombre,
      clienteTelefono: v.cliente_telefono,
      clienteEmail: v.cliente_email,
      direccion: v.direccion,
      localidad: v.localidad,
      provincia: v.provincia,
      codigoPostal: v.codigo_postal,
      entrega: v.entrega,
      seguimiento: v.seguimiento,
      bultos: v.bultos,
      nota: v.nota,
      estado: v.estado,
      stockDescontado: v.stock_descontado === 1,
      despachadoEn: v.despachado_en,
      usuarioId: v.usuario_id,
      creado: v.creado,
      actualizado: v.actualizado,
      estadoStock: stock,
      detalleStock: detalle,
      items: its.map((i) => ({
        id: i.id,
        productoId: i.producto_id,
        productoNombre: i.producto_nombre,
        titulo: i.titulo,
        cantidad: i.cantidad,
        precioUnitario: i.precio_unitario,
      })),
    };
  });
}

// ---------------------------------------------------------------------------
// Alta y edición
// ---------------------------------------------------------------------------

function ponerItems(ventaId: number, items: NonNullable<VentaDatos["items"]>) {
  db.prepare(`DELETE FROM venta_items WHERE venta_id = ?`).run(ventaId);
  const ins = db.prepare(
    `INSERT INTO venta_items (venta_id, producto_id, titulo, cantidad, precio_unitario)
     VALUES (?, ?, ?, ?, ?)`
  );
  for (const it of items) {
    if (it.productoId !== null) {
      const existe = db.prepare(`SELECT 1 FROM productos WHERE id = ?`).get(it.productoId);
      if (!existe) throw new Error(`No existe el producto #${it.productoId}`);
    }
    ins.run(ventaId, it.productoId, it.titulo, it.cantidad, it.precioUnitario);
  }
}

export function crearVenta(d: VentaDatos, usuarioId: number): number {
  return transaccion(() => {
    const r = db
      .prepare(
        `INSERT INTO ventas
           (canal, cuenta, numero_externo, fecha, cliente_nombre, cliente_telefono, cliente_email,
            direccion, localidad, provincia, codigo_postal, entrega, seguimiento, bultos, nota, usuario_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        d.canal ?? "manual",
        d.cuenta ?? null,
        d.numeroExterno ?? null,
        d.fecha!,
        d.clienteNombre!,
        d.clienteTelefono ?? null,
        d.clienteEmail ?? null,
        d.direccion ?? null,
        d.localidad ?? null,
        d.provincia ?? null,
        d.codigoPostal ?? null,
        d.entrega ?? "correo",
        d.seguimiento ?? null,
        d.bultos ?? 1,
        d.nota ?? null,
        usuarioId
      );
    const id = Number(r.lastInsertRowid);
    ponerItems(id, d.items!);
    return id;
  });
}

const COLUMNAS: Record<string, string> = {
  canal: "canal",
  cuenta: "cuenta",
  numeroExterno: "numero_externo",
  fecha: "fecha",
  clienteNombre: "cliente_nombre",
  clienteTelefono: "cliente_telefono",
  clienteEmail: "cliente_email",
  direccion: "direccion",
  localidad: "localidad",
  provincia: "provincia",
  codigoPostal: "codigo_postal",
  entrega: "entrega",
  seguimiento: "seguimiento",
  bultos: "bultos",
  nota: "nota",
};

// Los datos del cliente y de envío se pueden corregir siempre (por ejemplo
// cargar el seguimiento después de despachar). Los renglones sólo mientras
// la venta no salió, porque ya habría descontado stock.
export function editarVenta(id: number, d: VentaDatos): void {
  transaccion(() => {
    const v = traerVenta(id);
    if (!v) throw new Error("Venta no encontrada");

    if (d.items !== undefined && !ABIERTAS.includes(v.estado)) {
      throw new Error("Los productos sólo se pueden cambiar mientras la venta no esté despachada");
    }

    const cambios: string[] = [];
    const valores: (string | number | null)[] = [];
    for (const [clave, columna] of Object.entries(COLUMNAS)) {
      const valor = (d as Record<string, unknown>)[clave];
      if (valor === undefined) continue;
      cambios.push(`${columna} = ?`);
      valores.push(valor as string | number | null);
    }
    if (cambios.length) {
      cambios.push("actualizado = datetime('now','localtime')");
      db.prepare(`UPDATE ventas SET ${cambios.join(", ")} WHERE id = ?`).run(...valores, id);
    }
    if (d.items !== undefined) ponerItems(id, d.items);
  });
}

// ---------------------------------------------------------------------------
// Cambio de estado
// ---------------------------------------------------------------------------

// Cuánto de cada pieza / insumo gasta una venta (suma de sus renglones).
function necesidadDeVenta(ventaId: number): Map<string, { tipo: "base" | "insumo"; id: number; cantidad: number }> {
  const items = db
    .prepare(`SELECT producto_id, cantidad FROM venta_items WHERE venta_id = ? AND producto_id IS NOT NULL`)
    .all(ventaId) as { producto_id: number; cantidad: number }[];
  const n = new Map<string, { tipo: "base" | "insumo"; id: number; cantidad: number }>();
  for (const it of items) {
    for (const l of composicionDe(it.producto_id)) {
      const clave = `${l.item_tipo}:${l.item_id}`;
      const previo = n.get(clave);
      const cant = l.cantidad * it.cantidad;
      if (previo) previo.cantidad += cant;
      else n.set(clave, { tipo: l.item_tipo, id: l.item_id, cantidad: cant });
    }
  }
  return n;
}

function descontarStock(ventaId: number, usuarioId: number | null): void {
  const necesidad = necesidadDeVenta(ventaId);
  const insumos = mapaInsumosCalc();
  const piezas = mapaPiezasCalc();

  // 1) revisar que alcance (los consumibles pueden quedar en rojo)
  const faltan: { nombre: string; faltan: number; unidad: string }[] = [];
  for (const n of necesidad.values()) {
    if (n.tipo === "base") {
      const p = piezas.get(n.id);
      if (p && p.stock < n.cantidad) {
        faltan.push({ nombre: p.nombre, faltan: n.cantidad - p.stock, unidad: "u" });
      }
    } else {
      const i = insumos.get(n.id);
      if (i && i.tipo !== "consumible" && i.stock < n.cantidad) {
        faltan.push({
          nombre: i.nombre,
          faltan: Math.round((n.cantidad - i.stock) * 100) / 100,
          unidad: i.unidad_consumo,
        });
      }
    }
  }
  if (faltan.length) throw new FaltaMaterial(faltan);

  // 2) descontar
  for (const n of necesidad.values()) {
    const esConsumible = n.tipo === "insumo" && insumos.get(n.id)?.tipo === "consumible";
    moverStock({
      itemTipo: n.tipo,
      itemId: n.id,
      delta: -n.cantidad,
      motivo: "venta",
      referenciaTipo: "venta",
      referenciaId: ventaId,
      usuarioId,
      permitirNegativo: esConsumible,
    });
  }
}

function devolverStock(ventaId: number, usuarioId: number | null): void {
  const movs = db
    .prepare(
      `SELECT item_tipo, item_id, delta FROM movimientos_stock
       WHERE referencia_tipo = 'venta' AND referencia_id = ? AND motivo = 'venta'`
    )
    .all(ventaId) as { item_tipo: "insumo" | "base"; item_id: number; delta: number }[];
  for (const m of movs) {
    moverStock({
      itemTipo: m.item_tipo,
      itemId: m.item_id,
      delta: -m.delta,
      motivo: "anulacion",
      referenciaTipo: "venta",
      referenciaId: ventaId,
      usuarioId,
      permitirNegativo: true,
    });
  }
}

// Pasa la venta a otro estado. Despachar descuenta el stock de lo vendido
// (salvo descontar=false: para ventas cuyo stock ya se movió a mano). Sacarla
// de "despachado" devuelve lo descontado. Todo o nada.
// Lanza FaltaMaterial si no alcanza lo que hay para despachar.
export function cambiarEstadoVenta(
  id: number,
  nuevo: EstadoVenta,
  usuarioId: number | null,
  descontar = true
): void {
  transaccion(() => {
    const v = traerVenta(id);
    if (!v) throw new Error("Venta no encontrada");
    if (v.estado === nuevo) return;

    if (v.estado === "despachado" && v.stock_descontado === 1) {
      devolverStock(id, usuarioId);
      db.prepare(`UPDATE ventas SET stock_descontado = 0 WHERE id = ?`).run(id);
    }

    let descontado = 0;
    if (nuevo === "despachado" && descontar) {
      descontarStock(id, usuarioId);
      descontado = 1;
    }

    db.prepare(
      `UPDATE ventas
         SET estado = ?, stock_descontado = ?,
             despachado_en = CASE WHEN ? = 'despachado' THEN datetime('now','localtime') ELSE NULL END,
             actualizado = datetime('now','localtime')
       WHERE id = ?`
    ).run(nuevo, nuevo === "despachado" ? descontado : 0, nuevo, id);
  });
}

// Borra una venta que todavía no movió stock; si ya salió, la anula
// (devolviendo el stock) para no perder el rastro.
export function borrarVenta(id: number, usuarioId: number | null): "borrada" | "anulada" {
  return transaccion(() => {
    const v = traerVenta(id);
    if (!v) throw new Error("Venta no encontrada");
    if (ABIERTAS.includes(v.estado)) {
      db.prepare(`DELETE FROM venta_items WHERE venta_id = ?`).run(id);
      db.prepare(`DELETE FROM ventas WHERE id = ?`).run(id);
      return "borrada" as const;
    }
    if (v.estado !== "anulado") cambiarEstadoVenta(id, "anulado", usuarioId);
    return "anulada" as const;
  });
}
