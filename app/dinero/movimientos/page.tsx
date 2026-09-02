"use client";
// app/dinero/movimientos/page.tsx — Listado, filtros y edición de movimientos.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Encabezado from "@/components/Encabezado";
import Icono from "@/components/Icono";
import { Tarjeta, Boton, Chip, Segmentado, EstadoVacio, inputClase } from "@/components/ui";
import MovimientoModal, { type PresetMovimiento } from "@/components/MovimientoModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useUsuario } from "@/components/UsuarioContext";
import {
  formatearPesos,
  formatearFecha,
  formatearFechaCorta,
  hoyISO,
  mesActualYM,
  NOMBRE_RECURRENCIA,
} from "@/lib/formato";
import type { Categoria, Movimiento, UsuarioPanel } from "@/lib/tipos";

type Preset = "este_mes" | "mes_pasado" | "ult_30" | "este_anio" | "todo" | "personalizado";

function rangoDePreset(p: Preset): { desde: string; hasta: string } {
  const hoy = hoyISO();
  const [y, m] = mesActualYM().split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const ultimoDia = (yy: number, mm: number) => new Date(yy, mm, 0).getDate();
  switch (p) {
    case "este_mes":
      return { desde: `${y}-${pad(m)}-01`, hasta: `${y}-${pad(m)}-${ultimoDia(y, m)}` };
    case "mes_pasado": {
      const my = m === 1 ? y - 1 : y;
      const mm = m === 1 ? 12 : m - 1;
      return { desde: `${my}-${pad(mm)}-01`, hasta: `${my}-${pad(mm)}-${ultimoDia(my, mm)}` };
    }
    case "ult_30": {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      return {
        desde: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        hasta: hoy,
      };
    }
    case "este_anio":
      return { desde: `${y}-01-01`, hasta: `${y}-12-31` };
    default:
      return { desde: "", hasta: "" };
  }
}

