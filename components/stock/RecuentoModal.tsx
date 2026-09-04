"use client";
// components/stock/RecuentoModal.tsx — alta / edición de una lista de recuento.

import { useState } from "react";
import { Modal, Boton, Campo, inputClase } from "@/components/ui";
import type { Insumo, RecuentoLista } from "@/lib/tipos-stock";

export default function RecuentoModal({
  lista,
  insumos,
  onCerrar,
  onGuardado,
}: {
  lista?: RecuentoLista;
  insumos: Insumo[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const editar = !!lista;
  const [nombre, setNombre] = useState(lista?.nombre ?? "");
  const [diasCada, setDiasCada] = useState(String(lista?.diasCada ?? 3));
  const [seleccion, setSeleccion] = useState<Set<number>>(
    new Set(lista?.items.map((i) => i.insumoId) ?? [])
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Sugeridos arriba: los consumibles.
  const ordenados = [...insumos]
    .filter((i) => i.activo)
    .sort((a, b) => (a.tipo === "consumible" ? -1 : 1) - (b.tipo === "consumible" ? -1 : 1));

  function toggle(id: number) {
    setSeleccion((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function guardar() {
    setError(null);
    setGuardando(true);
    const body = {
      nombre,
      diasCada: Number(diasCada),
      insumoIds: [...seleccion],
    };
    const res = await fetch(editar ? `/api/recuento-listas/${lista!.id}` : "/api/recuento-listas", {
      method: editar ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
      titulo={editar ? "Editar lista de recuento" : "Nueva lista de recuento"}
      onCerrar={onCerrar}
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
        <div className="grid grid-cols-[1fr_130px] gap-3">
          <Campo label="Nombre">
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Consumibles de taller"
              className={inputClase}
            />
          </Campo>
          <Campo label="Avisar cada (días)">
            <input
              type="number"
              min="1"
              value={diasCada}
              onChange={(e) => setDiasCada(e.target.value)}
              className={inputClase}
            />
          </Campo>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-muted)]">
            Insumos a revisar ({seleccion.size})
          </p>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-[var(--color-border)] p-1.5">
            {ordenados.map((i) => (
              <label
                key={i.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
              >
                <input type="checkbox" checked={seleccion.has(i.id)} onChange={() => toggle(i.id)} />
                <span className="flex-1">{i.nombre}</span>
                <span className="text-[11px] text-[var(--color-muted)]">{i.tipo === "consumible" ? "consumible" : ""}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-[var(--color-expense)]">{error}</p>}
      </div>
    </Modal>
  );
}
