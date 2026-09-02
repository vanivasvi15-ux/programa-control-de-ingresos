// lib/movimientos.ts
//
// Helpers de movimientos que SÍ tocan la base (validación contra
// categorías, armado de la fila con joins). Las constantes/tipos y los
// helpers de fecha viven en lib/movimientos-datos.ts para poder usarlos
// también en el cliente.

import { db } from "./db";
import {
  RECURRENCIAS,
  ESTADOS,
  FRECUENCIAS,
  esFechaValida,
  type Recurrencia,
  type EstadoMovimiento,
  type TipoMovimiento,
  type Frecuencia,
} from "./movimientos-datos";

export {
  RECURRENCIAS,
  ESTADOS,
  TIPOS,
  FRECUENCIAS,
  esFechaValida,
  avanzarFecha,
} from "./movimientos-datos";
export type { Recurrencia, EstadoMovimiento, TipoMovimiento, Frecuencia } from "./movimientos-datos";

export type MovimientoRow = {
  id: number;
  tipo: TipoMovimiento;
  monto: number;
  categoria_id: number;
  fecha: string;
  recurrencia: Recurrencia;
  proxima_fecha: string | null;
  frecuencia: Frecuencia | null;
  generado_por_fijo_id: number | null;
  origen: "whatsapp" | "panel";
  usuario_id: number | null;
  estado: EstadoMovimiento;
  nota: string | null;
  creado: string;
  actualizado: string;
  categoria_nombre?: string | null;
  categoria_activa?: number | null;
  usuario_nombre?: string | null;
};

export function serializarMovimiento(m: MovimientoRow) {
  return {
    id: m.id,
    tipo: m.tipo,
    monto: m.monto,
    categoriaId: m.categoria_id,
    categoriaNombre: m.categoria_nombre ?? null,
    categoriaActiva: m.categoria_activa == null ? null : !!m.categoria_activa,
    fecha: m.fecha,
    recurrencia: m.recurrencia,
    proximaFecha: m.proxima_fecha,
    frecuencia: m.frecuencia,
    generadoPorFijoId: m.generado_por_fijo_id,
    origen: m.origen,
    usuarioId: m.usuario_id,
    usuarioNombre: m.usuario_nombre ?? null,
    estado: m.estado,
    nota: m.nota,
    creado: m.creado,
    actualizado: m.actualizado,
  };
}

const SELECT_CON_JOINS = `
  SELECT m.*, c.nombre AS categoria_nombre, c.activo AS categoria_activa, u.nombre AS usuario_nombre
  FROM movimientos m
  JOIN categorias c ON c.id = m.categoria_id
  LEFT JOIN usuarios u ON u.id = m.usuario_id
`;

export function obtenerMovimiento(id: number): MovimientoRow | undefined {
  return db.prepare(`${SELECT_CON_JOINS} WHERE m.id = ?`).get(id) as MovimientoRow | undefined;
}

export { SELECT_CON_JOINS };

export type DatosMovimiento = {
  tipo: TipoMovimiento;
  monto: number;
  categoria_id: number;
  fecha: string;
  recurrencia: Recurrencia;
  proxima_fecha: string | null;
  frecuencia: Frecuencia | null;
  estado: EstadoMovimiento;
  nota: string | null;
};

// Valida y normaliza los campos de un movimiento que llegan en POST/PUT.
// En PUT se pasa `base` (la fila actual): los campos que no vienen en el
// body se toman de ahí.
export function validarDatosMovimiento(
  body: Record<string, unknown>,
  base?: MovimientoRow
): { ok: true; datos: DatosMovimiento } | { ok: false; error: string } {
  const tipoCrudo = body.tipo ?? base?.tipo;
  if (tipoCrudo !== "ingreso" && tipoCrudo !== "gasto") {
    return { ok: false, error: "El tipo tiene que ser 'ingreso' o 'gasto'" };
  }
  const tipo = tipoCrudo as TipoMovimiento;

  const montoCrudo = body.monto ?? base?.monto;
  const monto = Number(montoCrudo);
  if (!Number.isInteger(monto) || monto <= 0) {
    return { ok: false, error: "El monto tiene que ser un número entero de pesos mayor a 0" };
  }

  const categoriaId = Number(body.categoria_id ?? base?.categoria_id);
  if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
    return { ok: false, error: "Falta la categoría" };
  }
  const categoria = db
    .prepare(`SELECT id, tipo, activo FROM categorias WHERE id = ?`)
    .get(categoriaId) as { id: number; tipo: string; activo: number } | undefined;
  if (!categoria) {
    return { ok: false, error: "La categoría no existe" };
  }
  if (categoria.tipo !== tipo) {
    return {
      ok: false,
      error: `La categoría es de tipo '${categoria.tipo}' y el movimiento es '${tipo}'`,
    };
  }
  const cambioCategoria = !base || base.categoria_id !== categoriaId;
  if (cambioCategoria && !categoria.activo) {
    return { ok: false, error: "Esa categoría está desactivada" };
  }

  const fecha = (body.fecha ?? base?.fecha) as unknown;
  if (!esFechaValida(fecha)) {
    return { ok: false, error: "La fecha tiene que tener el formato AAAA-MM-DD" };
  }

  const recurrencia = (body.recurrencia ?? base?.recurrencia ?? "unico") as unknown;
  if (!(RECURRENCIAS as readonly string[]).includes(recurrencia as string)) {
    return { ok: false, error: "Recurrencia inválida" };
  }

  let proximaFecha: string | null;
  let frecuencia: Frecuencia | null;
  if (recurrencia === "unico") {
    proximaFecha = null;
    frecuencia = null;
  } else {
    const pf = body.proxima_fecha !== undefined ? body.proxima_fecha : base?.proxima_fecha;
    if (!esFechaValida(pf)) {
      return {
        ok: false,
        error: "Un movimiento fijo o variable recurrente necesita una próxima fecha (AAAA-MM-DD)",
      };
    }
    proximaFecha = pf as string;

    const fr = body.frecuencia !== undefined ? body.frecuencia : (base?.frecuencia ?? "mensual");
    if (!(FRECUENCIAS as readonly string[]).includes(fr as string)) {
      return { ok: false, error: "Frecuencia inválida" };
    }
    frecuencia = fr as Frecuencia;
  }

  const estado = (body.estado ?? base?.estado ?? "activo") as unknown;
  if (!(ESTADOS as readonly string[]).includes(estado as string)) {
    return { ok: false, error: "Estado inválido" };
  }

  const notaCruda = body.nota !== undefined ? body.nota : base?.nota;
  const nota = typeof notaCruda === "string" && notaCruda.trim() ? notaCruda.trim() : null;

  return {
    ok: true,
    datos: {
      tipo,
      monto,
      categoria_id: categoriaId,
      fecha: fecha as string,
      recurrencia: recurrencia as Recurrencia,
      proxima_fecha: proximaFecha,
      frecuencia,
      estado: estado as EstadoMovimiento,
      nota,
    },
  };
}
