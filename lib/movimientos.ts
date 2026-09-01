// lib/movimientos.ts
//
// Helpers compartidos por las API Routes de movimientos: validación de
// fechas, del cuerpo que llega en POST/PUT, y armado de la fila para
// devolver al cliente (con el nombre de la categoría y del usuario ya
// resueltos, para no hacer un fetch aparte desde el panel).

import { db } from "./db";

export const RECURRENCIAS = ["unico", "fijo", "variable_recurrente"] as const;
export const ESTADOS = ["activo", "pausado", "anulado"] as const;
export const TIPOS = ["ingreso", "gasto"] as const;

export type Recurrencia = (typeof RECURRENCIAS)[number];
export type EstadoMovimiento = (typeof ESTADOS)[number];
export type TipoMovimiento = (typeof TIPOS)[number];

// "YYYY-MM-DD" real (2026-02-31 no pasa: Date lo corregiría a marzo).
export function esFechaValida(valor: unknown): valor is string {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [a, m, d] = valor.split("-").map(Number);
  const fecha = new Date(a, m - 1, d);
  return fecha.getFullYear() === a && fecha.getMonth() === m - 1 && fecha.getDate() === d;
}

export type MovimientoRow = {
  id: number;
  tipo: TipoMovimiento;
  monto: number;
  categoria_id: number;
  fecha: string;
  recurrencia: Recurrencia;
  proxima_fecha: string | null;
  origen: "whatsapp" | "panel";
  usuario_id: number | null;
  estado: EstadoMovimiento;
  nota: string | null;
  creado: string;
  actualizado: string;
  categoria_nombre?: string | null;
  usuario_nombre?: string | null;
};

export function serializarMovimiento(m: MovimientoRow) {
  return {
    id: m.id,
    tipo: m.tipo,
    monto: m.monto,
    categoriaId: m.categoria_id,
    categoriaNombre: m.categoria_nombre ?? null,
    fecha: m.fecha,
    recurrencia: m.recurrencia,
    proximaFecha: m.proxima_fecha,
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
  SELECT m.*, c.nombre AS categoria_nombre, u.nombre AS usuario_nombre
  FROM movimientos m
  JOIN categorias c ON c.id = m.categoria_id
  LEFT JOIN usuarios u ON u.id = m.usuario_id
`;

export function obtenerMovimiento(id: number): MovimientoRow | undefined {
  return db.prepare(`${SELECT_CON_JOINS} WHERE m.id = ?`).get(id) as MovimientoRow | undefined;
}

export { SELECT_CON_JOINS };

// Valida y normaliza los campos de un movimiento que llegan en POST/PUT.
// `parcial` = true en PUT: los campos que no vienen se toman de `base`.
export type DatosMovimiento = {
  tipo: TipoMovimiento;
  monto: number;
  categoria_id: number;
  fecha: string;
  recurrencia: Recurrencia;
  proxima_fecha: string | null;
  estado: EstadoMovimiento;
  nota: string | null;
};

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
  // Sólo se exige categoría activa al crear o al cambiar de categoría;
  // editar otros campos de un movimiento viejo cuya categoría se desactivó
  // después no debería quedar bloqueado.
  const cambioCategoria = !base || base.categoria_id !== categoriaId;
  if (cambioCategoria && !categoria.activo) {
    return { ok: false, error: "Esa categoría está desactivada" };
  }

  const fecha = (body.fecha ?? base?.fecha) as unknown;
  if (!esFechaValida(fecha)) {
    return { ok: false, error: "La fecha tiene que tener el formato AAAA-MM-DD" };
  }

  const recurrencia = (body.recurrencia ?? base?.recurrencia ?? "unico") as unknown;
  if (!RECURRENCIAS.includes(recurrencia as Recurrencia)) {
    return { ok: false, error: "Recurrencia inválida" };
  }

  let proximaFecha: string | null;
  if (recurrencia === "unico") {
    proximaFecha = null;
  } else {
    const pf = body.proxima_fecha !== undefined ? body.proxima_fecha : base?.proxima_fecha;
    if (!esFechaValida(pf)) {
      return {
        ok: false,
        error: "Un movimiento fijo o variable recurrente necesita una próxima fecha (AAAA-MM-DD)",
      };
    }
    proximaFecha = pf as string;
  }

  const estado = (body.estado ?? base?.estado ?? "activo") as unknown;
  if (!ESTADOS.includes(estado as EstadoMovimiento)) {
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
      estado: estado as EstadoMovimiento,
      nota,
    },
  };
}
