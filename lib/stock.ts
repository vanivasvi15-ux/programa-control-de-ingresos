// lib/stock.ts
//
// Helpers de stock y producción que SÍ tocan la base (validación, armado de
// filas con joins, y las operaciones transaccionales: realizar una orden de
// producción, cargar una compra, responder un recuento). Las constantes y
// los cálculos puros viven en lib/stock-datos.ts.
//
// Regla de la casa: los módulos que importan @/lib/db son sólo de servidor.

import { db, transaccion } from "./db";
import {
  TIPOS_INSUMO,
  CANALES_PUBLICACION,
  costoInsumoPorConsumo,
  costoPiezaBase,
  costoProducto,
  type InsumoCalc,
  type PiezaCalc,
  type ComposicionLinea,
  type RecetaLinea,
  type TipoInsumo,
  type MotivoStock,
} from "./stock-datos";

// ===========================================================================
// TIPOS DE FILA
// ===========================================================================

export type InsumoRow = {
  id: number;
  nombre: string;
  tipo: TipoInsumo;
  unidad_compra: string;
  unidad_consumo: string;
  factor_compra: number;
  stock: number;
  alerta_minimo: number | null;
  costo_unitario: number;
  activo: number;
  nota: string | null;
  creado: string;
  actualizado: string;
};

export type ProductoBaseRow = {
  id: number;
  nombre: string;
  stock: number;
  mano_obra_minutos: number;
  costo_calculado: number | null;
  costo_actualizado: string | null;
  activo: number;
  nota: string | null;
  creado: string;
  actualizado: string;
};

export type ProductoRow = {
  id: number;
  nombre: string;
  sku: string | null;
  precio: number;
  costo_calculado: number | null;
  costo_actualizado: string | null;
  imagen: string | null;
  activo: number;
  nota: string | null;
  creado: string;
  actualizado: string;
};

// ===========================================================================
// SERIALIZADORES (snake_case de la base -> camelCase para el panel)
// ===========================================================================

export function serializarInsumo(i: InsumoRow) {
  return {
    id: i.id,
    nombre: i.nombre,
    tipo: i.tipo,
    unidadCompra: i.unidad_compra,
    unidadConsumo: i.unidad_consumo,
    factorCompra: i.factor_compra,
    stock: i.stock,
    alertaMinimo: i.alerta_minimo,
    costoUnitario: i.costo_unitario,
    costoPorConsumo: costoInsumoPorConsumo(i),
    bajoMinimo: i.alerta_minimo != null && i.stock < i.alerta_minimo,
    activo: !!i.activo,
    nota: i.nota,
    creado: i.creado,
    actualizado: i.actualizado,
  };
}

export function serializarPiezaBase(p: ProductoBaseRow) {
  return {
    id: p.id,
    nombre: p.nombre,
    stock: p.stock,
    manoObraMinutos: p.mano_obra_minutos,
    costoCalculado: p.costo_calculado,
    costoActualizado: p.costo_actualizado,
    activo: !!p.activo,
    nota: p.nota,
    creado: p.creado,
    actualizado: p.actualizado,
  };
}

export function serializarProducto(p: ProductoRow) {
  return {
    id: p.id,
    nombre: p.nombre,
    sku: p.sku,
    precio: p.precio,
    costoCalculado: p.costo_calculado,
    costoActualizado: p.costo_actualizado,
    margen: p.costo_calculado != null ? p.precio - p.costo_calculado : null,
    imagen: p.imagen,
    activo: !!p.activo,
    nota: p.nota,
    creado: p.creado,
    actualizado: p.actualizado,
  };
}

// ===========================================================================
// CONFIG
// ===========================================================================

export function leerConfig(clave: string): string | null {
  const f = db.prepare(`SELECT valor FROM config WHERE clave = ?`).get(clave) as
    | { valor: string }
    | undefined;
  return f?.valor ?? null;
}

export function tarifaManoObraMinuto(): number {
  const v = Number(leerConfig("tarifa_mano_obra_minuto") ?? "0");
  return Number.isFinite(v) && v > 0 ? v : 0;
}

