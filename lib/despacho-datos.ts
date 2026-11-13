// lib/despacho-datos.ts
//
// Constantes, tipos y validación PURA de las ventas a despachar (lista diaria
// + etiquetas). No toca la base: se puede usar desde el cliente y testear.
// Mismo patrón que lib/stock-datos.ts y lib/movimientos-datos.ts.

import { esFechaValida } from "./movimientos-datos.ts";

export const CANALES_VENTA = ["mercadolibre", "tienda", "manual", "otro"] as const;
export const ENTREGAS = ["envio_ml", "correo", "mensajeria", "retiro"] as const;
export const ESTADOS_VENTA = ["pendiente", "preparado", "despachado", "anulado"] as const;

export type CanalVenta = (typeof CANALES_VENTA)[number];
export type Entrega = (typeof ENTREGAS)[number];
export type EstadoVenta = (typeof ESTADOS_VENTA)[number];

export const NOMBRE_CANAL: Record<CanalVenta, string> = {
  mercadolibre: "Mercado Libre",
  tienda: "Tienda",
  manual: "Manual",
  otro: "Otro",
};

export const NOMBRE_ENTREGA: Record<Entrega, string> = {
  envio_ml: "Mercado Envíos",
  correo: "Correo",
  mensajeria: "Mensajería / flete",
  retiro: "Retira en local",
};

export type ItemDatos = {
  productoId: number | null;
  titulo: string | null;
  cantidad: number;
  precioUnitario: number;
};

export type VentaDatos = {
  canal?: CanalVenta;
  cuenta?: string | null;
  numeroExterno?: string | null;
  fecha?: string;
  clienteNombre?: string;
  clienteTelefono?: string | null;
  clienteEmail?: string | null;
  direccion?: string | null;
  localidad?: string | null;
  provincia?: string | null;
  codigoPostal?: string | null;
  entrega?: Entrega;
  seguimiento?: string | null;
  bultos?: number;
  nota?: string | null;
  items?: ItemDatos[];
};

export type ResultadoValidacion =
  | { ok: true; datos: VentaDatos }
  | { ok: false; error: string };

function texto(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function esUnoDe<T extends string>(lista: readonly T[], v: unknown): v is T {
  return typeof v === "string" && (lista as readonly string[]).includes(v);
}

// Valida el body de POST (parcial=false: exige cliente, fecha e ítems) o de
// PUT (parcial=true: sólo valida lo que viene).
export function validarVenta(body: Record<string, unknown>, parcial: boolean): ResultadoValidacion {
  const d: VentaDatos = {};

  if (body.canal !== undefined) {
    if (!esUnoDe(CANALES_VENTA, body.canal)) return { ok: false, error: "Canal inválido" };
    d.canal = body.canal;
  }
  if (body.entrega !== undefined) {
    if (!esUnoDe(ENTREGAS, body.entrega)) return { ok: false, error: "Forma de entrega inválida" };
    d.entrega = body.entrega;
  }
  if (body.fecha !== undefined) {
    if (typeof body.fecha !== "string" || !esFechaValida(body.fecha)) {
      return { ok: false, error: "Fecha inválida (AAAA-MM-DD)" };
    }
    d.fecha = body.fecha;
  } else if (!parcial) {
    return { ok: false, error: "Falta la fecha" };
  }

  if (body.clienteNombre !== undefined) {
    const n = texto(body.clienteNombre);
    if (!n) return { ok: false, error: "Falta el nombre del cliente" };
    d.clienteNombre = n;
  } else if (!parcial) {
    return { ok: false, error: "Falta el nombre del cliente" };
  }

  for (const campo of [
    "cuenta",
    "numeroExterno",
    "clienteTelefono",
    "clienteEmail",
    "direccion",
    "localidad",
    "provincia",
    "codigoPostal",
    "seguimiento",
    "nota",
  ] as const) {
    if (body[campo] !== undefined) d[campo] = texto(body[campo]);
  }

  if (body.bultos !== undefined) {
    const b = Number(body.bultos);
    if (!Number.isInteger(b) || b < 1 || b > 50) return { ok: false, error: "Bultos inválido (1 a 50)" };
    d.bultos = b;
  }

  if (body.items !== undefined || !parcial) {
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return { ok: false, error: "La venta necesita al menos un producto" };
    }
    const items: ItemDatos[] = [];
    for (const raw of body.items as Record<string, unknown>[]) {
      const cantidad = Number(raw?.cantidad);
      if (!Number.isInteger(cantidad) || cantidad < 1) {
        return { ok: false, error: "Cantidad inválida en un producto" };
      }
      const productoId =
        raw?.productoId === null || raw?.productoId === undefined || raw?.productoId === ""
          ? null
          : Number(raw.productoId);
      if (productoId !== null && (!Number.isInteger(productoId) || productoId < 1)) {
        return { ok: false, error: "Producto inválido" };
      }
      const titulo = texto(raw?.titulo);
      if (productoId === null && !titulo) {
        return { ok: false, error: "Cada renglón necesita un producto o un título" };
      }
      const precio = raw?.precioUnitario === undefined ? 0 : Number(raw.precioUnitario);
      if (!Number.isFinite(precio) || precio < 0) return { ok: false, error: "Precio inválido" };
      items.push({ productoId, titulo, cantidad, precioUnitario: Math.round(precio) });
    }
    d.items = items;
  }

  return { ok: true, datos: d };
}

// "Calle 123 · Localidad (CP 1234) · Provincia" — una sola línea para listas.
export function direccionCompleta(v: {
  direccion?: string | null;
  localidad?: string | null;
  codigoPostal?: string | null;
  provincia?: string | null;
}): string {
  const partes = [
    v.direccion,
    [v.localidad, v.codigoPostal ? `(CP ${v.codigoPostal})` : null].filter(Boolean).join(" ") || null,
    v.provincia,
  ].filter((p): p is string => !!p && p.trim() !== "");
  return partes.join(" · ");
}
