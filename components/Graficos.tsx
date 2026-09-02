"use client";
// components/Graficos.tsx
//
// Gráficos del dashboard con recharts: barras de ingresos vs. gastos por
// mes, y torta de gastos/ingresos por categoría.
//
// Nota: las animaciones de entrada de recharts se desactivan
// (isAnimationActive={false}) porque con React 19 + render concurrente a
// veces quedan trabadas en el frame 0 y las barras/porciones no se ven.

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatearPesos } from "@/lib/formato";

const COLOR_INGRESO = "#059669";
const COLOR_GASTO = "#e11d48";

// Paleta para la torta por categoría.
const PALETA = [
  "#4f46e5",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
  "#ef4444",
  "#6366f1",
  "#84cc16",
];

function abreviar(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`;
  if (v >= 1000) return `${Math.round(v / 1000)}k`;
  return String(v);
}

function CajaTooltip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs shadow-lg">
      {children}
    </div>
  );
}

export function GraficoBarras({
  datos,
}: {
  datos: { etiqueta: string; ingresos: number; gastos: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={datos} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barGap={2}>
        <XAxis
          dataKey="etiqueta"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "var(--color-muted)" }}
        />
        <YAxis
          width={52}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: "var(--color-muted)" }}
          tickFormatter={(v) => abreviar(Number(v))}
        />
        <Tooltip
          cursor={{ fill: "var(--color-surface-2)" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <CajaTooltip>
                <p className="mb-1 font-semibold">{label}</p>
                {payload.map((p) => (
                  <p key={String(p.dataKey)} className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: p.color }}
                    />
                    {p.dataKey === "ingresos" ? "Ingresos" : "Gastos"}:{" "}
                    <span className="font-semibold tabular">
                      {formatearPesos(Number(p.value))}
                    </span>
                  </p>
                ))}
              </CajaTooltip>
            );
          }}
        />
        <Bar
          dataKey="ingresos"
          fill={COLOR_INGRESO}
          radius={[4, 4, 0, 0]}
          maxBarSize={26}
          isAnimationActive={false}
        />
        <Bar
          dataKey="gastos"
          fill={COLOR_GASTO}
          radius={[4, 4, 0, 0]}
          maxBarSize={26}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GraficoDona({ datos }: { datos: { nombre: string; total: number }[] }) {
  const total = datos.reduce((s, d) => s + d.total, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-[160px] w-[160px] flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={datos}
              dataKey="total"
              nameKey="nombre"
              innerRadius={52}
              outerRadius={78}
              paddingAngle={datos.length > 1 ? 2 : 0}
              stroke="none"
              isAnimationActive={false}
            >
              {datos.map((_, i) => (
                <Cell key={i} fill={PALETA[i % PALETA.length]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0];
                const val = Number(p.value);
                return (
                  <CajaTooltip>
                    <p className="font-semibold">{p.name}</p>
                    <p className="tabular">
                      {formatearPesos(val)} · {total ? Math.round((val / total) * 100) : 0}%
                    </p>
                  </CajaTooltip>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
            Total
          </span>
          <span className="text-sm font-bold tabular">{formatearPesos(total)}</span>
        </div>
      </div>
      <ul className="w-full space-y-1.5">
        {datos.slice(0, 6).map((d, i) => (
          <li key={d.nombre} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-sm"
              style={{ background: PALETA[i % PALETA.length] }}
            />
            <span className="flex-1 truncate">{d.nombre}</span>
            <span className="tabular font-semibold">
              {total ? Math.round((d.total / total) * 100) : 0}%
            </span>
            <span className="tabular w-24 text-right text-[var(--color-muted)]">
              {formatearPesos(d.total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