// ===========================================================================
// CÁLCULO DE COSTOS (recalcula y guarda costo_calculado hacia arriba)
// ===========================================================================
// Barato para la escala del taller (decenas de piezas y productos): se
// recalcula todo. Llamar después de cualquier cambio de precio, receta o
// composición. Corre en su propia transacción salvo que ya haya una abierta.

export function recalcularCostos(): void {
  transaccion(() => {
    const insumos = mapaInsumosCalc();
    const tarifa = tarifaManoObraMinuto();

    const piezas = db
      .prepare(`SELECT * FROM productos_base`)
      .all() as ProductoBaseRow[];
    const upBase = db.prepare(
      `UPDATE productos_base SET costo_calculado = ?, costo_actualizado = datetime('now','localtime') WHERE id = ?`
    );
    for (const p of piezas) {
      const receta = recetaDe(p.id);
      const costo = costoPiezaBase(receta, insumos, p.mano_obra_minutos, tarifa);
      upBase.run(costo, p.id);
    }

    // Recargar piezas ya con su costo nuevo para el costeo de productos.
    const piezasCalc = mapaPiezasCalc();
    const productos = db.prepare(`SELECT * FROM productos`).all() as ProductoRow[];
    const upProd = db.prepare(
      `UPDATE productos SET costo_calculado = ?, costo_actualizado = datetime('now','localtime') WHERE id = ?`
    );
    for (const pr of productos) {
      const comp = composicionDe(pr.id);
      const costo = costoProducto(comp, piezasCalc, insumos);
      upProd.run(costo, pr.id);
    }
  });
}

// ===========================================================================
// LECTURAS AUXILIARES
// ===========================================================================

export function mapaInsumosCalc(): Map<number, InsumoCalc> {
  const filas = db
    .prepare(
      `SELECT id, nombre, tipo, unidad_consumo, factor_compra, stock, costo_unitario FROM insumos`
    )
    .all() as InsumoCalc[];
  return new Map(filas.map((f) => [f.id, f]));
}

export function mapaPiezasCalc(): Map<number, PiezaCalc> {
  const filas = db
    .prepare(
      `SELECT id, nombre, stock, mano_obra_minutos, costo_calculado FROM productos_base`
    )
    .all() as PiezaCalc[];
  return new Map(filas.map((f) => [f.id, f]));
}

export function recetaDe(productoBaseId: number): RecetaLinea[] {
  return db
    .prepare(
      `SELECT insumo_id, cantidad, bloqueante FROM receta_base WHERE producto_base_id = ?`
    )
    .all(productoBaseId) as RecetaLinea[];
}

export function composicionDe(productoId: number): ComposicionLinea[] {
  return db
    .prepare(
      `SELECT item_tipo, item_id, cantidad FROM composicion_producto WHERE producto_id = ?`
    )
    .all(productoId) as ComposicionLinea[];
}

