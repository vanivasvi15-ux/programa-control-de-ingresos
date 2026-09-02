"use client";
// components/MovimientoModal.tsx
//
// Formulario de alta / edición de un movimiento. Lo usan la pantalla de
// movimientos (nuevo, editar, duplicar) y la de fijos (editar).

import { useMemo, useState } from "react";
import { Modal, Boton, Segmentado, Campo, inputClase } from "./ui";
import Icono from "./Icono";
import { hoyISO, NOMBRE_FRECUENCIA } from "@/lib/formato";
import { FRECUENCIAS } from "@/lib/movimientos-datos";
import type { Categoria, Movimiento, TipoMovimiento, Recurrencia, Frecuencia } from "@/lib/tipos";

export type PresetMovimiento = Partial<{
  tipo: TipoMovimiento;
  monto: number;
  categoriaId: number;
  fecha: string;
  recurrencia: Recurrencia;
  frecuencia: Frecuencia;
  proximaFecha: string;
  nota: string;
}>;

type Props = {
  categorias: Categoria[];
  puedeCrearCategoria: boolean;
  movimiento?: Movimiento | null;
  presets?: PresetMovimiento;
  onCerrar: () => void;
  onGuardado: (m: Movimiento) => void;
};

function soloDigitos(s: string) {
  return s.replace(/\D/g, "");
}
function conSeparadores(digitos: string) {
  if (!digitos) return "";
  return Number(digitos).toLocaleString("es-AR");
}

