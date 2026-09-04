"use client";
// app/stock/recuentos/page.tsx — listas de recuento de consumibles.

import { useCallback, useEffect, useState } from "react";
import Encabezado from "@/components/Encabezado";
import Icono from "@/components/Icono";
import { Tarjeta, Boton, Chip, EstadoVacio } from "@/components/ui";
import ConfirmDialog from "@/components/ConfirmDialog";
import RecuentoModal from "@/components/stock/RecuentoModal";
import ResponderRecuentoModal from "@/components/stock/ResponderRecuentoModal";
import { formatearFecha } from "@/lib/formato";
import type { Insumo, RecuentoLista } from "@/lib/tipos-stock";

export default function RecuentosPage() {
  const [listas, setListas] = useState<RecuentoLista[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [cargando, setCargando] = useState(true);

  const [modal, setModal] = useState<null | { lista?: RecuentoLista }>(null);
  const [responder, setResponder] = useState<RecuentoLista | null>(null);
  const [borrar, setBorrar] = useState<RecuentoLista | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const [rl, ri] = await Promise.all([fetch("/api/recuento-listas"), fetch("/api/insumos")]);
    if (rl.ok) setListas(await rl.json());
    if (ri.ok) setInsumos(await ri.json());
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div>
      <Encabezado
        titulo="Recuentos"
        subtitulo="Para lo difícil de medir (gas, discos): el sistema recuerda revisarlo cada tantos días."
        acciones={
          <Boton variante="primario" icono="mas" onClick={() => setModal({})} disabled={insumos.length === 0}>
            Nueva lista
          </Boton>
        }
      />

      {cargando ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--color-surface-2)]/40" />
          ))}
        </div>
      ) : listas.length === 0 ? (
        <Tarjeta>
          <EstadoVacio
            icono="escaner"
            titulo="Sin listas de recuento"
            detalle="Armá una lista con los consumibles difíciles de medir y elegí cada cuántos días revisarlos."
            accion={
              insumos.length > 0 && (
                <Boton variante="primario" icono="mas" onClick={() => setModal({})}>
                  Nueva lista
                </Boton>
              )
            }
          />
        </Tarjeta>
      ) : (
        <div className="space-y-3">
          {listas.map((l) => (
            <Tarjeta key={l.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold">{l.nombre}</span>
                    {l.venceRevision ? (
                      <Chip color="ambar">
                        <Icono nombre="campana" size={11} /> toca revisar
                      </Chip>
                    ) : (
                      <Chip color="verde">
                        <Icono nombre="check" size={11} /> al día
                      </Chip>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                    Cada {l.diasCada} días ·{" "}
                    {l.ultimaRevision ? `última revisión ${formatearFecha(l.ultimaRevision)}` : "sin revisar todavía"}
                    {" · "}
                    {l.items.length} {l.items.length === 1 ? "insumo" : "insumos"}
                  </p>
                  {l.items.length > 0 && (
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      {l.items.map((i) => i.nombre).join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <Boton
                    tamano="sm"
                    variante="primario"
                    icono="escaner"
                    onClick={() => setResponder(l)}
                    disabled={l.items.length === 0}
                  >
                    Hacer recuento
                  </Boton>
                  <button
                    onClick={() => setModal({ lista: l })}
                    className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                    title="Editar"
                  >
                    <Icono nombre="lapiz" size={15} />
                  </button>
                  <button
                    onClick={() => setBorrar(l)}
                    className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-expense-soft)] hover:text-[var(--color-expense)]"
                    title="Borrar"
                  >
                    <Icono nombre="basura" size={15} />
                  </button>
                </div>
              </div>
            </Tarjeta>
          ))}
        </div>
      )}

      {modal && (
        <RecuentoModal
          lista={modal.lista}
          insumos={insumos}
          onCerrar={() => setModal(null)}
          onGuardado={() => {
            setModal(null);
            cargar();
          }}
        />
      )}
      {responder && (
        <ResponderRecuentoModal
          lista={responder}
          onCerrar={() => setResponder(null)}
          onGuardado={() => {
            setResponder(null);
            cargar();
          }}
        />
      )}
      {borrar && (
        <ConfirmDialog
          titulo="Borrar lista de recuento"
          peligro
          textoConfirmar="Borrar"
          mensaje={
            <>
              Se borra la lista <strong>{borrar.nombre}</strong>. Los ajustes de stock que ya hiciste
              quedan en el historial.
            </>
          }
          onConfirmar={async () => {
            await fetch(`/api/recuento-listas/${borrar.id}`, { method: "DELETE" });
            setBorrar(null);
            cargar();
          }}
          onCerrar={() => setBorrar(null)}
        />
      )}
    </div>
  );
}
