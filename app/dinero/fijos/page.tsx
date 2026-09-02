"use client";
// app/dinero/fijos/page.tsx — Gastos e ingresos que se repiten.

import { useCallback, useEffect, useMemo, useState } from "react";
import Encabezado from "@/components/Encabezado";
import Icono from "@/components/Icono";
import { Tarjeta, Boton, Chip, EstadoVacio } from "@/components/ui";
import MovimientoModal from "@/components/MovimientoModal";
import RegistrarFijoModal from "@/components/RegistrarFijoModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useUsuario } from "@/components/UsuarioContext";
import {
  formatearPesos,
  formatearFecha,
  textoDias,
  hoyISO,
  NOMBRE_FRECUENCIA,
} from "@/lib/formato";
import type { Categoria, Movimiento, Frecuencia } from "@/lib/tipos";

// Cuánto pesa por mes un fijo según su frecuencia (para el estimado mensual).
const FACTOR_MENSUAL: Record<Frecuencia, number> = {
  semanal: 52 / 12,
  quincenal: 24 / 12,
  mensual: 1,
  bimestral: 1 / 2,
  trimestral: 1 / 3,
  semestral: 1 / 6,
  anual: 1 / 12,
};

function diasRestantes(fecha: string | null): number | null {
  if (!fecha) return null;
  const [a, m, d] = fecha.split("-").map(Number);
  const [ah, mh, dh] = hoyISO().split("-").map(Number);
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(ah, mh - 1, dh)) / 86400000);
}

