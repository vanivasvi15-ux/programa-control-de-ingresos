"use client";
// components/stock/InsumoModal.tsx — alta / edición de un insumo.

import { useState } from "react";
import { Modal, Boton, Campo, Segmentado, inputClase } from "@/components/ui";
import type { Insumo, TipoInsumo } from "@/lib/tipos-stock";

export default function InsumoModal({
  insumo,
  onCerrar,
  onGuardado,
}: {
  insumo?: Insumo;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const editar = !!insumo;
  const [nombre, setNombre] = useState(insumo?.nombre ?? "");
  const [tipo, setTipo] = useState<TipoInsumo>(insumo?.tipo ?? "materia_prima");
  const [unidadCompra, setUnidadCompra] = useState(insumo?.unidadCompra ?? "unidad");
  const [unidadConsumo, setUnidadConsumo] = useState(insumo?.unidadConsumo ?? "unidad");
  const [factorCompra, setFactorCompra] = useState(String(insumo?.factorCompra ?? 1));
  const [costoUnitario, setCostoUnitario] = useState(String(insumo?.costoUnitario ?? 0));
  const [alertaMinimo, setAlertaMinimo] = useState(
    insumo?.alertaMinimo != null ? String(insumo.alertaMinimo) : ""
  );
  const [nota, setNota] = useState(insumo?.nota ?? "");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setError(null);
    setGuardando(true);
    const body = {
      nombre,
      tipo,
      unidad_compra: unidadCompra,
      unidad_consumo: unidadConsumo,
      factor_compra: Number(factorCompra),
      costo_unitario: Number(costoUnitario),
      alerta_minimo: alertaMinimo === "" ? null : Number(alertaMinimo),
      nota,
    };
    const res = await fetch(editar ? `/api/insumos/${insumo!.id}` : "/api/insumos", {
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

  const costoPorConsumo =
    Number(factorCompra) > 0 ? Number(costoUnitario) / Number(factorCompra) : 0;

  return (
    <Modal
      titulo={editar ? "Editar insumo" : "Nuevo insumo"}
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
        <Campo label="Nombre">
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder='Ej. Planchuela 1" x 1/8'
            className={inputClase}
          />
        </Campo>

        <Campo label="Tipo">
          <Segmentado
            opciones={[
              { valor: "materia_prima", label: "Materia prima" },
              { valor: "herraje", label: "Herraje" },
              { valor: "consumible", label: "Consumible" },
            ]}
            valor={tipo}
            onChange={setTipo}
          />
          {tipo === "consumible" && (
            <span className="mt-1 block text-[11px] text-[var(--color-muted)]">
              Los consumibles no van en las recetas: se controlan con las listas de recuento.
            </span>
          )}
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Unidad de compra" hint="Cómo lo comprás (tira, kg, unidad…)">
            <input
              value={unidadCompra}
              onChange={(e) => setUnidadCompra(e.target.value)}
              className={inputClase}
            />
          </Campo>
          <Campo label="Unidad de consumo" hint="Cómo lo pide la receta (cm, unidad…)">
            <input
              value={unidadConsumo}
              onChange={(e) => setUnidadConsumo(e.target.value)}
              className={inputClase}
            />
          </Campo>
        </div>

        <Campo
          label="Factor de compra"
          hint={`Cuántos "${unidadConsumo}" entran en 1 "${unidadCompra}". Ej. tira de 6 m en cm → 600.`}
        >
          <input
            type="number"
            step="any"
            min="0"
            value={factorCompra}
            onChange={(e) => setFactorCompra(e.target.value)}
            className={inputClase}
          />
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo label={`Costo por ${unidadCompra} ($)`} hint="Último precio pagado">
            <input
              type="number"
              min="0"
              value={costoUnitario}
              onChange={(e) => setCostoUnitario(e.target.value)}
              className={inputClase}
            />
          </Campo>
          <Campo label={`Alerta de mínimo (${unidadConsumo})`} hint="Vacío = sin alerta">
            <input
              type="number"
              step="any"
              min="0"
              value={alertaMinimo}
              onChange={(e) => setAlertaMinimo(e.target.value)}
              className={inputClase}
            />
          </Campo>
        </div>

        {Number(costoUnitario) > 0 && Number(factorCompra) > 0 && (
          <p className="rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-muted)]">
            Costo por {unidadConsumo}:{" "}
            <span className="font-semibold text-[var(--color-text)]">
              $ {costoPorConsumo.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
            </span>
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
