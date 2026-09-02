"use client";
// app/dinero/configuracion/page.tsx — sólo para el dueño.

import { useState } from "react";
import Encabezado from "@/components/Encabezado";
import { Tarjeta } from "@/components/ui";
import { useUsuario } from "@/components/UsuarioContext";
import CategoriasPanel from "@/components/config/CategoriasPanel";
import AlertasPanel from "@/components/config/AlertasPanel";
import UsuariosPanel from "@/components/config/UsuariosPanel";

const TABS = [
  { id: "categorias", label: "Categorías" },
  { id: "alertas", label: "Alertas y límites" },
  { id: "usuarios", label: "Usuarios" },
] as const;

export default function ConfiguracionPage() {
  const usuario = useUsuario();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("categorias");

  if (usuario.rol !== "dueño") {
    return (
      <div>
        <Encabezado titulo="Configuración" />
        <Tarjeta className="p-8 text-center text-sm text-[var(--color-muted)]">
          Esta sección es sólo para el dueño.
        </Tarjeta>
      </div>
    );
  }

  return (
    <div>
      <Encabezado titulo="Configuración" subtitulo="Categorías, alertas y personal" />

      <div className="mb-5 flex gap-1 border-b border-[var(--color-border)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-[var(--color-accent)] text-[var(--color-text)]"
                : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "categorias" && <CategoriasPanel />}
      {tab === "alertas" && <AlertasPanel />}
      {tab === "usuarios" && <UsuariosPanel />}
    </div>
  );
}
