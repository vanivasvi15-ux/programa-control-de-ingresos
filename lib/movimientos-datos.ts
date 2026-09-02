// lib/movimientos-datos.ts
//
// Constantes, tipos y helpers de fecha de los movimientos que NO tocan la
// base de datos. Vive aparte de lib/movimientos.ts (que sí importa
// node:sqlite) para poder usarlo también desde componentes del cliente
// sin arrastrar el módulo de SQLite al bundle del navegador.

export const RECURRENCIAS = ["unico", "fijo", "variable_recurrente"] as const;
export const ESTADOS = ["activo", "pausado", "anulado"] as const;
export const TIPOS = ["ingreso", "gasto"] as const;
export const FRECUENCIAS = [
  "semanal",
  "quincenal",
  "mensual",
  "bimestral",
  "trimestral",
  "semestral",
  "anual",
] as const;

export type Recurrencia = (typeof RECURRENCIAS)[number];
export type EstadoMovimiento = (typeof ESTADOS)[number];
export type TipoMovimiento = (typeof TIPOS)[number];
export type Frecuencia = (typeof FRECUENCIAS)[number];

// "YYYY-MM-DD" real (2026-02-31 no pasa: Date lo corregiría a marzo).
export function esFechaValida(valor: unknown): valor is string {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [a, m, d] = valor.split("-").map(Number);
  const fecha = new Date(a, m - 1, d);
  return fecha.getFullYear() === a && fecha.getMonth() === m - 1 && fecha.getDate() === d;
}

// Suma un período a una fecha "YYYY-MM-DD". Para períodos en meses, si el
// día no existe en el mes destino (31 ene + 1 mes) cae al último día.
export function avanzarFecha(fecha: string, frecuencia: Frecuencia): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const dias: Partial<Record<Frecuencia, number>> = { semanal: 7, quincenal: 15 };
  const meses: Partial<Record<Frecuencia, number>> = {
    mensual: 1,
    bimestral: 2,
    trimestral: 3,
    semestral: 6,
    anual: 12,
  };

  let base: Date;
  if (dias[frecuencia]) {
    base = new Date(a, m - 1, d + dias[frecuencia]!);
  } else {
    const totalMeses = m - 1 + (meses[frecuencia] ?? 1);
    const anioDestino = a + Math.floor(totalMeses / 12);
    const mesDestino = totalMeses % 12;
    const ultimoDia = new Date(anioDestino, mesDestino + 1, 0).getDate();
    base = new Date(anioDestino, mesDestino, Math.min(d, ultimoDia));
  }

  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
