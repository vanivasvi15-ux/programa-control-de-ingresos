"use client";
// components/config/CategoriasPanel.tsx — alta / edición / baja de categorías.

import { useEffect, useState } from "react";
import { Tarjeta, Boton, inputClase } from "@/components/ui";
import Icono from "@/components/Icono";
import Switch from "@/components/Switch";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { Categoria, TipoMovimiento } from "@/lib/tipos";

function Columna({
  tipo,
  cats,
  onCambio,
}: {
  tipo: TipoMovimiento;
  cats: Categoria[];
  onCambio: () => void;
}) {
  const [nueva, setNueva] = useState("");
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [borrarObj, setBorrarObj] = useState<Categoria | null>(null);
  const [error, setError] = useState<string | null>(null);
  const propias = cats.filter((c) => c.tipo === tipo);

  async function crear() {
    const nombre = nueva.trim();
    if (!nombre) return;
    setError(null);
    const res = await fetch("/api/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, tipo }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "No se pudo crear");
      return;
    }
    setNueva("");
    onCambio();
  }

  async function actualizar(id: number, body: Record<string, unknown>) {
    await fetch(`/api/categorias/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setEditandoId(null);
    onCambio();
  }

  async function borrar() {
    if (!borrarObj) return;
    const res = await fetch(`/api/categorias/${borrarObj.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBorrarObj(null);
    onCambio();
    if (data?.desactivada) {
      setError(data.mensaje ?? null);
      setTimeout(() => setError(null), 4000);
    }
  }

  return (
    <Tarjeta className="p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-bold">
        <span
          className={`grid h-6 w-6 place-items-center rounded-md ${
            tipo === "ingreso"
              ? "bg-[var(--color-income-soft)] text-[var(--color-income)]"
              : "bg-[var(--color-expense-soft)] text-[var(--color-expense)]"
          }`}
        >
          <Icono nombre={tipo === "ingreso" ? "flecha-arriba" : "flecha-abajo"} size={13} />
        </span>
        Categorías de {tipo === "ingreso" ? "ingreso" : "gasto"}
      </p>

      <div className="divide-y divide-[var(--color-border)]">
        {propias.length === 0 && (
          <p className="py-3 text-sm text-[var(--color-muted)]">Todavía no hay ninguna.</p>
        )}
        {propias.map((c) => (
          <div key={c.id} className="flex items-center gap-2 py-2">
            {editandoId === c.id ? (
              <input
                autoFocus
                defaultValue={c.nombre}
                className={`${inputClase} py-1.5`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") actualizar(c.id, { nombre: e.currentTarget.value });
                  if (e.key === "Escape") setEditandoId(null);
                }}
                onBlur={(e) => actualizar(c.id, { nombre: e.currentTarget.value })}
              />
            ) : (
              <span className={`flex-1 text-sm ${!c.activo ? "text-[var(--color-muted)] line-through" : ""}`}>
                {c.nombre}
              </span>
            )}
            <Switch activo={c.activo} onChange={(v) => actualizar(c.id, { activo: v })} />
            <button
              onClick={() => setEditandoId(c.id)}
              className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
              title="Renombrar"
            >
              <Icono nombre="lapiz" size={14} />
            </button>
            <button
              onClick={() => setBorrarObj(c)}
              className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-expense-soft)] hover:text-[var(--color-expense)]"
              title="Borrar"
            >
              <Icono nombre="basura" size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && crear()}
          placeholder={`Nueva categoría de ${tipo}`}
          className={inputClase}
        />
        <Boton variante="primario" icono="mas" onClick={crear} className="flex-shrink-0">
          Agregar
        </Boton>
      </div>

      {error && <p className="mt-2 text-xs text-[var(--color-warn)]">{error}</p>}

      {borrarObj && (
        <ConfirmDialog
          titulo="Borrar categoría"
          peligro
          textoConfirmar="Borrar"
          mensaje={
            <>
              Se va a borrar <strong>{borrarObj.nombre}</strong>. Si ya tiene movimientos
              cargados, en vez de borrarse se va a <strong>desactivar</strong> (los movimientos
              viejos quedan intactos).
            </>
          }
          onConfirmar={borrar}
          onCerrar={() => setBorrarObj(null)}
        />
      )}
    </Tarjeta>
  );
}

export default function CategoriasPanel() {
  const [cats, setCats] = useState<Categoria[]>([]);

  // El GET sin filtros trae todas (activas e inactivas), así se pueden
  // reactivar desde acá.
  const cargar = () =>
    fetch("/api/categorias")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCats);

  useEffect(() => {
    cargar();
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Columna tipo="gasto" cats={cats} onCambio={cargar} />
      <Columna tipo="ingreso" cats={cats} onCambio={cargar} />
    </div>
  );
}