// Mueve el stock de un item y deja la fila en movimientos_stock. Debe correr
// SIEMPRE dentro de una transacción (la que abre la operación de arriba).
export function moverStock(args: {
  itemTipo: "insumo" | "base";
  itemId: number;
  delta: number;
  motivo: MotivoStock;
  referenciaTipo?: string | null;
  referenciaId?: number | null;
  costoUnitarioMomento?: number | null;
  usuarioId?: number | null;
  nota?: string | null;
  permitirNegativo?: boolean;
}): number {
  const tabla = args.itemTipo === "insumo" ? "insumos" : "productos_base";
  const fila = db.prepare(`SELECT stock FROM ${tabla} WHERE id = ?`).get(args.itemId) as
    | { stock: number }
    | undefined;
  if (!fila) throw new Error(`No existe ${args.itemTipo} #${args.itemId}`);

  const nuevo = fila.stock + args.delta;
  if (nuevo < 0 && !args.permitirNegativo) {
    throw new Error(
      `El stock quedaría negativo (${nuevo}) para ${args.itemTipo} #${args.itemId}`
    );
  }

  db.prepare(
    `UPDATE ${tabla} SET stock = ?, actualizado = datetime('now','localtime') WHERE id = ?`
  ).run(nuevo, args.itemId);

  db.prepare(
    `INSERT INTO movimientos_stock
       (item_tipo, item_id, delta, stock_resultante, motivo, referencia_tipo, referencia_id,
        costo_unitario_momento, usuario_id, nota)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    args.itemTipo,
    args.itemId,
    args.delta,
    nuevo,
    args.motivo,
    args.referenciaTipo ?? null,
    args.referenciaId ?? null,
    args.costoUnitarioMomento ?? null,
    args.usuarioId ?? null,
    args.nota ?? null
  );

  return nuevo;
}

// ===========================================================================
// ÓRDENES DE PRODUCCIÓN
// ===========================================================================

export class FaltaMaterial extends Error {
  faltan: { nombre: string; faltan: number; unidad: string }[];
  constructor(faltan: { nombre: string; faltan: number; unidad: string }[]) {
    super("Falta material para realizar la orden");
    this.faltan = faltan;
  }
}

// Pasa una orden 'planificada' a 'realizada': descuenta insumos, suma
// piezas, registra todo y calcula el costo_total. Todo o nada.
// Lanza FaltaMaterial si no alcanza la materia prima / los herrajes.
export function realizarOrden(ordenId: number, usuarioId: number | null): void {
  transaccion(() => {
    const orden = db
      .prepare(`SELECT * FROM ordenes_produccion WHERE id = ?`)
      .get(ordenId) as
      | { id: number; producto_base_id: number; cantidad: number; estado: string }
      | undefined;
    if (!orden) throw new Error("Orden no encontrada");
    if (orden.estado !== "planificada") {
      throw new Error(`La orden ya está '${orden.estado}'`);
    }

    const pieza = db
      .prepare(`SELECT * FROM productos_base WHERE id = ?`)
      .get(orden.producto_base_id) as ProductoBaseRow | undefined;
    if (!pieza) throw new Error("La pieza de la orden no existe");

    const insumos = mapaInsumosCalc();
    const receta = recetaDe(orden.producto_base_id);

    // 1) chequear faltantes (sólo lo bloqueante)
    const faltan: { nombre: string; faltan: number; unidad: string }[] = [];
    for (const l of receta) {
      if (l.bloqueante !== 1) continue;
      const ins = insumos.get(l.insumo_id);
      if (!ins) {
        faltan.push({ nombre: `insumo #${l.insumo_id}`, faltan: l.cantidad * orden.cantidad, unidad: "" });
        continue;
      }
      const necesita = l.cantidad * orden.cantidad;
      if (ins.stock < necesita) {
        faltan.push({
          nombre: ins.nombre,
          faltan: Math.round((necesita - ins.stock) * 100) / 100,
          unidad: ins.unidad_consumo,
        });
      }
    }
    if (faltan.length) throw new FaltaMaterial(faltan);

    // 2) descontar insumos (todos los renglones, bloqueantes o no)
    const tarifa = tarifaManoObraMinuto();
    let costoTotal = 0;
    for (const l of receta) {
      const ins = insumos.get(l.insumo_id);
      if (!ins) continue;
      const necesita = l.cantidad * orden.cantidad;
      moverStock({
        itemTipo: "insumo",
        itemId: ins.id,
        delta: -necesita,
        motivo: "produccion_consumo",
        referenciaTipo: "orden_produccion",
        referenciaId: orden.id,
        costoUnitarioMomento: ins.costo_unitario,
        usuarioId,
        permitirNegativo: l.bloqueante !== 1, // los consumibles pueden quedar en rojo
      });
      costoTotal += necesita * costoInsumoPorConsumo(ins);
    }
    costoTotal += pieza.mano_obra_minutos * tarifa * orden.cantidad;

    // 3) sumar las piezas fabricadas
    moverStock({
      itemTipo: "base",
      itemId: pieza.id,
      delta: orden.cantidad,
      motivo: "produccion_alta",
      referenciaTipo: "orden_produccion",
      referenciaId: orden.id,
      usuarioId,
    });

    // 4) cerrar la orden
    db.prepare(
      `UPDATE ordenes_produccion SET estado = 'realizada', costo_total = ?, actualizado = datetime('now','localtime') WHERE id = ?`
    ).run(Math.round(costoTotal), orden.id);
  });
}

