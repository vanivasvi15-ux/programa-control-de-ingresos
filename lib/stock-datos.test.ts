// lib/stock-datos.test.ts
//
// Tests de los cálculos puros de stock/producción. Correr con:
//   npm test        (node --test, type-stripping de Node 24)

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  costoInsumoPorConsumo,
  costoPiezaBase,
  costoProducto,
  faltantesDeProducto,
  type InsumoCalc,
  type PiezaCalc,
} from "./stock-datos.ts";

const planchuela: InsumoCalc = {
  id: 1,
  nombre: "Planchuela 1 x 1/8",
  tipo: "materia_prima",
  unidad_consumo: "cm",
  factor_compra: 600, // tira de 6 m
  stock: 1200,
  costo_unitario: 38000, // la tira
};
const rueda: InsumoCalc = {
  id: 2,
  nombre: "Rueda de nylon",
  tipo: "herraje",
  unidad_consumo: "u",
  factor_compra: 1,
  stock: 10,
  costo_unitario: 1500,
};
const disco: InsumoCalc = {
  id: 3,
  nombre: "Disco de corte",
  tipo: "consumible",
  unidad_consumo: "u",
  factor_compra: 1,
  stock: 0,
  costo_unitario: 3000,
};

const insumos = new Map<number, InsumoCalc>([
  [1, planchuela],
  [2, rueda],
  [3, disco],
]);

test("costoInsumoPorConsumo: precio de la tira / factor", () => {
  assert.equal(costoInsumoPorConsumo(planchuela), 38000 / 600);
  assert.equal(costoInsumoPorConsumo(rueda), 1500);
});

test("costoInsumoPorConsumo: factor 0 no rompe", () => {
  assert.equal(costoInsumoPorConsumo({ costo_unitario: 100, factor_compra: 0 }), 0);
});

test("costoPiezaBase: suma insumos, sin tarifa de mano de obra", () => {
  // 80 cm planchuela + 2 ruedas
  const receta = [
    { insumo_id: 1, cantidad: 80, bloqueante: 1 },
    { insumo_id: 2, cantidad: 2, bloqueante: 1 },
  ];
  const esperado = Math.round(80 * (38000 / 600) + 2 * 1500);
  assert.equal(costoPiezaBase(receta, insumos, 25, 0), esperado);
});

test("costoPiezaBase: la mano de obra suma si hay tarifa", () => {
  const receta = [{ insumo_id: 2, cantidad: 1, bloqueante: 1 }];
  assert.equal(costoPiezaBase(receta, insumos, 10, 50), 1500 + 10 * 50);
});

test("costoProducto: piezas por su costo_calculado + insumos sueltos", () => {
  const carro: PiezaCalc = { id: 10, nombre: "Carro", stock: 3, mano_obra_minutos: 0, costo_calculado: 9000 };
  const piezas = new Map<number, PiezaCalc>([[10, carro]]);
  const comp = [
    { item_tipo: "base" as const, item_id: 10, cantidad: 2 }, // 2 carros
    { item_tipo: "insumo" as const, item_id: 2, cantidad: 4 }, // 4 ruedas sueltas
  ];
  assert.equal(costoProducto(comp, piezas, insumos), 2 * 9000 + 4 * 1500);
});

test("faltantesDeProducto: alcanza con stock de piezas -> listo", () => {
  const carro: PiezaCalc = { id: 10, nombre: "Carro", stock: 5, mano_obra_minutos: 0, costo_calculado: 9000 };
  const r = faltantesDeProducto({
    cantidad: 2,
    composicion: [{ item_tipo: "base", item_id: 10, cantidad: 2 }],
    piezas: new Map([[10, carro]]),
    recetas: new Map(),
    insumos,
  });
  assert.equal(r.listo, true);
  assert.equal(r.faltantes.length, 0);
});

test("faltantesDeProducto: falta 1 carro pero hay material -> aFabricar, sigue listo", () => {
  const carro: PiezaCalc = { id: 10, nombre: "Carro", stock: 3, mano_obra_minutos: 0, costo_calculado: 9000 };
  const r = faltantesDeProducto({
    cantidad: 2, // pide 4 carros, hay 3
    composicion: [{ item_tipo: "base", item_id: 10, cantidad: 2 }],
    piezas: new Map([[10, carro]]),
    recetas: new Map([[10, [{ insumo_id: 1, cantidad: 80, bloqueante: 1 }]]]), // 80 cm c/u, hay 1200
    insumos,
  });
  assert.equal(r.listo, true);
  assert.deepEqual(r.aFabricar, [{ nombre: "Carro", cantidad: 1 }]);
});

test("faltantesDeProducto: falta carro y NO hay material -> faltante de insumo", () => {
  const carro: PiezaCalc = { id: 10, nombre: "Carro", stock: 0, mano_obra_minutos: 0, costo_calculado: 9000 };
  const r = faltantesDeProducto({
    cantidad: 1,
    composicion: [{ item_tipo: "base", item_id: 10, cantidad: 2 }], // 2 carros, 0 en stock
    piezas: new Map([[10, carro]]),
    recetas: new Map([[10, [{ insumo_id: 1, cantidad: 800, bloqueante: 1 }]]]), // 800 cm c/u -> 1600, hay 1200
    insumos,
  });
  assert.equal(r.listo, false);
  assert.equal(r.faltantes[0].tipo, "insumo");
  assert.equal(r.faltantes[0].nombre, "Planchuela 1 x 1/8");
});

test("faltantesDeProducto: un consumible faltante NO frena", () => {
  const r = faltantesDeProducto({
    cantidad: 1,
    composicion: [{ item_tipo: "insumo", item_id: 3, cantidad: 5 }], // disco, stock 0, es consumible
    piezas: new Map(),
    recetas: new Map(),
    insumos,
  });
  assert.equal(r.listo, true);
});

test("faltantesDeProducto: no cuenta dos veces el mismo insumo entre componentes", () => {
  // dos piezas distintas que consumen la misma planchuela; juntas se pasan
  const a: PiezaCalc = { id: 20, nombre: "Pieza A", stock: 0, mano_obra_minutos: 0, costo_calculado: 0 };
  const b: PiezaCalc = { id: 21, nombre: "Pieza B", stock: 0, mano_obra_minutos: 0, costo_calculado: 0 };
  const r = faltantesDeProducto({
    cantidad: 1,
    composicion: [
      { item_tipo: "base", item_id: 20, cantidad: 1 },
      { item_tipo: "base", item_id: 21, cantidad: 1 },
    ],
    piezas: new Map([[20, a], [21, b]]),
    recetas: new Map([
      [20, [{ insumo_id: 1, cantidad: 700, bloqueante: 1 }]],
      [21, [{ insumo_id: 1, cantidad: 700, bloqueante: 1 }]],
    ]),
    insumos, // planchuela stock 1200 < 1400
  });
  assert.equal(r.listo, false);
});
