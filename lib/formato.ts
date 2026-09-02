// lib/formato.ts
//
// Formateo de plata, fechas y períodos en español de Argentina.
// Se usa tanto en el servidor como en el cliente.

const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const numero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

// $ 45.000  /  con signo: + $ 45.000  ·  - $ 15.000
export function formatearPesos(monto: number, opts?: { signo?: boolean }): string {
  const base = pesos.format(Math.abs(Math.round(monto)));
  if (!opts?.signo) return monto < 0 ? `-${base}` : base;
  if (monto > 0) return `+ ${base}`;
  if (monto < 0) return `- ${base}`;
  return base;
}

export function formatearNumero(n: number): string {
  return numero.format(Math.round(n));
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// "2026-09-01" -> "1 sep 2026"
export function formatearFecha(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso ?? "";
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MESES[m - 1].slice(0, 3)} ${a}`;
}

// "2026-09-01" -> "lun 1 sep"
export function formatearFechaCorta(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso ?? "";
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dias = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const dow = dias[new Date(a, m - 1, d).getDay()];
  return `${dow} ${d} ${MESES[m - 1].slice(0, 3)}`;
}

// "2026-09" -> "Septiembre 2026"
export function formatearMes(ym: string): string {
  const [a, m] = ym.split("-").map(Number);
  const nombre = MESES[m - 1];
  return `${nombre[0].toUpperCase()}${nombre.slice(1)} ${a}`;
}

// "2026-09" -> "sep 2026"
export function formatearMesCorto(ym: string): string {
  const [a, m] = ym.split("-").map(Number);
  return `${MESES[m - 1].slice(0, 3)} ${a}`;
}

// n días -> "vence hoy" / "en 3 días" / "vencido hace 2 días"
export function textoDias(dias: number | null): string {
  if (dias === null) return "";
  if (dias === 0) return "vence hoy";
  if (dias === 1) return "vence mañana";
  if (dias > 1) return `en ${dias} días`;
  if (dias === -1) return "venció ayer";
  return `venció hace ${Math.abs(dias)} días`;
}

// Variación porcentual entre dos valores (para los KPI "vs mes anterior").
export function variacionPorcentual(actual: number, anterior: number): number | null {
  if (anterior === 0) return actual === 0 ? 0 : null; // null = "sin base de comparación"
  return Math.round(((actual - anterior) / Math.abs(anterior)) * 100);
}

export const NOMBRE_FRECUENCIA: Record<string, string> = {
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
  bimestral: "Bimestral",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export const NOMBRE_RECURRENCIA: Record<string, string> = {
  unico: "Único",
  fijo: "Fijo",
  variable_recurrente: "Variable recurrente",
};

// "2026-09-01" (hoy del cliente, en su huso local)
export function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function mesActualYM(): string {
  return hoyISO().slice(0, 7);
}
