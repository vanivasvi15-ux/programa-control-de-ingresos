"use client";
// app/stock/movimientos/page.tsx — historial de stock (sólo lectura).

import { useCallback, useEffect, useMemo, useState } from "react";
import Encabezado from "@/components/Encabezado";
import Icono from "@/components/Icono";
import Ayuda from "@/components/Ayuda";
import { Tarjeta, Chip, Segmentado, EstadoVacio, inputClase } from "@/components/ui";
import { formatearFecha } from "@/lib/formato";
import {
  DESCRIPCION_MOTIVO_STOCK,
  NOMBRE_MOTIVO_STOCK,
  formatearCantidad,
  textoOrigenMovimiento,
  type MovimientoStock,
} from "@/lib/tipos-stock";

const COLOR_MOTIVO: Record<string, "verde" | "rojo" | "ambar" | "indigo" | "neutro"> = {
  compra: "verde",
  produccion_alta: "verde",
  produccion_consumo: "rojo",
  venta: "rojo",
  ajuste: "ambar",
  recuento: "indigo",
  anulacion: "ambar",
};

export default function HistorialStockPage() {
  const [movs, setMovs] = useState<MovimientoStock[]>([]);
  const [cargando, setCargando] = useState(true);
  const [itemTipo, setItemTipo] = useState<"todos" | "insumo" | "base">("todos");
  const [motivo, setMotivo] = useState("");
  const [texto, setTexto] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    const qs = new URLSearchParams({ limite: "300" });
    if (itemTipo !== "todos") qs.set("item_tipo", itemTipo);
    if (motivo) qs.set("motivo", motivo);
    const r = await fetch(`/api/movimientos-stock?${qs}`);
    if (r.ok) setMovs(await r.json());
    setCargando(false);
  }, [itemTipo, motivo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtrados = useMemo(() => {
    const t = texto.trim().toLowerCase();
    if (!t) return movs;
    return movs.filter(
      (m) =>
        m.itemNombre?.toLowerCase().includes(t) ||
        NOMBRE_MOTIVO_STOCK[m.motivo]?.toLowerCase().includes(t) ||
        (textoOrigenMovimiento(m.referenciaTipo, m.referenciaId) ?? "").toLowerCase().includes(t)
    );
  }, [movs, texto]);

  return (
    <div>
      <Encabezado
        titulo="Historial de stock"
        subtitulo="Cada vez que sube o baja una cantidad queda anotado acá: qué, cuánto, por qué y quién"
      />

      <Ayuda titulo="¿Cómo leo esta lista?">
        <p>
          Cada renglón es <strong>un cambio de stock</strong>. A la izquierda está lo que cambió y por qué; a la
          derecha, <strong>cuánto subió o bajó</strong> (verde = sube, rojo = baja) y <strong>cuánto quedó</strong>{" "}
          después. Abajo del nombre dice <strong>de qué operación salió</strong> (una orden de producción, un
          escaneo, una venta…) y quién la hizo.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(DESCRIPCION_MOTIVO_STOCK).map(([clave, d]) => (
            <div key={clave} className="rounded-lg bg-[var(--color-surface-2)] px-3 py-2">
              <Chip color={COLOR_MOTIVO[clave] ?? "neutro"}>{NOMBRE_MOTIVO_STOCK[clave]}</Chip>
              <p className="mt-1 text-[13px]">{d.que}</p>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">Ej.: {d.ejemplo}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--color-muted)]">
          Esta lista no se puede editar a propósito: sirve de registro. Para corregir algo, se hace la operación
          contraria (por ejemplo «Deshacer» en Ingreso) y queda anotada como «Se deshizo».
        </p>
      </Ayuda>

      <Tarjeta className="mb-4 flex flex-wrap items-center gap-2.5 p-3">
        <Segmentado
          opciones={[
            { valor: "todos", label: "Todo" },
            { valor: "insumo", label: "Materiales" },
            { valor: "base", label: "Piezas" },
          ]}
          valor={itemTipo}
          onChange={(v) => setItemTipo(v as typeof itemTipo)}
        />
        <select
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className={`${inputClase} w-auto`}
          aria-label="Filtrar por motivo"
        >
          <option value="">Todos los motivos</option>
          {Object.entries(NOMBRE_MOTIVO_STOCK).map(([clave, nombre]) => (
            <option key={clave} value={clave}>
              {nombre}
            </option>
          ))}
        </select>
        <label className="relative flex-1 min-w-[160px]">
          <Icono
            nombre="buscar"
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
          />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por nombre, motivo u operación…"
            className={`${inputClase} pl-8`}
          />
        </label>
      </Tarjeta>

      <Tarjeta className="overflow-hidden">
        {cargando ? (
          <div className="divide-y divide-[var(--color-border)]">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse bg-[var(--color-surface-2)]/40" />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <EstadoVacio
            icono="movimientos"
            titulo="Sin movimientos de stock"
            detalle="Cuando compres material, fabrique piezas o despaches una venta, va a aparecer acá."
          />
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {filtrados.map((m) => {
              const origen = textoOrigenMovimiento(m.referenciaTipo, m.referenciaId);
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium">{m.itemNombre ?? `#${m.itemId}`}</span>
                      <Chip color={COLOR_MOTIVO[m.motivo] ?? "neutro"}>
                        {NOMBRE_MOTIVO_STOCK[m.motivo] ?? m.motivo}
                      </Chip>
                      <span className="text-[11px] text-[var(--color-muted)]">
                        {m.itemTipo === "base" ? "pieza" : "material"}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-muted)]">
                      {formatearFecha(m.creado.slice(0, 10))} {m.creado.slice(11, 16)}
                      {origen && ` · ${origen}`}
                      {m.usuarioNombre && ` · ${m.usuarioNombre}`}
                      {m.nota && ` · ${m.nota}`}
                    </p>
                    {m.motivo === "anulacion" && (
                      <p className="text-[11px] text-[var(--color-warn)]">
                        Vuelve atrás un movimiento anterior de esa misma operación.
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-bold tabular ${
                        m.delta >= 0 ? "text-[var(--color-income)]" : "text-[var(--color-expense)]"
                      }`}
                    >
                      {m.delta >= 0 ? "+" : ""}
                      {formatearCantidad(m.delta)} <span className="text-[11px] font-normal">{m.unidad}</span>
                    </p>
                    <p className="text-[11px] text-[var(--color-muted)]">
                      queda {formatearCantidad(m.stockResultante)} {m.unidad}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
