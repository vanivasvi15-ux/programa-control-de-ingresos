// scripts/seed-stock.js
//
// Carga datos de PRUEBA de la Fase 2 (stock y producción) en data.db:
// insumos, piezas fabricadas, recetas, dos kits, publicaciones y una lista
// de recuento. Precios de metal aproximados de la lista mayorista de
// J.Gomez SRL (12/08/2026); herrajes y consumibles con valores inventados.
// Las cantidades de cada receta son INVENTADAS — reemplazalas por las
// reales desde /stock cuando estén las pantallas.
//
//   node scripts/seed-stock.js            -> agrega (falla si ya hay datos)
//   node scripts/seed-stock.js --reset    -> BORRA las tablas de Fase 2 y recarga
//
// No toca nada de la Fase 1 (movimientos, categorías, usuarios, bot).

const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const RESET = process.argv.includes("--reset");
const db = new DatabaseSync(path.join(process.cwd(), "data.db"));
db.exec("PRAGMA busy_timeout = 5000;");
db.exec("PRAGMA foreign_keys = ON;");

const TABLAS_FASE2 = [
  "movimientos_stock",
  "compras_insumo",
  "ordenes_produccion",
  "recuento_items",
  "recuento_listas",
  "composicion_producto",
  "receta_base",
  "publicaciones",
  "productos",
  "productos_base",
  "insumos",
];

function hayDatos() {
  return TABLAS_FASE2.some((t) => {
    try {
      return db.prepare(`SELECT 1 FROM ${t} LIMIT 1`).get();
    } catch {
      return false;
    }
  });
}

if (hayDatos() && !RESET) {
  console.log("Ya hay datos de Fase 2. Para borrarlos y recargar:\n  node scripts/seed-stock.js --reset");
  process.exit(1);
}

