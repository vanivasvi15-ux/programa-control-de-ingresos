import { NextRequest, NextResponse } from "next/server";
import { verificarLogin, crearSesion, COOKIE_NAME } from "@/lib/auth";

// POST /api/auth/login
// body esperado: { usuario: "vani", password: "..." }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { usuario, password } = body;

  if (!usuario || !password) {
    return NextResponse.json({ error: "Faltan usuario o contraseña" }, { status: 400 });
  }

  const usuarioValido = verificarLogin(usuario, password);
  if (!usuarioValido) {
    return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
  }

  const token = crearSesion(usuarioValido.id);

  const res = NextResponse.json({
    nombre: usuarioValido.nombre,
    nombre_usuario: usuarioValido.nombre_usuario,
    rol: usuarioValido.rol,
  });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 días
  });
  return res;
}
