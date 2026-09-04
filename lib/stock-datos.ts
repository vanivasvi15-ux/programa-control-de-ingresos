// lib/stock-datos.ts
//
// Constantes, tipos y CÁLCULOS PUROS de stock y producción que NO tocan la
// base de datos. Vive aparte de lib/stock.ts (que sí importa node:sqlite)
// para poder testearlo y usarlo desde componentes del cliente sin arrastrar
// SQLite al bundle. Mismo patrón que lib/movimientos-datos.ts.

export const TIPOS_INSUMO = ["materia_prima", "herraje", "consumible"] as const;
export const MOTIVOS_STOCK = [
  "compra",
  "produccion_consumo",
  "produccion_alta",
  "venta",
  "ajuste",
  "recuento",
  "anulacion",
] as const;
export const CANALES_PUBLICACION = ["mercadolibre", "tienda", "otro"] as const;
export const ESTADOS_ORDEN = ["planificada", "realizada", "anulada"] as const;
export const ITEMS_COMPOSICION = ["base", "insumo"] as const;

export type TipoInsumo = (typeof TIPOS_INSUMO)[number];
export type MotivoStock = (typeof MOTIVOS_STOCK)[number];
export type CanalPublicacion = (typeof CANALES_PUBLICACION)[number];
export type EstadoOrden = (typeof ESTADOS_ORDEN)[number];
export type ItemComposicion = (typeof ITEMS_COMPOSICION)[number];

// ---------------------------------------------------------------------------
// Formas mínimas que necesitan los cálculos (un subconjunto de las filas).
// ---------------------------------------------------------------------------

export type InsumoCalc = {
  id: number;
  nombre: string;
  tipo: TipoInsumo;
  unidad_consumo: string;
  factor_compra: number;
  stock: number;
  costo_unitario: number; // pesos por unidad de COMPRA
};

export type RecetaLinea = {
  insumo_id: number;
  cantidad: number; // en unidad de consumo del insumo
  bloqueante: number; // 1 | 0
};

export type PiezaCalc = {
  id: number;
  nombre: string;
  stock: number;
  mano_obra_minutos: number;
  costo_calculado: number | null;
};

export type ComposicionLinea = {
  item_tipo: ItemComposicion;
  item_id: number;
  cantidad: number;
};

// ---------------------------------------------------------------------------
// COSTOS (hacia arriba: insumo -> pieza base -> producto)
// ---------------------------------------------------------------------------

// Costo de un insumo por UNA unidad de consumo (ej. por cm de planchuela).
// costo_unitario es el precio de la unidad de compra (la tira); factor_compra
// es cuántas unidades de consumo trae (600 cm).
export function costoInsumoPorConsumo(
  i: Pick<InsumoCalc, "costo_unitario" | "factor_compra">
): number {
  if (!i.factor_compra || i.factor_compra <= 0) return 0;
  return i.costo_unitario / i.factor_compra;
}

// Costo de fabricar UNA pieza base: suma de sus insumos + mano de obra
// (mano de obra sólo pesa si tarifaManoObraMinuto > 0). Redondeado a pesos.
export function costoPiezaBase(
  receta: RecetaLinea[],
  insumos: Map<number, InsumoCalc>,
  manoObraMinutos = 0,
  tarifaManoObraMinuto = 0
): number {
  let total = 0;
  for (const l of receta) {
    const ins = insumos.get(l.insumo_id);
    if (!ins) continue;
    total += l.cantidad * costoInsumoPorConsumo(ins);
  }
  total += manoObraMinutos * tarifaManoObraMinuto;
  return Math.round(total);
}

// Costo de UN producto (kit o repuesto): suma de sus componentes. Cada pieza
// base entra por su costo_calculado ya guardado; cada insumo suelto por su
// costo por unidad de consumo. Redondeado a pesos.
export function costoProducto(
  composicion: ComposicionLinea[],
  piezas: Map<number, PiezaCalc>,
  insumos: Map<number, InsumoCalc>
): number {
  let total = 0;
  for (const l of composicion) {
    if (l.item_tipo === "base") {
      const p = piezas.get(l.item_id);
      if (p?.costo_calculado != null) total += l.cantidad * p.costo_calculado;
    } else {
      const ins = insumos.get(l.item_id);
      if (ins) total += l.cantidad * costoInsumoPorConsumo(ins);
    }
  }
  return Math.round(total);
}

