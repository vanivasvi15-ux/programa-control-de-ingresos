// lib/tipos-stock.ts
//
// Formas de los objetos que devuelven las API Routes de stock/producción
// (ya en camelCase), para tiparlas igual en todas las pantallas de /stock.

import type { TipoInsumo } from "./stock-datos";
import type { CanalVenta, Entrega, EstadoVenta } from "./despacho-datos";
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
  codigoBarras: string | null;
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
  codigoBarras: string | null;
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
  unidad: string;
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

export type VentaItem = {
  id: number;
  productoId: number | null;
  productoNombre: string | null;
  titulo: string | null;
  cantidad: number;
  precioUnitario: number;
};

export type Venta = {
  id: number;
  canal: CanalVenta;
  cuenta: string | null;
  numeroExterno: string | null;
  fecha: string;
  clienteNombre: string;
  clienteTelefono: string | null;
  clienteEmail: string | null;
  direccion: string | null;
  localidad: string | null;
  provincia: string | null;
  codigoPostal: string | null;
  entrega: Entrega;
  seguimiento: string | null;
  bultos: number;
  nota: string | null;
  estado: EstadoVenta;
  stockDescontado: boolean;
  despachadoEn: string | null;
  creado: string;
  actualizado: string;
  estadoStock: "listo" | "fabricar" | "faltan" | null;
  detalleStock: string[];
  items: VentaItem[];
};

export const NOMBRE_TIPO_INSUMO: Record<TipoInsumo, string> = {
  materia_prima: "Materia prima",
  herraje: "Herraje",
  consumible: "Consumible",
};

// Nombres en palabras de todos los días (lo que se ve en el Historial).
export const NOMBRE_MOTIVO_STOCK: Record<string, string> = {
  compra: "Compra de material",
  produccion_consumo: "Material gastado",
  produccion_alta: "Pieza fabricada",
  venta: "Salió por venta",
  ajuste: "Ajuste a mano",
  recuento: "Corrección por recuento",
  anulacion: "Se deshizo",
};

// Qué significa cada motivo, con un ejemplo. Se muestra en la ayuda del
// Historial y en la página Ayuda.
export const DESCRIPCION_MOTIVO_STOCK: Record<string, { que: string; ejemplo: string }> = {
  compra: {
    que: "Entró material nuevo porque cargaste una compra.",
    ejemplo: "Compraste 5 tiras de planchuela → la planchuela sube 3.000 cm.",
  },
  produccion_consumo: {
    que: "Se gastó material para fabricar una pieza, según su receta.",
    ejemplo: "Fabricás 2 rieles → la planchuela baja 400 cm y el ángulo 80 cm.",
  },
  produccion_alta: {
    que: "Se sumó una pieza terminada al stock (por una orden de producción o por escaneo).",
    ejemplo: "Escaneás la etiqueta de un Carro → el stock de Carro sube 1.",
  },
  venta: {
    que: "Se despachó una venta y se descontó lo vendido.",
    ejemplo: "Despachás un kit → bajan las piezas y herrajes que lleva.",
  },
  ajuste: {
    que: "Alguien corrigió el stock a mano.",
    ejemplo: "Se rompió una pieza y se la dio de baja.",
  },
  recuento: {
    que: "Se contó lo que hay de verdad y el sistema se acomodó a ese número.",
    ejemplo: "El sistema decía 10 discos de corte, contaste 8 → queda −2.",
  },
  anulacion: {
    que: "Se deshizo un movimiento anterior: devuelve lo mismo pero al revés, para volver al valor de antes. No es un error: es la marca de que apretaste «Deshacer» o anulaste algo.",
    ejemplo: "Escaneaste un Carro por equivocación y tocaste «Deshacer» → aparece +400 cm de planchuela (se devuelve) y −1 Carro.",
  },
};

// De qué operación viene un movimiento, en una frase corta.
export function textoOrigenMovimiento(tipo: string | null, id: number | null): string | null {
  if (!tipo) return null;
  const n = id != null ? ` #${id}` : "";
  switch (tipo) {
    case "orden_produccion":
      return `Orden de producción${n}`;
    case "escaneo":
      return `Ingreso por escaneo${n}`;
    case "venta":
      return `Venta${n}`;
    case "compra_insumo":
      return `Compra de material${n}`;
    case "recuento_lista":
      return `Recuento${n}`;
    default:
      return `${tipo}${n}`;
  }
}

// Formatea una cantidad de stock: sin decimales si es entera, con hasta 2 si no.
export function formatearCantidad(n: number): string {
  return Number.isInteger(n)
    ? n.toLocaleString("es-AR")
    : n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}
