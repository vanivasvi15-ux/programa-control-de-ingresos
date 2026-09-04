"use client";
// app/stock/productos/page.tsx — productos que se venden (kits y repuestos).

import { useCallback, useEffect, useMemo, useState } from "react";
import Encabezado from "@/components/Encabezado";
import Icono from "@/components/Icono";
import { Tarjeta, Boton, Chip, EstadoVacio, inputClase } from "@/components/ui";
import ConfirmDialog from "@/components/ConfirmDialog";
import ProductoModal from "@/components/stock/ProductoModal";
import PublicacionesModal from "@/components/stock/PublicacionesModal";
import { formatearPesos } from "@/lib/formato";
import type { Insumo, PiezaBase, Producto } from "@/lib/tipos-stock";

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [piezas, setPiezas] = useState<PiezaBase[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState("");
  const [verInactivos, setVerInactivos] = useState(false);

  const [modal, setModal] = useState<null | { producto?: Producto }>(null);
  const [pubs, setPubs] = useState<Producto | null>(null);
  const [borrar, setBorrar] = useState<Producto | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const [rp, rb, ri] = await Promise.all([
      fetch("/api/productos"),
      fetch("/api/productos-base"),
      fetch("/api/insumos"),
    ]);
    if (rp.ok) setProductos(await rp.json());
    if (rb.ok) setPiezas(await rb.json());
    if (ri.ok) setInsumos(await ri.json());
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtrados = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return productos.filter((p) => {
      if (!verInactivos && !p.activo) return false;
      if (t && !p.nombre.toLowerCase().includes(t)) return false;
      return true;
    });
  }, [productos, texto, verInactivos]);

  async function confirmarBorrado() {
    if (!borrar) return;
    const res = await fetch(`/api/productos/${borrar.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBorrar(null);
    cargar();
    if (data?.desactivado) {
      setAviso(data.mensaje ?? "Se desactivó.");
      setTimeout(() => setAviso(null), 4000);
    }
  }

  return (
    <div>
      <Encabezado
        titulo="Productos"
        subtitulo="Kits y repuestos que se venden. Un producto = una receta; muchas publicaciones."
        acciones={
          <Boton variante="primario" icono="mas" onClick={() => setModal({})} disabled={piezas.length === 0}>
            Nuevo producto
          </Boton>
        }
      />

      {aviso && (
        <div className="mb-4 rounded-lg border border-[var(--color-warn)]/40 bg-[var(--color-warn-soft)] px-3 py-2 text-sm text-[var(--color-warn)]">
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
            placeholder="Buscar producto…"
            className={`${inputClase} pl-8`}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
          <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} />
          Ver inactivos
        </label>
      </Tarjeta>

      <Tarjeta className="overflow-hidden">
        {cargando ? (
          <div className="divide-y divide-[var(--color-border)]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse bg-[var(--color-surface-2)]/40" />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <EstadoVacio
            icono="etiqueta"
            titulo="Sin productos"
            detalle={
              piezas.length === 0
                ? "Primero armá las piezas fabricadas, después el kit que las combina."
                : "Creá el primer kit y su composición."
            }
            accion={
              piezas.length > 0 && (
                <Boton variante="primario" icono="mas" onClick={() => setModal({})}>
                  Nuevo producto
                </Boton>
              )
            }
          />
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {filtrados.map((p) => (
              <div key={p.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-sm font-semibold ${!p.activo ? "text-[var(--color-muted)] line-through" : ""}`}>
                      {p.nombre}
                    </span>
                    {p.sku && <Chip>{p.sku}</Chip>}
                    <button
                      onClick={() => setPubs(p)}
                      className="inline-flex items-center gap-1 rounded-md bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)]"
                    >
                      <Icono nombre="enlace" size={11} />
                      {p.publicaciones ?? 0} {(p.publicaciones ?? 0) === 1 ? "aviso" : "avisos"}
                    </button>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                    Precio {formatearPesos(p.precio)}
                    {" · "}
                    Costo {p.costoCalculado != null ? formatearPesos(p.costoCalculado) : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {p.margen != null && (
                    <div className="text-right">
                      <p className="text-[11px] uppercase text-[var(--color-muted)]">Margen</p>
                      <p
                        className={`text-sm font-bold tabular ${
                          p.margen >= 0 ? "text-[var(--color-income)]" : "text-[var(--color-expense)]"
                        }`}
                      >
                        {formatearPesos(p.margen)}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => setModal({ producto: p })}
                    className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                    title="Editar producto y composición"
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
        )}
      </Tarjeta>

      {modal && (
        <ProductoModal
          producto={modal.producto}
          piezas={piezas}
          insumos={insumos}
          onCerrar={() => setModal(null)}
          onGuardado={() => {
            setModal(null);
            cargar();
          }}
        />
      )}
      {pubs && (
        <PublicacionesModal producto={pubs} onCerrar={() => setPubs(null)} onCambio={cargar} />
      )}
      {borrar && (
        <ConfirmDialog
          titulo="Borrar producto"
          peligro
          textoConfirmar="Borrar"
          mensaje={
            <>
              Se va a borrar <strong>{borrar.nombre}</strong>. Si tiene publicaciones vinculadas, en
              vez de borrarse se <strong>desactiva</strong>.
            </>
          }
          onConfirmar={confirmarBorrado}
          onCerrar={() => setBorrar(null)}
        />
      )}
    </div>
  );
}
