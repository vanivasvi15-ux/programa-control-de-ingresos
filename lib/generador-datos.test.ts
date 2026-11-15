import { test } from "node:test";
import assert from "node:assert/strict";
import { agujerosRiel, planificar, partesPlegado, rolesUsados, type LineaKit } from "./generador-datos.ts";

const cant = (l: LineaKit[], buscar: (x: LineaKit) => boolean) => l.find(buscar)?.cantidad;
const base = (l: LineaKit[], pieza: string) => cant(l, (x) => x.tipo === "base" && x.pieza === pieza);
const insumo = (l: LineaKit[], rol: string) => cant(l, (x) => x.tipo === "insumo" && x.rol === rol);

test("agujeros de los rieles según lo dicho por el dueño", () => {
  assert.equal(agujerosRiel("comun", 140, false), 4);
  assert.equal(agujerosRiel("comun", 160, false), 4);
  assert.equal(agujerosRiel("comun", 160, true), 6);
  assert.equal(agujerosRiel("comun", 180, false), 5);
  assert.equal(agujerosRiel("comun", 250, true), 6);
  assert.equal(agujerosRiel("comun", 300, true), 8);
  assert.equal(agujerosRiel("comun", 360, true), 9);
  assert.equal(agujerosRiel("comun", 400, true), 10);
  assert.equal(agujerosRiel("giratorio", 80, false), 3);
  assert.equal(agujerosRiel("giratorio", 150, false), 4);
  assert.equal(agujerosRiel("giratorio", 160, false), 5);
  assert.equal(agujerosRiel("giratorio", 200, false), 5);
  assert.equal(agujerosRiel("comun", 230, false), null); // no hay entero de 230
  assert.equal(agujerosRiel("giratorio", 100, true), null);
});

test("los largos que ya no se venden (120, 130, 210, 230, 260) no existen", () => {
  assert.equal(agujerosRiel("comun", 120, false), null);
  assert.equal(agujerosRiel("comun", 130, false), null);
  assert.equal(agujerosRiel("comun", 210, true), null);
  assert.equal(agujerosRiel("comun", 230, true), null);
  assert.equal(agujerosRiel("comun", 260, true), null);
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
  assert.equal(base(k.composicion, "Tubito separador"), 4);
  assert.equal(base(k.composicion, "Jota estándar"), 2);
  assert.equal(base(k.composicion, "Tope de fin de riel"), 2);
  assert.equal(base(k.composicion, "Tope de piso"), 1);
  assert.equal(insumo(k.composicion, "arandela"), 4);
  // 4 del riel + 2 del tope de piso
  assert.equal(insumo(k.composicion, "tirafondo"), 6);
  assert.equal(insumo(k.composicion, "tarugo"), 6);
  assert.equal(insumo(k.composicion, "tornillo_tuerca"), 4);
});

test("plegado de 250: 6 agujeros y una bisagra; el de 320 lleva dos", () => {
  const plan = planificar([{ tipo: "estandar", enteros: [], plegados: [250, 320], doble: false }]);
  const r250 = plan.piezas.find((p) => p.nombre === "Riel común 250 cm plegado")!;
  assert.deepEqual(r250.receta, [
    { rol: "planchuela_comun", cantidad: 250 },
    { rol: "bisagra", cantidad: 1 },
  ]);
  const r320 = plan.piezas.find((p) => p.nombre === "Riel común 320 cm plegado")!;
  assert.equal(r320.receta.find((l) => l.rol === "bisagra")?.cantidad, 2);
  const k320 = plan.kits.find((k) => k.nombre === "Kit estándar 320 cm plegado")!;
  assert.equal(base(k320.composicion, "Tubito separador"), 9);
});

test("doble: 4 jotas, 8 tornillos con tuerca y 2 topes de piso", () => {
  const plan = planificar([{ tipo: "estandar", enteros: [200], plegados: [], doble: true }]);
  assert.equal(plan.kits.length, 2);
  const d = plan.kits.find((k) => k.nombre === "Kit estándar 200 cm doble")!;
  assert.equal(base(d.composicion, "Jota estándar"), 4);
  assert.equal(base(d.composicion, "Tope de piso"), 2);
  assert.equal(insumo(d.composicion, "tornillo_tuerca"), 8);
  // 5 agujeros + 2 por cada uno de los 2 topes de piso
  assert.equal(insumo(d.composicion, "tirafondo"), 9);
});