// ---------------------------------------------------------------------------
// "LISTO PARA ARMAR" / FALTANTES
// ---------------------------------------------------------------------------
// Dado un producto y una cantidad a preparar, dice si se puede armar con lo
// que hay, o qué falta. Mira sólo lo bloqueante (materia prima y herrajes;
// los consumibles no frenan). Si falta una pieza base pero hay material para
// fabricarla, no cuenta como faltante: va en "aFabricar".
//
// OJO: cuenta el stock por consulta, sin reservar. Con varios pedidos a la
// vez puede contar dos veces el mismo stock (ver docs/FASE-2-PASO-1.md).

export type Faltante = {
  tipo: "insumo" | "base";
  nombre: string;
  faltan: number;
  unidad: string;
};

export type AFabricar = { nombre: string; cantidad: number };

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Para un insumo suelto dentro de un kit no hay flag por línea: los
// consumibles no frenan, el resto sí.
function insumoFrena(ins: InsumoCalc): boolean {
  return ins.tipo !== "consumible";
}

export function faltantesDeProducto(args: {
  cantidad: number;
  composicion: ComposicionLinea[];
  piezas: Map<number, PiezaCalc>;
  recetas: Map<number, RecetaLinea[]>; // clave: producto_base_id
  insumos: Map<number, InsumoCalc>;
}): { listo: boolean; faltantes: Faltante[]; aFabricar: AFabricar[] } {
  const { cantidad, composicion, piezas, recetas, insumos } = args;
  const faltantes: Faltante[] = [];
  const aFabricar: AFabricar[] = [];

  // Consumo "reservado" mientras evaluamos este pedido, para no contar el
  // mismo stock de un insumo dos veces dentro de la misma consulta.
  const consumoInsumo = new Map<number, number>();
  const disponible = (id: number, stock: number) => stock - (consumoInsumo.get(id) ?? 0);
  const reservar = (id: number, q: number) =>
    consumoInsumo.set(id, (consumoInsumo.get(id) ?? 0) + q);

  for (const l of composicion) {
    if (l.item_tipo === "insumo") {
      const ins = insumos.get(l.item_id);
      if (!ins || !insumoFrena(ins)) continue;
      const necesita = l.cantidad * cantidad;
      const hay = disponible(ins.id, ins.stock);
      if (hay < necesita) {
        faltantes.push({
          tipo: "insumo",
          nombre: ins.nombre,
          faltan: redondear2(necesita - hay),
          unidad: ins.unidad_consumo,
        });
      } else {
        reservar(ins.id, necesita);
      }
      continue;
    }

    // item_tipo === "base"
    const pieza = piezas.get(l.item_id);
    if (!pieza) continue;
    const necesita = l.cantidad * cantidad;
    if (pieza.stock >= necesita) continue;

    const faltanPiezas = necesita - pieza.stock;
    const receta = (recetas.get(pieza.id) ?? []).filter((r) => r.bloqueante === 1);

    let sePuedenFabricar = true;
    const reservasTemp: Array<[number, number]> = [];
    for (const r of receta) {
      const ins = insumos.get(r.insumo_id);
      if (!ins) {
        sePuedenFabricar = false;
        break;
      }
      const necesitaMat = r.cantidad * faltanPiezas;
      const hay = disponible(ins.id, ins.stock);
      if (hay < necesitaMat) {
        sePuedenFabricar = false;
        faltantes.push({
          tipo: "insumo",
          nombre: ins.nombre,
          faltan: redondear2(necesitaMat - hay),
          unidad: ins.unidad_consumo,
        });
      } else {
        reservasTemp.push([ins.id, necesitaMat]);
      }
    }

    if (sePuedenFabricar) {
      for (const [id, q] of reservasTemp) reservar(id, q);
      aFabricar.push({ nombre: pieza.nombre, cantidad: faltanPiezas });
    } else {
      faltantes.push({ tipo: "base", nombre: pieza.nombre, faltan: faltanPiezas, unidad: "u" });
    }
  }

  return { listo: faltantes.length === 0, faltantes, aFabricar };
}
