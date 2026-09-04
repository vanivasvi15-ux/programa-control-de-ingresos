"use client";
// app/stock/piezas/page.tsx — piezas fabricadas (productos_base) + su receta.

import { useCallback, useEffect, useMemo, useState } from "react";
import Encabezado from "@/components/Encabezado";
import Icono from "@/components/Icono";
import { Tarjeta, Boton, EstadoVacio, inputClase } from "@/components/ui";
import ConfirmDialog from "@/components/ConfirmDialog";
import PiezaModal from "@/components/stock/PiezaModal";
import { formatearPesos } from "@/lib/formato";
import { formatearCantidad, type Insumo, type PiezaBase } from "@/lib/tipos-stock";

export default function PiezasPage() {
  const [piezas, setPiezas] = useState<PiezaBase[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState("");
  const [verInactivas, setVerInactivas] = useState(false);

  const [modal, setModal] = useState<null | { pieza?: PiezaBase }>(null);
  const [borrar, setBorrar] = useState<PiezaBase | null>(null);
  const [vender, setVender] = useState<PiezaBase | null>(null);
  const [precioVenta, setPrecioVenta] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const [rp, ri] = await Promise.all([fetch("/api/productos-base"), fetch("/api/insumos")]);
    if (rp.ok) setPiezas(await rp.json());
    if (ri.ok) setInsumos(await ri.json());
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtradas = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return piezas.filter((p) => {
      if (!verInactivas && !p.activo) return false;
      if (t && !p.nombre.toLowerCase().includes(t)) return false;
      return true;
    });
  }, [piezas, texto, verInactivas]);

  async function confirmarBorrado() {
    if (!borrar) return;
    const res = await fetch(`/api/productos-base/${borrar.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBorrar(null);
    cargar();
    if (data?.desactivado) {
      setAviso(data.mensaje ?? "Se desactivó.");
      setTimeout(() => setAviso(null), 4000);
    }
  }

  async function confirmarVenta() {
    if (!vender) return;
    const res = await fetch("/api/productos/desde-pieza", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productoBaseId: vender.id, precio: Number(precioVenta) || 0 }),
    });
    setVender(null);
    setPrecioVenta("");
    if (res.ok) {
      setAviso("Producto de venta suelta creado. Ajustá el precio en Productos.");
      setTimeout(() => setAviso(null), 4000);
    } else {
      setAviso((await res.json().catch(() => ({}))).error ?? "No se pudo crear");
      setTimeout(() => setAviso(null), 4000);
    }
  }

  return (
    <div>
      <Encabezado
        titulo="Piezas fabricadas"
        subtitulo="Lo que arma el taller: carros, rieles, topes…"
        acciones={
          <Boton variante="primario" icono="mas" onClick={() => setModal({})} disabled={insumos.length === 0}>
            Nueva pieza
          </Boton>
        }
      />

      {aviso && (
        <div className="mb-4 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] px-3 py-2 text-sm text-[var(--color-accent)]">
          {aviso}
        </div>
      )}

      <Tarjeta className="mb-4 flex flex-wrap items-center gap-2.5 p-3">
        <label className="relative flex-1 min-w-[160px]">
          <Icono
            nombre="buscar"
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
          />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar pieza…"
            className={`${inputClase} pl-8`}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
          <input type="checkbox" checked={verInactivas} onChange={(e) => setVerInactivas(e.target.checked)} />
          Ver inactivas
        </label>
      </Tarjeta>

      <Tarjeta className="overflow-hidden">
        {cargando ? (
          <div className="divide-y divide-[var(--color-border)]">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse bg-[var(--color-surface-2)]/40" />
            ))}
          </div>
        ) : filtradas.length === 0 ? (
          <EstadoVacio
            icono="pieza"
            titulo="Sin piezas"
            detalle={
              insumos.length === 0
                ? "Primero cargá insumos, después armás las piezas con su receta."
                : "Creá la primera pieza y su receta."
            }
            accion={
              insumos.length > 0 && (
                <Boton variante="primario" icono="mas" onClick={() => setModal({})}>
                  Nueva pieza
                </Boton>
              )
            }
          />
        ) : (
          <>
            <div className="hidden border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/40 px-4 py-2 text-[11px] font-semibold uppercase text-[var(--color-muted)] sm:grid sm:grid-cols-[1fr_90px_130px_110px] sm:gap-3">
              <span>Pieza</span>
              <span className="text-right">Stock</span>
              <span className="text-right">Costo</span>
              <span />
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {filtradas.map((p) => (
                <div
                  key={p.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_90px_130px_110px]"
                >
                  <div className="min-w-0">
                    <span className={`text-sm font-medium ${!p.activo ? "text-[var(--color-muted)] line-through" : ""}`}>
                      {p.nombre}
                    </span>
                    {p.manoObraMinutos > 0 && (
                      <p className="mt-0.5 text-xs text-[var(--color-muted)]">{p.manoObraMinutos} min de mano de obra</p>
                    )}
                  </div>
                  <div className="order-2 text-right text-sm font-semibold tabular sm:order-none">
                    {formatearCantidad(p.stock)}
                  </div>
                  <div className="hidden text-right text-sm tabular sm:block">
                    {p.costoCalculado != null ? formatearPesos(p.costoCalculado) : "—"}
                  </div>
                  <div className="order-1 flex justify-end gap-1 sm:order-none">
                    <button
                      onClick={() => setVender(p)}
                      className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                      title="Vender suelta (crea un producto)"
                    >
                      <Icono nombre="etiqueta" size={15} />
                    </button>
                    <button
                      onClick={() => setModal({ pieza: p })}
                      className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                      title="Editar pieza y receta"
                    >
                      <Icono nombre="lapiz" size={15} />
                    </button>
                    <button
                      onClick={() => setBorrar(p)}
                      className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-expense-soft)] hover:text-[var(--color-expense)]"
                      title="Borrar"
                    >
                      <Icono nombre="basura" size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Tarjeta>

      {modal && (
        <PiezaModal
          pieza={modal.pieza}
          insumos={insumos}
          onCerrar={() => setModal(null)}
          onGuardado={() => {
            setModal(null);
            cargar();
          }}
        />
      )}
      {borrar && (
        <ConfirmDialog
          titulo="Borrar pieza"
          peligro
          textoConfirmar="Borrar"
          mensaje={
            <>
              Se va a borrar <strong>{borrar.nombre}</strong> y su receta. Si está en algún kit u
              orden de producción, en vez de borrarse se <strong>desactiva</strong>.
            </>
          }
          onConfirmar={confirmarBorrado}
          onCerrar={() => setBorrar(null)}
        />
      )}
      {vender && (
        <ConfirmDialog
          titulo={`Vender "${vender.nombre}" suelta`}
          textoConfirmar="Crear producto"
          mensaje={
            <div className="space-y-3">
              <p>
                Se crea un producto <strong>{vender.nombre} (repuesto)</strong> que por dentro es 1{" "}
                {vender.nombre}. Después lo publicás y lo vendés como cualquier kit.
              </p>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">Precio de venta ($)</span>
                <input
                  type="number"
                  min="0"
                  value={precioVenta}
                  onChange={(e) => setPrecioVenta(e.target.value)}
                  className={inputClase}
                  autoFocus
                />
              </label>
            </div>
          }
          onConfirmar={confirmarVenta}
          onCerrar={() => {
            setVender(null);
            setPrecioVenta("");
          }}
        />
      )}
    </div>
  );
}
