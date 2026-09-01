import { NextRequest, NextResponse } from "next/server";
import { borrarSesion, COOKIE_NAME } from "@/lib/auth";

// POST /api/auth/logout
export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  borrarSesion(token);

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
