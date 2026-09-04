"use client";
// components/stock/OrdenModal.tsx — nueva orden de producción.

import { useState } from "react";
import { Modal, Boton, Campo, inputClase } from "@/components/ui";
import Icono from "@/components/Icono";
import { hoyISO } from "@/lib/formato";
import { formatearCantidad, type PiezaBase } from "@/lib/tipos-stock";

export default function OrdenModal({
  piezas,
  onCerrar,
  onGuardado,
}: {
  piezas: PiezaBase[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [piezaId, setPiezaId] = useState<number | "">("");
  const [cantidad, setCantidad] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [nota, setNota] = useState("");
  const [realizar, setRealizar] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [faltan, setFaltan] = useState<{ nombre: string; faltan: number; unidad: string }[] | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setError(null);
    setFaltan(null);
    setGuardando(true);
    const res = await fetch("/api/ordenes-produccion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productoBaseId: Number(piezaId),
        cantidad: Number(cantidad),
        fecha,
        nota: nota.trim() || undefined,
        realizar,
      }),
    });
    setGuardando(false);
    if (res.status === 422) {
      const d = await res.json().catch(() => ({}));
      setFaltan(d.faltan ?? []);
      setError(d.error ?? "Falta material");
      return;
    }
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "No se pudo crear la orden");
      return;
    }
    onGuardado();
  }

  return (
    <Modal
      titulo="Nueva orden de producción"
      onCerrar={onCerrar}
      footer={
        <>
          <Boton variante="fantasma" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            onClick={guardar}
            disabled={guardando || piezaId === "" || !(Number(cantidad) > 0)}
          >
            {guardando ? "Un momento…" : realizar ? "Crear y fabricar" : "Guardar planificada"}
          </Boton>
        </>
      }
    >
      <div className="space-y-4">
        <Campo label="Pieza a fabricar">
          <select
            value={piezaId}
            onChange={(e) => setPiezaId(e.target.value ? Number(e.target.value) : "")}
            className={inputClase}
            autoFocus
          >
            <option value="">Elegí una pieza…</option>
            {piezas
              .filter((p) => p.activo)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} (stock {formatearCantidad(p.stock)})
                </option>
              ))}
          </select>
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Cantidad">
            <input
              type="number"
              min="1"
              step="1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className={inputClase}
            />
          </Campo>
          <Campo label="Fecha">
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputClase} />
          </Campo>
        </div>

        <Campo label="Nota (opcional)">
          <input value={nota} onChange={(e) => setNota(e.target.value)} className={inputClase} />
        </Campo>

        <label className="flex items-start gap-2 rounded-lg bg-[var(--color-surface-2)] px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            checked={realizar}
            onChange={(e) => setRealizar(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Fabricar ahora</span>
            <span className="block text-xs text-[var(--color-muted)]">
              Descuenta los insumos y suma las piezas al stock. Si lo dejás sin marcar, queda
              planificada para fabricar después.
            </span>
          </span>
        </label>

        {error && (
          <div className="rounded-lg border border-[var(--color-expense)]/40 bg-[var(--color-expense-soft)] px-3 py-2.5 text-sm text-[var(--color-expense)]">
            <p className="flex items-center gap-1.5 font-semibold">
              <Icono nombre="alerta" size={14} /> {error}
            </p>
            {faltan && faltan.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-xs">
                {faltan.map((f, i) => (
                  <li key={i}>
                    Faltan <strong>{formatearCantidad(f.faltan)} {f.unidad}</strong> de {f.nombre}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