// Anula una orden. Si estaba 'realizada', revierte los movimientos de stock
// que generó (con motivo 'anulacion').
export function anularOrden(ordenId: number, usuarioId: number | null): void {
  transaccion(() => {
    const orden = db
      .prepare(`SELECT id, estado FROM ordenes_produccion WHERE id = ?`)
      .get(ordenId) as { id: number; estado: string } | undefined;
    if (!orden) throw new Error("Orden no encontrada");
    if (orden.estado === "anulada") return;

    if (orden.estado === "realizada") {
      const movs = db
        .prepare(
          `SELECT item_tipo, item_id, delta FROM movimientos_stock
           WHERE referencia_tipo = 'orden_produccion' AND referencia_id = ?
             AND motivo IN ('produccion_consumo','produccion_alta')`
        )
        .all(orden.id) as { item_tipo: "insumo" | "base"; item_id: number; delta: number }[];
      for (const m of movs) {
        moverStock({
          itemTipo: m.item_tipo,
          itemId: m.item_id,
          delta: -m.delta,
          motivo: "anulacion",
          referenciaTipo: "orden_produccion",
          referenciaId: orden.id,
          usuarioId,
          permitirNegativo: true,
        });
      }
    }

    db.prepare(
      `UPDATE ordenes_produccion SET estado = 'anulada', actualizado = datetime('now','localtime') WHERE id = ?`
    ).run(orden.id);
  });
}

// ===========================================================================
// COMPRAS DE INSUMO
// ===========================================================================

// Carga una compra: sube el stock (cantidad_compra * factor_compra) y, si
// actualiza_costo, deja el precio como costo_unitario del insumo. El gasto
// en el Control de Caja (movimiento_id) se engancha en el Paso 2.
export function aplicarCompra(args: {
  insumoId: number;
  cantidadCompra: number;
  costoUnitario: number;
  actualizaCosto: boolean;
  proveedor: string | null;
  fecha: string;
  nota: string | null;
  usuarioId: number | null;
}): number {
  return transaccion(() => {
    const insumo = db
      .prepare(`SELECT * FROM insumos WHERE id = ?`)
      .get(args.insumoId) as InsumoRow | undefined;
    if (!insumo) throw new Error("Insumo no encontrado");

    const deltaConsumo = args.cantidadCompra * insumo.factor_compra;
    const costoTotal = Math.round(args.cantidadCompra * args.costoUnitario);

    const res = db
      .prepare(
        `INSERT INTO compras_insumo
           (insumo_id, cantidad_compra, costo_unitario, costo_total, actualiza_costo,
            movimiento_id, proveedor, fecha, usuario_id, nota)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`
      )
      .run(
        args.insumoId,
        args.cantidadCompra,
        args.costoUnitario,
        costoTotal,
        args.actualizaCosto ? 1 : 0,
        args.proveedor,
        args.fecha,
        args.usuarioId,
        args.nota
      );
    const compraId = Number(res.lastInsertRowid);

    moverStock({
      itemTipo: "insumo",
      itemId: args.insumoId,
      delta: deltaConsumo,
      motivo: "compra",
      referenciaTipo: "compra_insumo",
      referenciaId: compraId,
      costoUnitarioMomento: args.costoUnitario,
      usuarioId: args.usuarioId,
    });

    if (args.actualizaCosto && args.costoUnitario !== insumo.costo_unitario) {
      db.prepare(
        `UPDATE insumos SET costo_unitario = ?, actualizado = datetime('now','localtime') WHERE id = ?`
      ).run(args.costoUnitario, args.insumoId);
      recalcularCostos();
    }

    return compraId;
  });
}

