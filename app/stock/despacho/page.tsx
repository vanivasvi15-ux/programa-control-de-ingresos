"use client";
// app/stock/despacho/page.tsx — lista de despacho del día: qué se vendió,
// a quién, qué hay que armar, y las etiquetas de los paquetes.

import { useCallback, useEffect, useMemo, useState } from "react";
import Encabezado from "@/components/Encabezado";
import Ayuda, { Ejemplo } from "@/components/Ayuda";
import Icono from "@/components/Icono";
import { Tarjeta, Boton, Chip, EstadoVacio } from "@/components/ui";
import ConfirmDialog from "@/components/ConfirmDialog";
import VentaModal from "@/components/stock/VentaModal";
import { formatearFecha, formatearFechaCorta, formatearPesos, hoyISO } from "@/lib/formato";
import { NOMBRE_CANAL, NOMBRE_ENTREGA, direccionCompleta } from "@/lib/despacho-datos";
import type { Producto, Venta } from "@/lib/tipos-stock";

function sumarDias(iso: string, n: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const f = new Date(a, m - 1, d + n);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}

const abierta = (v: Venta) => v.estado === "pendiente" || v.estado === "preparado";

function abrirEtiquetas(ids: number[]) {
  if (ids.length === 0) return;
  window.open(`/etiquetas?ids=${ids.join(",")}`, "_blank");
}

