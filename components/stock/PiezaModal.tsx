"use client";
// components/stock/PiezaModal.tsx — alta / edición de una pieza fabricada,
// con su receta (materia prima y herrajes; los consumibles no van acá).

import { useEffect, useState } from "react";
import { Modal, Boton, Campo, inputClase } from "@/components/ui";
import Icono from "@/components/Icono";
import type { Insumo, PiezaBase, RecetaLineaVista } from "@/lib/tipos-stock";

type LineaEdit = { insumoId: number | ""; cantidad: string; bloqueante: boolean };

export default function PiezaModal({
  pieza,
  insumos,
  onCerrar,
  onGuardado,
}: {
  pieza?: PiezaBase;
  insumos: Insumo[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const editar = !!pieza;
  const [nombre, setNombre] = useState(pieza?.nombre ?? "");
  const [manoObra, setManoObra] = useState(String(pieza?.manoObraMinutos ?? 0));
  const [lineas, setLineas] = useState<LineaEdit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const insumosReceta = insumos.filter((i) => i.tipo !== "consumible" && i.activo);

  useEffect(() => {
    if (!pieza) return;
    fetch(`/api/productos-base/${pieza.id}/receta`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rs: RecetaLineaVista[]) =>
        setLineas(
          rs.map((l) => ({ insumoId: l.insumoId, cantidad: String(l.cantidad), bloqueante: l.bloqueante }))
        )
      );
  }, [pieza]);

  function setLinea(i: number, patch: Partial<LineaEdit>) {
    setLineas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function guardar() {
    setError(null);
    setGuardando(true);
    try {
      let piezaId = pieza?.id;
      const resP = await fetch(editar ? `/api/productos-base/${piezaId}` : "/api/productos-base", {
        method: editar ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, mano_obra_minutos: Number(manoObra) }),
      });
      if (!resP.ok) {
        setError((await resP.json().catch(() => ({}))).error ?? "No se pudo guardar la pieza");
        return;
      }
      if (!editar) piezaId = (await resP.json()).id;

      const lineasValidas = lineas
        .filter((l) => l.insumoId !== "" && Number(l.cantidad) > 0)
        .map((l) => ({ insumoId: Number(l.insumoId), cantidad: Number(l.cantidad), bloqueante: l.bloqueante }));

      const resR = await fetch(`/api/productos-base/${piezaId}/receta`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineas: lineasValidas }),
      });
      if (!resR.ok) {
        setError((await resR.json().catch(() => ({}))).error ?? "No se pudo guardar la receta");
        return;
      }
      onGuardado();
    } finally {
      setGuardando(false);
    }
  }

  const usados = new Set(lineas.map((l) => l.insumoId));

  return (
    <Modal
      titulo={editar ? `Editar pieza · ${pieza!.nombre}` : "Nueva pieza"}
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px]">
          <Campo label="Nombre">
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Riel 200 con bisagra"
              className={inputClase}
            />
          </Campo>
          <Campo label="Mano de obra (min)" hint="Para el costo">
            <input
              type="number"
              min="0"
              value={manoObra}
              onChange={(e) => setManoObra(e.target.value)}
              className={inputClase}
            />
          </Campo>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-[var(--color-muted)]">Receta</span>
            <Boton
              tamano="sm"
              icono="mas"
              onClick={() => setLineas((ls) => [...ls, { insumoId: "", cantidad: "", bloqueante: true }])}
            >
              Agregar insumo
            </Boton>
          </div>

          {lineas.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-4 text-center text-xs text-[var(--color-muted)]">
              Sin insumos todavía. Agregá materia prima y herrajes.
            </p>
          ) : (
            <div className="space-y-2">
              {lineas.map((l, i) => {
                const ins = insumos.find((x) => x.id === l.insumoId);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={l.insumoId}
                      onChange={(e) => setLinea(i, { insumoId: e.target.value ? Number(e.target.value) : "" })}
                      className={`${inputClase} flex-1`}
                    >
                      <option value="">Elegí un insumo…</option>
                      {insumosReceta.map((x) => (
                        <option key={x.id} value={x.id} disabled={usados.has(x.id) && x.id !== l.insumoId}>
                          {x.nombre}
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
                    <span className="w-10 text-xs text-[var(--color-muted)]">{ins?.unidadConsumo ?? ""}</span>
                    <label
                      className="flex items-center gap-1 text-[11px] text-[var(--color-muted)]"
                      title="Si falta, frena el armado (materia prima y herrajes: sí)"
                    >
                      <input
                        type="checkbox"
                        checked={l.bloqueante}
                        onChange={(e) => setLinea(i, { bloqueante: e.target.checked })}
                      />
                      frena
                    </label>
                    <button
                      onClick={() => setLineas((ls) => ls.filter((_, idx) => idx !== i))}
                      className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-expense-soft)] hover:text-[var(--color-expense)]"
                    >
                      <Icono nombre="x" size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {insumosReceta.length === 0 && (
            <p className="mt-2 text-[11px] text-[var(--color-muted)]">
              No hay materia prima ni herrajes cargados todavía. Creá insumos primero.
            </p>
          )}
        </div>

        {error && <p className="text-sm text-[var(--color-expense)]">{error}</p>}
      </div>
    </Modal>
  );
}
