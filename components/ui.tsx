"use client";
// components/ui.tsx
//
// Piezas de interfaz chicas y reutilizables del panel: tarjeta, botón,
// chip, control segmentado, estado vacío, modal. Todo con las variables
// de color de globals.css (modo claro/oscuro automático).

import { useEffect } from "react";
import Icono from "./Icono";

// ---------- Tarjeta ----------
export function Tarjeta({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

// ---------- Botón ----------
type BotonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primario" | "suave" | "contorno" | "peligro" | "fantasma";
  tamano?: "sm" | "md";
  icono?: React.ComponentProps<typeof Icono>["nombre"];
};

export function Boton({
  variante = "contorno",
  tamano = "md",
  icono,
  className = "",
  children,
  ...props
}: BotonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]";
  const tam = tamano === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm";
  const variantes: Record<string, string> = {
    primario: "bg-[var(--color-accent)] text-white hover:opacity-90",
    suave:
      "bg-[var(--color-surface-2)] text-[var(--color-text)] hover:bg-[var(--color-border)]",
    contorno:
      "border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)]",
    peligro: "bg-[var(--color-expense)] text-white hover:opacity-90",
    fantasma:
      "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]",
  };
  return (
    <button className={`${base} ${tam} ${variantes[variante]} ${className}`} {...props}>
      {icono && <Icono nombre={icono} size={tamano === "sm" ? 15 : 17} />}
      {children}
    </button>
  );
}

// ---------- Chip / etiqueta ----------
export function Chip({
  color = "neutro",
  children,
}: {
  color?: "neutro" | "verde" | "rojo" | "ambar" | "indigo";
  children: React.ReactNode;
}) {
  const colores: Record<string, string> = {
    neutro: "bg-[var(--color-surface-2)] text-[var(--color-muted)]",
    verde: "bg-[var(--color-income-soft)] text-[var(--color-income)]",
    rojo: "bg-[var(--color-expense-soft)] text-[var(--color-expense)]",
    ambar: "bg-[var(--color-warn-soft)] text-[var(--color-warn)]",
    indigo: "bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold ${colores[color]}`}
    >
      {children}
    </span>
  );
}

// ---------- Control segmentado ----------
export function Segmentado<T extends string>({
  opciones,
  valor,
  onChange,
  className = "",
}: {
  opciones: { valor: T; label: string }[];
  valor: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-0.5 ${className}`}
    >
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onChange(o.valor)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            valor === o.valor
              ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm"
              : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Estado vacío ----------
export function EstadoVacio({
  icono = "billete",
  titulo,
  detalle,
  accion,
}: {
  icono?: React.ComponentProps<typeof Icono>["nombre"];
  titulo: string;
  detalle?: string;
  accion?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-muted)]">
        <Icono nombre={icono} size={22} />
      </div>
      <p className="font-semibold">{titulo}</p>
      {detalle && <p className="max-w-xs text-sm text-[var(--color-muted)]">{detalle}</p>}
      {accion && <div className="mt-2">{accion}</div>}
    </div>
  );
}

// ---------- Modal ----------
export function Modal({
  titulo,
  onCerrar,
  children,
  footer,
  ancho = "max-w-lg",
}: {
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  ancho?: string;
}) {
  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/45" onClick={onCerrar} />
      <div
        className={`relative aparecer flex max-h-[92vh] w-full ${ancho} flex-col overflow-hidden rounded-t-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl sm:rounded-2xl`}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5">
          <h2 className="text-sm font-bold">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
          >
            <Icono nombre="x" size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/40 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Campo de formulario ----------
export function Campo({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[var(--color-muted)]">{hint}</span>}
    </label>
  );
}

export const inputClase =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20";
