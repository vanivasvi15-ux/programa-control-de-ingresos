// lib/alertas.ts
//
// Tipos y validación de las alertas configurables. La tabla alertas_config
// guarda los parámetros de cada alerta como JSON en "parametros_json"
// para no atarse a columnas fijas; acá se define qué forma tiene ese JSON
// según el tipo, y se valida al crear/editar. La tarea programada que
// dispara las alertas llega en el paso 3.

export const TIPOS_ALERTA = [
  "limite_categoria",
  "fijo_por_vencer",
  "resumen_periodico",
  "inactividad",
] as const;

export type TipoAlerta = (typeof TIPOS_ALERTA)[number];

// Valida el objeto de parámetros de una alerta según su tipo. Devuelve el
// objeto ya normalizado, o un mensaje de error.
export function validarParametrosAlerta(
  tipo: TipoAlerta,
  params: Record<string, unknown>
): { ok: true; parametros: Record<string, unknown> } | { ok: false; error: string } {
  switch (tipo) {
    case "limite_categoria": {
      const categoriaId = Number(params.categoriaId);
      const monto = Number(params.monto);
      if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
        return { ok: false, error: "Elegí una categoría para el límite" };
      }
      if (!Number.isInteger(monto) || monto <= 0) {
        return { ok: false, error: "El monto del límite tiene que ser un entero mayor a 0" };
      }
      return { ok: true, parametros: { categoriaId, monto } };
    }
    case "fijo_por_vencer": {
      const diasAntes = Number(params.diasAntes);
      if (!Number.isInteger(diasAntes) || diasAntes < 0 || diasAntes > 60) {
        return { ok: false, error: "Los días de aviso tienen que estar entre 0 y 60" };
      }
      return { ok: true, parametros: { diasAntes } };
    }
    case "resumen_periodico": {
      const periodo = params.periodo;
      if (periodo !== "semanal" && periodo !== "mensual") {
        return { ok: false, error: "El período tiene que ser 'semanal' o 'mensual'" };
      }
      return { ok: true, parametros: { periodo } };
    }
    case "inactividad": {
      const dias = Number(params.dias);
      if (!Number.isInteger(dias) || dias < 1 || dias > 90) {
        return { ok: false, error: "Los días de inactividad tienen que estar entre 1 y 90" };
      }
      return { ok: true, parametros: { dias } };
    }
    default:
      return { ok: false, error: "Tipo de alerta inválido" };
  }
}
