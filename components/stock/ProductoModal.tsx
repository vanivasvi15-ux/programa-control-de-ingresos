"use client";
// components/stock/ProductoModal.tsx — alta / edición de un producto con su
// composición (piezas fabricadas + herrajes sueltos).

import { useEffect, useState } from "react";
import { Modal, Boton, Campo, inputClase } from "@/components/ui";
import Icono from "@/components/Icono";
import { formatearPesos } from "@/lib/formato";
import type { ComposicionLineaVista, Insumo, PiezaBase, Producto } from "@/lib/tipos-stock";

type LineaEdit = { itemTipo: "base" | "insumo"; itemId: number | ""; cantidad: string };

export default function ProductoModal({
  producto,
  piezas,
  insumos,
  onCerrar,
  onGuardado,
}: {
  producto?: Producto;
  piezas: PiezaBase[];
  insumos: Insumo[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const editar = !!producto;
  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [sku, setSku] = useState(producto?.sku ?? "");
  const [precio, setPrecio] = useState(String(producto?.precio ?? 0));
  const [nota, setNota] = useState(producto?.nota ?? "");
  const [lineas, setLineas] = useState<LineaEdit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const herrajes = insumos.filter((i) => i.tipo !== "consumible" && i.activo);

  useEffect(() => {
    if (!producto) return;
    fetch(`/api/productos/${producto.id}/composicion`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rs: ComposicionLineaVista[]) =>
        setLineas(rs.map((l) => ({ itemTipo: l.itemTipo, itemId: l.itemId, cantidad: String(l.cantidad) })))
      );
  }, [producto]);

  function setLinea(i: number, patch: Partial<LineaEdit>) {
    setLineas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function guardar() {
    setError(null);
    setGuardando(true);
    try {
      let productoId = producto?.id;
      const resP = await fetch(editar ? `/api/productos/${productoId}` : "/api/productos", {
        method: editar ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, sku: sku.trim() || undefined, precio: Number(precio), nota }),
      });
      if (!resP.ok) {
        setError((await resP.json().catch(() => ({}))).error ?? "No se pudo guardar el producto");
        return;
      }
      if (!editar) productoId = (await resP.json()).id;

      const lineasValidas = lineas
        .filter((l) => l.itemId !== "" && Number(l.cantidad) > 0)
        .map((l) => ({ itemTipo: l.itemTipo, itemId: Number(l.itemId), cantidad: Number(l.cantidad) }));

      const resC = await fetch(`/api/productos/${productoId}/composicion`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineas: lineasValidas }),
      });
      if (!resC.ok) {
        setError((await resC.json().catch(() => ({}))).error ?? "No se pudo guardar la composición");
        return;
      }
      onGuardado();
    } finally {
      setGuardando(false);
    }
  }

  const opcionesDe = (tipo: "base" | "insumo") =>
    tipo === "base"
      ? piezas.filter((p) => p.activo).map((p) => ({ id: p.id, nombre: p.nombre }))
      : herrajes.map((i) => ({ id: i.id, nombre: i.nombre }));

  return (
    <Modal
      titulo={editar ? `Editar producto · ${producto!.nombre}` : "Nuevo producto"}
      onCerrar={onCerrar}
      ancho="max-w-2xl"
      footer={
        <>
          <Boton variante="fantasma" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton variante="primario" onClick={guardar} disabled={guardando || !nombre.trim()}>
            {guardando ? "Guardando…" : "Guardar"}
          </Boton>
        </>
      }
    >
      <div className="space-y-4">
        <Campo label="Nombre" hint="Nombre ordenado para uso interno">
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Kit Puerta Granero — riel 200 con bisagra"
            className={inputClase}
          />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Precio de venta ($)">
            <input
              type="number"
              min="0"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className={inputClase}
            />
          </Campo>
          <Campo label="Código / SKU (opcional)">
            <input value={sku} onChange={(e) => setSku(e.target.value)} className={inputClase} />
          </Campo>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-[var(--color-muted)]">Composición</span>
            <Boton
              tamano="sm"
              icono="mas"
              onClick={() => setLineas((ls) => [...ls, { itemTipo: "base", itemId: "", cantidad: "" }])}
            >
              Agregar componente
            </Boton>
          </div>

          {lineas.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-4 text-center text-xs text-[var(--color-muted)]">
              Sin componentes. Sumá piezas fabricadas y herrajes.
            </p>
          ) : (
            <div className="space-y-2">
              {lineas.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={l.itemTipo}
                    onChange={(e) =>
                      setLinea(i, { itemTipo: e.target.value as "base" | "insumo", itemId: "" })
                    }
                    className={`${inputClase} w-28`}
                  >
                    <option value="base">Pieza</option>
                    <option value="insumo">Herraje</option>
                  </select>
                  <select
                    value={l.itemId}
                    onChange={(e) => setLinea(i, { itemId: e.target.value ? Number(e.target.value) : "" })}
                    className={`${inputClase} flex-1`}
                  >
                    <option value="">Elegí…</option>
                    {opcionesDe(l.itemTipo).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nombre}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={l.cantidad}
                    onChange={(e) => setLinea(i, { cantidad: e.target.value })}
                    placeholder="cant."
                    className={`${inputClase} w-24`}
                  />
                  <button
                    onClick={() => setLineas((ls) => ls.filter((_, idx) => idx !== i))}
                    className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-expense-soft)] hover:text-[var(--color-expense)]"
                  >
                    <Icono nombre="x" size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {editar && producto!.costoCalculado != null && (
          <p className="rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-muted)]">
            Costo actual: <span className="font-semibold text-[var(--color-text)]">{formatearPesos(producto!.costoCalculado)}</span>
            {" · "}se recalcula al guardar.
          </p>
        )}

        <Campo label="Nota (opcional)">
          <input value={nota} onChange={(e) => setNota(e.target.value)} className={inputClase} />
        </Campo>

        {error && <p className="text-sm text-[var(--color-expense)]">{error}</p>}
      </div>
    </Modal>
  );
}
