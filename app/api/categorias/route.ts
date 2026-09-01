import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usuarioActual } from "@/lib/auth";

export const dynamic = "force-dynamic";

type CategoriaRow = {
  id: number;
  nombre: string;
  tipo: "ingreso" | "gasto";
  activo: number;
  creado: string;
};

function serializar(c: CategoriaRow) {
  return {
    id: c.id,
    nombre: c.nombre,
    tipo: c.tipo,
    activo: !!c.activo,
    creado: c.creado,
  };
}

// GET /api/categorias -> lista de categorías.
// Filtros opcionales por querystring: ?tipo=ingreso|gasto  ?activo=1|0
export async function GET(req: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo");
  const activo = searchParams.get("activo");

  const condiciones: string[] = [];
  const valores: (string | number)[] = [];

  if (tipo === "ingreso" || tipo === "gasto") {
    condiciones.push("tipo = ?");
    valores.push(tipo);
  }
  if (activo === "0" || activo === "1") {
    condiciones.push("activo = ?");
    valores.push(Number(activo));
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  const filas = db
    .prepare(
      `SELECT id, nombre, tipo, activo, creado FROM categorias ${where} ORDER BY tipo, nombre`
    )
    .all(...valores) as CategoriaRow[];

  return NextResponse.json(filas.map(serializar));
}

// POST /api/categorias -> crea una categoría (sólo dueño).
// body esperado: { nombre: "Nafta", tipo: "gasto" }
// Si ya existe una con ese (nombre, tipo) pero está inactiva, la reactiva.
export async function POST(req: NextRequest) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No hay sesión activa" }, { status: 401 });
  }
  if (usuario.rol !== "dueño") {
    return NextResponse.json(
      { error: "Sólo el dueño puede administrar categorías" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  const tipo = body.tipo;

  if (!nombre) {
    return NextResponse.json({ error: "Falta el nombre de la categoría" }, { status: 400 });
  }
  if (tipo !== "ingreso" && tipo !== "gasto") {
    return NextResponse.json({ error: "El tipo tiene que ser 'ingreso' o 'gasto'" }, { status: 400 });
  }

  const existente = db
    .prepare(`SELECT id, nombre, tipo, activo, creado FROM categorias WHERE nombre = ? AND tipo = ?`)
    .get(nombre, tipo) as CategoriaRow | undefined;

  if (existente) {
    if (existente.activo) {
      return NextResponse.json({ error: "Ya existe una categoría con ese nombre y tipo" }, { status: 409 });
    }
    db.prepare(`UPDATE categorias SET activo = 1 WHERE id = ?`).run(existente.id);
    return NextResponse.json(serializar({ ...existente, activo: 1 }), { status: 200 });
  }

  const resultado = db
    .prepare(`INSERT INTO categorias (nombre, tipo) VALUES (?, ?)`)
    .run(nombre, tipo);

  const creada = db
    .prepare(`SELECT id, nombre, tipo, activo, creado FROM categorias WHERE id = ?`)
    .get(Number(resultado.lastInsertRowid)) as CategoriaRow;

  return NextResponse.json(serializar(creada), { status: 201 });
}
