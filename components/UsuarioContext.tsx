"use client";
// components/UsuarioContext.tsx
//
// Deja disponible el usuario logueado (id, nombre, rol) a cualquier
// pantalla del panel sin volver a pedirlo a la API. Lo provee
// SidebarLayout con los datos que ya resolvió el layout del servidor.

import { createContext, useContext } from "react";
import type { Rol } from "@/lib/auth";

export type UsuarioActual = {
  id: number;
  nombre: string;
  nombreUsuario: string;
  rol: Rol;
};

const Ctx = createContext<UsuarioActual | null>(null);

export function ProveedorUsuario({
  usuario,
  children,
}: {
  usuario: UsuarioActual;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={usuario}>{children}</Ctx.Provider>;
}

export function useUsuario(): UsuarioActual {
  const u = useContext(Ctx);
  if (!u) throw new Error("useUsuario fuera de ProveedorUsuario");
  return u;
}

export const esDueno = (rol: Rol) => rol === "dueño";
export const puedeEscribir = (rol: Rol) => rol !== "contador";