// Revierte una compra: compensa el stock y borra la fila. Los movimientos de
// stock (+compra y -anulacion) quedan como rastro.
export function revertirCompra(compraId: number, usuarioId: number | null): void {
  transaccion(() => {
    const compra = db
      .prepare(`SELECT * FROM compras_insumo WHERE id = ?`)
      .get(compraId) as
      | { id: number; insumo_id: number; cantidad_compra: number }
      | undefined;
    if (!compra) throw new Error("Compra no encontrada");

    const insumo = db
      .prepare(`SELECT factor_compra FROM insumos WHERE id = ?`)
      .get(compra.insumo_id) as { factor_compra: number } | undefined;
    const factor = insumo?.factor_compra ?? 1;

    moverStock({
      itemTipo: "insumo",
      itemId: compra.insumo_id,
      delta: -(compra.cantidad_compra * factor),
      motivo: "anulacion",
      referenciaTipo: "compra_insumo",
      referenciaId: compra.id,
      usuarioId,
      permitirNegativo: true,
    });

    db.prepare(`DELETE FROM compras_insumo WHERE id = ?`).run(compra.id);
  });
}

// ===========================================================================
// RECUENTO
// ===========================================================================

// Aplica los números cargados en un recuento: por cada insumo, ajusta el
// stock a lo que se contó (delta = contado - stock actual) con motivo
// 'recuento', y marca la lista como revisada hoy.
export function responderRecuento(
  listaId: number,
  conteos: { insumoId: number; stock: number }[],
  usuarioId: number | null
): void {
  transaccion(() => {
    const lista = db
      .prepare(`SELECT id FROM recuento_listas WHERE id = ?`)
      .get(listaId) as { id: number } | undefined;
    if (!lista) throw new Error("Lista de recuento no encontrada");

    for (const c of conteos) {
      const insumo = db
        .prepare(`SELECT stock FROM insumos WHERE id = ?`)
        .get(c.insumoId) as { stock: number } | undefined;
      if (!insumo) continue;
      const delta = c.stock - insumo.stock;
      if (delta === 0) continue;
      moverStock({
        itemTipo: "insumo",
        itemId: c.insumoId,
        delta,
        motivo: "recuento",
        referenciaTipo: "recuento_lista",
        referenciaId: listaId,
        usuarioId,
        permitirNegativo: true,
      });
    }

    db.prepare(
      `UPDATE recuento_listas SET ultima_revision = date('now','localtime') WHERE id = ?`
    ).run(listaId);
  });
}

// ===========================================================================
// VALIDADORES (para POST/PUT)
// ===========================================================================

type Ok<T> = { ok: true; datos: T };
type Err = { ok: false; error: string };

export function validarInsumo(
  body: Record<string, unknown>,
  base?: InsumoRow
): Ok<{
  nombre: string;
  tipo: TipoInsumo;
  unidad_compra: string;
  unidad_consumo: string;
  factor_compra: number;
  alerta_minimo: number | null;
  costo_unitario: number;
  activo: number;
  nota: string | null;
}> | Err {
  const nombre = String(body.nombre ?? base?.nombre ?? "").trim();
  if (!nombre) return { ok: false, error: "Falta el nombre del insumo" };

  const tipo = (body.tipo ?? base?.tipo) as string;
  if (!(TIPOS_INSUMO as readonly string[]).includes(tipo)) {
    return { ok: false, error: "El tipo tiene que ser materia_prima, herraje o consumible" };
  }

  const unidad_compra = String(body.unidad_compra ?? base?.unidad_compra ?? "unidad").trim() || "unidad";
  const unidad_consumo = String(body.unidad_consumo ?? base?.unidad_consumo ?? "unidad").trim() || "unidad";

  const factor_compra = Number(body.factor_compra ?? base?.factor_compra ?? 1);
  if (!Number.isFinite(factor_compra) || factor_compra <= 0) {
    return { ok: false, error: "El factor de compra tiene que ser un número mayor a 0" };
  }

  let alerta_minimo: number | null = null;
  const am = body.alerta_minimo ?? base?.alerta_minimo ?? null;
  if (am !== null && am !== "" && am !== undefined) {
    const n = Number(am);
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: "La alerta de mínimo no es válida" };
    alerta_minimo = n;
  }

  const costo_unitario = Math.round(Number(body.costo_unitario ?? base?.costo_unitario ?? 0));
  if (!Number.isInteger(costo_unitario) || costo_unitario < 0) {
    return { ok: false, error: "El costo tiene que ser un entero de pesos ≥ 0" };
  }

  const activo = typeof body.activo === "boolean" ? (body.activo ? 1 : 0) : (base?.activo ?? 1);
  const notaCruda = body.nota !== undefined ? body.nota : base?.nota;
  const nota = typeof notaCruda === "string" && notaCruda.trim() ? notaCruda.trim() : null;

  return {
    ok: true,
    datos: {
      nombre,
      tipo: tipo as TipoInsumo,
      unidad_compra,
      unidad_consumo,
      factor_compra,
      alerta_minimo,
      costo_unitario,
      activo,
      nota,
    },
  };
}