export default function MovimientoModal({
  categorias,
  puedeCrearCategoria,
  movimiento,
  presets,
  onCerrar,
  onGuardado,
}: Props) {
  const edicion = !!movimiento;
  // Valores iniciales: si es edición vienen del movimiento; si no, de los
  // presets (duplicar / nuevo fijo); si no, valores por defecto.
  const ini = {
    tipo: (movimiento?.tipo ?? presets?.tipo ?? "gasto") as TipoMovimiento,
    monto: movimiento?.monto ?? presets?.monto ?? null,
    categoriaId: movimiento?.categoriaId ?? presets?.categoriaId ?? ("" as number | ""),
    fecha: movimiento?.fecha ?? presets?.fecha ?? hoyISO(),
    recurrencia: (movimiento?.recurrencia ?? presets?.recurrencia ?? "unico") as Recurrencia,
    frecuencia: (movimiento?.frecuencia ?? presets?.frecuencia ?? "mensual") as Frecuencia,
    proximaFecha: movimiento?.proximaFecha ?? presets?.proximaFecha ?? "",
    nota: movimiento?.nota ?? presets?.nota ?? "",
  };

  const [tipo, setTipo] = useState<TipoMovimiento>(ini.tipo);
  const [montoTxt, setMontoTxt] = useState(ini.monto ? conSeparadores(String(ini.monto)) : "");
  const [categoriaId, setCategoriaId] = useState<number | "">(ini.categoriaId);
  const [fecha, setFecha] = useState(ini.fecha);
  const [recurrencia, setRecurrencia] = useState<Recurrencia>(ini.recurrencia);
  const [frecuencia, setFrecuencia] = useState<Frecuencia>(ini.frecuencia);
  const [proximaFecha, setProximaFecha] = useState(ini.proximaFecha);
  const [nota, setNota] = useState(ini.nota);

  const [cats, setCats] = useState(categorias);
  const [creandoCat, setCreandoCat] = useState(false);
  const [nuevaCat, setNuevaCat] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoriasVisibles = useMemo(() => {
    const activas = cats.filter((c) => c.tipo === tipo && c.activo);
    // En edición, si la categoría actual quedó inactiva, igual mostrarla.
    if (edicion && movimiento && !activas.some((c) => c.id === movimiento.categoriaId)) {
      const actual = cats.find((c) => c.id === movimiento.categoriaId);
      if (actual) return [actual, ...activas];
    }
    return activas;
  }, [cats, tipo, edicion, movimiento]);

  function cambiarTipo(t: TipoMovimiento) {
    setTipo(t);
    // Si la categoría elegida no es de este tipo, la limpiamos.
    const cat = cats.find((c) => c.id === categoriaId);
    if (!cat || cat.tipo !== t) setCategoriaId("");
  }

  async function crearCategoria() {
    const nombre = nuevaCat.trim();
    if (!nombre) return;
    setError(null);
    const res = await fetch("/api/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, tipo }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "No se pudo crear la categoría");
      return;
    }
    setCats((prev) => [...prev, data]);
    setCategoriaId(data.id);
    setNuevaCat("");
    setCreandoCat(false);
  }

  async function guardar() {
    setError(null);
    const monto = Number(soloDigitos(montoTxt));
    if (!monto || monto <= 0) {
      setError("Poné un monto mayor a 0");
      return;
    }
    if (!categoriaId) {
      setError("Elegí una categoría");
      return;
    }
    if (recurrencia !== "unico" && !proximaFecha) {
      setError("Un fijo necesita una próxima fecha");
      return;
    }

    setGuardando(true);
    const cuerpo = {
      tipo,
      monto,
      categoria_id: categoriaId,
      fecha,
      recurrencia,
      proxima_fecha: recurrencia === "unico" ? null : proximaFecha,
      frecuencia: recurrencia === "unico" ? null : frecuencia,
      nota: nota.trim() || null,
    };
    const url = edicion ? `/api/movimientos/${movimiento!.id}` : "/api/movimientos";
    const res = await fetch(url, {
      method: edicion ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    const data = await res.json();
    setGuardando(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar");
      return;
    }
    onGuardado(data as Movimiento);
  }

  const esIngreso = tipo === "ingreso";

  return (
    <Modal
      titulo={edicion ? "Editar movimiento" : "Nuevo movimiento"}
      onCerrar={onCerrar}
      footer={
        <>
          <Boton variante="fantasma" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton variante="primario" onClick={guardar} disabled={guardando} icono="check">
            {guardando ? "Guardando…" : edicion ? "Guardar cambios" : "Agregar"}
          </Boton>
        </>
      }
    >
      <div className="space-y-4">
        {/* Tipo */}
        <Segmentado
          className="w-full [&>button]:flex-1"
          opciones={[
            { valor: "gasto", label: "Gasto" },
            { valor: "ingreso", label: "Ingreso" },
          ]}
          valor={tipo}
          onChange={(v) => cambiarTipo(v as TipoMovimiento)}
        />

        {/* Monto */}
        <Campo label="Monto">
          <div className="relative">
            <span
              className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold ${
                esIngreso ? "text-[var(--color-income)]" : "text-[var(--color-expense)]"
              }`}
            >
              $
            </span>
            <input
              value={montoTxt}
              onChange={(e) => setMontoTxt(conSeparadores(soloDigitos(e.target.value)))}
              inputMode="numeric"
              placeholder="0"
              autoFocus
              className={`${inputClase} pl-7 text-lg font-bold tabular`}
            />
          </div>
        </Campo>

        {/* Categoría */}
        <Campo label="Categoría">
          {!creandoCat ? (
            <div className="flex gap-2">
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value ? Number(e.target.value) : "")}
                className={inputClase}
              >
                <option value="">Elegí una…</option>
                {categoriasVisibles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                    {!c.activo ? " (inactiva)" : ""}
                  </option>
                ))}
              </select>
              {puedeCrearCategoria && (
                <Boton
                  variante="contorno"
                  onClick={() => setCreandoCat(true)}
                  title="Nueva categoría"
                  className="flex-shrink-0"
                >
                  <Icono nombre="mas" size={16} />
                </Boton>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={nuevaCat}
                onChange={(e) => setNuevaCat(e.target.value)}
                placeholder={`Nueva categoría de ${tipo}`}
                autoFocus
                className={inputClase}
                onKeyDown={(e) => e.key === "Enter" && crearCategoria()}
              />
              <Boton variante="primario" onClick={crearCategoria} className="flex-shrink-0">
                <Icono nombre="check" size={16} />
              </Boton>
              <Boton
                variante="fantasma"
                onClick={() => {
                  setCreandoCat(false);
                  setNuevaCat("");
                }}
                className="flex-shrink-0"
              >
                <Icono nombre="x" size={16} />
              </Boton>
            </div>
          )}
        </Campo>

        {/* Fecha */}
        <Campo label="Fecha">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={inputClase}
          />
        </Campo>

        {/* Recurrencia */}
        <Campo label="¿Se repite?">
          <Segmentado
            className="w-full [&>button]:flex-1"
            opciones={[
              { valor: "unico", label: "No, una vez" },
              { valor: "fijo", label: "Fijo" },
              { valor: "variable_recurrente", label: "Variable" },
            ]}
            valor={recurrencia}
            onChange={(v) => {
              setRecurrencia(v as Recurrencia);
              if (v !== "unico" && !proximaFecha) setProximaFecha(fecha);
            }}
          />
        </Campo>

        {recurrencia !== "unico" && (
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-[var(--color-surface-2)] p-3">
            <Campo label="Cada cuánto">
              <select
                value={frecuencia}
                onChange={(e) => setFrecuencia(e.target.value as Frecuencia)}
                className={inputClase}
              >
                {FRECUENCIAS.map((f) => (
                  <option key={f} value={f}>
                    {NOMBRE_FRECUENCIA[f]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Próxima vez">
              <input
                type="date"
                value={proximaFecha}
                onChange={(e) => setProximaFecha(e.target.value)}
                className={inputClase}
              />
            </Campo>
            {recurrencia === "variable_recurrente" && (
              <p className="col-span-2 text-[11px] text-[var(--color-muted)]">
                Variable = se repite pero el monto cambia (ej. luz, gas). Al registrarlo cada
                mes te va a pedir el monto real de esa vez.
              </p>
            )}
          </div>
        )}

        {/* Nota */}
        <Campo label="Nota (opcional)">
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder="Ej: reja para el vecino / compra de electrodos"
            className={inputClase}
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
