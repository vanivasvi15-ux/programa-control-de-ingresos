"use client";
// components/stock/PublicacionesModal.tsx — vincular avisos (Mercado Libre /
// tienda) a un producto. Varios avisos con nombres distintos apuntan al
// mismo producto.

import { useEffect, useState } from "react";
import { Modal, Boton, inputClase } from "@/components/ui";
import Icono from "@/components/Icono";
import type { Producto, Publicacion } from "@/lib/tipos-stock";

type Nueva = { canal: "mercadolibre" | "tienda" | "otro"; titulo: string; cuenta: string; ml_item_id: string; url: string };

const VACIA: Nueva = { canal: "mercadolibre", titulo: "", cuenta: "", ml_item_id: "", url: "" };

export default function PublicacionesModal({
  producto,
  onCerrar,
  onCambio,
}: {
  producto: Producto;
  onCerrar: () => void;
  onCambio: () => void;
}) {
  const [lista, setLista] = useState<Publicacion[]>([]);
  const [nueva, setNueva] = useState<Nueva>(VACIA);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const cargar = () =>
    fetch(`/api/publicaciones?producto_id=${producto.id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setLista);

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producto.id]);

  async function agregar() {
    if (!nueva.titulo.trim() && !nueva.ml_item_id.trim()) {
      setError("Poné al menos un título o el código del aviso");
      return;
    }
    setError(null);
    setTrabajando(true);
    const res = await fetch("/api/publicaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        producto_id: producto.id,
        canal: nueva.canal,
        titulo: nueva.titulo.trim() || undefined,
        cuenta: nueva.cuenta.trim() || undefined,
        ml_item_id: nueva.ml_item_id.trim() || undefined,
        url: nueva.url.trim() || undefined,
      }),
    });
    setTrabajando(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "No se pudo agregar");
      return;
    }
    setNueva(VACIA);
    cargar();
    onCambio();
  }

  async function borrar(id: number) {
    await fetch(`/api/publicaciones/${id}`, { method: "DELETE" });
    cargar();
    onCambio();
  }

  return (
    <Modal titulo={`Publicaciones · ${producto.nombre}`} onCerrar={onCerrar} ancho="max-w-2xl">
      <div className="space-y-4">
        {lista.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-4 text-center text-xs text-[var(--color-muted)]">
            Este producto no tiene avisos vinculados todavía.
          </p>
        ) : (
          <div className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
            {lista.map((p) => (
              <div key={p.id} className="flex items-start gap-2 px-3 py-2.5">
                <Icono nombre="enlace" size={15} className="mt-0.5 flex-shrink-0 text-[var(--color-muted)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.titulo || p.mlItemId || "(sin título)"}</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {p.canal}
                    {p.cuenta && ` · ${p.cuenta}`}
                    {p.mlItemId && ` · ${p.mlItemId}`}
                  </p>
                </div>
                <button
                  onClick={() => borrar(p.id)}
                  className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-expense-soft)] hover:text-[var(--color-expense)]"
                >
                  <Icono nombre="basura" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-lg bg-[var(--color-surface-2)] p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-muted)]">Vincular un aviso</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <select
              value={nueva.canal}
              onChange={(e) => setNueva((n) => ({ ...n, canal: e.target.value as Nueva["canal"] }))}
              className={inputClase}
            >
              <option value="mercadolibre">Mercado Libre</option>
              <option value="tienda">Tienda propia</option>
              <option value="otro">Otro</option>
            </select>
            <input
              value={nueva.cuenta}
              onChange={(e) => setNueva((n) => ({ ...n, cuenta: e.target.value }))}
              placeholder="Cuenta (principal / secundaria)"
              className={inputClase}
            />
            <input
              value={nueva.titulo}
              onChange={(e) => setNueva((n) => ({ ...n, titulo: e.target.value }))}
              placeholder="Título del aviso (como figura en ML)"
              className={`${inputClase} sm:col-span-2`}
            />
            <input
              value={nueva.ml_item_id}
              onChange={(e) => setNueva((n) => ({ ...n, ml_item_id: e.target.value }))}
              placeholder="Código ML (MLA…) — opcional"
              className={inputClase}
            />
            <input
              value={nueva.url}
              onChange={(e) => setNueva((n) => ({ ...n, url: e.target.value }))}
              placeholder="Link — opcional"
              className={inputClase}
            />
          </div>
          {error && <p className="mt-2 text-xs text-[var(--color-expense)]">{error}</p>}
          <div className="mt-2 flex justify-end">
            <Boton variante="primario" tamano="sm" icono="mas" onClick={agregar} disabled={trabajando}>
              Agregar
            </Boton>
          </div>
        </div>
      </div>
    </Modal>
  );
}