export function validarPiezaBase(
  body: Record<string, unknown>,
  base?: ProductoBaseRow
): Ok<{ nombre: string; mano_obra_minutos: number; activo: number; nota: string | null }> | Err {
  const nombre = String(body.nombre ?? base?.nombre ?? "").trim();
  if (!nombre) return { ok: false, error: "Falta el nombre de la pieza" };

  const mano_obra_minutos = Math.round(Number(body.mano_obra_minutos ?? base?.mano_obra_minutos ?? 0));
  if (!Number.isInteger(mano_obra_minutos) || mano_obra_minutos < 0) {
    return { ok: false, error: "Los minutos de mano de obra no son válidos" };
  }
  const activo = typeof body.activo === "boolean" ? (body.activo ? 1 : 0) : (base?.activo ?? 1);
  const notaCruda = body.nota !== undefined ? body.nota : base?.nota;
  const nota = typeof notaCruda === "string" && notaCruda.trim() ? notaCruda.trim() : null;

  return { ok: true, datos: { nombre, mano_obra_minutos, activo, nota } };
}

export function validarProducto(
  body: Record<string, unknown>,
  base?: ProductoRow
): Ok<{
  nombre: string;
  sku: string | null;
  precio: number;
  imagen: string | null;
  activo: number;
  nota: string | null;
}> | Err {
  const nombre = String(body.nombre ?? base?.nombre ?? "").trim();
  if (!nombre) return { ok: false, error: "Falta el nombre del producto" };

  const skuCrudo = body.sku !== undefined ? body.sku : base?.sku;
  const sku = typeof skuCrudo === "string" && skuCrudo.trim() ? skuCrudo.trim() : null;

  const precio = Math.round(Number(body.precio ?? base?.precio ?? 0));
  if (!Number.isInteger(precio) || precio < 0) {
    return { ok: false, error: "El precio tiene que ser un entero de pesos ≥ 0" };
  }
  const imgCrudo = body.imagen !== undefined ? body.imagen : base?.imagen;
  const imagen = typeof imgCrudo === "string" && imgCrudo.trim() ? imgCrudo.trim() : null;
  const activo = typeof body.activo === "boolean" ? (body.activo ? 1 : 0) : (base?.activo ?? 1);
  const notaCruda = body.nota !== undefined ? body.nota : base?.nota;
  const nota = typeof notaCruda === "string" && notaCruda.trim() ? notaCruda.trim() : null;

  return { ok: true, datos: { nombre, sku, precio, imagen, activo, nota } };
}

export type RecetaEntrada = { insumoId: number; cantidad: number; bloqueante?: boolean };