function MenuAcciones({ acciones }: { acciones: { label: string; icono: React.ComponentProps<typeof Icono>["nombre"]; onClick: () => void; peligro?: boolean }[] }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
      >
        <span className="text-lg leading-none">⋯</span>
      </button>
      {abierto && (
        <div className="absolute right-0 top-9 z-10 w-40 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg aparecer">
          {acciones.map((a) => (
            <button
              key={a.label}
              onClick={() => {
                setAbierto(false);
                a.onClick();
              }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-[var(--color-surface-2)] ${
                a.peligro ? "text-[var(--color-expense)]" : ""
              }`}
            >
              <Icono nombre={a.icono} size={15} />
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MovimientosPage() {
  const usuario = useUsuario();
  const puedeEscribir = usuario.rol !== "contador";
  const veUsuarios = usuario.rol !== "encargado";

  const [preset, setPreset] = useState<Preset>("este_mes");
  const [rango, setRango] = useState(rangoDePreset("este_mes"));
  const [tipo, setTipo] = useState<"todos" | "ingreso" | "gasto">("todos");
  const [categoriaId, setCategoriaId] = useState<number | "">("");
  const [estado, setEstado] = useState<"todos" | "activo" | "pausado" | "anulado">("activo");
  const [usuarioId, setUsuarioId] = useState<number | "">("");
  const [texto, setTexto] = useState("");

  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioPanel[]>([]);
  const [cargando, setCargando] = useState(true);

  const [modalNuevo, setModalNuevo] = useState<null | { presets?: PresetMovimiento }>(null);
  const [editar, setEditar] = useState<Movimiento | null>(null);
  const [anular, setAnular] = useState<Movimiento | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const qs = new URLSearchParams();
    if (rango.desde) qs.set("desde", rango.desde);
    if (rango.hasta) qs.set("hasta", rango.hasta);
    if (tipo !== "todos") qs.set("tipo", tipo);
    if (categoriaId) qs.set("categoria_id", String(categoriaId));
    if (estado !== "todos") qs.set("estado", estado);
    if (veUsuarios && usuarioId) qs.set("usuario_id", String(usuarioId));
    const rM = await fetch(`/api/movimientos?${qs}`);
    if (rM.ok) setMovs(await rM.json());
    setCargando(false);
  }, [rango, tipo, categoriaId, estado, usuarioId, veUsuarios]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Catálogos: se piden una sola vez.
  useEffect(() => {
    fetch("/api/categorias")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCategorias);
    if (veUsuarios) {
      fetch("/api/usuarios")
        .then((r) => (r.ok ? r.json() : []))
        .then(setUsuarios);
    }
  }, [veUsuarios]);

  const filtrados = useMemo(() => {
    const t = texto.trim().toLowerCase();
    if (!t) return movs;
    return movs.filter(
      (m) =>
        m.nota?.toLowerCase().includes(t) ||
        m.categoriaNombre?.toLowerCase().includes(t) ||
        String(m.monto).includes(t)
    );
  }, [movs, texto]);

  const totales = useMemo(() => {
    let ing = 0;
    let gas = 0;
    for (const m of filtrados) {
      if (m.estado === "anulado") continue;
      if (m.tipo === "ingreso") ing += m.monto;
      else gas += m.monto;
    }
    return { ing, gas, balance: ing - gas, n: filtrados.length };
  }, [filtrados]);

  function cambiarPreset(p: Preset) {
    setPreset(p);
    if (p !== "personalizado") setRango(rangoDePreset(p));
  }

  function exportarCSV() {
    const cab = ["Fecha", "Tipo", "Categoria", "Monto", "Estado", "Recurrencia", "Origen", "Usuario", "Nota"];
    const filas = filtrados.map((m) => [
      m.fecha,
      m.tipo,
      m.categoriaNombre ?? "",
      String(m.monto),
      m.estado,
      m.recurrencia,
      m.origen,
      m.usuarioNombre ?? "",
      (m.nota ?? "").replace(/"/g, '""'),
    ]);
    const csv = [cab, ...filas]
      .map((f) => f.map((c) => `"${c}"`).join(";"))
      .join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movimientos-${hoyISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function anularMov() {
    if (!anular) return;
    await fetch(`/api/movimientos/${anular.id}`, { method: "DELETE" });
    setAnular(null);
    cargar();
  }

  const catsActivasYtipo = categorias.filter((c) => tipo === "todos" || c.tipo === tipo);

  return (
    <div>
      <Encabezado
        titulo="Movimientos"
        acciones={
          <>
            <Boton variante="contorno" icono="descargar" onClick={exportarCSV} disabled={!filtrados.length}>
              Exportar
            </Boton>
            {puedeEscribir && (
              <Boton variante="primario" icono="mas" onClick={() => setModalNuevo({})}>
                Nuevo
              </Boton>
            )}
          </>
        }
      />

      {/* Filtros */}
      <Tarjeta className="mb-4 p-3">
        <div className="flex flex-wrap items-end gap-2.5">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-[var(--color-muted)]">Período</span>
            <select
              value={preset}
              onChange={(e) => cambiarPreset(e.target.value as Preset)}
              className={`${inputClase} w-40`}
            >
              <option value="este_mes">Este mes</option>
              <option value="mes_pasado">Mes pasado</option>
              <option value="ult_30">Últimos 30 días</option>
              <option value="este_anio">Este año</option>
              <option value="todo">Todo</option>
              <option value="personalizado">Personalizado</option>
            </select>
          </label>

          {preset === "personalizado" && (
            <>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-[var(--color-muted)]">Desde</span>
                <input
                  type="date"
                  value={rango.desde}
                  onChange={(e) => setRango((r) => ({ ...r, desde: e.target.value }))}
                  className={`${inputClase} w-40`}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-[var(--color-muted)]">Hasta</span>
                <input
                  type="date"
                  value={rango.hasta}
                  onChange={(e) => setRango((r) => ({ ...r, hasta: e.target.value }))}
                  className={`${inputClase} w-40`}
                />
              </label>
            </>
          )}

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-[var(--color-muted)]">Categoría</span>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value ? Number(e.target.value) : "")}
              className={`${inputClase} w-44`}
            >
              <option value="">Todas</option>
              {catsActivasYtipo.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.tipo === "ingreso" ? "ing" : "gto"})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-[var(--color-muted)]">Estado</span>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as typeof estado)}
              className={`${inputClase} w-32`}
            >
              <option value="activo">Activos</option>
              <option value="pausado">Pausados</option>
              <option value="anulado">Anulados</option>
              <option value="todos">Todos</option>
            </select>
          </label>

          {veUsuarios && (
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-[var(--color-muted)]">Cargó</span>
              <select
                value={usuarioId}
                onChange={(e) => setUsuarioId(e.target.value ? Number(e.target.value) : "")}
                className={`${inputClase} w-36`}
              >
                <option value="">Cualquiera</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block flex-1 min-w-[160px]">
            <span className="mb-1 block text-[11px] font-semibold text-[var(--color-muted)]">Buscar</span>
            <div className="relative">
              <Icono
                nombre="buscar"
                size={15}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
              />
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="nota o categoría…"
                className={`${inputClase} pl-8`}
              />
            </div>
          </label>

          <div className="ml-auto">
            <Segmentado
              opciones={[
                { valor: "todos", label: "Todo" },
                { valor: "ingreso", label: "Ingresos" },
                { valor: "gasto", label: "Gastos" },
              ]}
              valor={tipo}
              onChange={(v) => setTipo(v as typeof tipo)}
            />
          </div>
        </div>
      </Tarjeta>

      {/* Totales del filtro */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tarjeta className="p-3">
          <p className="text-[11px] font-semibold uppercase text-[var(--color-muted)]">Movimientos</p>
          <p className="text-lg font-bold tabular">{totales.n}</p>
        </Tarjeta>
        <Tarjeta className="p-3">
          <p className="text-[11px] font-semibold uppercase text-[var(--color-muted)]">Ingresos</p>
          <p className="text-lg font-bold tabular text-[var(--color-income)]">
            {formatearPesos(totales.ing)}
          </p>
        </Tarjeta>
        <Tarjeta className="p-3">
          <p className="text-[11px] font-semibold uppercase text-[var(--color-muted)]">Gastos</p>
          <p className="text-lg font-bold tabular text-[var(--color-expense)]">
            {formatearPesos(totales.gas)}
          </p>
        </Tarjeta>
        <Tarjeta className="p-3">
          <p className="text-[11px] font-semibold uppercase text-[var(--color-muted)]">Balance</p>
          <p
            className={`text-lg font-bold tabular ${
              totales.balance >= 0 ? "text-[var(--color-income)]" : "text-[var(--color-expense)]"
            }`}
          >
            {formatearPesos(totales.balance)}
          </p>
        </Tarjeta>
      </div>

      {/* Lista */}
      <Tarjeta className="overflow-hidden">
        {cargando ? (
          <div className="divide-y divide-[var(--color-border)]">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 animate-pulse bg-[var(--color-surface-2)]/40" />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <EstadoVacio
            titulo="Sin movimientos"
            detalle="Probá cambiar los filtros o cargá uno nuevo."
            accion={
              puedeEscribir && (
                <Boton variante="primario" icono="mas" onClick={() => setModalNuevo({})}>
                  Nuevo movimiento
                </Boton>
              )
            }
          />
        ) : (
          <>
            {/* Encabezado tabla (desktop) */}
            <div className="hidden border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/40 px-4 py-2 text-[11px] font-semibold uppercase text-[var(--color-muted)] sm:grid sm:grid-cols-[92px_1fr_120px_44px] sm:gap-3">
              <span>Fecha</span>
              <span>Detalle</span>
              <span className="text-right">Monto</span>
              <span />
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {filtrados.map((m) => {
                const acciones = [
                  { label: "Editar", icono: "lapiz" as const, onClick: () => setEditar(m) },
                  {
                    label: "Duplicar",
                    icono: "duplicar" as const,
                    onClick: () =>
                      setModalNuevo({
                        presets: {
                          tipo: m.tipo,
                          monto: m.monto,
                          categoriaId: m.categoriaId,
                          nota: m.nota ?? undefined,
                          fecha: hoyISO(),
                        },
                      }),
                  },
                  ...(m.estado !== "anulado"
                    ? [{ label: "Anular", icono: "basura" as const, onClick: () => setAnular(m), peligro: true }]
                    : []),
                ];
                return (
                  <div
                    key={m.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[92px_1fr_120px_44px]"
                  >
                    <div className="order-1 text-xs text-[var(--color-muted)] sm:order-none">
                      <span className="hidden sm:inline">{formatearFechaCorta(m.fecha)}</span>
                      <span className="sm:hidden">{formatearFecha(m.fecha)}</span>
                    </div>
                    <div className="order-3 col-span-2 min-w-0 sm:order-none sm:col-span-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-md ${
                            m.tipo === "ingreso"
                              ? "bg-[var(--color-income-soft)] text-[var(--color-income)]"
                              : "bg-[var(--color-expense-soft)] text-[var(--color-expense)]"
                          }`}
                        >
                          <Icono
                            nombre={m.tipo === "ingreso" ? "flecha-arriba" : "flecha-abajo"}
                            size={13}
                          />
                        </span>
                        <span className="text-sm font-medium">{m.categoriaNombre}</span>
                        {m.categoriaActiva === false && <Chip>inactiva</Chip>}
                        {m.recurrencia !== "unico" && (
                          <Chip color="indigo">{NOMBRE_RECURRENCIA[m.recurrencia]}</Chip>
                        )}
                        {m.generadoPorFijoId && <Chip color="indigo">de un fijo</Chip>}
                        {m.origen === "whatsapp" && <Chip color="verde">WhatsApp</Chip>}
                        {m.estado === "pausado" && <Chip color="ambar">Pausado</Chip>}
                        {m.estado === "anulado" && <Chip color="rojo">Anulado</Chip>}
                      </div>
                      {(m.nota || (veUsuarios && m.usuarioNombre)) && (
                        <p className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
                          {m.nota}
                          {m.nota && veUsuarios && m.usuarioNombre ? " · " : ""}
                          {veUsuarios && m.usuarioNombre ? `cargó ${m.usuarioNombre}` : ""}
                        </p>
                      )}
                    </div>
                    <div
                      className={`order-2 text-right text-sm font-bold tabular sm:order-none ${
                        m.estado === "anulado"
                          ? "text-[var(--color-muted)] line-through"
                          : m.tipo === "ingreso"
                          ? "text-[var(--color-income)]"
                          : "text-[var(--color-expense)]"
                      }`}
                    >
                      {m.tipo === "ingreso" ? "+" : "−"}
                      {formatearPesos(m.monto)}
                    </div>
                    <div className="order-4 flex justify-end sm:order-none">
                      {puedeEscribir ? (
                        <MenuAcciones acciones={acciones} />
                      ) : (
                        <span className="w-8" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Tarjeta>

      {modalNuevo && (
        <MovimientoModal
          categorias={categorias}
          puedeCrearCategoria={usuario.rol === "dueño"}
          presets={modalNuevo.presets}
          onCerrar={() => setModalNuevo(null)}
          onGuardado={() => {
            setModalNuevo(null);
            cargar();
          }}
        />
      )}
      {editar && (
        <MovimientoModal
          categorias={categorias}
          puedeCrearCategoria={usuario.rol === "dueño"}
          movimiento={editar}
          onCerrar={() => setEditar(null)}
          onGuardado={() => {
            setEditar(null);
            cargar();
          }}
        />
      )}
      {anular && (
        <ConfirmDialog
          titulo="Anular movimiento"
          peligro
          textoConfirmar="Sí, anular"
          mensaje={
            <>
              Se va a marcar como <strong>anulado</strong> (no se borra, deja de contar en los
              totales).
              <br />
              <span className="text-[var(--color-muted)]">
                {formatearFecha(anular.fecha)} · {anular.categoriaNombre} ·{" "}
                {formatearPesos(anular.monto)}
              </span>
            </>
          }
          onConfirmar={anularMov}
          onCerrar={() => setAnular(null)}
        />
      )}
    </div>
  );
}
