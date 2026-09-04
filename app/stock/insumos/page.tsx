"use client";
// app/stock/insumos/page.tsx — listado y ABM de insumos.

import { useCallback, useEffect, useMemo, useState } from "react";
import Encabezado from "@/components/Encabezado";
import Icono from "@/components/Icono";
import { Tarjeta, Boton, Chip, Segmentado, EstadoVacio, inputClase } from "@/components/ui";
import ConfirmDialog from "@/components/ConfirmDialog";
import InsumoModal from "@/components/stock/InsumoModal";
import { formatearPesos } from "@/lib/formato";
import {
  NOMBRE_TIPO_INSUMO,
  formatearCantidad,
  type Insumo,
  type TipoInsumo,
} from "@/lib/tipos-stock";

export default function InsumosPage() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [tipo, setTipo] = useState<"todos" | TipoInsumo>("todos");
  const [texto, setTexto] = useState("");
  const [soloBajos, setSoloBajos] = useState(false);
  const [verInactivos, setVerInactivos] = useState(false);

  const [modal, setModal] = useState<null | { insumo?: Insumo }>(null);
  const [borrar, setBorrar] = useState<Insumo | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const r = await fetch("/api/insumos");
    if (r.ok) setInsumos(await r.json());
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtrados = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return insumos.filter((i) => {
      if (!verInactivos && !i.activo) return false;
      if (tipo !== "todos" && i.tipo !== tipo) return false;
      if (soloBajos && !i.bajoMinimo) return false;
      if (t && !i.nombre.toLowerCase().includes(t)) return false;
      return true;
    });
  }, [insumos, tipo, texto, soloBajos, verInactivos]);

  const bajos = insumos.filter((i) => i.activo && i.bajoMinimo).length;

  async function confirmarBorrado() {
    if (!borrar) return;
    const res = await fetch(`/api/insumos/${borrar.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBorrar(null);
    cargar();
    if (data?.desactivado) {
      setAviso(data.mensaje ?? "Se desactivó.");
      setTimeout(() => setAviso(null), 4000);
    }
  }

  return (
    <div>
      <Encabezado
        titulo="Insumos"
        subtitulo="Materia prima, herrajes y consumibles con stock"
        acciones={
          <Boton variante="primario" icono="mas" onClick={() => setModal({})}>
            Nuevo insumo
          </Boton>
        }
      />

      {aviso && (
        <div className="mb-4 rounded-lg border border-[var(--color-warn)]/40 bg-[var(--color-warn-soft)] px-3 py-2 text-sm text-[var(--color-warn)]">
          {aviso}
        </div>
      )}

      <Tarjeta className="mb-4 flex flex-wrap items-center gap-2.5 p-3">
        <Segmentado
          opciones={[
            { valor: "todos", label: "Todos" },
            { valor: "materia_prima", label: "Materia prima" },
            { valor: "herraje", label: "Herrajes" },
            { valor: "consumible", label: "Consumibles" },
          ]}
          valor={tipo}
          onChange={(v) => setTipo(v as typeof tipo)}
        />
        <label className="relative flex-1 min-w-[160px]">
          <Icono
            nombre="buscar"
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
          />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por nombre…"
            className={`${inputClase} pl-8`}
          />
        </label>
        <button
          onClick={() => setSoloBajos((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold ${
            soloBajos
              ? "border-[var(--color-warn)] bg-[var(--color-warn-soft)] text-[var(--color-warn)]"
              : "border-[var(--color-border)] text-[var(--color-muted)]"
          }`}
        >
          <Icono nombre="alerta" size={14} /> Bajo mínimo {bajos > 0 && `(${bajos})`}
        </button>
        <label className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
          <input
            type="checkbox"
            checked={verInactivos}
            onChange={(e) => setVerInactivos(e.target.checked)}
          />
          Ver inactivos
        </label>
      </Tarjeta>

      <Tarjeta className="overflow-hidden">
        {cargando ? (
          <div className="divide-y divide-[var(--color-border)]">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 animate-pulse bg-[var(--color-surface-2)]/40" />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <EstadoVacio
            icono="caja"
            titulo="Sin insumos"
            detalle="Cargá el primero para empezar a armar recetas."
            accion={
              <Boton variante="primario" icono="mas" onClick={() => setModal({})}>
                Nuevo insumo
              </Boton>
            }
          />
        ) : (
          <>
            <div className="hidden border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/40 px-4 py-2 text-[11px] font-semibold uppercase text-[var(--color-muted)] sm:grid sm:grid-cols-[1fr_120px_130px_120px_70px] sm:gap-3">
              <span>Insumo</span>
              <span className="text-right">Stock</span>
              <span className="text-right">Costo compra</span>
              <span className="text-right">Costo consumo</span>
              <span />
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {filtrados.map((i) => (
                <div
                  key={i.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_120px_130px_120px_70px]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-sm font-medium ${!i.activo ? "text-[var(--color-muted)] line-through" : ""}`}>
                        {i.nombre}
                      </span>
                      <Chip color={i.tipo === "consumible" ? "ambar" : i.tipo === "herraje" ? "indigo" : "neutro"}>
                        {NOMBRE_TIPO_INSUMO[i.tipo]}
                      </Chip>
                      {i.bajoMinimo && (
                        <Chip color="rojo">
                          <Icono nombre="alerta" size={11} /> bajo
                        </Chip>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                      compra en {i.unidadCompra} · consume en {i.unidadConsumo}
                      {i.factorCompra !== 1 && ` · 1 ${i.unidadCompra} = ${formatearCantidad(i.factorCompra)} ${i.unidadConsumo}`}
                    </p>
                  </div>
                  <div className="order-2 text-right text-sm font-semibold tabular sm:order-none">
                    {formatearCantidad(i.stock)}
                    <span className="ml-1 text-xs font-normal text-[var(--color-muted)]">{i.unidadConsumo}</span>
                  </div>
                  <div className="hidden text-right text-sm tabular text-[var(--color-muted)] sm:block">
                    {formatearPesos(i.costoUnitario)}
                  </div>
                  <div className="hidden text-right text-sm tabular sm:block">
                    ${" "}
                    {i.costoPorConsumo.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                  </div>
                  <div className="order-1 flex justify-end gap-1 sm:order-none">
                    <button
                      onClick={() => setModal({ insumo: i })}
                      className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                      title="Editar"
                    >
                      <Icono nombre="lapiz" size={15} />
                    </button>
                    <button
                      onClick={() => setBorrar(i)}
                      className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-expense-soft)] hover:text-[var(--color-expense)]"
                      title="Borrar"
                    >
                      <Icono nombre="basura" size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Tarjeta>

      {modal && (
        <InsumoModal
          insumo={modal.insumo}
          onCerrar={() => setModal(null)}
          onGuardado={() => {
            setModal(null);
            cargar();
          }}
        />
      )}
      {borrar && (
        <ConfirmDialog
          titulo="Borrar insumo"
          peligro
          textoConfirmar="Borrar"
          mensaje={
            <>
              Se va a borrar <strong>{borrar.nombre}</strong>. Si está en alguna receta, compra o
              movimiento, en vez de borrarse se <strong>desactiva</strong>.
            </>
          }
          onConfirmar={confirmarBorrado}
          onCerrar={() => setBorrar(null)}
        />
      )}
    </div>
  );
}
