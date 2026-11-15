// lib/generador.ts
//
// Generador de kits (parte que toca la base): con el plan de
// lib/generador-datos.ts crea los materiales que falten, las piezas con su
// receta y los kits con su composición. No pisa nada: lo que ya existe con
// el mismo nombre se deja como está. Con aplicar = false sólo cuenta qué
// haría (vista previa).
//
// Regla de la casa: los módulos que importan @/lib/db son sólo de servidor.

import { db, transaccion } from "./db";
import { asegurarCodigo, recalcularCostos } from "./stock";
import {
  ROLES,
  planificar,
  rolesUsados,
  type Rol,
  type Seleccion,
} from "./generador-datos";

export type EleccionMaterial = number | null | undefined; // id de un insumo existente, o vacío = el de nombre por defecto / crear

export type ResumenGenerador = {
  aplicado: boolean;
  errores: string[];
  materiales: { rol: Rol; nombre: string; estado: "existente" | "elegido" | "se_crea" | "creado" }[];
  piezasNuevas: string[];
  piezasExistentes: string[];
  kitsNuevos: string[];
  kitsExistentes: string[];
  // Ejemplos con la lista de lo que lleva (para revisar antes de crear).
  ejemplos: { nombre: string; lineas: { texto: string; cantidad: number }[] }[];
};

type Resuelto = { id: number | null; nombre: string; estado: ResumenGenerador["materiales"][number]["estado"] };

function buscarInsumoPorNombre(nombre: string): { id: number; nombre: string } | undefined {
  return db
    .prepare(`SELECT id, nombre FROM insumos WHERE lower(nombre) = lower(?)`)
    .get(nombre) as { id: number; nombre: string } | undefined;
}

export function generarKits(args: {
  selecciones: Seleccion[];
  materiales: Partial<Record<Rol, EleccionMaterial>>;
  aplicar: boolean;
}): ResumenGenerador {
  const plan = planificar(args.selecciones);
  const resumen: ResumenGenerador = {
    aplicado: false,
    errores: [...plan.errores],
    materiales: [],
    piezasNuevas: [],
    piezasExistentes: [],
    kitsNuevos: [],
    kitsExistentes: [],
    ejemplos: [],
  };
  if (plan.kits.length === 0) return resumen;

  const hacer = () => {
    // 1) Materiales: el que eligió el dueño, el que ya tiene el nombre por
    //    defecto, o uno nuevo.
    const insumoDeRol = new Map<Rol, Resuelto>();
    for (const rol of rolesUsados(plan)) {
      const elegido = args.materiales[rol];
      if (typeof elegido === "number") {
        const fila = db.prepare(`SELECT id, nombre FROM insumos WHERE id = ?`).get(elegido) as
          | { id: number; nombre: string }
          | undefined;
        if (!fila) throw new Error(`El material elegido para "${ROLES[rol].nombre}" ya no existe`);
        insumoDeRol.set(rol, { id: fila.id, nombre: fila.nombre, estado: "elegido" });
        continue;
      }
      const def = ROLES[rol];
      const existente = buscarInsumoPorNombre(def.nombre);
      if (existente) {
        insumoDeRol.set(rol, { id: existente.id, nombre: existente.nombre, estado: "existente" });
      } else if (args.aplicar) {
        const r = db
          .prepare(
            `INSERT INTO insumos (nombre, tipo, unidad_compra, unidad_consumo, factor_compra, costo_unitario, nota)
             VALUES (?, ?, ?, ?, ?, 0, 'Creado por el generador de kits: cargá el precio en Compras.')`
          )
          .run(def.nombre, def.tipo, def.unidadCompra, def.unidadConsumo, def.factor);
        insumoDeRol.set(rol, { id: Number(r.lastInsertRowid), nombre: def.nombre, estado: "creado" });
      } else {
        insumoDeRol.set(rol, { id: null, nombre: def.nombre, estado: "se_crea" });
      }
    }
    resumen.materiales = [...insumoDeRol].map(([rol, r]) => ({ rol, nombre: r.nombre, estado: r.estado }));

    // 2) Piezas con su receta.
    const piezaId = new Map<string, number | null>();
    for (const p of plan.piezas) {
      const existe = db.prepare(`SELECT id FROM productos_base WHERE nombre = ?`).get(p.nombre) as
        | { id: number }
        | undefined;
      if (existe) {
        resumen.piezasExistentes.push(p.nombre);
        piezaId.set(p.nombre, existe.id);
        continue;
      }
      resumen.piezasNuevas.push(p.nombre);
      if (!args.aplicar) {
        piezaId.set(p.nombre, null);
        continue;
      }
      const r = db
        .prepare(`INSERT INTO productos_base (nombre, nota) VALUES (?, ?)`)
        .run(p.nombre, p.nota);
      const id = Number(r.lastInsertRowid);
      asegurarCodigo("base", id);
      for (const l of p.receta) {
        db.prepare(
          `INSERT INTO receta_base (producto_base_id, insumo_id, cantidad, bloqueante) VALUES (?, ?, ?, 1)`
        ).run(id, insumoDeRol.get(l.rol)!.id, l.cantidad);
      }
      piezaId.set(p.nombre, id);
    }

    // 3) Kits con su composición.
    for (const k of plan.kits) {
      const existe = db.prepare(`SELECT id FROM productos WHERE nombre = ?`).get(k.nombre);
      if (existe) {
        resumen.kitsExistentes.push(k.nombre);
        continue;
      }
      resumen.kitsNuevos.push(k.nombre);
      if (!args.aplicar) continue;
      const r = db.prepare(`INSERT INTO productos (nombre, nota) VALUES (?, ?)`).run(k.nombre, k.nota);
      const id = Number(r.lastInsertRowid);
      asegurarCodigo("producto", id);
      for (const l of k.composicion) {
        if (l.tipo === "base") {
          db.prepare(
            `INSERT INTO composicion_producto (producto_id, item_tipo, item_id, cantidad) VALUES (?, 'base', ?, ?)`
          ).run(id, piezaId.get(l.pieza)!, l.cantidad);
        } else {
          db.prepare(
            `INSERT INTO composicion_producto (producto_id, item_tipo, item_id, cantidad) VALUES (?, 'insumo', ?, ?)`
          ).run(id, insumoDeRol.get(l.rol)!.id, l.cantidad);
        }
      }
    }

    // 4) Ejemplos para revisar (los primeros kits del plan).
    resumen.ejemplos = plan.kits.slice(0, 3).map((k) => ({
      nombre: k.nombre,
      lineas: k.composicion.map((l) =>
        l.tipo === "base"
          ? { texto: l.pieza, cantidad: l.cantidad }
          : { texto: insumoDeRol.get(l.rol)!.nombre, cantidad: l.cantidad }
      ),
    }));

    if (args.aplicar) {
      recalcularCostos();
      resumen.aplicado = true;
    }
  };

  if (args.aplicar) transaccion(hacer);
  else hacer();
  return resumen;
}