// Valida la receta COMPLETA de una pieza (se reemplaza entera, no por
// renglón). Rechaza consumibles marcados como bloqueantes sin querer y
// exige que los insumos existan.
export function validarReceta(
  lineas: unknown
): Ok<{ insumo_id: number; cantidad: number; bloqueante: number }[]> | Err {
  if (!Array.isArray(lineas)) return { ok: false, error: "La receta tiene que ser una lista" };
  const vistos = new Set<number>();
  const out: { insumo_id: number; cantidad: number; bloqueante: number }[] = [];

  for (const l of lineas as RecetaEntrada[]) {
    const insumoId = Number(l?.insumoId);
    const cantidad = Number(l?.cantidad);
    if (!Number.isInteger(insumoId) || insumoId <= 0) {
      return { ok: false, error: "Cada renglón necesita un insumo" };
    }
    if (vistos.has(insumoId)) {
      return { ok: false, error: "Hay un insumo repetido en la receta" };
    }
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return { ok: false, error: "Cada renglón necesita una cantidad mayor a 0" };
    }
    const insumo = db
      .prepare(`SELECT id, tipo FROM insumos WHERE id = ?`)
      .get(insumoId) as { id: number; tipo: TipoInsumo } | undefined;
    if (!insumo) return { ok: false, error: `El insumo #${insumoId} no existe` };
    if (insumo.tipo === "consumible") {
      return {
        ok: false,
        error: "Los consumibles no van en la receta — se controlan por recuento periódico",
      };
    }
    const bloqueante = l?.bloqueante === false ? 0 : 1;
    vistos.add(insumoId);
    out.push({ insumo_id: insumoId, cantidad, bloqueante });
  }
  return { ok: true, datos: out };
}

export type ComposicionEntrada = { itemTipo: "base" | "insumo"; itemId: number; cantidad: number };

export function validarComposicion(
  lineas: unknown
): Ok<{ item_tipo: "base" | "insumo"; item_id: number; cantidad: number }[]> | Err {
  if (!Array.isArray(lineas)) return { ok: false, error: "La composición tiene que ser una lista" };
  const vistos = new Set<string>();
  const out: { item_tipo: "base" | "insumo"; item_id: number; cantidad: number }[] = [];

  for (const l of lineas as ComposicionEntrada[]) {
    const itemTipo = l?.itemTipo;
    const itemId = Number(l?.itemId);
    const cantidad = Number(l?.cantidad);
    if (itemTipo !== "base" && itemTipo !== "insumo") {
      return { ok: false, error: "Cada componente es 'base' o 'insumo'" };
    }
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return { ok: false, error: "Cada componente necesita un item" };
    }
    const clave = `${itemTipo}:${itemId}`;
    if (vistos.has(clave)) return { ok: false, error: "Hay un componente repetido" };
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return { ok: false, error: "Cada componente necesita una cantidad mayor a 0" };
    }
    const tabla = itemTipo === "base" ? "productos_base" : "insumos";
    const existe = db.prepare(`SELECT id FROM ${tabla} WHERE id = ?`).get(itemId);
    if (!existe) return { ok: false, error: `El ${itemTipo} #${itemId} no existe` };
    vistos.add(clave);
    out.push({ item_tipo: itemTipo, item_id: itemId, cantidad });
  }
  return { ok: true, datos: out };
}

export function validarPublicacion(
  body: Record<string, unknown>,
  base?: { producto_id: number; canal: string; ml_item_id: string | null; cuenta: string | null; titulo: string | null; url: string | null; activo: number }
): Ok<{
  producto_id: number;
  canal: string;
  ml_item_id: string | null;
  cuenta: string | null;
  titulo: string | null;
  url: string | null;
  activo: number;
}> | Err {
  const producto_id = Number(body.producto_id ?? base?.producto_id);
  if (!Number.isInteger(producto_id) || producto_id <= 0) {
    return { ok: false, error: "Falta el producto" };
  }
  const existe = db.prepare(`SELECT id FROM productos WHERE id = ?`).get(producto_id);
  if (!existe) return { ok: false, error: "El producto no existe" };

  const canal = String(body.canal ?? base?.canal ?? "mercadolibre");
  if (!(CANALES_PUBLICACION as readonly string[]).includes(canal)) {
    return { ok: false, error: "Canal inválido" };
  }
  const str = (v: unknown, b: string | null | undefined) => {
    const c = v !== undefined ? v : b;
    return typeof c === "string" && c.trim() ? c.trim() : null;
  };
  const activo = typeof body.activo === "boolean" ? (body.activo ? 1 : 0) : (base?.activo ?? 1);

  return {
    ok: true,
    datos: {
      producto_id,
      canal,
      ml_item_id: str(body.ml_item_id, base?.ml_item_id),
      cuenta: str(body.cuenta, base?.cuenta),
      titulo: str(body.titulo, base?.titulo),
      url: str(body.url, base?.url),
      activo,
    },
  };
}
