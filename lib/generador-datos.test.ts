import { test } from "node:test";
import assert from "node:assert/strict";
import { agujerosRiel, planificar, partesPlegado, rolesUsados, type LineaKit } from "./generador-datos.ts";

const cant = (l: LineaKit[], buscar: (x: LineaKit) => boolean) => l.find(buscar)?.cantidad;

test("agujeros de los rieles según lo dicho por el dueño", () => {
  assert.equal(agujerosRiel("comun", 120, false), 3);
  assert.equal(agujerosRiel("comun", 160, false), 4);
  assert.equal(agujerosRiel("comun", 160, true), 6);
  assert.equal(agujerosRiel("comun", 180, false), 5);
  assert.equal(agujerosRiel("comun", 260, true), 6);
  assert.equal(agujerosRiel("comun", 300, true), 8);
  assert.equal(agujerosRiel("comun", 360, true), 9);
  assert.equal(agujerosRiel("comun", 400, true), 10);
  assert.equal(agujerosRiel("giratorio", 80, false), 3);
  assert.equal(agujerosRiel("giratorio", 150, false), 4);
  assert.equal(agujerosRiel("comun", 250, false), null); // no hay entero de 250
  assert.equal(agujerosRiel("giratorio", 100, true), null);
});

test("plegados: 2 partes hasta 300, 3 partes después", () => {
  assert.equal(partesPlegado(200), 2);
  assert.equal(partesPlegado(300), 2);
  assert.equal(partesPlegado(320), 3);
  assert.equal(partesPlegado(400), 3);
});

test("kit estándar entero de 160: 4 agujeros", () => {
  const plan = planificar([{ tipo: "estandar", enteros: [160], plegados: [], doble: false }]);
  assert.deepEqual(plan.errores, []);
  assert.equal(plan.kits.length, 1);
  const k = plan.kits[0];
  assert.equal(k.nombre, "Kit estándar 160 cm");
  assert.equal(cant(k.composicion, (l) => l.tipo === "base" && l.pieza === "Tubito separador"), 4);
  assert.equal(cant(k.composicion, (l) => l.tipo === "base" && l.pieza === "Jota estándar"), 2);
  assert.equal(cant(k.composicion, (l) => l.tipo === "base" && l.pieza === "Tope de fin de riel"), 2);
  assert.equal(cant(k.composicion, (l) => l.tipo === "base" && l.pieza === "Tope de piso"), 1);
  assert.equal(cant(k.composicion, (l) => l.tipo === "insumo" && l.rol === "arandela"), 4);
  // 4 del riel + 2 del tope de piso
  assert.equal(cant(k.composicion, (l) => l.tipo === "insumo" && l.rol === "tirafondo"), 6);
  assert.equal(cant(k.composicion, (l) => l.tipo === "insumo" && l.rol === "tarugo"), 6);
  assert.equal(cant(k.composicion, (l) => l.tipo === "insumo" && l.rol === "tornillo_tuerca"), 4);
});

test("plegado de 260: 6 agujeros y una bisagra; el de 320 lleva dos", () => {
  const plan = planificar([{ tipo: "estandar", enteros: [], plegados: [260, 320], doble: false }]);
  const r260 = plan.piezas.find((p) => p.nombre === "Riel común 260 cm plegado")!;
  assert.deepEqual(r260.receta, [
    { rol: "planchuela_comun", cantidad: 260 },
    { rol: "bisagra", cantidad: 1 },
  ]);
  const r320 = plan.piezas.find((p) => p.nombre === "Riel común 320 cm plegado")!;
  assert.equal(r320.receta.find((l) => l.rol === "bisagra")?.cantidad, 2);
  const k320 = plan.kits.find((k) => k.nombre === "Kit estándar 320 cm plegado")!;
  assert.equal(cant(k320.composicion, (l) => l.tipo === "base" && l.pieza === "Tubito separador"), 9);
});

test("doble: 4 jotas, 8 tornillos con tuerca y 2 topes de piso", () => {
  const plan = planificar([{ tipo: "estandar", enteros: [200], plegados: [], doble: true }]);
  assert.equal(plan.kits.length, 2);
  const d = plan.kits.find((k) => k.nombre === "Kit estándar 200 cm doble")!;
  assert.equal(cant(d.composicion, (l) => l.tipo === "base" && l.pieza === "Jota estándar"), 4);
  assert.equal(cant(d.composicion, (l) => l.tipo === "base" && l.pieza === "Tope de piso"), 2);
  assert.equal(cant(d.composicion, (l) => l.tipo === "insumo" && l.rol === "tornillo_tuerca"), 8);
  // 5 agujeros + 2 por cada uno de los 2 topes de piso
  assert.equal(cant(d.composicion, (l) => l.tipo === "insumo" && l.rol === "tirafondo"), 9);
});

test("jotas: el estándar suma el tope jota y la giratoria gasta arandela y tornillo corto", () => {
  const plan = planificar([
    { tipo: "estandar", enteros: [120], plegados: [], doble: false },
    { tipo: "giratorio", enteros: [90], plegados: [], doble: false },
  ]);
  const std = plan.piezas.find((p) => p.nombre === "Jota estándar")!;
  assert.equal(std.receta.find((l) => l.rol === "planchuela_jota")?.cantidad, 31.5); // 29,5 + 2
  const gir = plan.piezas.find((p) => p.nombre === "Jota giratoria")!;
  assert.equal(gir.receta.find((l) => l.rol === "planchuela_gruesa")?.cantidad, 38); // 23 + 15
  assert.equal(gir.receta.find((l) => l.rol === "arandela")?.cantidad, 1);
  assert.equal(gir.receta.find((l) => l.rol === "tornillo_corto")?.cantidad, 1);
  assert.ok(gir.receta.every((l) => l.rol !== "planchuela_jota"));
});

test("errores: medida que no existe, plegado en giratorio, superpuesto sin medida", () => {
  const a = planificar([{ tipo: "estandar", enteros: [250], plegados: [], doble: false }]);
  assert.equal(a.kits.length, 0);
  assert.equal(a.errores.length, 1);
  const b = planificar([{ tipo: "giratorio", enteros: [], plegados: [200], doble: false }]);
  assert.equal(b.errores.length, 1);
  const c = planificar([{ tipo: "superpuesto", enteros: [160], plegados: [], doble: false }]);
  assert.equal(c.kits.length, 0);
  assert.equal(c.errores.length, 1);
});

test("las piezas compartidas no se repiten y los roles salen sin duplicar", () => {
  const plan = planificar([
    { tipo: "estandar", enteros: [140, 150], plegados: [], doble: false },
    { tipo: "rueda_libre", enteros: [140], plegados: [], doble: false },
  ]);
  // Estándar y rueda libre usan el mismo riel común.
  const rieles140 = plan.piezas.filter((p) => p.nombre === "Riel común 140 cm");
  assert.equal(rieles140.length, 1);
  const nombres = plan.piezas.map((p) => p.nombre);
  assert.equal(new Set(nombres).size, nombres.length);
  const roles = rolesUsados(plan);
  assert.equal(new Set(roles).size, roles.length);
});
