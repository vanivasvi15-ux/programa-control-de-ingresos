import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { autorizarBridge } from "@/lib/bot-auth";
import { resolverUsuarioPorNumero } from "@/lib/bot-numero";
import { esFechaValida } from "@/lib/movimientos-datos";
import { obtenerMovimiento, serializarMovimiento } from "@/lib/movimientos";

export const dynamic = "force-dynamic";

// Normaliza un texto para comparar nombres de categoría sin depender de
// tildes/mayúsculas.
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// POST /api/bot-whatsapp/movimiento
// Lo llama SÓLO el bot cuando su IA entendió un gasto/ingreso. Si algún
// dato no se puede resolver, devuelve 422 con un "motivo" para que el bot
// escale la conversación (no inventa nada).
//
// body: { numero, tipo, monto, categoriaId?, categoriaNombre?, fecha?, nota? }
export async function POST(req: NextRequest) {
  const { comoBot } = await autorizarBridge(req);
  if (!comoBot) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { numero, tipo, categoriaId, categoriaNombre, nota } = body;

  const usuario = numero ? resolverUsuarioPorNumero(String(numero)) : null;
  if (!usuario || !usuario.puedeCargar) {
    return NextResponse.json(
      { error: "numero_no_habilitado", motivo: "El número no está habilitado para cargar movimientos" },
      { status: 403 }
    );
  }

  if (tipo !== "ingreso" && tipo !== "gasto") {
    return NextResponse.json(
      { error: "tipo_invalido", motivo: "No se entendió si es ingreso o gasto" },
      { status: 422 }
    );
  }

  const monto = Number(body.monto);
  if (!Number.isInteger(monto) || monto <= 0) {
    return NextResponse.json(
      { error: "monto_invalido", motivo: "No se entendió el monto" },
      { status: 422 }
    );
  }

  // Resolver categoría: por id, o por nombre (match exacto normalizado, o
  // que una contenga a la otra) entre las activas del mismo tipo.
  const activas = db
    .prepare(`SELECT id, nombre, tipo FROM categorias WHERE activo = 1 AND tipo = ?`)
    .all(tipo) as { id: number; nombre: string; tipo: string }[];

  let cat: { id: number; nombre: string } | undefined;
  if (Number.isInteger(Number(categoriaId))) {
    cat = activas.find((c) => c.id === Number(categoriaId));
  }
  if (!cat && typeof categoriaNombre === "string" && categoriaNombre.trim()) {
    const n = norm(categoriaNombre);
    cat =
      activas.find((c) => norm(c.nombre) === n) ||
      activas.find((c) => norm(c.nombre).includes(n) || n.includes(norm(c.nombre)));
  }
  if (!cat) {
    return NextResponse.json(
      {
        error: "categoria_no_resuelta",
        motivo: "No se pudo emparejar la categoría",
        categoriasDisponibles: activas.map((c) => c.nombre),
      },
      { status: 422 }
    );
  }

  const ahora = new Date();
  const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(
    ahora.getDate()
  ).padStart(2, "0")}`;
  const fecha = esFechaValida(body.fecha) ? body.fecha : hoy;

  const r = db
    .prepare(
      `INSERT INTO movimientos
         (tipo, monto, categoria_id, fecha, recurrencia, origen, usuario_id, estado, nota)
       VALUES (?, ?, ?, ?, 'unico', 'whatsapp', ?, 'activo', ?)`
    )
    .run(tipo, monto, cat.id, fecha, usuario.id, typeof nota === "string" && nota.trim() ? nota.trim() : null);

  const creado = obtenerMovimiento(Number(r.lastInsertRowid))!;
  return NextResponse.json(
    { movimiento: serializarMovimiento(creado), categoria: cat.nombre, usuario: usuario.nombre },
    { status: 201 }
  );
}