test("jotas: la estándar suma el tope jota y la giratoria gasta arandela y tornillo corto", () => {
  const plan = planificar([
    { tipo: "estandar", enteros: [140], plegados: [], doble: false },
    { tipo: "giratorio", enteros: [90], plegados: [], doble: false },
  ]);
  const std = plan.piezas.find((p) => p.nombre === "Jota estándar")!;
  assert.equal(std.receta.find((l) => l.rol === "planchuela_jota")?.cantidad, 31.5); // 29,5 + 2
  assert.equal(std.receta.find((l) => l.rol === "rueda")?.cantidad, 1);
  const gir = plan.piezas.find((p) => p.nombre === "Jota giratoria")!;
  assert.equal(gir.receta.find((l) => l.rol === "planchuela_gruesa")?.cantidad, 38); // 23 + 15
  assert.equal(gir.receta.find((l) => l.rol === "arandela")?.cantidad, 1);
  assert.equal(gir.receta.find((l) => l.rol === "tornillo_corto")?.cantidad, 1);
  assert.ok(gir.receta.every((l) => l.rol !== "planchuela_jota"));
});

test("jota reforzada: la misma planchuela que la estándar pero con rueda de 60", () => {
  const plan = planificar([{ tipo: "reforzado", enteros: [160], plegados: [], doble: false }]);
  const j = plan.piezas.find((p) => p.nombre === "Jota reforzada")!;
  assert.equal(j.receta.find((l) => l.rol === "planchuela_jota")?.cantidad, 31.5);
  assert.equal(j.receta.find((l) => l.rol === "rueda_60")?.cantidad, 1);
  assert.ok(j.receta.every((l) => l.rol !== "rueda" && l.rol !== "planchuela_gruesa"));
  // El riel sí es de planchuela gruesa y el kit lleva topes de fin de riel.
  const riel = plan.piezas.find((p) => p.nombre === "Riel reforzado 160 cm")!;
  assert.equal(riel.receta.find((l) => l.rol === "planchuela_gruesa")?.cantidad, 160);
  assert.equal(base(plan.kits[0].composicion, "Tope de fin de riel"), 2);
});

test("giratorio: sin topes de fin de riel y con tope de piso de varilla", () => {
  const plan = planificar([{ tipo: "giratorio", enteros: [160, 80], plegados: [], doble: false }]);
  assert.deepEqual(plan.errores, []);
  const k160 = plan.kits.find((k) => k.nombre === "Kit giratorio 160 cm")!;
  assert.equal(base(k160.composicion, "Tope de fin de riel"), undefined);
  assert.equal(base(k160.composicion, "Tope de piso"), undefined);
  assert.equal(base(k160.composicion, "Tope de piso giratorio"), 1);
  assert.equal(base(k160.composicion, "Tubito separador"), 5); // 160 cm giratorio: 5 agujeros
  assert.equal(base(plan.kits.find((k) => k.nombre === "Kit giratorio 80 cm")!.composicion, "Tubito separador"), 3);
  const tope = plan.piezas.find((p) => p.nombre === "Tope de piso giratorio")!;
  assert.deepEqual(tope.receta, [
    { rol: "varilla", cantidad: 4.5 },
    { rol: "planchuela_jota", cantidad: 8 },
  ]);
  // Nada de ángulo: ni el tope de riel ni el de piso común se crean.
  assert.ok(plan.piezas.every((p) => p.nombre !== "Tope de fin de riel" && p.nombre !== "Tope de piso"));
});

test("superpuesto: 2 jotas reforzadas + 2 superpuestas (20 + 21 cm) y 8 tornillos con tuerca", () => {
  const plan = planificar([{ tipo: "superpuesto", enteros: [150, 200], plegados: [300], doble: false }]);
  assert.deepEqual(plan.errores, []);
  assert.equal(plan.kits.length, 3);
  const k = plan.kits.find((x) => x.nombre === "Kit superpuesto 150 cm")!;
  assert.equal(base(k.composicion, "Jota reforzada"), 2);
  assert.equal(base(k.composicion, "Jota superpuesta"), 2);
  assert.equal(base(k.composicion, "Tope de fin de riel"), 2);
  assert.equal(base(k.composicion, "Tope de piso"), 1);
  assert.equal(insumo(k.composicion, "tornillo_tuerca"), 8);
  const jota = plan.piezas.find((p) => p.nombre === "Jota superpuesta")!;
  assert.equal(jota.receta.find((l) => l.rol === "planchuela_jota")?.cantidad, 41); // 20 + 21, sin tope jota
  // El de 3 m es plegado: 8 agujeros.
  assert.equal(base(plan.kits.find((x) => x.nombre === "Kit superpuesto 300 cm plegado")!.composicion, "Tubito separador"), 8);
});

test("superpuesto sólo se vende en 150, 200 y 300", () => {
  const plan = planificar([{ tipo: "superpuesto", enteros: [160], plegados: [], doble: false }]);
  assert.equal(plan.kits.length, 0);
  assert.equal(plan.errores.length, 1);
});

test("errores: medida que no existe y plegado en giratorio", () => {
  const a = planificar([{ tipo: "estandar", enteros: [250], plegados: [], doble: false }]);
  assert.equal(a.kits.length, 0);
  assert.equal(a.errores.length, 1);
  const b = planificar([{ tipo: "giratorio", enteros: [], plegados: [200], doble: false }]);
  assert.equal(b.errores.length, 1);
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
