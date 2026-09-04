"use client";
// app/stock/movimientos/page.tsx — historial de stock (sólo lectura).

import { useCallback, useEffect, useMemo, useState } from "react";
import Encabezado from "@/components/Encabezado";
import Icono from "@/components/Icono";
import { Tarjeta, Chip, Segmentado, EstadoVacio, inputClase } from "@/components/ui";
import { formatearFecha } from "@/lib/formato";
import {
  NOMBRE_MOTIVO_STOCK,
  formatearCantidad,
  type MovimientoStock,
} from "@/lib/tipos-stock";

const COLOR_MOTIVO: Record<string, "verde" | "rojo" | "ambar" | "indigo" | "neutro"> = {
  compra: "verde",
  produccion_alta: "verde",
  produccion_consumo: "rojo",
  venta: "rojo",
  ajuste: "ambar",
  recuento: "indigo",
  anulacion: "neutro",
};

export default function HistorialStockPage() {
  const [movs, setMovs] = useState<MovimientoStock[]>([]);
  const [cargando, setCargando] = useState(true);
  const [itemTipo, setItemTipo] = useState<"todos" | "insumo" | "base">("todos");
  const [texto, setTexto] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    const qs = new URLSearchParams({ limite: "300" });
    if (itemTipo !== "todos") qs.set("item_tipo", itemTipo);
    const r = await fetch(`/api/movimientos-stock?${qs}`);
    if (r.ok) setMovs(await r.json());
    setCargando(false);
  }, [itemTipo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtrados = useMemo(() => {
    const t = texto.trim().toLowerCase();
    if (!t) return movs;
    return movs.filter(
      (m) =>
        m.itemNombre?.toLowerCase().includes(t) ||
        NOMBRE_MOTIVO_STOCK[m.motivo]?.toLowerCase().includes(t)
    );
  }, [movs, texto]);

  return (
    <div>
      <Encabezado titulo="Historial de stock" subtitulo="Cada cambio de stock, con su motivo y quién lo hizo" />

      <Tarjeta className="mb-4 flex flex-wrap items-center gap-2.5 p-3">
        <Segmentado
          opciones={[
            { valor: "todos", label: "Todo" },
            { valor: "insumo", label: "Insumos" },
            { valor: "base", label: "Piezas" },
          ]}
          valor={itemTipo}
          onChange={(v) => setItemTipo(v as typeof itemTipo)}
        />
        <label className="relative flex-1 min-w-[160px]">
          <Icono
            nombre="buscar"
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
          />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por insumo o motivo…"
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
          <EstadoVacio icono="movimientos" titulo="Sin movimientos de stock" detalle="Todavía no se registró ningún cambio." />
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {filtrados.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium">{m.itemNombre ?? `#${m.itemId}`}</span>
                    <Chip color={COLOR_MOTIVO[m.motivo] ?? "neutro"}>{NOMBRE_MOTIVO_STOCK[m.motivo] ?? m.motivo}</Chip>
                  </div>
                  <p className="text-xs text-[var(--color-muted)]">
                    {formatearFecha(m.creado.slice(0, 10))}
                    {m.usuarioNombre && ` · ${m.usuarioNombre}`}
                    {m.nota && ` · ${m.nota}`}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-bold tabular ${
                      m.delta >= 0 ? "text-[var(--color-income)]" : "text-[var(--color-expense)]"
                    }`}
                  >
                    {m.delta >= 0 ? "+" : ""}
                    {formatearCantidad(m.delta)}
                  </p>
                  <p className="text-[11px] text-[var(--color-muted)]">queda {formatearCantidad(m.stockResultante)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
