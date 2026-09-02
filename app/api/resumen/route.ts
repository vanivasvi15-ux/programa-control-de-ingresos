import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usuarioActual } from "@/lib/auth";
import { SELECT_CON_JOINS, serializarMovimiento, type MovimientoRow } from "@/lib/movimientos";

export const dynamic = "force-dynamic";

// Devuelve todo lo que necesita el dashboard /dinero para un mes dado,
// ya agregado del lado del servidor (así el panel no baja todos los
// movimientos para sumar a mano).
//
// Querystring: ?mes=AAAA-MM  (default: mes actual)
//
// Criterio: los totales del mes cuentan sólo los movimientos con
// recurrencia = 'unico' y estado = 'activo' (incluye los que se generaron
// al "registrar" un fijo). Los fijos en sí son plantillas y se muestran
// aparte en "próximos a vencer".

function sumarMeses(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + delta;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

function diasEntre(desde: string, hasta: string): number {
  const [a1, m1, d1] = desde.split("-").map(Number);
  const [a2, m2, d2] = hasta.split("-").map(Number);
  const t1 = Date.UTC(a1, m1 - 1, d1);
  const t2 = Date.UTC(a2, m2 - 1, d2);
  return Math.round((t2 - t1) / 86400000);
}

export async function GET(req: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
  }

  const ahora = new Date();
  const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(
    ahora.getDate()
  ).padStart(2, "0")}`;
  const mesActual = hoy.slice(0, 7);

  const { searchParams } = new URL(req.url);
  const mesParam = searchParams.get("mes");
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : mesActual;
  const mesAnterior = sumarMeses(mes, -1);

  // Filtro por usuario para el rol "encargado" (sólo ve lo suyo).
  // node:sqlite tira error si se pasa un named param que no está en el
  // SQL, así que sólo agregamos { uid } al objeto de params cuando el
  // filtro está activo.
  const soloMio = usuario.rol === "encargado";
  const filtroUsuario = soloMio ? " AND m.usuario_id = @uid" : "";
  const U: Record<string, number> = soloMio ? { uid: usuario.id } : {};

  // --- Totales de un mes (ingresos/gastos/balance) ---
  function totalesDe(ym: string) {
    const fila = db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN m.tipo = 'ingreso' THEN m.monto END), 0) AS ingresos,
           COALESCE(SUM(CASE WHEN m.tipo = 'gasto'   THEN m.monto END), 0) AS gastos
         FROM movimientos m
         WHERE m.recurrencia = 'unico' AND m.estado = 'activo'
           AND m.fecha LIKE @patron ${filtroUsuario}`
      )
      .get({ patron: `${ym}-%`, ...U }) as { ingresos: number; gastos: number };
    return { ingresos: fila.ingresos, gastos: fila.gastos, balance: fila.ingresos - fila.gastos };
  }

  const totales = totalesDe(mes);
  const totalesMesAnterior = totalesDe(mesAnterior);

  // --- Desglose por categoría del mes ---
  const porCategoria = db
    .prepare(
      `SELECT c.id AS categoriaId, c.nombre, c.tipo, SUM(m.monto) AS total
       FROM movimientos m
       JOIN categorias c ON c.id = m.categoria_id
       WHERE m.recurrencia = 'unico' AND m.estado = 'activo'
         AND m.fecha LIKE @patron ${filtroUsuario}
       GROUP BY c.id
       ORDER BY total DESC`
    )
    .all({ patron: `${mes}-%`, ...U }) as {
    categoriaId: number;
    nombre: string;
    tipo: "ingreso" | "gasto";
    total: number;
  }[];

  // --- Serie de los últimos 6 meses (incluye el mes elegido) ---
  const desdeSerie = `${sumarMeses(mes, -5)}-01`;
  const hastaSerie = `${sumarMeses(mes, 1)}-01`;
  const filasSerie = db
    .prepare(
      `SELECT substr(m.fecha, 1, 7) AS ym, m.tipo, SUM(m.monto) AS total
       FROM movimientos m
       WHERE m.recurrencia = 'unico' AND m.estado = 'activo'
         AND m.fecha >= @desde AND m.fecha < @hasta ${filtroUsuario}
       GROUP BY ym, m.tipo`
    )
    .all({ desde: desdeSerie, hasta: hastaSerie, ...U }) as {
    ym: string;
    tipo: "ingreso" | "gasto";
    total: number;
  }[];

  const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const serie = Array.from({ length: 6 }, (_, i) => {
    const ym = sumarMeses(mes, -5 + i);
    const ingresos = filasSerie.find((f) => f.ym === ym && f.tipo === "ingreso")?.total ?? 0;
    const gastos = filasSerie.find((f) => f.ym === ym && f.tipo === "gasto")?.total ?? 0;
    return { mes: ym, etiqueta: MESES_CORTOS[Number(ym.slice(5, 7)) - 1], ingresos, gastos };
  });

  // --- Próximos fijos a vencer ---
  const fijosRaw = db
    .prepare(
      `${SELECT_CON_JOINS}
       WHERE m.recurrencia != 'unico' AND m.estado = 'activo' ${filtroUsuario}
       ORDER BY m.proxima_fecha ASC
       LIMIT 20`
    )
    .all(U) as MovimientoRow[];

  const proximosFijos = fijosRaw.map((f) => {
    const yaRegistrado = db
      .prepare(
        `SELECT 1 FROM movimientos
         WHERE generado_por_fijo_id = ? AND fecha LIKE ? LIMIT 1`
      )
      .get(f.id, `${mes}-%`);
    return {
      ...serializarMovimiento(f),
      diasRestantes: f.proxima_fecha ? diasEntre(hoy, f.proxima_fecha) : null,
      yaRegistradoEsteMes: !!yaRegistrado,
    };
  });

  // --- Límites por categoría (sólo el dueño los administra y los ve) ---
  type LimiteResumen = {
    id: number;
    categoriaId: number;
    categoriaNombre: string;
    limite: number;
    gastado: number;
    porcentaje: number;
  };
  let limites: LimiteResumen[] = [];
  if (usuario.rol === "dueño") {
    const alertas = db
      .prepare(`SELECT id, parametros_json FROM alertas_config WHERE tipo = 'limite_categoria' AND activo = 1`)
      .all() as { id: number; parametros_json: string }[];
    limites = alertas
      .map((a): LimiteResumen | null => {
        let p: { categoriaId?: number; monto?: number } = {};
        try {
          p = JSON.parse(a.parametros_json || "{}");
        } catch {
          p = {};
        }
        if (!p.categoriaId || !p.monto) return null;
        const cat = db.prepare(`SELECT nombre FROM categorias WHERE id = ?`).get(p.categoriaId) as
          | { nombre: string }
          | undefined;
        const gastadoFila = db
          .prepare(
            `SELECT COALESCE(SUM(monto), 0) AS t FROM movimientos
             WHERE recurrencia = 'unico' AND estado = 'activo' AND tipo = 'gasto'
               AND categoria_id = ? AND fecha LIKE ?`
          )
          .get(p.categoriaId, `${mes}-%`) as { t: number };
        return {
          id: a.id,
          categoriaId: p.categoriaId,
          categoriaNombre: cat?.nombre ?? "(categoría borrada)",
          limite: p.monto,
          gastado: gastadoFila.t,
          porcentaje: p.monto > 0 ? Math.round((gastadoFila.t / p.monto) * 100) : 0,
        };
      })
      .filter((x): x is LimiteResumen => x !== null)
      .sort((a, b) => b.porcentaje - a.porcentaje);
  }

  // --- Últimos movimientos ---
  const ultimosRaw = db
    .prepare(
      `${SELECT_CON_JOINS}
       WHERE m.recurrencia = 'unico' AND m.estado != 'anulado' ${filtroUsuario}
       ORDER BY m.fecha DESC, m.id DESC
       LIMIT 8`
    )
    .all(U) as MovimientoRow[];
  const ultimos = ultimosRaw.map(serializarMovimiento);

  // --- Proyección a fin de mes: balance actual + fijos que faltan
  //     registrar cuya proxima_fecha cae dentro del mes elegido ---
  const fijosPendientes = proximosFijos.filter(
    (f) => !f.yaRegistradoEsteMes && f.proximaFecha && f.proximaFecha.slice(0, 7) <= mes
  );
  const pendientesIngreso = fijosPendientes
    .filter((f) => f.tipo === "ingreso")
    .reduce((s, f) => s + f.monto, 0);
  const pendientesGasto = fijosPendientes
    .filter((f) => f.tipo === "gasto")
    .reduce((s, f) => s + f.monto, 0);
  const proyeccion = {
    ingresos: totales.ingresos + pendientesIngreso,
    gastos: totales.gastos + pendientesGasto,
    balance: totales.balance + pendientesIngreso - pendientesGasto,
    pendientesIngreso,
    pendientesGasto,
  };

  return NextResponse.json({
    mes,
    mesAnterior,
    esMesActual: mes === mesActual,
    hoy,
    totales,
    totalesMesAnterior,
    porCategoria,
    serie,
    proximosFijos,
    limites,
    ultimos,
    proyeccion,
  });
}
