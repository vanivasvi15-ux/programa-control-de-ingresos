"use client";
// components/SidebarLayout.tsx
//
// Cascarón del panel /dinero:
// - Escritorio (lg+): barra lateral fija, colapsable a una tira de íconos.
//   El estado (abierta/colapsada) se recuerda en este navegador.
// - Celular: barra superior con botón de menú que abre la barra como
//   cajón (drawer) sobre el contenido.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Icono from "./Icono";
import type { Rol } from "@/lib/auth";

const CLAVE = "vyv-sidebar-colapsado";

export default function SidebarLayout({
  usuario,
  children,
}: {
  usuario: { nombre: string; rol: Rol };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [colapsado, setColapsado] = useState(false);
  const [drawerAbierto, setDrawerAbierto] = useState(false);

  useEffect(() => {
    setColapsado(localStorage.getItem(CLAVE) === "true");
  }, []);

  useEffect(() => {
    setDrawerAbierto(false);
  }, [pathname]);

  function alternarColapso() {
    setColapsado((v) => {
      localStorage.setItem(CLAVE, String(!v));
      return !v;
    });
  }

  return (
    <div className="min-h-screen">
      {/* --- Barra lateral fija (escritorio) --- */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden border-r border-[var(--color-border)] transition-[width] duration-200 lg:block ${
          colapsado ? "w-[68px]" : "w-60"
        }`}
      >
        <Sidebar usuario={usuario} colapsado={colapsado} />
        <button
          type="button"
          onClick={alternarColapso}
          title={colapsado ? "Expandir" : "Colapsar"}
          className="absolute -right-3 top-16 grid h-6 w-6 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] shadow-sm hover:text-[var(--color-text)]"
        >
          <Icono nombre={colapsado ? "chevron-der" : "chevron-izq"} size={14} />
        </button>
      </aside>

      {/* --- Cajón (celular) --- */}
      {drawerAbierto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerAbierto(false)} />
          <div className="absolute inset-y-0 left-0 w-64 border-r border-[var(--color-border)] shadow-xl aparecer">
            <Sidebar usuario={usuario} onNavegar={() => setDrawerAbierto(false)} />
          </div>
        </div>
      )}

      {/* --- Contenido --- */}
      <div className={`transition-[padding] duration-200 ${colapsado ? "lg:pl-[68px]" : "lg:pl-60"}`}>
        {/* Barra superior sólo en celular */}
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerAbierto(true)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--color-border)] text-[var(--color-muted)]"
          >
            <Icono nombre="menu" size={18} />
          </button>
          <span className="text-sm font-bold">Herrería VyV</span>
        </div>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
