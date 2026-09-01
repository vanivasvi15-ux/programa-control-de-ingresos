import { NextResponse } from "next/server";
import { usuarioActual } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/auth/me -> quién es el usuario de la sesión actual (o 401)
export async function GET() {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
  }
  return NextResponse.json(usuario);
}
