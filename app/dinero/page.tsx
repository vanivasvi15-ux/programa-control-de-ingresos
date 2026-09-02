"use client";
// app/dinero/page.tsx — Dashboard del control de caja.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Encabezado from "@/components/Encabezado";
import Icono from "@/components/Icono";
import { Tarjeta, Boton, Chip, Segmentado, EstadoVacio } from "@/components/ui";
import { GraficoBarras, GraficoDona } from "@/components/Graficos";
import MovimientoModal from "@/components/MovimientoModal";
import RegistrarFijoModal from "@/components/RegistrarFijoModal";
import { useUsuario } from "@/components/UsuarioContext";
import {
  formatearPesos,
  formatearMes,
  formatearFechaCorta,
  textoDias,
  variacionPorcentual,
  mesActualYM,
} from "@/lib/formato";
import type { Categoria, Resumen, FijoProximo } from "@/lib/tipos";

function sumarMes(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + delta;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

function Kpi({
  label,
  valor,
  anterior,
  color,
  invertirColorVariacion = false,
}: {
  label: string;
  valor: number;
  anterior?: number;
  color?: "verde" | "rojo" | "neutro";
  invertirColorVariacion?: boolean;
}) {
  const clases =
    color === "verde"
      ? "text-[var(--color-income)]"
      : color === "rojo"
      ? "text-[var(--color-expense)]"
      : "text-[var(--color-text)]";
  const vari = anterior !== undefined ? variacionPorcentual(valor, anterior) : null;
  // Para gastos, "subió" es malo (rojo); para ingresos/balance, "subió" es bueno.
  const subio = vari !== null && vari > 0;
  const buenoQueSuba = !invertirColorVariacion;
  const colorVar =
    vari === null || vari === 0
      ? "text-[var(--color-muted)]"
      : subio === buenoQueSuba
      ? "text-[var(--color-income)]"
      : "text-[var(--color-expense)]";

  return (
    <Tarjeta className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold tabular ${clases}`}>{formatearPesos(valor)}</p>
      <p className={`mt-1 flex items-center gap-1 text-xs ${colorVar}`}>
        {vari === null ? (
          <span className="text-[var(--color-muted)]">sin dato del mes anterior</span>
        ) : (
          <>
            <Icono nombre={subio ? "flecha-arriba" : "flecha-abajo"} size={13} />
            {Math.abs(vari)}% vs. mes anterior
          </>
        )}
      </p>
    </Tarjeta>
  );
}

function FilaFijo({
  fijo,
  onRegistrar,
}: {
  fijo: FijoProximo;
  onRegistrar: (f: FijoProximo) => void;
}) {
  const puede = useUsuario().rol !== "contador";
  const vencido = fijo.diasRestantes !== null && fijo.diasRestantes < 0;
  const pronto = fijo.diasRestantes !== null && fijo.diasRestantes >= 0 && fijo.diasRestantes <= 5;
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span
        className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg ${
          fijo.tipo === "ingreso"
            ? "bg-[var(--color-income-soft)] text-[var(--color-income)]"
            : "bg-[var(--color-expense-soft)] text-[var(--color-expense)]"
        }`}
      >
        <Icono nombre={fijo.tipo === "ingreso" ? "flecha-arriba" : "flecha-abajo"} size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{fijo.categoriaNombre}</p>
        <p className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
          {fijo.proximaFecha && formatearFechaCorta(fijo.proximaFecha)}
          <span>·</span>
          <span className={vencido ? "font-semibold text-[var(--color-expense)]" : ""}>
            {textoDias(fijo.diasRestantes)}
          </span>
        </p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <span className="tabular text-sm font-semibold">
          {fijo.recurrencia === "variable_recurrente" ? "~" : ""}
          {formatearPesos(fijo.monto)}
        </span>
        {fijo.yaRegistradoEsteMes ? (
          <Chip color="verde">
            <Icono nombre="check" size={12} /> hecho
          </Chip>
        ) : puede ? (
          <Boton
            tamano="sm"
            variante={pronto || vencido ? "primario" : "contorno"}
            onClick={() => onRegistrar(fijo)}
          >
            Registrar
          </Boton>
        ) : null}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const usuario = useUsuario();
  const [mes, setMes] = useState(mesActualYM());
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [fijoARegistrar, setFijoARegistrar] = useState<FijoProximo | null>(null);
  const [tortaTipo, setTortaTipo] = useState<"gasto" | "ingreso">("gasto");

  const cargar = useCallback(async () => {
    const [rRes, rCat] = await Promise.all([
      fetch(`/api/resumen?mes=${mes}`),
      fetch("/api/categorias"),
    ]);
    if (rRes.ok) setResumen(await rRes.json());
    if (rCat.ok) setCategorias(await rCat.json());
    setCargando(false);
  }, [mes]);

  useEffect(() => {
    setCargando(true);
    cargar();
  }, [cargar]);

  const tortaDatos =
    resumen?.porCategoria
      .filter((c) => c.tipo === tortaTipo)
      .map((c) => ({ nombre: c.nombre, total: c.total })) ?? [];

  return (
    <div>
      <Encabezado
        titulo="Panel"
        subtitulo={`Hola, ${usuario.nombre.split(" ")[0]} 👋`}
        acciones={
          <>
            <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
              <button
                onClick={() => setMes((m) => sumarMes(m, -1))}
                className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
                title="Mes anterior"
              >
                <Icono nombre="chevron-izq" size={16} />
              </button>
              <span className="min-w-[130px] text-center text-sm font-semibold">
                {formatearMes(mes)}
              </span>
              <button
                onClick={() => setMes((m) => sumarMes(m, 1))}
                disabled={mes >= mesActualYM()}
                className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] disabled:opacity-30"
                title="Mes siguiente"
              >
                <Icono nombre="chevron-der" size={16} />
              </button>
            </div>
            {mes !== mesActualYM() && (
              <Boton variante="fantasma" tamano="sm" onClick={() => setMes(mesActualYM())}>
                Hoy
              </Boton>
            )}
            {usuario.rol !== "contador" && (
              <Boton variante="primario" icono="mas" onClick={() => setModalNuevo(true)}>
                Nuevo movimiento
              </Boton>
            )}
          </>
        }
      />

      {cargando || !resumen ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Tarjeta key={i} className="h-28 animate-pulse bg-[var(--color-surface-2)]" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Kpi
              label="Ingresos"
              valor={resumen.totales.ingresos}
              anterior={resumen.totalesMesAnterior.ingresos}
              color="verde"
            />
            <Kpi
              label="Gastos"
              valor={resumen.totales.gastos}
              anterior={resumen.totalesMesAnterior.gastos}
              color="rojo"
              invertirColorVariacion
            />
            <Kpi
              label="Balance"
              valor={resumen.totales.balance}
              anterior={resumen.totalesMesAnterior.balance}
              color={resumen.totales.balance >= 0 ? "verde" : "rojo"}
            />
          </div>

          {/* Proyección */}
          {resumen.esMesActual &&
            (resumen.proyeccion.pendientesGasto > 0 ||
              resumen.proyeccion.pendientesIngreso > 0) && (
              <Tarjeta className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
                <div className="flex items-center gap-2 text-sm">
                  <Icono nombre="reloj" size={16} className="text-[var(--color-muted)]" />
                  <span className="font-semibold">Proyección a fin de mes</span>
                </div>
                <p className="text-xs text-[var(--color-muted)]">
                  Sumando los fijos que faltan registrar este mes
                  {resumen.proyeccion.pendientesIngreso > 0 && (
                    <> · +{formatearPesos(resumen.proyeccion.pendientesIngreso)} por cobrar</>
                  )}
                  {resumen.proyeccion.pendientesGasto > 0 && (
                    <> · −{formatearPesos(resumen.proyeccion.pendientesGasto)} por pagar</>
                  )}
                </p>
                <span
                  className={`tabular ml-auto text-lg font-bold ${
                    resumen.proyeccion.balance >= 0
                      ? "text-[var(--color-income)]"
                      : "text-[var(--color-expense)]"
                  }`}
                >
                  {formatearPesos(resumen.proyeccion.balance)}
                </span>
              </Tarjeta>
            )}

          {/* Gráficos */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Tarjeta className="p-4">
              <p className="mb-3 text-sm font-semibold">Ingresos vs. gastos · últimos 6 meses</p>
              <GraficoBarras datos={resumen.serie} />
            </Tarjeta>
            <Tarjeta className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">Por categoría</p>
                <Segmentado
                  opciones={[
                    { valor: "gasto", label: "Gastos" },
                    { valor: "ingreso", label: "Ingresos" },
                  ]}
                  valor={tortaTipo}
                  onChange={(v) => setTortaTipo(v as "gasto" | "ingreso")}
                />
              </div>
              {tortaDatos.length ? (
                <GraficoDona datos={tortaDatos} />
              ) : (
                <EstadoVacio
                  icono="etiqueta"
                  titulo="Sin datos este mes"
                  detalle={`No hay ${tortaTipo === "gasto" ? "gastos" : "ingresos"} cargados en ${formatearMes(
                    mes
                  )}.`}
                />
              )}
            </Tarjeta>
          </div>

          {/* Fijos + límites */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Tarjeta className="p-4">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-sm font-semibold">Próximos fijos</p>
                <Link
                  href="/dinero/fijos"
                  className="text-xs font-medium text-[var(--color-accent)] hover:underline"
                >
                  Ver todos
                </Link>
              </div>
              {resumen.proximosFijos.length ? (
                <div className="divide-y divide-[var(--color-border)]">
                  {resumen.proximosFijos.slice(0, 6).map((f) => (
                    <FilaFijo key={f.id} fijo={f} onRegistrar={setFijoARegistrar} />
                  ))}
                </div>
              ) : (
                <EstadoVacio
                  icono="fijos"
                  titulo="No hay fijos cargados"
                  detalle="Cargá un movimiento marcándolo como Fijo para verlo acá."
                />
              )}
            </Tarjeta>

            {usuario.rol === "dueño" && resumen.limites.length > 0 && (
              <Tarjeta className="p-4">
                <p className="mb-3 text-sm font-semibold">Límites por categoría</p>
                <div className="space-y-3">
                  {resumen.limites.map((l) => {
                    const pct = Math.min(l.porcentaje, 100);
                    const pasado = l.porcentaje >= 100;
                    const cerca = l.porcentaje >= 80 && !pasado;
                    return (
                      <div key={l.id}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium">{l.categoriaNombre}</span>
                          <span className="tabular text-[var(--color-muted)]">
                            {formatearPesos(l.gastado)} / {formatearPesos(l.limite)}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                          <div
                            className={`h-full rounded-full ${
                              pasado
                                ? "bg-[var(--color-expense)]"
                                : cerca
                                ? "bg-[var(--color-warn)]"
                                : "bg-[var(--color-income)]"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Tarjeta>
            )}
          </div>

          {/* Últimos movimientos */}
          <Tarjeta className="p-4">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-semibold">Últimos movimientos</p>
              <Link
                href="/dinero/movimientos"
                className="text-xs font-medium text-[var(--color-accent)] hover:underline"
              >
                Ver todos
              </Link>
            </div>
            {resumen.ultimos.length ? (
              <div className="divide-y divide-[var(--color-border)]">
                {resumen.ultimos.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 py-2.5">
                    <span
                      className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg ${
                        m.tipo === "ingreso"
                          ? "bg-[var(--color-income-soft)] text-[var(--color-income)]"
                          : "bg-[var(--color-expense-soft)] text-[var(--color-expense)]"
                      }`}
                    >
                      <Icono
                        nombre={m.tipo === "ingreso" ? "flecha-arriba" : "flecha-abajo"}
                        size={15}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {m.categoriaNombre}
                        {m.nota ? (
                          <span className="font-normal text-[var(--color-muted)]"> · {m.nota}</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {formatearFechaCorta(m.fecha)}
                        {m.origen === "whatsapp" && " · WhatsApp"}
                      </p>
                    </div>
                    <span
                      className={`tabular flex-shrink-0 text-sm font-semibold ${
                        m.tipo === "ingreso"
                          ? "text-[var(--color-income)]"
                          : "text-[var(--color-expense)]"
                      }`}
                    >
                      {m.tipo === "ingreso" ? "+" : "−"}
                      {formatearPesos(m.monto)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EstadoVacio
                titulo="Todavía no hay movimientos"
                detalle="Cargá el primero con el botón “Nuevo movimiento”."
                accion={
                  usuario.rol !== "contador" && (
                    <Boton variante="primario" icono="mas" onClick={() => setModalNuevo(true)}>
                      Nuevo movimiento
                    </Boton>
                  )
                }
              />
            )}
          </Tarjeta>
        </div>
      )}

      {modalNuevo && (
        <MovimientoModal
          categorias={categorias}
          puedeCrearCategoria={usuario.rol === "dueño"}
          onCerrar={() => setModalNuevo(false)}
          onGuardado={() => {
            setModalNuevo(false);
            cargar();
          }}
        />
      )}

      {fijoARegistrar && (
        <RegistrarFijoModal
          fijo={fijoARegistrar}
          onCerrar={() => setFijoARegistrar(null)}
          onRegistrado={() => {
            setFijoARegistrar(null);
            cargar();
          }}
        />
      )}
    </div>
  );
}
