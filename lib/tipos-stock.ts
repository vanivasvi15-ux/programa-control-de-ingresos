// lib/tipos-stock.ts
//
// Formas de los objetos que devuelven las API Routes de stock/producción
// (ya en camelCase), para tiparlas igual en todas las pantallas de /stock.

import type { TipoInsumo } from "./stock-datos";
export type { TipoInsumo } from "./stock-datos";

export type Insumo = {
  id: number;
  nombre: string;
  tipo: TipoInsumo;
  unidadCompra: string;
  unidadConsumo: string;
  factorCompra: number;
  stock: number;
  alertaMinimo: number | null;
  costoUnitario: number;
  costoPorConsumo: number;
  bajoMinimo: boolean;
  activo: boolean;
  nota: string | null;
  creado: string;
  actualizado: string;
};

export type PiezaBase = {
  id: number;
  nombre: string;
  stock: number;
  manoObraMinutos: number;
  costoCalculado: number | null;
  costoActualizado: string | null;
  activo: boolean;
  nota: string | null;
  creado: string;
  actualizado: string;
};

export type RecetaLineaVista = {
  insumoId: number;
  cantidad: number;
  bloqueante: boolean;
  insumoNombre: string;
  insumoTipo: TipoInsumo;
  unidad: string;
};

export type Producto = {
  id: number;
  nombre: string;
  sku: string | null;
  precio: number;
  costoCalculado: number | null;
  costoActualizado: string | null;
  margen: number | null;
  imagen: string | null;
  activo: boolean;
  nota: string | null;
  creado: string;
  actualizado: string;
  publicaciones?: number;
};

export type ComposicionLineaVista = {
  itemTipo: "base" | "insumo";
  itemId: number;
  cantidad: number;
  nombre: string;
  unidad: string;
};

export type Publicacion = {
  id: number;
  productoId: number;
  productoNombre?: string | null;
  canal: "mercadolibre" | "tienda" | "otro";
  mlItemId: string | null;
  cuenta: string | null;
  titulo: string | null;
  url: string | null;
  activo: boolean;
  creado: string;
};

export type OrdenProduccion = {
  id: number;
  productoBaseId: number;
  piezaNombre: string | null;
  cantidad: number;
  estado: "planificada" | "realizada" | "anulada";
  fecha: string;
  costoTotal: number | null;
  usuarioId: number | null;
  usuarioNombre: string | null;
  nota: string | null;
  creado: string;
  actualizado: string;
};

export type CompraInsumo = {
  id: number;
  insumoId: number;
  insumoNombre: string | null;
  cantidadCompra: number;
  costoUnitario: number;
  costoTotal: number;
  actualizaCosto: boolean;
  movimientoId: number | null;
  proveedor: string | null;
  fecha: string;
  usuarioId: number | null;
  usuarioNombre: string | null;
  nota: string | null;
  creado: string;
};

export type RecuentoLista = {
  id: number;
  nombre: string;
  diasCada: number;
  ultimaRevision: string | null;
  diasDesdeRevision?: number | null;
  venceRevision?: boolean;
  activo: boolean;
  creado: string;
  items: { insumoId: number; nombre: string; stock: number; unidad: string }[];
};

export type MovimientoStock = {
  id: number;
  itemTipo: "insumo" | "base";
  itemId: number;
  itemNombre: string | null;
  delta: number;
  stockResultante: number;
  motivo: string;
  referenciaTipo: string | null;
  referenciaId: number | null;
  costoUnitarioMomento: number | null;
  usuarioId: number | null;
  usuarioNombre: string | null;
  nota: string | null;
  creado: string;
};

export type Faltantes = {
  producto: string;
  cantidad: number;
  listo: boolean;
  faltantes: { tipo: "insumo" | "base"; nombre: string; faltan: number; unidad: string }[];
  aFabricar: { nombre: string; cantidad: number }[];
};

export const NOMBRE_TIPO_INSUMO: Record<TipoInsumo, string> = {
  materia_prima: "Materia prima",
  herraje: "Herraje",
  consumible: "Consumible",
};

export const NOMBRE_MOTIVO_STOCK: Record<string, string> = {
  compra: "Compra",
  produccion_consumo: "Consumo de producción",
  produccion_alta: "Alta de producción",
  venta: "Venta",
  ajuste: "Ajuste",
  recuento: "Recuento",
  anulacion: "Anulación",
};

// Formatea una cantidad de stock: sin decimales si es entera, con hasta 2 si no.
export function formatearCantidad(n: number): string {
  return Number.isInteger(n)
    ? n.toLocaleString("es-AR")
    : n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}
