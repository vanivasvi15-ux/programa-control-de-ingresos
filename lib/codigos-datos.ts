// lib/codigos-datos.ts
//
// Códigos de barras de piezas y productos: formato, generación y validación
// PURAS (sin base de datos), para usar en servidor y cliente.
//
// Se imprimen en Code128. El lector USB escribe el código como si fuera un
// teclado, así que se evitan símbolos que cambian según la distribución del
// teclado (guiones, barras…): los códigos propios son sólo letras y números.

export type TipoCodigo = "base" | "producto";

// PB = pieza base, PF = producto final. El prefijo hace que un código propio
// nunca choque entre piezas y productos, y deja ver de un vistazo qué es.
export const PREFIJO_CODIGO: Record<TipoCodigo, string> = {
  base: "PB",
  producto: "PF",
};

export const LARGO_MAXIMO_CODIGO = 40;

// Código que se asigna solo: PB00012 / PF00003.
export function codigoPorDefecto(tipo: TipoCodigo, id: number): string {
  return `${PREFIJO_CODIGO[tipo]}${String(id).padStart(5, "0")}`;
}

// Dirección de la hoja de etiquetas de código de barras (se abre en otra
// pestaña para imprimir).
export function urlEtiquetasCodigos(tipo: TipoCodigo, ids: number[], copias = 1): string {
  return `/etiquetas/codigos?tipo=${tipo}&ids=${ids.join(",")}&copias=${copias}`;
}

export type ResultadoCodigo = { ok: true; codigo: string | null } | { ok: false; error: string };

// Normaliza el código que escribe una persona: sin espacios en los bordes,
// vacío = null (se genera uno), sólo ASCII imprimible (lo que entra en Code128
// subconjunto B) y de largo razonable. Lo que se escanea suele venir en
// mayúsculas, así que no se cambia el uso de mayúsculas/minúsculas.
export function normalizarCodigo(valor: unknown): ResultadoCodigo {
  if (valor === null || valor === undefined) return { ok: true, codigo: null };
  const s = String(valor).trim();
  if (!s) return { ok: true, codigo: null };
  if (s.length > LARGO_MAXIMO_CODIGO) {
    return { ok: false, error: `El código de barras no puede pasar de ${LARGO_MAXIMO_CODIGO} caracteres` };
  }
  if (!/^[\x20-\x7E]+$/.test(s) || /\s/.test(s)) {
    return {
      ok: false,
      error: "El código de barras sólo puede tener letras sin acento, números y símbolos comunes, sin espacios",
    };
  }
  return { ok: true, codigo: s };
}
