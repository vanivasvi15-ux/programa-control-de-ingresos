"use client";
// app/stock/produccion/page.tsx — órdenes de producción.

import { useCallback, useEffect, useState } from "react";
import Encabezado from "@/components/Encabezado";
import Icono from "@/components/Icono";
import { Tarjeta, Boton, Chip, Segmentado, EstadoVacio } from "@/components/ui";
import ConfirmDialog from "@/components/ConfirmDialog";
import OrdenModal from "@/components/stock/OrdenModal";
import { formatearPesos, formatearFecha } from "@/lib/formato";
import { formatearCantidad, type OrdenProduccion, type PiezaBase } from "@/lib/tipos-stock";

const CHIP: Record<string, "ambar" | "verde" | "rojo"> = {
  planificada: "ambar",
  realizada: "verde",
  anulada: "rojo",
};

export default function ProduccionPage() {
  const [ordenes, setOrdenes] = useState<OrdenProduccion[]>([]);
  const [piezas, setPiezas] = useState<PiezaBase[]>([]);
  const [cargando, setCargando] = useState(true);
  const [estado, setEstado] = useState<"todas" | "planificada" | "realizada" | "anulada">("todas");

  const [modal, setModal] = useState(false);
  const [realizar, setRealizar] = useState<OrdenProduccion | null>(null);
  const [anular, setAnular] = useState<OrdenProduccion | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const qs = estado !== "todas" ? `?estado=${estado}` : "";
    const [ro, rp] = await Promise.all([
      fetch(`/api/ordenes-produccion${qs}`),
      fetch("/api/productos-base"),
    ]);
    if (ro.ok) setOrdenes(await ro.json());
    if (rp.ok) setPiezas(await rp.json());
    setCargando(false);
  }, [estado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function mostrarAviso(tipo: "ok" | "error", texto: string) {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 4500);
  }

  async function confirmarRealizar() {
    if (!realizar) return;
    const res = await fetch(`/api/ordenes-produccion/${realizar.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "realizada" }),
    });
    setRealizar(null);
    if (res.status === 422) {
      const d = await res.json().catch(() => ({}));
      const lista = (d.faltan ?? [])
        .map((f: { nombre: string; faltan: number; unidad: string }) => `${f.nombre} (${formatearCantidad(f.faltan)} ${f.unidad})`)
        .join(", ");
      mostrarAviso("error", `Falta material: ${lista}`);
    } else if (!res.ok) {
      mostrarAviso("error", (await res.json().catch(() => ({}))).error ?? "No se pudo fabricar");
    } else {
      mostrarAviso("ok", "Orden fabricada. Stock actualizado.");
    }
    cargar();
  }

  async function confirmarAnular() {
    if (!anular) return;
    await fetch(`/api/ordenes-produccion/${anular.id}`, { method: "DELETE" });
    setAnular(null);
    cargar();
  }

  return (
    <div>
      <Encabezado
        titulo="Producción"
        subtitulo="Órdenes para fabricar piezas. Al fabricar, descuenta insumos y suma stock."
        acciones={
          <Boton variante="primario" icono="mas" onClick={() => setModal(true)} disabled={piezas.length === 0}>
            Nueva orden
          </Boton>
        }
      />

      {aviso && (
        <div
          className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
            aviso.tipo === "ok"
              ? "border-[var(--color-income)]/40 bg-[var(--color-income-soft)] text-[var(--color-income)]"
              : "border-[var(--color-expense)]/40 bg-[var(--color-expense-soft)] text-[var(--color-expense)]"
          }`}
        >
          {aviso.texto}
        </div>
      )}

      <div className="mb-4">
        <Segmentado
          opciones={[
            { valor: "todas", label: "Todas" },
            { valor: "planificada", label: "Planificadas" },
            { valor: "realizada", label: "Realizadas" },
            { valor: "anulada", label: "Anuladas" },
          ]}
          valor={estado}
          onChange={(v) => setEstado(v as typeof estado)}
        />
      </div>

      <Tarjeta className="overflow-hidden">
        {cargando ? (
          <div className="divide-y divide-[var(--color-border)]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse bg-[var(--color-surface-2)]/40" />
            ))}
          </div>
        ) : ordenes.length === 0 ? (
          <EstadoVacio
            icono="fabrica"
            titulo="Sin órdenes"
            detalle={
              piezas.length === 0
                ? "Necesitás al menos una pieza con receta para fabricar."
                : "Creá una orden para empezar a fabricar."
            }
          />
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {ordenes.map((o) => (
              <div key={o.id} className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold">
                      {formatearCantidad(o.cantidad)} × {o.piezaNombre}
                    </span>
                    <Chip color={CHIP[o.estado]}>{o.estado}</Chip>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                    {formatearFecha(o.fecha)}
                    {o.usuarioNombre && ` · ${o.usuarioNombre}`}
                    {o.costoTotal != null && ` · costo ${formatearPesos(o.costoTotal)}`}
                    {o.nota && ` · ${o.nota}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {o.estado === "planificada" && (
                    <>
                      <Boton tamano="sm" variante="primario" icono="play" onClick={() => setRealizar(o)}>
                        Fabricar
                      </Boton>
                      <button
                        onClick={() => setAnular(o)}
                        className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-expense-soft)] hover:text-[var(--color-expense)]"
                        title="Descartar"
                      >
                        <Icono nombre="basura" size={15} />
                      </button>
                    </>
                  )}
                  {o.estado === "realizada" && (
                    <Boton tamano="sm" variante="contorno" onClick={() => setAnular(o)}>
                      Anular
                    </Boton>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Tarjeta>

      {modal && (
        <OrdenModal
          piezas={piezas}
          onCerrar={() => setModal(false)}
          onGuardado={() => {
            setModal(false);
            cargar();
            mostrarAviso("ok", "Orden creada.");
          }}
        />
      )}
      {realizar && (
        <ConfirmDialog
          titulo="Fabricar orden"
          textoConfirmar="Fabricar"
          mensaje={
            <>
              Se van a descontar los insumos de la receta de{" "}
              <strong>
                {formatearCantidad(realizar.cantidad)} × {realizar.piezaNombre}
              </strong>{" "}
              y sumar esas piezas al stock. Si falta materia prima o herrajes, no se hace nada.
            </>
          }
          onConfirmar={confirmarRealizar}
          onCerrar={() => setRealizar(null)}
        />
      )}
      {anular && (
        <ConfirmDialog
          titulo={anular.estado === "realizada" ? "Anular orden realizada" : "Descartar orden"}
          peligro
          textoConfirmar={anular.estado === "realizada" ? "Anular y revertir" : "Descartar"}
          mensaje={
            anular.estado === "realizada" ? (
              <>Se van a <strong>revertir</strong> los movimientos de stock que generó esta orden.</>
            ) : (
              <>Se descarta la orden planificada. No afecta el stock.</>
            )
          }
          onConfirmar={confirmarAnular}
          onCerrar={() => setAnular(null)}
        />
      )}
    </div>
  );
}
