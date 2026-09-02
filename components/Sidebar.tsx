"use client";
// components/Sidebar.tsx
//
// Barra lateral de navegación del panel /dinero. La usa SidebarLayout,
// tanto en la versión fija de escritorio como en el cajón (drawer) del
// celular.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Icono from "./Icono";
import type { Rol } from "@/lib/auth";

type Item = {
  href: string;
  label: string;
  icono: React.ComponentProps<typeof Icono>["nombre"];
  soloDueno?: boolean;
};

const ITEMS: Item[] = [
  { href: "/dinero", label: "Panel", icono: "panel" },
  { href: "/dinero/movimientos", label: "Movimientos", icono: "movimientos" },
  { href: "/dinero/fijos", label: "Fijos", icono: "fijos" },
  { href: "/dinero/configuracion", label: "Configuración", icono: "config", soloDueno: true },
];

export default function Sidebar({
  usuario,
  colapsado = false,
  onNavegar,
}: {
  usuario: { nombre: string; rol: Rol };
  colapsado?: boolean;
  onNavegar?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    setSaliendo(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const items = ITEMS.filter((i) => !i.soloDueno || usuario.rol === "dueño");
  const inicial = usuario.nombre.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex h-full flex-col bg-[var(--color-surface)]">
      {/* Marca */}
      <div
        className={`flex items-center gap-2.5 border-b border-[var(--color-border)] px-4 ${
          colapsado ? "justify-center" : ""
        }`}
        style={{ height: 60 }}
      >
        <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-[var(--color-accent)] text-sm font-bold text-white">
          V
        </span>
        {!colapsado && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold">Herrería VyV</p>
            <p className="truncate text-[11px] text-[var(--color-muted)]">Control de caja</p>
          </div>
        )}
      </div>

      {/* Navegación */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const activo =
            pathname === item.href ||
            (item.href !== "/dinero" && pathname?.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavegar}
              title={colapsado ? item.label : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                colapsado ? "justify-center" : ""
              } ${
                activo
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
              }`}
            >
              <Icono nombre={item.icono} size={19} />
              {!colapsado && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Usuario + salir */}
      <div className="border-t border-[var(--color-border)] p-3">
        <div
          className={`mb-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${
            colapsado ? "justify-center" : ""
          }`}
        >
          <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-xs font-bold">
            {inicial}
          </span>
          {!colapsado && (
            <div className="min-w-0 leading-tight">
              <p className="truncate text-xs font-semibold">{usuario.nombre}</p>
              <p className="truncate text-[11px] capitalize text-[var(--color-muted)]">
                {usuario.rol}
              </p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={salir}
          disabled={saliendo}
          title="Cerrar sesión"
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] disabled:opacity-50 ${
            colapsado ? "justify-center" : ""
          }`}
        >
          <Icono nombre="salir" size={18} />
          {!colapsado && <span>{saliendo ? "Saliendo…" : "Cerrar sesión"}</span>}
        </button>
      </div>
    </div>
  );
}
