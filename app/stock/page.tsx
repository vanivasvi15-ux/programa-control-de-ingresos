"use client";
// app/stock/page.tsx — resumen del taller.

import { useEffect, useState } from "react";
import Link from "next/link";
import Encabezado from "@/components/Encabezado";
import Icono from "@/components/Icono";
import { Tarjeta, Chip, EstadoVacio } from "@/components/ui";
import { formatearPesos, formatearFecha } from "@/lib/formato";
import { formatearCantidad } from "@/lib/tipos-stock";

type Resumen = {
  contadores: { insumos: number; bajoMinimo: number; piezas: number; productos: number };
  valorStock: number;
  valorInsumos: number;
  valorPiezas: number;
  bajoMinimo: { id: number; nombre: string; stock: number; alertaMinimo: number; unidad: string }[];
  recuentosPendientes: { id: number; nombre: string; ultimaRevision: string | null }[];
  ultimasOrdenes: { id: number; cantidad: number; estado: string; fecha: string; costoTotal: number | null; pieza: string }[];
  ultimasCompras: { id: number; cantidad: number; costoTotal: number; fecha: string; insumo: string }[];
  productos: { id: number; nombre: string; precio: number; costoCalculado: number | null; margen: number | null }[];
  avisos: { piezasSinReceta: string[]; productosSinComposicion: string[] };
};

function KpiChico({ label, valor, tono }: { label: string; valor: string | number; tono?: "warn" }) {
  return (
    <Tarjeta className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold tabular ${
          tono === "warn" ? "text-[var(--color-warn)]" : "text-[var(--color-text)]"
        }`}
      >
        {valor}
      </p>
    </Tarjeta>
  );
}

export default function StockResumenPage() {
  const [data, setData] = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch("/api/stock/resumen")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setData(d);
        setCargando(false);
      });
  }, []);

  if (cargando) {
    return (
      <div>
        <Encabezado titulo="Taller" subtitulo="Stock, producción y costos" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--color-surface-2)]/40" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <Encabezado titulo="Taller" />
        <Tarjeta>
          <EstadoVacio titulo="No se pudo cargar" detalle="Probá recargar la página." />
        </Tarjeta>
      </div>
    );
  }

  const hayAvisos =
    data.avisos.piezasSinReceta.length > 0 || data.avisos.productosSinComposicion.length > 0;

  return (
    <div className="space-y-5">
      <Encabezado titulo="Taller" subtitulo="Stock, producción y costos" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiChico label="Valor del stock" valor={formatearPesos(data.valorStock)} />
        <KpiChico label="Insumos" valor={data.contadores.insumos} />
        <KpiChico
          label="Bajo mínimo"
          valor={data.contadores.bajoMinimo}
          tono={data.contadores.bajoMinimo > 0 ? "warn" : undefined}
        />
        <KpiChico label="Productos" valor={data.contadores.productos} />
      </div>

      {hayAvisos && (
        <Tarjeta className="border-[var(--color-warn)]/40 bg-[var(--color-warn-soft)]/40 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-warn)]">
            <Icono nombre="alerta" size={15} /> Datos incompletos
          </p>
          <ul className="mt-1.5 space-y-0.5 text-xs text-[var(--color-muted)]">
            {data.avisos.piezasSinReceta.map((n) => (
              <li key={n}>
                La pieza <strong>{n}</strong> no tiene receta cargada.
              </li>
            ))}
            {data.avisos.productosSinComposicion.map((n) => (
              <li key={n}>
                El producto <strong>{n}</strong> no tiene composición cargada.
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Bajo mínimo */}
        <Tarjeta className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold">Stock bajo mínimo</p>
            <Link href="/stock/insumos" className="text-xs text-[var(--color-accent)] hover:underline">
              Ver insumos
            </Link>
          </div>
          {data.bajoMinimo.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--color-muted)]">Todo por encima del mínimo 👍</p>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {data.bajoMinimo.map((i) => (
                <div key={i.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{i.nombre}</span>
                  <span className="tabular text-[var(--color-expense)]">
                    {formatearCantidad(i.stock)} / {formatearCantidad(i.alertaMinimo)} {i.unidad}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Tarjeta>

        {/* Recuentos pendientes */}
        <Tarjeta className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold">Recuentos a revisar</p>
            <Link href="/stock/recuentos" className="text-xs text-[var(--color-accent)] hover:underline">
              Ver recuentos
            </Link>
          </div>
          {data.recuentosPendientes.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--color-muted)]">Nada pendiente.</p>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {data.recuentosPendientes.map((l) => (
                <div key={l.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{l.nombre}</span>
                  <Chip color="ambar">
                    {l.ultimaRevision ? `desde ${formatearFecha(l.ultimaRevision)}` : "nunca"}
                  </Chip>
                </div>
              ))}
            </div>
          )}
        </Tarjeta>
      </div>

      {/* Costos y márgenes por producto */}
      <Tarjeta className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <p className="text-sm font-bold">Costos y márgenes</p>
          <Link href="/stock/productos" className="text-xs text-[var(--color-accent)] hover:underline">
            Ver productos
          </Link>
        </div>
        {data.productos.length === 0 ? (
          <EstadoVacio titulo="Sin productos" detalle="Cargá insumos, piezas y armá tu primer kit." />
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            <div className="hidden bg-[var(--color-surface-2)]/40 px-4 py-2 text-[11px] font-semibold uppercase text-[var(--color-muted)] sm:grid sm:grid-cols-[1fr_110px_110px_110px] sm:gap-3">
              <span>Producto</span>
              <span className="text-right">Precio</span>
              <span className="text-right">Costo</span>
              <span className="text-right">Margen</span>
            </div>
            {data.productos.map((p) => (
              <div key={p.id} className="grid grid-cols-2 gap-2 px-4 py-2.5 text-sm sm:grid-cols-[1fr_110px_110px_110px]">
                <span className="col-span-2 font-medium sm:col-span-1">{p.nombre}</span>
                <span className="text-right tabular text-[var(--color-muted)]">{formatearPesos(p.precio)}</span>
                <span className="text-right tabular">{p.costoCalculado != null ? formatearPesos(p.costoCalculado) : "—"}</span>
                <span
                  className={`text-right font-semibold tabular ${
                    (p.margen ?? 0) >= 0 ? "text-[var(--color-income)]" : "text-[var(--color-expense)]"
                  }`}
                >
                  {p.margen != null ? formatearPesos(p.margen) : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Tarjeta>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold">Últimas órdenes</p>
            <Link href="/stock/produccion" className="text-xs text-[var(--color-accent)] hover:underline">
              Ver producción
            </Link>
          </div>
          {data.ultimasOrdenes.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--color-muted)]">Sin órdenes todavía.</p>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {data.ultimasOrdenes.map((o) => (
                <div key={o.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    {formatearCantidad(o.cantidad)} × {o.pieza}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                    {formatearFecha(o.fecha)}
                    <Chip color={o.estado === "realizada" ? "verde" : o.estado === "anulada" ? "rojo" : "ambar"}>
                      {o.estado}
                    </Chip>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Tarjeta>

        <Tarjeta className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold">Últimas compras</p>
            <Link href="/stock/compras" className="text-xs text-[var(--color-accent)] hover:underline">
              Ver compras
            </Link>
          </div>
          {data.ultimasCompras.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--color-muted)]">Sin compras todavía.</p>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {data.ultimasCompras.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{c.insumo}</span>
                  <span className="text-xs text-[var(--color-muted)]">
                    {formatearFecha(c.fecha)} · {formatearPesos(c.costoTotal)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Tarjeta>
      </div>
    </div>
  );
}
