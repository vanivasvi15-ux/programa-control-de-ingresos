"use client";
// components/stock/ResponderRecuentoModal.tsx — cargar el stock contado de
// cada insumo de una lista.

import { useState } from "react";
import { Modal, Boton } from "@/components/ui";
import { formatearCantidad, type RecuentoLista } from "@/lib/tipos-stock";

export default function ResponderRecuentoModal({
  lista,
  onCerrar,
  onGuardado,
}: {
  lista: RecuentoLista;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [valores, setValores] = useState<Record<number, string>>(
    Object.fromEntries(lista.items.map((i) => [i.insumoId, String(i.stock)]))
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setError(null);
    const conteos = lista.items
      .map((i) => ({ insumoId: i.insumoId, stock: Number(valores[i.insumoId]) }))
      .filter((c) => Number.isFinite(c.stock) && c.stock >= 0);
    if (conteos.length !== lista.items.length) {
      setError("Completá todos los stocks con un número ≥ 0");
      return;
    }
    setGuardando(true);
    const res = await fetch(`/api/recuento-listas/${lista.id}/responder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conteos }),
    });
    setGuardando(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "No se pudo guardar");
      return;
    }
    onGuardado();
  }

  return (
    <Modal
      titulo={`Recuento · ${lista.nombre}`}
      onCerrar={onCerrar}
      footer={
        <>
          <Boton variante="fantasma" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton variante="primario" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar recuento"}
          </Boton>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-[var(--color-muted)]">
          Anotá el stock real de cada uno. El sistema ajusta la diferencia y lo deja registrado.
        </p>
        {lista.items.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">Esta lista no tiene insumos.</p>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {lista.items.map((i) => {
              const nuevo = Number(valores[i.insumoId]);
              const dif = Number.isFinite(nuevo) ? nuevo - i.stock : 0;
              return (
                <div key={i.insumoId} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{i.nombre}</p>
                    <p className="text-xs text-[var(--color-muted)]">
                      sistema: {formatearCantidad(i.stock)} {i.unidad}
                      {dif !== 0 && Number.isFinite(nuevo) && (
                        <span className={dif > 0 ? "text-[var(--color-income)]" : "text-[var(--color-expense)]"}>
                          {" "}
                          ({dif > 0 ? "+" : ""}
                          {formatearCantidad(dif)})
                        </span>
                      )}
                    </p>
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={valores[i.insumoId] ?? ""}
                    onChange={(e) => setValores((v) => ({ ...v, [i.insumoId]: e.target.value }))}
                    className="w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20"
                  />
                </div>
              );
            })}
          </div>
        )}
        {error && <p className="text-sm text-[var(--color-expense)]">{error}</p>}
      </div>
    </Modal>
  );
}
