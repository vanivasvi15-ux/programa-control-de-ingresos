// lib/despacho-datos.test.ts
//
// Tests de la validación pura de ventas a despachar. Correr con: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { validarVenta, direccionCompleta } from "./despacho-datos.ts";

const base = {
  fecha: "2026-11-13",
  clienteNombre: "  Juan Pérez ",
  items: [{ productoId: 1, cantidad: 2, precioUnitario: 1500.4 }],
};

test("validarVenta: alta mínima válida, limpia espacios y redondea precio", () => {
  const r = validarVenta(base, false);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.datos.clienteNombre, "Juan Pérez");
  assert.equal(r.datos.items?.[0].precioUnitario, 1500);
});

test("validarVenta: el alta exige cliente, fecha e ítems", () => {
  assert.equal(validarVenta({ ...base, clienteNombre: "  " }, false).ok, false);
  assert.equal(validarVenta({ ...base, fecha: undefined }, false).ok, false);
  assert.equal(validarVenta({ ...base, items: [] }, false).ok, false);
});

test("validarVenta: fecha, canal, entrega y bultos inválidos se rechazan", () => {
  assert.equal(validarVenta({ ...base, fecha: "13/11/2026" }, false).ok, false);
  assert.equal(validarVenta({ ...base, canal: "ebay" }, false).ok, false);
  assert.equal(validarVenta({ ...base, entrega: "dron" }, false).ok, false);
  assert.equal(validarVenta({ ...base, bultos: 0 }, false).ok, false);
  assert.equal(validarVenta({ ...base, bultos: 2.5 }, false).ok, false);
});

test("validarVenta: cada renglón necesita producto o título, y cantidad entera ≥ 1", () => {
  assert.equal(validarVenta({ ...base, items: [{ cantidad: 1 }] }, false).ok, false);
  assert.equal(validarVenta({ ...base, items: [{ titulo: "Soporte", cantidad: 1 }] }, false).ok, true);
  assert.equal(validarVenta({ ...base, items: [{ productoId: 1, cantidad: 0 }] }, false).ok, false);
  assert.equal(validarVenta({ ...base, items: [{ productoId: 1, cantidad: 1.5 }] }, false).ok, false);
});

test("validarVenta parcial: sólo valida lo que viene", () => {
  const r = validarVenta({ seguimiento: " ABC123 " }, true);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.datos, { seguimiento: "ABC123" });
  assert.equal(validarVenta({ clienteNombre: "" }, true).ok, false);
});

test("direccionCompleta: arma una línea sin partes vacías", () => {
  assert.equal(
    direccionCompleta({ direccion: "Av. Siempreviva 742", localidad: "Quilmes", codigoPostal: "1878", provincia: "Buenos Aires" }),
    "Av. Siempreviva 742 · Quilmes (CP 1878) · Buenos Aires"
  );
  assert.equal(direccionCompleta({ localidad: "Quilmes" }), "Quilmes");
  assert.equal(direccionCompleta({}), "");
});
