"use client";
// components/stock/CompraModal.tsx — cargar una compra de insumo.

import { useMemo, useState } from "react";
import { Modal, Boton, Campo, inputClase } from "@/components/ui";
import { hoyISO, formatearPesos } from "@/lib/formato";
import { formatearCantidad, type Insumo } from "@/lib/tipos-stock";

export default function CompraModal({
  insumos,
  onCerrar,
  onGuardado,
}: {
  insumos: Insumo[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [insumoId, setInsumoId] = useState<number | "">("");
  const [cantidad, setCantidad] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");
  const [actualizaCosto, setActualizaCosto] = useState(true);
  const [proveedor, setProveedor] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const insumo = useMemo(() => insumos.find((i) => i.id === insumoId), [insumos, insumoId]);

  // Al elegir un insumo, precargar su último costo.
  function elegir(id: number | "") {
    setInsumoId(id);
    const i = insumos.find((x) => x.id === id);
    if (i && costoUnitario === "") setCostoUnitario(String(i.costoUnitario));
  }

  const sumaStock =
    insumo && Number(cantidad) > 0 ? Number(cantidad) * insumo.factorCompra : 0;
  const total = Number(cantidad) > 0 && Number(costoUnitario) > 0 ? Number(cantidad) * Number(costoUnitario) : 0;

  async function guardar() {
    setError(null);
    setGuardando(true);
    const res = await fetch("/api/compras-insumo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        insumoId: Number(insumoId),
        cantidadCompra: Number(cantidad),
        costoUnitario: Number(costoUnitario),
        actualizaCosto,
        proveedor: proveedor.trim() || undefined,
        fecha,
        nota: nota.trim() || undefined,
      }),
    });
    setGuardando(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "No se pudo cargar la compra");
      return;
    }
    onGuardado();
  }

  return (
    <Modal
      titulo="Nueva compra de material"
      onCerrar={onCerrar}
      footer={
        <>
          <Boton variante="fantasma" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            onClick={guardar}
            disabled={guardando || insumoId === "" || !(Number(cantidad) > 0) || !(Number(costoUnitario) >= 0)}
          >
            {guardando ? "Guardando…" : "Cargar compra"}
          </Boton>
        </>
      }
    >
      <div className="space-y-4">
        <Campo label="Insumo">
          <select
            value={insumoId}
            onChange={(e) => elegir(e.target.value ? Number(e.target.value) : "")}
            className={inputClase}
            autoFocus
          >
            <option value="">Elegí un insumo…</option>
            {insumos
              .filter((i) => i.activo)
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre}
                </option>
              ))}
          </select>
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo label={`Cantidad ${insumo ? `(en ${insumo.unidadCompra})` : ""}`}>
            <input
              type="number"
              step="any"
              min="0"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className={inputClase}
            />
          </Campo>
          <Campo label={`Costo por ${insumo?.unidadCompra ?? "unidad"} ($)`}>
            <input
              type="number"
              min="0"
              value={costoUnitario}
              onChange={(e) => setCostoUnitario(e.target.value)}
              className={inputClase}
            />
          </Campo>
        </div>

        {insumo && (Number(cantidad) > 0 || Number(costoUnitario) > 0) && (
          <div className="rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-muted)]">
            Suma <span className="font-semibold text-[var(--color-text)]">{formatearCantidad(sumaStock)} {insumo.unidadConsumo}</span> al stock
            {total > 0 && (
              <>
                {" · "}total <span className="font-semibold text-[var(--color-text)]">{formatearPesos(total)}</span>
              </>
            )}
          </div>
        )}

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={actualizaCosto}
            onChange={(e) => setActualizaCosto(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Usar este precio como el costo del insumo
            <span className="block text-xs text-[var(--color-muted)]">
              Recalcula lo que sale cada pieza y cada kit que lo usan.
            </span>
          </span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Proveedor (opcional)">
            <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} className={inputClase} />
          </Campo>
          <Campo label="Fecha">
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputClase} />
          </Campo>
        </div>

        <Campo label="Nota (opcional)">
          <input value={nota} onChange={(e) => setNota(e.target.value)} className={inputClase} />
        </Campo>

        <p className="text-[11px] text-[var(--color-muted)]">
          El gasto en el Control de Caja se engancha en un paso próximo.
        </p>

        {error && <p className="text-sm text-[var(--color-expense)]">{error}</p>}
      </div>
    </Modal>
  );
}
