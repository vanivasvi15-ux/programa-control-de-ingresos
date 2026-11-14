"use client";
// components/stock/EscanerCodigo.tsx — caja para escanear (o escribir) un
// código de barras y ver al instante qué es. El lector USB funciona como un
// teclado: escribe el código y aprieta Enter, así que alcanza con tener el
// cursor en la caja.

import { useRef, useState } from "react";
import Link from "next/link";
import Icono from "@/components/Icono";
import { Tarjeta, Chip, inputClase } from "@/components/ui";
import { formatearPesos } from "@/lib/formato";
import { formatearCantidad } from "@/lib/tipos-stock";

type Resultado =
  | {
      tipo: "base";
      id: number;
      nombre: string;
      codigo: string;
      activo: boolean;
      stock: number;
      costo: number | null;
    }
  | {
      tipo: "producto";
      id: number;
      nombre: string;
      codigo: string;
      activo: boolean;
      precio: number;
      costo: number | null;
      armable: boolean;
      faltantes: { nombre: string; faltan: number; unidad: string }[];
      aFabricar: { nombre: string; cantidad: number }[];
    };

export default function EscanerCodigo() {
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [noHay, setNoHay] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function buscar() {
    const codigo = texto.trim();
    if (!codigo) return;
    setBuscando(true);
    setNoHay(null);
    const res = await fetch(`/api/codigos/${encodeURIComponent(codigo)}`);
    setBuscando(false);
    if (res.ok) {
      setResultado(await res.json());
    } else {
      setResultado(null);
      setNoHay(codigo);
    }
    // listo para el próximo escaneo
    setTexto("");
    ref.current?.focus();
  }

  return (
    <Tarjeta className="p-4">
      <label className="block">
        <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase text-[var(--color-muted)]">
          <Icono nombre="escaner" size={14} /> Escanear código
        </span>
        <input
          ref={ref}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && buscar()}
          placeholder="Apuntá el lector a una etiqueta (o escribí el código y Enter)"
          className={`${inputClase} font-mono`}
          disabled={buscando}
          autoComplete="off"
        />
      </label>

      {noHay && (
        <p className="mt-3 text-sm text-[var(--color-warn)]">
          No hay ninguna pieza ni producto con el código <span className="font-mono">{noHay}</span>.
        </p>
      )}

      {resultado && (
        <div className="mt-3 rounded-lg bg-[var(--color-surface-2)]/60 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-bold">{resultado.nombre}</span>
            <Chip color={resultado.tipo === "base" ? "indigo" : "neutro"}>
              {resultado.tipo === "base" ? "Pieza" : "Producto"}
            </Chip>
            <span className="font-mono text-xs text-[var(--color-muted)]">{resultado.codigo}</span>
            {!resultado.activo && <Chip color="rojo">inactivo</Chip>}
          </div>

          {resultado.tipo === "base" ? (
            <p className="mt-1.5 text-sm">
              En stock: <strong className="tabular">{formatearCantidad(resultado.stock)}</strong>
              {resultado.costo != null && (
                <span className="text-[var(--color-muted)]"> · costo {formatearPesos(resultado.costo)}</span>
              )}
            </p>
          ) : (
            <div className="mt-1.5 space-y-1 text-sm">
              <p>
                Precio <strong className="tabular">{formatearPesos(resultado.precio)}</strong>
                {resultado.costo != null && (
                  <span className="text-[var(--color-muted)]"> · costo {formatearPesos(resultado.costo)}</span>
                )}
              </p>
              {resultado.armable ? (
                <Chip color={resultado.aFabricar.length ? "ambar" : "verde"}>
                  {resultado.aFabricar.length ? "se puede armar fabricando antes" : "se puede armar hoy"}
                </Chip>
              ) : (
                <Chip color="rojo">falta material</Chip>
              )}
              {[
                ...resultado.aFabricar.map((a) => `Fabricar ${a.cantidad} × ${a.nombre}`),
                ...resultado.faltantes.map((f) => `Falta ${f.faltan} ${f.unidad} de ${f.nombre}`),
              ].map((t, i) => (
                <p key={i} className="text-xs text-[var(--color-warn)]">
                  • {t}
                </p>
              ))}
            </div>
          )}

          <Link
            href={`${resultado.tipo === "base" ? "/stock/piezas" : "/stock/productos"}?q=${encodeURIComponent(resultado.codigo)}`}
            className="mt-2 inline-block text-xs text-[var(--color-accent)] hover:underline"
          >
            Abrir en {resultado.tipo === "base" ? "Piezas" : "Productos"}
          </Link>
        </div>
      )}
    </Tarjeta>
  );
}