export default function FijosPage() {
  const usuario = useUsuario();
  const puedeEscribir = usuario.rol !== "contador";

  const [fijos, setFijos] = useState<Movimiento[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);

  const [nuevo, setNuevo] = useState(false);
  const [editar, setEditar] = useState<Movimiento | null>(null);
  const [registrar, setRegistrar] = useState<Movimiento | null>(null);
  const [anular, setAnular] = useState<Movimiento | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const [rf, rv] = await Promise.all([
      fetch("/api/movimientos?recurrencia=fijo&estado=todos"),
      fetch("/api/movimientos?recurrencia=variable_recurrente&estado=todos"),
    ]);
    const a: Movimiento[] = rf.ok ? await rf.json() : [];
    const b: Movimiento[] = rv.ok ? await rv.json() : [];
    const todos = [...a, ...b]
      .filter((m) => m.estado !== "anulado")
      .sort((x, y) => (x.proximaFecha ?? "").localeCompare(y.proximaFecha ?? ""));
    setFijos(todos);
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
    fetch("/api/categorias")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCategorias);
  }, [cargar]);

  const activos = fijos.filter((f) => f.estado === "activo");
  const pausados = fijos.filter((f) => f.estado === "pausado");

  const estimado = useMemo(() => {
    let ing = 0;
    let gas = 0;
    for (const f of activos) {
      const factor = f.frecuencia ? FACTOR_MENSUAL[f.frecuencia] : 1;
      if (f.tipo === "ingreso") ing += f.monto * factor;
      else gas += f.monto * factor;
    }
    return { ing: Math.round(ing), gas: Math.round(gas), neto: Math.round(ing - gas) };
  }, [activos]);

  async function cambiarEstado(f: Movimiento, estado: "activo" | "pausado") {
    await fetch(`/api/movimientos/${f.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    cargar();
  }

  async function anularFijo() {
    if (!anular) return;
    await fetch(`/api/movimientos/${anular.id}`, { method: "DELETE" });
    setAnular(null);
    cargar();
  }

  function Fila({ f }: { f: Movimiento }) {
    const dr = diasRestantes(f.proximaFecha);
    const vencido = dr !== null && dr < 0;
    const pronto = dr !== null && dr >= 0 && dr <= 5;
    const pausado = f.estado === "pausado";
    return (
      <div className={`flex flex-wrap items-center gap-3 px-4 py-3 ${pausado ? "opacity-60" : ""}`}>
        <span
          className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg ${
            f.tipo === "ingreso"
              ? "bg-[var(--color-income-soft)] text-[var(--color-income)]"
              : "bg-[var(--color-expense-soft)] text-[var(--color-expense)]"
          }`}
        >
          <Icono nombre={f.tipo === "ingreso" ? "flecha-arriba" : "flecha-abajo"} size={16} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold">{f.categoriaNombre}</span>
            <Chip color="indigo">{f.frecuencia ? NOMBRE_FRECUENCIA[f.frecuencia] : "—"}</Chip>
            {f.recurrencia === "variable_recurrente" && <Chip>variable</Chip>}
            {pausado && <Chip color="ambar">Pausado</Chip>}
          </div>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
            {f.nota ? `${f.nota} · ` : ""}
            {f.proximaFecha ? (
              <>
                próxima: {formatearFecha(f.proximaFecha)}{" "}
                <span className={vencido ? "font-semibold text-[var(--color-expense)]" : ""}>
                  ({textoDias(dr)})
                </span>
              </>
            ) : (
              "sin próxima fecha"
            )}
          </p>
        </div>

        <span className="tabular text-sm font-bold">
          {f.recurrencia === "variable_recurrente" ? "~" : ""}
          {formatearPesos(f.monto)}
        </span>

        {puedeEscribir && (
          <div className="flex items-center gap-1.5">
            {!pausado && (
              <Boton
                tamano="sm"
                variante={pronto || vencido ? "primario" : "contorno"}
                onClick={() => setRegistrar(f)}
              >
                Registrar
              </Boton>
            )}
            <Boton
              tamano="sm"
              variante="fantasma"
              icono={pausado ? "play" : "pausa"}
              onClick={() => cambiarEstado(f, pausado ? "activo" : "pausado")}
              title={pausado ? "Reactivar" : "Pausar"}
            >
              {pausado ? "Reactivar" : "Pausar"}
            </Boton>
            <Boton tamano="sm" variante="fantasma" icono="lapiz" onClick={() => setEditar(f)} title="Editar">
              <span className="sr-only">Editar</span>
            </Boton>
            <Boton
              tamano="sm"
              variante="fantasma"
              icono="basura"
              onClick={() => setAnular(f)}
              title="Anular"
              className="text-[var(--color-expense)]"
            >
              <span className="sr-only">Anular</span>
            </Boton>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <Encabezado
        titulo="Fijos"
        subtitulo="Gastos e ingresos que se repiten"
        acciones={
          puedeEscribir && (
            <Boton variante="primario" icono="mas" onClick={() => setNuevo(true)}>
              Nuevo fijo
            </Boton>
          )
        }
      />

      {/* Estimado mensual */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Tarjeta className="p-3">
          <p className="text-[11px] font-semibold uppercase text-[var(--color-muted)]">
            Ingresos fijos / mes
          </p>
          <p className="text-lg font-bold tabular text-[var(--color-income)]">
            {formatearPesos(estimado.ing)}
          </p>
        </Tarjeta>
        <Tarjeta className="p-3">
          <p className="text-[11px] font-semibold uppercase text-[var(--color-muted)]">
            Gastos fijos / mes
          </p>
          <p className="text-lg font-bold tabular text-[var(--color-expense)]">
            {formatearPesos(estimado.gas)}
          </p>
        </Tarjeta>
        <Tarjeta className="p-3">
          <p className="text-[11px] font-semibold uppercase text-[var(--color-muted)]">Neto / mes</p>
          <p
            className={`text-lg font-bold tabular ${
              estimado.neto >= 0 ? "text-[var(--color-income)]" : "text-[var(--color-expense)]"
            }`}
          >
            {formatearPesos(estimado.neto)}
          </p>
        </Tarjeta>
      </div>

      <Tarjeta className="overflow-hidden">
        {cargando ? (
          <div className="divide-y divide-[var(--color-border)]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse bg-[var(--color-surface-2)]/40" />
            ))}
          </div>
        ) : fijos.length === 0 ? (
          <EstadoVacio
            icono="fijos"
            titulo="No hay fijos cargados"
            detalle="Un fijo es algo que se repite: alquiler, sueldos, la luz, un abono. Cargá el primero."
            accion={
              puedeEscribir && (
                <Boton variante="primario" icono="mas" onClick={() => setNuevo(true)}>
                  Nuevo fijo
                </Boton>
              )
            }
          />
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {activos.map((f) => (
              <Fila key={f.id} f={f} />
            ))}
            {pausados.length > 0 && (
              <>
                <div className="bg-[var(--color-surface-2)]/40 px-4 py-1.5 text-[11px] font-semibold uppercase text-[var(--color-muted)]">
                  Pausados
                </div>
                {pausados.map((f) => (
                  <Fila key={f.id} f={f} />
                ))}
              </>
            )}
          </div>
        )}
      </Tarjeta>

      {(nuevo || editar) && (
        <MovimientoModal
          categorias={categorias}
          puedeCrearCategoria={usuario.rol === "dueño"}
          movimiento={editar}
          presets={nuevo ? { recurrencia: "fijo", frecuencia: "mensual", fecha: hoyISO() } : undefined}
          onCerrar={() => {
            setNuevo(false);
            setEditar(null);
          }}
          onGuardado={() => {
            setNuevo(false);
            setEditar(null);
            cargar();
          }}
        />
      )}
      {registrar && (
        <RegistrarFijoModal
          fijo={registrar}
          onCerrar={() => setRegistrar(null)}
          onRegistrado={() => {
            setRegistrar(null);
            cargar();
          }}
        />
      )}
      {anular && (
        <ConfirmDialog
          titulo="Anular fijo"
          peligro
          textoConfirmar="Sí, anular"
          mensaje={
            <>
              El fijo <strong>{anular.categoriaNombre}</strong> se marca como anulado y deja de
              aparecer. Los movimientos que ya generó quedan como están.
            </>
          }
          onConfirmar={anularFijo}
          onCerrar={() => setAnular(null)}
        />
      )}
    </div>
  );
}