export default function DespachoPage() {
  const [fecha, setFecha] = useState(hoyISO());
  const [delDia, setDelDia] = useState<Venta[]>([]);
  const [atrasadas, setAtrasadas] = useState<Venta[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);

  const [modal, setModal] = useState<null | { venta?: Venta }>(null);
  const [borrar, setBorrar] = useState<Venta | null>(null);
  const [sinStock, setSinStock] = useState<null | { venta: Venta; faltan: { nombre: string; faltan: number; unidad: string }[] }>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const [rd, ra, rp] = await Promise.all([
      fetch(`/api/ventas?fecha=${fecha}`),
      fetch(`/api/ventas?abiertas=1&hasta=${sumarDias(fecha, -1)}`),
      fetch("/api/productos"),
    ]);
    if (rd.ok) setDelDia(await rd.json());
    if (ra.ok) setAtrasadas(await ra.json());
    if (rp.ok) setProductos(await rp.json());
    setCargando(false);
  }, [fecha]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function mostrarAviso(tipo: "ok" | "error", texto: string) {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 4500);
  }

  async function cambiarEstado(v: Venta, estado: string, descontarStock = true) {
    const res = await fetch(`/api/ventas/${v.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado, descontarStock }),
    });
    if (res.status === 422) {
      const d = await res.json().catch(() => ({}));
      setSinStock({ venta: v, faltan: d.faltan ?? [] });
      return;
    }
    if (!res.ok) {
      mostrarAviso("error", (await res.json().catch(() => ({}))).error ?? "No se pudo cambiar el estado");
    } else if (estado === "despachado") {
      mostrarAviso("ok", descontarStock ? "Despachada. Stock descontado." : "Despachada (sin tocar el stock).");
    }
    cargar();
  }

  async function confirmarBorrado() {
    if (!borrar) return;
    await fetch(`/api/ventas/${borrar.id}`, { method: "DELETE" });
    setBorrar(null);
    cargar();
  }

  const porDespachar = useMemo(() => delDia.filter(abierta), [delDia]);
  const despachadas = useMemo(() => delDia.filter((v) => v.estado === "despachado"), [delDia]);
  const anuladas = useMemo(() => delDia.filter((v) => v.estado === "anulado"), [delDia]);
  const bultosPendientes = [...atrasadas, ...porDespachar].reduce((s, v) => s + v.bultos, 0);
  const esHoy = fecha === hoyISO();

  return (
    <div className="space-y-5">
      <Encabezado
        titulo="Despacho"
        subtitulo="Lo vendido del día para armar, etiquetar y enviar"
        acciones={
          <>
            <Boton
              icono="impresora"
              onClick={() => abrirEtiquetas([...atrasadas, ...porDespachar].map((v) => v.id))}
              disabled={atrasadas.length + porDespachar.length === 0}
            >
              Etiquetas pendientes ({bultosPendientes})
            </Boton>
            <Boton variante="primario" icono="mas" onClick={() => setModal({})}>
              Nueva venta
            </Boton>
          </>
        }
      />

      <Ayuda>
        <p>
          Es <strong>la lista de lo que hay que enviar</strong>. Cada tarjeta es <strong>una venta</strong>, con los datos
          del cliente, la forma de entrega y qué productos lleva. Cargás las ventas con «Nueva venta» (después se van a
          sumar solas las de Mercado Libre y la tienda).
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Preparada</strong>: ya la armaste (sólo es una marca para organizarse).{" "}
            <strong>Despachar</strong>: la venta sale y el sistema <strong>descuenta del stock</strong> lo que lleva.{" "}
            <strong>Deshacer</strong>: la vuelve a «por despachar» y devuelve el stock.
          </li>
          <li>
            La <strong>impresora</strong> imprime la etiqueta del paquete (10 × 15 cm), una por bulto. «Etiquetas
            pendientes» las imprime todas juntas.
          </li>
          <li>
            El aviso de color dice si <strong>se puede armar hoy</strong>: «stock ok», «hay que fabricar» (y qué) o «falta
            material». <strong>Atrasadas</strong> son ventas de días anteriores que todavía no salieron.
          </li>
        </ul>
        <Ejemplo>
          Vendiste un kit a María (Córdoba). Lo marcás «Preparada», imprimís la etiqueta, la pegás en la caja y apretás
          «Despachar»: bajan del stock las piezas del kit y la venta pasa a «Despachadas».
        </Ejemplo>
      </Ayuda>

      {/* Navegador de día */}
      <Tarjeta className="flex flex-wrap items-center gap-2 p-3">
        <button
          onClick={() => setFecha(sumarDias(fecha, -1))}
          className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]"
          aria-label="Día anterior"
        >
          <Icono nombre="chevron-izq" size={16} />
        </button>
        <input
          type="date"
          value={fecha}
          onChange={(e) => e.target.value && setFecha(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
        <button
          onClick={() => setFecha(sumarDias(fecha, 1))}
          className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]"
          aria-label="Día siguiente"
        >
          <Icono nombre="chevron-der" size={16} />
        </button>
        {!esHoy && (
          <Boton tamano="sm" variante="suave" onClick={() => setFecha(hoyISO())}>
            Hoy
          </Boton>
        )}
        <span className="ml-1 text-sm font-medium">{formatearFechaCorta(fecha)}</span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Chip color="ambar">{porDespachar.length} por despachar</Chip>
          <Chip color="verde">{despachadas.length} despachadas</Chip>
          {atrasadas.length > 0 && <Chip color="rojo">{atrasadas.length} atrasadas</Chip>}
        </div>
      </Tarjeta>

      {aviso && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            aviso.tipo === "ok"
              ? "border-[var(--color-income)]/40 bg-[var(--color-income-soft)] text-[var(--color-income)]"
              : "border-[var(--color-expense)]/40 bg-[var(--color-expense-soft)] text-[var(--color-expense)]"
          }`}
        >
          {aviso.texto}
        </div>
      )}

      {cargando ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-[var(--color-surface-2)]/40" />
          ))}
        </div>
      ) : (
        <>
          {atrasadas.length > 0 && (
            <Seccion titulo="Atrasadas (de días anteriores)" tono="rojo">
              {atrasadas.map((v) => (
                <VentaTarjeta key={v.id} v={v} mostrarFecha {...{ setModal, setBorrar, cambiarEstado }} />
              ))}
            </Seccion>
          )}

          <Seccion titulo={`Por despachar · ${formatearFecha(fecha)}`}>
            {porDespachar.length === 0 ? (
              <Tarjeta>
                <EstadoVacio
                  icono="camion"
                  titulo="Nada para despachar"
                  detalle={delDia.length === 0 ? "No hay ventas cargadas para este día." : "Todo lo de este día ya salió."}
                  accion={
                    <Boton variante="primario" icono="mas" onClick={() => setModal({})}>
                      Nueva venta
                    </Boton>
                  }
                />
              </Tarjeta>
            ) : (
              porDespachar.map((v) => (
                <VentaTarjeta key={v.id} v={v} {...{ setModal, setBorrar, cambiarEstado }} />
              ))
            )}
          </Seccion>

          {despachadas.length > 0 && (
            <Seccion titulo="Despachadas" tono="verde">
              {despachadas.map((v) => (
                <VentaTarjeta key={v.id} v={v} {...{ setModal, setBorrar, cambiarEstado }} />
              ))}
            </Seccion>
          )}

          {anuladas.length > 0 && (
            <Seccion titulo="Anuladas">
              {anuladas.map((v) => (
                <VentaTarjeta key={v.id} v={v} {...{ setModal, setBorrar, cambiarEstado }} />
              ))}
            </Seccion>
          )}
        </>
      )}

      {modal && (
        <VentaModal
          venta={modal.venta}
          productos={productos}
          fechaInicial={fecha}
          onCerrar={() => setModal(null)}
          onGuardado={() => {
            setModal(null);
            cargar();
          }}
        />
      )}
      {borrar && (
        <ConfirmDialog
          titulo={abierta(borrar) ? "Borrar venta" : "Anular venta"}
          peligro
          textoConfirmar={abierta(borrar) ? "Borrar" : "Anular"}
          mensaje={
            abierta(borrar) ? (
              <>
                Se borra la venta de <strong>{borrar.clienteNombre}</strong>. Todavía no movió stock.
              </>
            ) : (
              <>
                Se anula la venta de <strong>{borrar.clienteNombre}</strong>
                {borrar.stockDescontado && " y se devuelve el stock que había descontado"}.
              </>
            )
          }
          onConfirmar={confirmarBorrado}
          onCerrar={() => setBorrar(null)}
        />
      )}
      {sinStock && (
        <ConfirmDialog
          titulo="No hay stock registrado"
          textoConfirmar="Despachar igual"
          mensaje={
            <div className="space-y-2">
              <p>Según el sistema falta:</p>
              <ul className="list-disc space-y-0.5 pl-5 text-sm">
                {sinStock.faltan.map((f, i) => (
                  <li key={i}>
                    {f.faltan} {f.unidad} de <strong>{f.nombre}</strong>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-[var(--color-muted)]">
                Si en realidad lo tenés, podés despachar igual: la venta sale y el stock no se toca.
              </p>
            </div>
          }
          onConfirmar={async () => {
            const { venta } = sinStock;
            setSinStock(null);
            await cambiarEstado(venta, "despachado", false);
          }}
          onCerrar={() => setSinStock(null)}
        />
      )}
    </div>
  );
}

function Seccion({
  titulo,
  tono,
  children,
}: {
  titulo: string;
  tono?: "rojo" | "verde";
  children: React.ReactNode;
}) {
  const color =
    tono === "rojo"
      ? "text-[var(--color-expense)]"
      : tono === "verde"
        ? "text-[var(--color-income)]"
        : "text-[var(--color-muted)]";
  return (
    <section className="space-y-3">
      <h2 className={`text-xs font-bold uppercase tracking-wide ${color}`}>{titulo}</h2>
      {children}
    </section>
  );
}

function VentaTarjeta({
  v,
  mostrarFecha,
  setModal,
  setBorrar,
  cambiarEstado,
}: {
  v: Venta;
  mostrarFecha?: boolean;
  setModal: (m: { venta?: Venta }) => void;
  setBorrar: (v: Venta) => void;
  cambiarEstado: (v: Venta, estado: string) => void;
}) {
  const dir = direccionCompleta(v);
  const total = v.items.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0);

  return (
    <Tarjeta className={`p-4 ${v.estado === "anulado" ? "opacity-60" : ""}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-bold">{v.clienteNombre}</span>
            <Chip color={v.canal === "mercadolibre" ? "ambar" : "neutro"}>{NOMBRE_CANAL[v.canal]}</Chip>
            {v.numeroExterno && <Chip>#{v.numeroExterno}</Chip>}
            {v.estado === "preparado" && <Chip color="indigo">preparada</Chip>}
            {v.estado === "despachado" && (
              <Chip color="verde">
                <Icono nombre="check" size={11} /> despachada
              </Chip>
            )}
            {v.estado === "anulado" && <Chip color="rojo">anulada</Chip>}
            {mostrarFecha && <Chip color="rojo">del {formatearFecha(v.fecha)}</Chip>}
            {v.estadoStock === "listo" && <Chip color="verde">stock ok</Chip>}
            {v.estadoStock === "fabricar" && <Chip color="ambar">hay que fabricar</Chip>}
            {v.estadoStock === "faltan" && (
              <Chip color="rojo">
                <Icono nombre="alerta" size={11} /> falta material
              </Chip>
            )}
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            {NOMBRE_ENTREGA[v.entrega]}
            {dir && ` · ${dir}`}
          </p>
          <p className="text-xs text-[var(--color-muted)]">
            {v.clienteTelefono && `Tel. ${v.clienteTelefono}`}
            {v.clienteTelefono && v.clienteEmail && " · "}
            {v.clienteEmail}
            {v.seguimiento && ` · Seguimiento ${v.seguimiento}`}
            {v.bultos > 1 && ` · ${v.bultos} bultos`}
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
          {abierta(v) && (
            <>
              {v.estado === "pendiente" ? (
                <Boton tamano="sm" variante="suave" icono="check" onClick={() => cambiarEstado(v, "preparado")}>
                  Preparada
                </Boton>
              ) : (
                <Boton tamano="sm" variante="suave" onClick={() => cambiarEstado(v, "pendiente")}>
                  Desmarcar
                </Boton>
              )}
              <Boton tamano="sm" variante="primario" icono="camion" onClick={() => cambiarEstado(v, "despachado")}>
                Despachar
              </Boton>
            </>
          )}
          {v.estado === "despachado" && (
            <Boton tamano="sm" variante="contorno" onClick={() => cambiarEstado(v, "pendiente")}>
              Deshacer
            </Boton>
          )}
          {v.estado === "anulado" && (
            <Boton tamano="sm" variante="contorno" onClick={() => cambiarEstado(v, "pendiente")}>
              Reabrir
            </Boton>
          )}
          {v.estado !== "anulado" && (
            <button
              onClick={() => abrirEtiquetas([v.id])}
              className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
              title={`Imprimir etiqueta${v.bultos > 1 ? "s" : ""}`}
            >
              <Icono nombre="impresora" size={15} />
            </button>
          )}
          <button
            onClick={() => setModal({ venta: v })}
            className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
            title="Editar"
          >
            <Icono nombre="lapiz" size={15} />
          </button>
          <button
            onClick={() => setBorrar(v)}
            className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-expense-soft)] hover:text-[var(--color-expense)]"
            title={abierta(v) ? "Borrar" : "Anular"}
          >
            <Icono nombre="basura" size={15} />
          </button>
        </div>
      </div>

      <div className="mt-3 divide-y divide-[var(--color-border)] rounded-lg bg-[var(--color-surface-2)]/50 px-3">
        {v.items.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
            <span>
              <strong className="tabular">{i.cantidad} ×</strong> {i.productoNombre ?? i.titulo}
            </span>
            {i.precioUnitario > 0 && (
              <span className="tabular text-xs text-[var(--color-muted)]">{formatearPesos(i.cantidad * i.precioUnitario)}</span>
            )}
          </div>
        ))}
        {total > 0 && (
          <div className="flex justify-between py-1.5 text-xs font-semibold">
            <span>Total</span>
            <span className="tabular">{formatearPesos(total)}</span>
          </div>
        )}
      </div>

      {v.detalleStock.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-[var(--color-warn)]">
          {v.detalleStock.map((d, i) => (
            <li key={i}>• {d}</li>
          ))}
        </ul>
      )}
      {v.nota && <p className="mt-2 text-xs text-[var(--color-muted)]">Nota: {v.nota}</p>}
    </Tarjeta>
  );
}