db.exec("BEGIN");
try {
  if (RESET) {
    for (const t of TABLAS_FASE2) db.exec(`DELETE FROM ${t}`);
    db.exec(
      `DELETE FROM sqlite_sequence WHERE name IN (${TABLAS_FASE2.map((t) => `'${t}'`).join(",")})`
    );
  }

  // --- insumos ---------------------------------------------------------------
  const insInsumo = db.prepare(
    `INSERT INTO insumos (nombre, tipo, unidad_compra, unidad_consumo, factor_compra, stock, alerta_minimo, costo_unitario)
     VALUES (@nombre, @tipo, @uc, @ucons, @factor, @stock, @min, @costo)`
  );
  const insumoId = {};
  const insumos = [
    // metal: tira de 6 m, se consume en cm -> factor 600
    { nombre: "Planchuela 3/4\" x 1/8", tipo: "materia_prima", uc: "tira", ucons: "cm", factor: 600, stock: 2400, min: 600, costo: 8959 },
    { nombre: "Planchuela 1\" x 1/8", tipo: "materia_prima", uc: "tira", ucons: "cm", factor: 600, stock: 3000, min: 600, costo: 11873 },
    { nombre: "Planchuela 1 1/4\" x 1/8", tipo: "materia_prima", uc: "tira", ucons: "cm", factor: 600, stock: 3000, min: 1200, costo: 13237 },
    { nombre: "Ángulo 3/4\" x 1/8", tipo: "materia_prima", uc: "tira", ucons: "cm", factor: 600, stock: 1800, min: 600, costo: 15732 },
    { nombre: "Ángulo 1\" x 1/8", tipo: "materia_prima", uc: "tira", ucons: "cm", factor: 600, stock: 1800, min: 600, costo: 20165 },
    { nombre: "Redondo liso 3/8\"", tipo: "materia_prima", uc: "tira", ucons: "cm", factor: 600, stock: 1200, min: 300, costo: 8866 },
    // ruedas: por unidad
    { nombre: "Rueda canal V 60 mm", tipo: "materia_prima", uc: "unidad", ucons: "unidad", factor: 1, stock: 24, min: 8, costo: 10912 },
    { nombre: "Rueda canal V 75 mm", tipo: "materia_prima", uc: "unidad", ucons: "unidad", factor: 1, stock: 16, min: 8, costo: 13469 },
    // herrajes del kit: por unidad (precios inventados)
    { nombre: "Separador de riel", tipo: "herraje", uc: "unidad", ucons: "unidad", factor: 1, stock: 200, min: 40, costo: 800 },
    { nombre: "Tornillo tirafondo", tipo: "herraje", uc: "unidad", ucons: "unidad", factor: 1, stock: 400, min: 80, costo: 120 },
    { nombre: "Tarugo", tipo: "herraje", uc: "unidad", ucons: "unidad", factor: 1, stock: 400, min: 80, costo: 30 },
    { nombre: "Tornillo con rosca", tipo: "herraje", uc: "unidad", ucons: "unidad", factor: 1, stock: 400, min: 80, costo: 90 },
    { nombre: "Tuerca", tipo: "herraje", uc: "unidad", ucons: "unidad", factor: 1, stock: 400, min: 80, costo: 40 },
    { nombre: "Arandela", tipo: "herraje", uc: "unidad", ucons: "unidad", factor: 1, stock: 400, min: 80, costo: 25 },
    // consumibles: no van en recetas, se controlan por recuento
    { nombre: "Disco de corte 115 x 1,6", tipo: "consumible", uc: "unidad", ucons: "unidad", factor: 1, stock: 8, min: 5, costo: 3069 },
    { nombre: "Alambre de soldar", tipo: "consumible", uc: "kg", ucons: "kg", factor: 1, stock: 5, min: 2, costo: 3875 },
  ];
  for (const i of insumos) {
    const r = insInsumo.run(i);
    insumoId[i.nombre] = Number(r.lastInsertRowid);
  }

  // --- piezas fabricadas + recetas ----------------------------------------
  const insPieza = db.prepare(
    `INSERT INTO productos_base (nombre, mano_obra_minutos) VALUES (?, ?)`
  );
  const insReceta = db.prepare(
    `INSERT INTO receta_base (producto_base_id, insumo_id, cantidad, bloqueante) VALUES (?, ?, ?, 1)`
  );
  const piezaId = {};
  const piezas = [
    {
      nombre: "Carro",
      manoObra: 25,
      receta: [
        ["Planchuela 1\" x 1/8", 40],
        ["Ángulo 3/4\" x 1/8", 15],
        ["Rueda canal V 60 mm", 2],
      ],
    },
    {
      nombre: "Riel 200 con bisagra",
      manoObra: 40,
      receta: [
        ["Planchuela 1 1/4\" x 1/8", 200],
        ["Ángulo 1\" x 1/8", 40],
      ],
    },
    {
      nombre: "Riel 200 sin bisagra",
      manoObra: 30,
      receta: [
        ["Planchuela 1 1/4\" x 1/8", 200],
        ["Ángulo 1\" x 1/8", 20],
      ],
    },
    {
      nombre: "Tope de fin de riel",
      manoObra: 5,
      receta: [["Planchuela 3/4\" x 1/8", 8]],
    },
    {
      nombre: "Tope de piso",
      manoObra: 8,
      receta: [
        ["Planchuela 3/4\" x 1/8", 12],
        ["Redondo liso 3/8\"", 5],
      ],
    },
  ];
  for (const p of piezas) {
    const r = insPieza.run(p.nombre, p.manoObra);
    const id = Number(r.lastInsertRowid);
    piezaId[p.nombre] = id;
    for (const [nombreIns, cant] of p.receta) insReceta.run(id, insumoId[nombreIns], cant);
  }

  // --- productos (kits) + composición ------------------------------------
  const insProd = db.prepare(`INSERT INTO productos (nombre, precio) VALUES (?, ?)`);
  const insComp = db.prepare(
    `INSERT INTO composicion_producto (producto_id, item_tipo, item_id, cantidad) VALUES (?, ?, ?, ?)`
  );
  const productoId = {};
  const herrajesKit = [
    ["Separador de riel", 4],
    ["Tornillo tirafondo", 4],
    ["Tarugo", 4],
    ["Tornillo con rosca", 4],
    ["Tuerca", 4],
    ["Arandela", 4],
  ];
  const kits = [
    { nombre: "Kit Puerta Granero — riel 200 con bisagra", precio: 145000, riel: "Riel 200 con bisagra" },
    { nombre: "Kit Puerta Granero — riel 200 sin bisagra", precio: 145000, riel: "Riel 200 sin bisagra" },
  ];
  for (const k of kits) {
    const r = insProd.run(k.nombre, k.precio);
    const id = Number(r.lastInsertRowid);
    productoId[k.nombre] = id;
    insComp.run(id, "base", piezaId["Carro"], 2);
    insComp.run(id, "base", piezaId[k.riel], 1);
    insComp.run(id, "base", piezaId["Tope de fin de riel"], 2);
    insComp.run(id, "base", piezaId["Tope de piso"], 1);
    for (const [nombreIns, cant] of herrajesKit) insComp.run(id, "insumo", insumoId[nombreIns], cant);
  }

  // --- publicaciones (varios avisos con nombres distintos -> mismo producto) ---
  const insPub = db.prepare(
    `INSERT INTO publicaciones (producto_id, canal, ml_item_id, cuenta, titulo) VALUES (?, 'mercadolibre', ?, ?, ?)`
  );
  insPub.run(productoId["Kit Puerta Granero — riel 200 con bisagra"], "MLA100000001", "principal",
    "Kit Puerta Granero Corrediza Riel Reforzado 2 Mts Cierre Suave");
  insPub.run(productoId["Kit Puerta Granero — riel 200 con bisagra"], "MLA100000002", "principal",
    "Herrajes Puerta Granero Corredera 2m Kit Completo Con Bisagra");
  insPub.run(productoId["Kit Puerta Granero — riel 200 sin bisagra"], "MLA100000003", "secundaria",
    "Kit Puerta Granero 2 Metros Riel Sin Bisagra Envío Largo");

  // --- lista de recuento para los consumibles ---------------------------
  const rl = db.prepare(`INSERT INTO recuento_listas (nombre, dias_cada) VALUES (?, 3)`).run("Consumibles de taller");
  const listaId = Number(rl.lastInsertRowid);
  const insRi = db.prepare(`INSERT INTO recuento_items (lista_id, insumo_id) VALUES (?, ?)`);
  insRi.run(listaId, insumoId["Disco de corte 115 x 1,6"]);
  insRi.run(listaId, insumoId["Alambre de soldar"]);

  // --- costos calculados (mismo cálculo que lib/stock-datos.ts) ----------
  const tarifa = Number(
    (db.prepare(`SELECT valor FROM config WHERE clave='tarifa_mano_obra_minuto'`).get() || { valor: "0" }).valor
  ) || 0;
  const insumoRows = db.prepare(`SELECT id, costo_unitario, factor_compra FROM insumos`).all();
  const costoConsumo = new Map(
    insumoRows.map((i) => [i.id, i.factor_compra > 0 ? i.costo_unitario / i.factor_compra : 0])
  );
  const upBase = db.prepare(
    `UPDATE productos_base SET costo_calculado = ?, costo_actualizado = datetime('now','localtime') WHERE id = ?`
  );
  for (const p of db.prepare(`SELECT id, mano_obra_minutos FROM productos_base`).all()) {
    const receta = db.prepare(`SELECT insumo_id, cantidad FROM receta_base WHERE producto_base_id = ?`).all(p.id);
    let c = receta.reduce((s, l) => s + l.cantidad * (costoConsumo.get(l.insumo_id) || 0), 0);
    c += p.mano_obra_minutos * tarifa;
    upBase.run(Math.round(c), p.id);
  }
  const costoPieza = new Map(
    db.prepare(`SELECT id, costo_calculado FROM productos_base`).all().map((p) => [p.id, p.costo_calculado || 0])
  );
  const upProd = db.prepare(
    `UPDATE productos SET costo_calculado = ?, costo_actualizado = datetime('now','localtime') WHERE id = ?`
  );
  for (const pr of db.prepare(`SELECT id FROM productos`).all()) {
    const comp = db.prepare(`SELECT item_tipo, item_id, cantidad FROM composicion_producto WHERE producto_id = ?`).all(pr.id);
    let c = 0;
    for (const l of comp) {
      c += l.item_tipo === "base"
        ? l.cantidad * (costoPieza.get(l.item_id) || 0)
        : l.cantidad * (costoConsumo.get(l.item_id) || 0);
    }
    upProd.run(Math.round(c), pr.id);
  }

  db.exec("COMMIT");
} catch (e) {
  db.exec("ROLLBACK");
  console.error("Falló, no se cambió nada:", e);
  process.exit(1);
}

// --- resumen ---
console.log("Datos de prueba de Fase 2 cargados ✔\n");
const q = (s) => db.prepare(s).get().c;
console.log(`  insumos:        ${q("SELECT COUNT(*) c FROM insumos")}`);
console.log(`  piezas base:    ${q("SELECT COUNT(*) c FROM productos_base")}`);
console.log(`  productos:      ${q("SELECT COUNT(*) c FROM productos")}`);
console.log(`  publicaciones:  ${q("SELECT COUNT(*) c FROM publicaciones")}`);
console.log("\n  Costos calculados:");
for (const p of db.prepare(`SELECT nombre, costo_calculado FROM productos_base ORDER BY nombre`).all()) {
  console.log(`    ${p.nombre.padEnd(28)} $ ${Number(p.costo_calculado).toLocaleString("es-AR")}`);
}
for (const p of db.prepare(`SELECT nombre, precio, costo_calculado FROM productos ORDER BY nombre`).all()) {
  const m = p.precio - p.costo_calculado;
  console.log(`    ${p.nombre.padEnd(40)} costo $ ${Number(p.costo_calculado).toLocaleString("es-AR")}  ·  margen $ ${m.toLocaleString("es-AR")}`);
}
