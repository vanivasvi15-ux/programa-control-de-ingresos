"use client";
// components/stock/VentaModal.tsx — alta / edición de una venta a despachar:
// datos del cliente, envío y renglones (productos vendidos).

import { useState } from "react";
import { Modal, Boton, Campo, inputClase } from "@/components/ui";
import Icono from "@/components/Icono";
import { hoyISO } from "@/lib/formato";
import {
  CANALES_VENTA,
  ENTREGAS,
  NOMBRE_CANAL,
  NOMBRE_ENTREGA,
  type CanalVenta,
  type Entrega,
} from "@/lib/despacho-datos";
import type { Producto, Venta } from "@/lib/tipos-stock";

type LineaEdit = { productoId: number | ""; titulo: string; cantidad: string; precio: string };

export default function VentaModal({
  venta,
  productos,
  fechaInicial,
  onCerrar,
  onGuardado,
}: {
  venta?: Venta;
  productos: Producto[];
  fechaInicial?: string;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const editar = !!venta;
  // Una venta ya despachada ya descontó stock: sus renglones no se tocan.
  const bloqueaItems = !!venta && !["pendiente", "preparado"].includes(venta.estado);

  const [canal, setCanal] = useState<CanalVenta>(venta?.canal ?? "manual");
  const [numeroExterno, setNumeroExterno] = useState(venta?.numeroExterno ?? "");
  const [fecha, setFecha] = useState(venta?.fecha ?? fechaInicial ?? hoyISO());
  const [nombre, setNombre] = useState(venta?.clienteNombre ?? "");
  const [telefono, setTelefono] = useState(venta?.clienteTelefono ?? "");
  const [email, setEmail] = useState(venta?.clienteEmail ?? "");
  const [direccion, setDireccion] = useState(venta?.direccion ?? "");
  const [localidad, setLocalidad] = useState(venta?.localidad ?? "");
  const [provincia, setProvincia] = useState(venta?.provincia ?? "");
  const [cp, setCp] = useState(venta?.codigoPostal ?? "");
  const [entrega, setEntrega] = useState<Entrega>(venta?.entrega ?? "correo");
  const [seguimiento, setSeguimiento] = useState(venta?.seguimiento ?? "");
  const [bultos, setBultos] = useState(String(venta?.bultos ?? 1));
  const [nota, setNota] = useState(venta?.nota ?? "");
  const [lineas, setLineas] = useState<LineaEdit[]>(
    venta
      ? venta.items.map((i) => ({
          productoId: i.productoId ?? "",
          titulo: i.titulo ?? "",
          cantidad: String(i.cantidad),
          precio: String(i.precioUnitario),
        }))
      : [{ productoId: "", titulo: "", cantidad: "1", precio: "" }]
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function setLinea(i: number, patch: Partial<LineaEdit>) {
    setLineas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function elegirProducto(i: number, id: number | "") {
    const p = productos.find((x) => x.id === id);
    setLinea(i, {
      productoId: id,
      // sugerir el precio de lista si todavía no se cargó uno
      ...(p && lineas[i].precio === "" ? { precio: String(p.precio) } : {}),
    });
  }

  async function guardar() {
    setError(null);
    setGuardando(true);
    const body: Record<string, unknown> = {
      canal,
      numeroExterno,
      fecha,
      clienteNombre: nombre,
      clienteTelefono: telefono,
      clienteEmail: email,
      direccion,
      localidad,
      provincia,
      codigoPostal: cp,
      entrega,
      seguimiento,
      bultos: Number(bultos),
      nota,
    };
    if (!bloqueaItems) {
      body.items = lineas
        .filter((l) => l.productoId !== "" || l.titulo.trim())
        .map((l) => ({
          productoId: l.productoId === "" ? null : l.productoId,
          titulo: l.titulo,
          cantidad: Number(l.cantidad),
          precioUnitario: Number(l.precio) || 0,
        }));
    }
    const res = await fetch(editar ? `/api/ventas/${venta!.id}` : "/api/ventas", {
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

  return (
    <Modal
      titulo={editar ? `Editar venta #${venta!.id}` : "Nueva venta"}
      onCerrar={onCerrar}
      ancho="max-w-2xl"
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
      <div className="space-y-5">
        {/* Origen */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Campo label="Canal">
            <select value={canal} onChange={(e) => setCanal(e.target.value as CanalVenta)} className={inputClase}>
              {CANALES_VENTA.map((c) => (
                <option key={c} value={c}>
                  {NOMBRE_CANAL[c]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="N° de orden (opcional)">
            <input value={numeroExterno} onChange={(e) => setNumeroExterno(e.target.value)} className={inputClase} />
          </Campo>
          <Campo label="Fecha de la venta">
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputClase} />
          </Campo>
        </div>

        {/* Cliente */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-muted)]">Cliente</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label="Nombre y apellido">
              <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClase} />
            </Campo>
            <Campo label="Teléfono">
              <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className={inputClase} />
            </Campo>
            <Campo label="Dirección (calle y número)">
              <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className={inputClase} />
            </Campo>
            <Campo label="Email (opcional)">
              <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputClase} />
            </Campo>
            <Campo label="Localidad">
              <input value={localidad} onChange={(e) => setLocalidad(e.target.value)} className={inputClase} />
            </Campo>
            <div className="grid grid-cols-[1fr_110px] gap-3">
              <Campo label="Provincia">
                <input value={provincia} onChange={(e) => setProvincia(e.target.value)} className={inputClase} />
              </Campo>
              <Campo label="C. postal">
                <input value={cp} onChange={(e) => setCp(e.target.value)} className={inputClase} />
              </Campo>
            </div>
          </div>
        </div>

        {/* Envío */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-muted)]">Envío</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Campo label="Forma de entrega">
              <select value={entrega} onChange={(e) => setEntrega(e.target.value as Entrega)} className={inputClase}>
                {ENTREGAS.map((x) => (
                  <option key={x} value={x}>
                    {NOMBRE_ENTREGA[x]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Bultos (etiquetas)" hint="Una etiqueta por bulto">
              <input
                type="number"
                min="1"
                max="50"
                value={bultos}
                onChange={(e) => setBultos(e.target.value)}
                className={inputClase}
              />
            </Campo>
            <Campo label="Seguimiento (opcional)">
              <input value={seguimiento} onChange={(e) => setSeguimiento(e.target.value)} className={inputClase} />
            </Campo>
          </div>
        </div>

        {/* Productos */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-[var(--color-muted)]">Productos vendidos</p>
            {!bloqueaItems && (
              <Boton
                tamano="sm"
                icono="mas"
                onClick={() => setLineas((ls) => [...ls, { productoId: "", titulo: "", cantidad: "1", precio: "" }])}
              >
                Agregar
              </Boton>
            )}
          </div>
          {bloqueaItems && (
            <p className="mb-2 text-xs text-[var(--color-muted)]">
              La venta ya salió: los productos no se pueden cambiar (ya descontaron stock). Podés corregir los
              datos del cliente y el envío.
            </p>
          )}
          <div className="space-y-2">
            {lineas.map((l, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select
                  disabled={bloqueaItems}
                  value={l.productoId}
                  onChange={(e) => elegirProducto(i, e.target.value ? Number(e.target.value) : "")}
                  className={`${inputClase} min-w-[200px] flex-1`}
                >
                  <option value="">Producto…</option>
                  {productos
                    .filter((p) => p.activo || p.id === l.productoId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                </select>
                <input
                  disabled={bloqueaItems}
                  type="number"
                  min="1"
                  value={l.cantidad}
                  onChange={(e) => setLinea(i, { cantidad: e.target.value })}
                  className={`${inputClase} w-20`}
                  aria-label="Cantidad"
                />
                <input
                  disabled={bloqueaItems}
                  type="number"
                  min="0"
                  value={l.precio}
                  onChange={(e) => setLinea(i, { precio: e.target.value })}
                  placeholder="$ c/u"
                  className={`${inputClase} w-28`}
                  aria-label="Precio unitario"
                />
                {l.productoId === "" && (
                  <input
                    disabled={bloqueaItems}
                    value={l.titulo}
                    onChange={(e) => setLinea(i, { titulo: e.target.value })}
                    placeholder="Título (si no está en el catálogo)"
                    className={`${inputClase} w-full`}
                  />
                )}
                {!bloqueaItems && lineas.length > 1 && (
                  <button
                    onClick={() => setLineas((ls) => ls.filter((_, idx) => idx !== i))}
                    className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-expense-soft)] hover:text-[var(--color-expense)]"
                    aria-label="Quitar renglón"
                  >
                    <Icono nombre="x" size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <Campo label="Nota (opcional)" hint="Sale impresa en la etiqueta">
          <input value={nota} onChange={(e) => setNota(e.target.value)} className={inputClase} />
        </Campo>

        {error && <p className="text-sm text-[var(--color-expense)]">{error}</p>}
      </div>
    </Modal>
  );
}
