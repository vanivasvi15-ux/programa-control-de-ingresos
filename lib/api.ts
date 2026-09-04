// lib/api.ts
//
// Ayudantes chicos para las API Routes de la Fase 2. La Fase 1 resuelve los
// permisos inline en cada endpoint; acá se junta ese preámbulo (sesión +
// rol) en una función para no repetirlo en las ~20 rutas de stock.

import { NextResponse } from "next/server";
import { usuarioActual, type Usuario } from "./auth";

// Corre `handler` sólo si hay sesión. Con `{ escritura: true }` además
// rechaza al rol "contador" (sólo lectura). Cualquier otro rol
// (dueño, encargado) puede todo en /stock — sin separación por área,
// según lo definido con el dueño.
export async function conUsuario(
  handler: (usuario: Usuario) => Promise<NextResponse> | NextResponse,
  opts: { escritura?: boolean } = {}
): Promise<NextResponse> {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
  }
  if (opts.escritura && usuario.rol === "contador") {
    return NextResponse.json({ error: "El rol contador es de sólo lectura" }, { status: 403 });
  }
  return handler(usuario);
}

// Lee y parsea el body JSON; si viene vacío o roto devuelve {}.
export async function leerBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function errorJson(mensaje: string, status = 400): NextResponse {
  return NextResponse.json({ error: mensaje }, { status });
}
