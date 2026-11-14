// lib/codigos-datos.test.ts
//
// Tests del formato y la validación de códigos de barras. Correr con: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { codigoPorDefecto, normalizarCodigo } from "./codigos-datos.ts";

test("codigoPorDefecto: prefijo por tipo y número de 5 dígitos", () => {
  assert.equal(codigoPorDefecto("base", 12), "PB00012");
  assert.equal(codigoPorDefecto("producto", 3), "PF00003");
  assert.equal(codigoPorDefecto("base", 123456), "PB123456");
});

test("normalizarCodigo: vacío o nulo = null (se genera uno)", () => {
  assert.deepEqual(normalizarCodigo(undefined), { ok: true, codigo: null });
  assert.deepEqual(normalizarCodigo(null), { ok: true, codigo: null });
  assert.deepEqual(normalizarCodigo("   "), { ok: true, codigo: null });
});

test("normalizarCodigo: recorta bordes y respeta mayúsculas", () => {
  assert.deepEqual(normalizarCodigo("  7791234567890 "), { ok: true, codigo: "7791234567890" });
  assert.deepEqual(normalizarCodigo("abC12"), { ok: true, codigo: "abC12" });
});

test("normalizarCodigo: rechaza espacios internos, acentos y códigos larguísimos", () => {
  assert.equal(normalizarCodigo("AB 12").ok, false);
  assert.equal(normalizarCodigo("TORNILLÓ").ok, false);
  assert.equal(normalizarCodigo("A".repeat(41)).ok, false);
  assert.equal(normalizarCodigo("A".repeat(40)).ok, true);
});
