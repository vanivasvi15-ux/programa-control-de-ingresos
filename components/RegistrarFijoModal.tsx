"use client";
// components/RegistrarFijoModal.tsx
//
// "Registrar" un fijo: crea el movimiento real de este período y corre la
// próxima fecha del fijo hacia adelante. Para los variables recurrentes
// pide el monto de esta vez.

import { useState } from "react";
import { Modal, Boton, Campo, inputClase } from "./ui";
import { formatearPesos, formatearFecha, NOMBRE_FRECUENCIA } from "@/lib/formato";
import type { Movimiento } from "@/lib/tipos";

function soloDigitos(s: string) {
  return s.replace(/\D/g, "");
}
function conSeparadores(d: string) {
  return d ? Number(d).toLocaleString("es-AR") : "";
}

export default function RegistrarFijoModal({
  fijo,
  onCerrar,
  onRegistrado,
}: {
  fijo: Movimiento;
  onCerrar: () => void;
  onRegistrado: () => void;
}) {
  const variable = fijo.recurrencia === "variable_recurrente";
  const [montoTxt, setMontoTxt] = useState(conSeparadores(String(fijo.monto)));
  const [fecha, setFecha] = useState(fijo.proximaFecha ?? "");
  const [nota, setNota] = useState(fijo.nota ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function registrar() {
    setError(null);
    const monto = Number(soloDigitos(montoTxt));
    if (!monto || monto <= 0) {
      setError("Poné un monto válido");
      return;
    }
    setGuardando(true);
    const res = await fetch(`/api/movimientos/${fijo.id}/registrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monto, fecha, nota: nota.trim() || null }),
    });
    const data = await res.json();
    setGuardando(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo registrar");
      return;
    }
    onRegistrado();
  }

  return (
    <Modal
      titulo="Registrar fijo"
      onCerrar={onCerrar}
      ancho="max-w-md"
      footer={
        <>
          <Boton variante="fantasma" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton variante="primario" icono="check" onClick={registrar} disabled={guardando}>
            {guardando ? "Registrando…" : "Registrar"}
          </Boton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-[var(--color-surface-2)] p-3 text-sm">
          <p className="font-semibold">
            {fijo.tipo === "ingreso" ? "Cobro" : "Pago"} de {fijo.categoriaNombre}
          </p>
          <p className="text-xs text-[var(--color-muted)]">
            {fijo.frecuencia ? NOMBRE_FRECUENCIA[fijo.frecuencia] : ""} · después de registrarlo, la
            próxima queda para más adelante
          </p>
        </div>

        <Campo label={variable ? "¿Cuánto salió esta vez?" : "Monto"}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--color-muted)]">
              $
            </span>
            <input
              value={montoTxt}
              onChange={(e) => setMontoTxt(conSeparadores(soloDigitos(e.target.value)))}
              inputMode="numeric"
              autoFocus={variable}
              className={`${inputClase} pl-7 text-lg font-bold tabular`}
            />
          </div>
          {!variable && (
            <span className="mt-1 block text-[11px] text-[var(--color-muted)]">
              Viene del fijo ({formatearPesos(fijo.monto)}). Cambialo si esta vez fue distinto.
            </span>
          )}
        </Campo>

        <Campo label="Fecha del movimiento">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={inputClase}
          />
          {fijo.proximaFecha && (
            <span className="mt-1 block text-[11px] text-[var(--color-muted)]">
              Vencía el {formatearFecha(fijo.proximaFecha)}
            </span>
          )}
        </Campo>

        <Campo label="Nota (opcional)">
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            className={inputClase}
            placeholder="Ej: mes de agosto"
          />
        </Campo>

        {error && (
          <p className="rounded-lg bg-[var(--color-expense-soft)] px-3 py-2 text-sm text-[var(--color-expense)]">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
