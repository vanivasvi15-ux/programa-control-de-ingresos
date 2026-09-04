"use client";
// app/stock/compras/page.tsx — compras de insumo (suben stock).

import { useCallback, useEffect, useState } from "react";
import Encabezado from "@/components/Encabezado";
import Icono from "@/components/Icono";
import { Tarjeta, Boton, EstadoVacio } from "@/components/ui";
import ConfirmDialog from "@/components/ConfirmDialog";
import CompraModal from "@/components/stock/CompraModal";
import { formatearPesos, formatearFecha } from "@/lib/formato";
import { formatearCantidad, type CompraInsumo, type Insumo } from "@/lib/tipos-stock";

export default function ComprasPage() {
  const [compras, setCompras] = useState<CompraInsumo[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(false);
  const [revertir, setRevertir] = useState<CompraInsumo | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const [rc, ri] = await Promise.all([fetch("/api/compras-insumo"), fetch("/api/insumos")]);
    if (rc.ok) setCompras(await rc.json());
    if (ri.ok) setInsumos(await ri.json());
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function confirmarRevertir() {
    if (!revertir) return;
    const res = await fetch(`/api/compras-insumo/${revertir.id}`, { method: "DELETE" });
    setRevertir(null);
    if (!res.ok) {
      setAviso((await res.json().catch(() => ({}))).error ?? "No se pudo revertir");
      setTimeout(() => setAviso(null), 4000);
    }
    cargar();
  }

  return (
    <div>
      <Encabezado
        titulo="Compras de material"
        subtitulo="Cada compra sube el stock del insumo"
        acciones={
          <Boton variante="primario" icono="mas" onClick={() => setModal(true)} disabled={insumos.length === 0}>
            Nueva compra
          </Boton>
        }
      />

      {aviso && (
        <div className="mb-4 rounded-lg border border-[var(--color-expense)]/40 bg-[var(--color-expense-soft)] px-3 py-2 text-sm text-[var(--color-expense)]">
          {aviso}
        </div>
      )}

      <Tarjeta className="overflow-hidden">
        {cargando ? (
          <div className="divide-y divide-[var(--color-border)]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse bg-[var(--color-surface-2)]/40" />
            ))}
          </div>
        ) : compras.length === 0 ? (
          <EstadoVacio
            icono="carrito"
            titulo="Sin compras"
            detalle={
              insumos.length === 0
                ? "Cargá insumos primero."
                : "Registrá la primera compra para cargar stock."
            }
          />
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {compras.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{c.insumoNombre}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                    {formatearFecha(c.fecha)} · {formatearCantidad(c.cantidadCompra)} ×{" "}
                    {formatearPesos(c.costoUnitario)}
                    {c.proveedor && ` · ${c.proveedor}`}
                    {c.usuarioNombre && ` · ${c.usuarioNombre}`}
                  </p>
                </div>
                <div className="text-right text-sm font-semibold tabular">{formatearPesos(c.costoTotal)}</div>
                <button
                  onClick={() => setRevertir(c)}
                  className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-expense-soft)] hover:text-[var(--color-expense)]"
                  title="Revertir (baja el stock que sumó)"
                >
                  <Icono nombre="basura" size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Tarjeta>

      {modal && (
        <CompraModal
          insumos={insumos}
          onCerrar={() => setModal(false)}
          onGuardado={() => {
            setModal(false);
            cargar();
            setAviso(null);
          }}
        />
      )}
      {revertir && (
        <ConfirmDialog
          titulo="Revertir compra"
          peligro
          textoConfirmar="Revertir"
          mensaje={
            <>
              Se va a descontar del stock lo que sumó esta compra de{" "}
              <strong>{revertir.insumoNombre}</strong> y a borrar el registro.
            </>
          }
          onConfirmar={confirmarRevertir}
          onCerrar={() => setRevertir(null)}
        />
      )}
    </div>
  );
}
