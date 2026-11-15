// lib/generador-datos.ts
//
// Reglas del taller para armar kits de puerta granero, PURAS (sin base de
// datos): tablas de agujeros por largo de riel, tipos de jota y la cuenta de
// qué lleva cada kit. Con esto el "Generador de kits" crea de una vez las
// piezas, las recetas y los kits (ver lib/generador.ts).
//
// Todo lo dicho por el dueño el 2026-11-15 está en docs/CATALOGO-TALLER.md.
// Los SUPUESTOS (cosas que no se confirmaron) están marcados abajo con
// "SUPUESTO" para poder corregirlos en un solo lugar.

// ---------------------------------------------------------------------------
// Materiales ("roles"): cada receta habla de roles; en el generador el dueño
// elige qué insumo real de su lista cumple cada rol (o se crea uno nuevo).
// ---------------------------------------------------------------------------

export type Rol =
  | "planchuela_comun"
  | "planchuela_gruesa"
  | "planchuela_jota"
  | "angulo"
  | "cano"
  | "varilla"
  | "rueda"
  | "rueda_60"
  | "bisagra"
  | "tornillo_tuerca"
  | "tirafondo"
  | "tarugo"
  | "arandela"
  | "tornillo_corto";

export type DefRol = {
  nombre: string; // nombre con el que se crea si no existe
  ayuda: string; // para qué se usa, en palabras simples
  tipo: "materia_prima" | "herraje";
  unidadCompra: string;
  unidadConsumo: string;
  factor: number; // cuántas unidades de consumo trae una de compra
};

export const ROLES: Record<Rol, DefRol> = {
  planchuela_comun: {
    nombre: "Planchuela común (riel)",
    ayuda: "Riel estándar y rueda libre",
    tipo: "materia_prima",
    unidadCompra: "tira",
    unidadConsumo: "cm",
    factor: 600,
  },
  planchuela_gruesa: {
    nombre: "Planchuela gruesa (reforzada)",
    ayuda: "Riel de reforzado, giratorio y superpuesto, y jota giratoria",
    tipo: "materia_prima",
    unidadCompra: "tira",
    unidadConsumo: "cm",
    factor: 600,
  },
  planchuela_jota: {
    nombre: "Planchuela de jota",
    ayuda:
      "Jotas (estándar, reforzada, rueda libre, económica y superpuesta), tope jota, tope de piso giratorio y riel económico",
    tipo: "materia_prima",
    unidadCompra: "tira",
    unidadConsumo: "cm",
    factor: 600,
  },
  angulo: {
    nombre: "Ángulo (topes)",
    ayuda: "Tope de fin de riel (2,5 cm) y tope de piso (4,5 cm)",
    tipo: "materia_prima",
    unidadCompra: "tira",
    unidadConsumo: "cm",
    factor: 600,
  },
  cano: {
    nombre: "Caño (tubitos separadores)",
    ayuda: "Se corta en tubitos de 4,5 cm",
    tipo: "materia_prima",
    unidadCompra: "barra",
    unidadConsumo: "cm",
    factor: 600,
  },
  varilla: {
    nombre: "Varilla de 6 mm (tope de piso giratorio)",
    ayuda: "Se corta a 4,5 cm para el tope de piso de los kits giratorios",
    tipo: "materia_prima",
    unidadCompra: "barra",
    unidadConsumo: "cm",
    factor: 600, // SUPUESTO: se compra en barras de 6 m; cambiar si es otra
  },
  rueda: {
    nombre: "Rueda de 50 mm",
    ayuda: "Una por jota estándar, rueda libre, económica y giratoria",
    tipo: "materia_prima",
    unidadCompra: "unidad",
    unidadConsumo: "unidad",
    factor: 1,
  },
  rueda_60: {
    nombre: "Rueda de 60 mm",
    ayuda: "Una por jota reforzada (y superpuesta)",
    tipo: "materia_prima",
    unidadCompra: "unidad",
    unidadConsumo: "unidad",
    factor: 1,
  },
  bisagra: {
    nombre: "Bisagra de riel plegado",
    ayuda: "Une las partes de un riel plegado",
    tipo: "herraje",
    unidadCompra: "unidad",
    unidadConsumo: "unidad",
    factor: 1,
  },
  tornillo_tuerca: {
    nombre: "Tornillo con tuerca (jotas)",
    ayuda: "4 por par de jotas",
    tipo: "herraje",
    unidadCompra: "unidad",
    unidadConsumo: "unidad",
    factor: 1,
  },
  tirafondo: {
    nombre: "Tornillo tirafondo",
    ayuda: "Uno por agujero del riel, más 2 por tope de piso",
    tipo: "herraje",
    unidadCompra: "unidad",
    unidadConsumo: "unidad",
    factor: 1,
  },
  tarugo: {
    nombre: "Tarugo",
    ayuda: "Los mismos que los tirafondos",
    tipo: "herraje",
    unidadCompra: "unidad",
    unidadConsumo: "unidad",
    factor: 1,
  },
  arandela: {
    nombre: "Arandela",
    ayuda: "Una por separador (y una por jota giratoria)",
    tipo: "herraje",
    unidadCompra: "unidad",
    unidadConsumo: "unidad",
    factor: 1,
  },
  tornillo_corto: {
    nombre: "Tornillo corto (jota giratoria)",
    ayuda: "Uno por jota giratoria",
    tipo: "herraje",
    unidadCompra: "unidad",
    unidadConsumo: "unidad",
    factor: 1,
  },
};

// ---------------------------------------------------------------------------
// Rieles: largo (cm) -> agujeros
// ---------------------------------------------------------------------------

export type FamiliaRiel = "comun" | "reforzado" | "economico" | "giratorio";

// Estándar, rueda libre, reforzado, superpuesto y económico comparten la
// misma cantidad de agujeros ("es igual para todos los estándares").
// Sólo los largos que se venden hoy (el dueño sacó 120, 130, 210, 230 y 260).
export const AGUJEROS_ENTEROS: Record<number, number> = {
  140: 4, 150: 4, 160: 4, 170: 4, 180: 5, 190: 5, 200: 5,
};

// Plegados: vienen en 2 partes (hasta 300 cm) o 3 partes (más de 300).
export const AGUJEROS_PLEGADOS: Record<number, number> = {
  160: 6, 170: 6, 180: 6, 190: 6, 200: 6, 220: 6, 240: 6,
  250: 6, 280: 8, 300: 8, 320: 9, 360: 9, 400: 10,
};

// Giratorios: de 80 cm a 2 m, riel de planchuela gruesa (de 160 a 200: 5).
export const AGUJEROS_GIRATORIOS: Record<number, number> = {
  80: 3, 90: 4, 100: 4, 110: 4, 120: 4, 130: 4, 140: 4, 150: 4,
  160: 5, 170: 5, 180: 5, 190: 5, 200: 5,
};

export const LARGOS_ENTEROS = Object.keys(AGUJEROS_ENTEROS).map(Number);
export const LARGOS_PLEGADOS = Object.keys(AGUJEROS_PLEGADOS).map(Number);
export const LARGOS_GIRATORIOS = Object.keys(AGUJEROS_GIRATORIOS).map(Number);

export function agujerosRiel(familia: FamiliaRiel, largo: number, plegado: boolean): number | null {
  if (familia === "giratorio") return plegado ? null : AGUJEROS_GIRATORIOS[largo] ?? null;
  const tabla = plegado ? AGUJEROS_PLEGADOS : AGUJEROS_ENTEROS;
  return tabla[largo] ?? null;
}

// Partes en que viene un riel plegado (soldadas con bisagra).
export function partesPlegado(largo: number): number {
  return largo > 300 ? 3 : 2;
}

// ---------------------------------------------------------------------------
// Tipos de kit
// ---------------------------------------------------------------------------

export type TipoKit = "estandar" | "reforzado" | "rueda_libre" | "economico" | "giratorio" | "superpuesto";

type DefJota = {
  nombre: string;
  partes: { rol: Rol; cm: number }[]; // planchuela que lleva
  topeJota: boolean; // suma 2 cm de la misma planchuela
  extras: { rol: Rol; cantidad: number }[];
};

export type DefTipoKit = {
  nombre: string; // para los nombres de kit
  etiqueta: string; // para la pantalla
  riel: FamiliaRiel;
  plegable: boolean;
  permiteDoble: boolean;
  // Pares de jotas que lleva el kit (cada una se hace de a 2; la versión doble
  // duplica todo). El superpuesto lleva dos pares distintos.
  jotas: DefJota[];
  topesRiel: boolean; // 2 topes de fin de riel (el giratorio no los lleva)
  topePiso: "angulo" | "giratorio";
  // Si el kit sólo se vende en algunos largos (el superpuesto).
  largos?: { enteros: number[]; plegados: number[] };
};

export const LARGO_TOPE_JOTA_CM = 2;
export const LARGO_TOPE_RIEL_CM = 2.5;
export const LARGO_TOPE_PISO_CM = 4.5;
export const LARGO_TUBITO_CM = 4.5;
// Tope de piso del giratorio: varilla de 6 mm de 4,5 cm + planchuela de jota de 8 cm.
export const LARGO_VARILLA_PISO_CM = 4.5;
export const LARGO_PLANCHUELA_PISO_CM = 8;

const JOTA_ESTANDAR: DefJota = {
  nombre: "Jota estándar",
  partes: [{ rol: "planchuela_jota", cm: 29.5 }],
  topeJota: true,
  extras: [{ rol: "rueda", cantidad: 1 }],
};

// Igual que la estándar pero con rueda de 60 (dicho por el dueño).
const JOTA_REFORZADA: DefJota = {
  nombre: "Jota reforzada",
  partes: [{ rol: "planchuela_jota", cm: 29.5 }],
  topeJota: true,
  extras: [{ rol: "rueda_60", cantidad: 1 }],
};

export const TIPOS_KIT: Record<TipoKit, DefTipoKit> = {
  estandar: {
    nombre: "estándar",
    etiqueta: "Estándar",
    riel: "comun",
    plegable: true,
    permiteDoble: true,
    jotas: [JOTA_ESTANDAR],
    topesRiel: true,
    topePiso: "angulo",
  },
  reforzado: {
    nombre: "reforzado",
    etiqueta: "Reforzado",
    riel: "reforzado",
    plegable: true,
    permiteDoble: true,
    jotas: [JOTA_REFORZADA],
    topesRiel: true,
    topePiso: "angulo",
  },
  rueda_libre: {
    nombre: "rueda libre",
    etiqueta: "Rueda libre",
    riel: "comun",
    plegable: true,
    permiteDoble: true,
    // SUPUESTO: la jota rueda libre usa la planchuela de jota.
    jotas: [
      {
        nombre: "Jota rueda libre",
        partes: [{ rol: "planchuela_jota", cm: 23 }],
        topeJota: true,
        extras: [{ rol: "rueda", cantidad: 1 }],
      },
    ],
    topesRiel: true,
    topePiso: "angulo",
  },
  economico: {
    nombre: "económico",
    etiqueta: "Económico (riel liviano)",
    riel: "economico",
    plegable: true,
    permiteDoble: true,
    jotas: [
      {
        nombre: "Jota económica",
        partes: [{ rol: "planchuela_jota", cm: 23 }],
        topeJota: false,
        extras: [{ rol: "rueda", cantidad: 1 }],
      },
    ],
    topesRiel: true,
    topePiso: "angulo",
  },
  giratorio: {
    nombre: "giratorio",
    etiqueta: "Giratorio",
    riel: "giratorio",
    plegable: false,
    permiteDoble: false,
    // Dos partes de planchuela (23 + 15 cm), 1 arandela y 1 tornillo corto
    // por jota. SUPUESTO: la planchuela es la gruesa.
    jotas: [
      {
        nombre: "Jota giratoria",
        partes: [
          { rol: "planchuela_gruesa", cm: 23 },
          { rol: "planchuela_gruesa", cm: 15 },
        ],
        topeJota: false,
        extras: [
          { rol: "rueda", cantidad: 1 },
          { rol: "arandela", cantidad: 1 },
          { rol: "tornillo_corto", cantidad: 1 },
        ],
      },
    ],
    topesRiel: false, // el giratorio no lleva tope de fin de riel
    topePiso: "giratorio",
  },
  superpuesto: {
    nombre: "superpuesto",
    etiqueta: "Superpuesto",
    riel: "reforzado",
    plegable: true,
    permiteDoble: false, // ya trae 4 jotas: un par de reforzadas y un par de superpuestas
    jotas: [
      JOTA_REFORZADA,
      {
        // Dos partes de la planchuela de jota (20 y 21 cm), sin tope jota.
        // SUPUESTO: lleva rueda de 60 como la reforzada.
        nombre: "Jota superpuesta",
        partes: [
          { rol: "planchuela_jota", cm: 20 },
          { rol: "planchuela_jota", cm: 21 },
        ],
        topeJota: false,
        extras: [{ rol: "rueda_60", cantidad: 1 }],
      },
    ],
    topesRiel: true,
    topePiso: "angulo",
    // SUPUESTO: el de 3 m es plegado (un riel entero llega a 2 m).
    largos: { enteros: [150, 200], plegados: [300] },
  },
};

export const ORDEN_TIPOS_KIT: TipoKit[] = [
  "estandar",
  "reforzado",
  "rueda_libre",
  "economico",
  "giratorio",
  "superpuesto",
];

// ---------------------------------------------------------------------------
// Planificación
// ---------------------------------------------------------------------------

export type Seleccion = {
  tipo: TipoKit;
  enteros: number[]; // largos de riel entero
  plegados: number[]; // largos de riel plegado
  doble: boolean; // además de la versión simple, la versión de dos hojas
};

export type LineaReceta = { rol: Rol; cantidad: number };
export type PiezaPlan = { nombre: string; nota: string; receta: LineaReceta[] };
export type LineaKit =
  | { tipo: "base"; pieza: string; cantidad: number }
  | { tipo: "insumo"; rol: Rol; cantidad: number };
export type KitPlan = { nombre: string; nota: string; composicion: LineaKit[] };
export type Plan = { piezas: PiezaPlan[]; kits: KitPlan[]; errores: string[] };

const FAMILIA_NOMBRE: Record<FamiliaRiel, string> = {
  comun: "común",
  reforzado: "reforzado",
  economico: "económico",
  giratorio: "giratorio",
};

const FAMILIA_PLANCHUELA: Record<FamiliaRiel, Rol> = {
  comun: "planchuela_comun",
  reforzado: "planchuela_gruesa",
  economico: "planchuela_jota", // SUPUESTO: "la misma planchuela que las jotas estándar"
  giratorio: "planchuela_gruesa",
};

const redondear = (n: number) => Math.round(n * 100) / 100;

// Suma las cantidades de un mismo material (la receta no admite repetidos).
function juntar(lineas: LineaReceta[]): LineaReceta[] {
  const mapa = new Map<Rol, number>();
  for (const l of lineas) mapa.set(l.rol, (mapa.get(l.rol) ?? 0) + l.cantidad);
  return [...mapa].map(([rol, cantidad]) => ({ rol, cantidad: redondear(cantidad) }));
}

export const PIEZA_TOPE_RIEL = "Tope de fin de riel";
export const PIEZA_TOPE_PISO = "Tope de piso";
export const PIEZA_TOPE_PISO_GIRATORIO = "Tope de piso giratorio";
export const PIEZA_TUBITO = "Tubito separador";

const PIEZAS_COMUNES: Record<string, PiezaPlan> = {
  [PIEZA_TOPE_RIEL]: {
    nombre: PIEZA_TOPE_RIEL,
    nota: `Ángulo de ${LARGO_TOPE_RIEL_CM} cm`,
    receta: [{ rol: "angulo", cantidad: LARGO_TOPE_RIEL_CM }],
  },
  [PIEZA_TOPE_PISO]: {
    nombre: PIEZA_TOPE_PISO,
    nota: `Ángulo de ${LARGO_TOPE_PISO_CM} cm`,
    receta: [{ rol: "angulo", cantidad: LARGO_TOPE_PISO_CM }],
  },
  [PIEZA_TOPE_PISO_GIRATORIO]: {
    nombre: PIEZA_TOPE_PISO_GIRATORIO,
    nota: `Varilla de 6 mm cortada a ${LARGO_VARILLA_PISO_CM} cm + planchuela de jota de ${LARGO_PLANCHUELA_PISO_CM} cm`,
    receta: [
      { rol: "varilla", cantidad: LARGO_VARILLA_PISO_CM },
      { rol: "planchuela_jota", cantidad: LARGO_PLANCHUELA_PISO_CM },
    ],
  },
  [PIEZA_TUBITO]: {
    nombre: PIEZA_TUBITO,
    nota: `Tubito de ${LARGO_TUBITO_CM} cm cortado de un caño (separador de pared)`,
    receta: [{ rol: "cano", cantidad: LARGO_TUBITO_CM }],
  },
};

function piezaJota(def: DefJota): PiezaPlan {
  const lineas: LineaReceta[] = def.partes.map((p) => ({ rol: p.rol, cantidad: p.cm }));
  if (def.topeJota) {
    // El tope jota se hace con la misma planchuela de la jota.
    lineas.push({ rol: def.partes[0].rol, cantidad: LARGO_TOPE_JOTA_CM });
  }
  for (const e of def.extras) lineas.push(e);
  const medida = def.partes.map((p) => `${p.cm}`).join(" + ");
  return {
    nombre: def.nombre,
    nota: `Planchuela ${medida} cm${def.topeJota ? ` + tope jota de ${LARGO_TOPE_JOTA_CM} cm` : ""}`,
    receta: juntar(lineas),
  };
}

export function nombreRiel(familia: FamiliaRiel, largo: number, plegado: boolean): string {
  return `Riel ${FAMILIA_NOMBRE[familia]} ${largo} cm${plegado ? " plegado" : ""}`;
}

function piezaRiel(familia: FamiliaRiel, largo: number, plegado: boolean, agujeros: number): PiezaPlan {
  const lineas: LineaReceta[] = [{ rol: FAMILIA_PLANCHUELA[familia], cantidad: largo }];
  let nota = `${agujeros} agujeros`;
  if (plegado) {
    const partes = partesPlegado(largo);
    // SUPUESTO: una bisagra por cada unión entre partes.
    lineas.push({ rol: "bisagra", cantidad: partes - 1 });
    nota += `, ${partes} partes con bisagra`;
  }
  return { nombre: nombreRiel(familia, largo, plegado), nota, receta: juntar(lineas) };
}

export function nombreKit(tipo: TipoKit, largo: number, plegado: boolean, doble: boolean): string {
  return `Kit ${TIPOS_KIT[tipo].nombre} ${largo} cm${plegado ? " plegado" : ""}${doble ? " doble" : ""}`;
}

// Qué lleva un kit (la cuenta que se hacía a mano en el taller).
export function composicionKit(
  tipo: TipoKit,
  largo: number,
  plegado: boolean,
  doble: boolean,
  agujeros: number
): LineaKit[] {
  const def = TIPOS_KIT[tipo];
  const repeticion = doble ? 2 : 1; // la versión doble duplica jotas y tope de piso
  const pares = def.jotas.length * repeticion;
  const topesPiso = repeticion;
  const lineas: LineaKit[] = [
    { tipo: "base", pieza: nombreRiel(def.riel, largo, plegado), cantidad: 1 },
    ...def.jotas.map((j): LineaKit => ({ tipo: "base", pieza: j.nombre, cantidad: 2 * repeticion })),
  ];
  if (def.topesRiel) lineas.push({ tipo: "base", pieza: PIEZA_TOPE_RIEL, cantidad: 2 });
  lineas.push(
    {
      tipo: "base",
      pieza: def.topePiso === "giratorio" ? PIEZA_TOPE_PISO_GIRATORIO : PIEZA_TOPE_PISO,
      cantidad: topesPiso,
    },
    // Bolsita: un separador, un tirafondo, un tarugo y una arandela por agujero.
    { tipo: "base", pieza: PIEZA_TUBITO, cantidad: agujeros },
    { tipo: "insumo", rol: "arandela", cantidad: agujeros },
    // Tirafondos y tarugos del riel + 2 de cada por tope de piso.
    { tipo: "insumo", rol: "tirafondo", cantidad: agujeros + 2 * topesPiso },
    { tipo: "insumo", rol: "tarugo", cantidad: agujeros + 2 * topesPiso },
    // 4 tornillos con tuerca por par de jotas.
    { tipo: "insumo", rol: "tornillo_tuerca", cantidad: 4 * pares }
  );
  return lineas;
}

export function planificar(selecciones: Seleccion[]): Plan {
  const errores: string[] = [];
  const piezas = new Map<string, PiezaPlan>();
  const kits: KitPlan[] = [];
  const agregarPieza = (p: PiezaPlan) => {
    if (!piezas.has(p.nombre)) piezas.set(p.nombre, p);
  };

  for (const sel of selecciones) {
    const def = TIPOS_KIT[sel.tipo];
    if (!def) {
      errores.push(`Tipo de kit desconocido: ${sel.tipo}`);
      continue;
    }
    const pedidos = sel.enteros.length + sel.plegados.length;
    if (pedidos === 0) continue;
    if (sel.plegados.length > 0 && !def.plegable) {
      errores.push(`${def.etiqueta} no tiene versión plegada`);
      continue;
    }
    if (sel.doble && !def.permiteDoble) {
      errores.push(`${def.etiqueta} no tiene versión doble`);
      continue;
    }

    for (const jota of def.jotas) agregarPieza(piezaJota(jota));

    const combinaciones: { largo: number; plegado: boolean }[] = [
      ...sel.enteros.map((largo) => ({ largo, plegado: false })),
      ...sel.plegados.map((largo) => ({ largo, plegado: true })),
    ];
    for (const { largo, plegado } of combinaciones) {
      const agujeros = agujerosRiel(def.riel, largo, plegado);
      const vendido = def.largos ? (plegado ? def.largos.plegados : def.largos.enteros).includes(largo) : true;
      if (agujeros === null || !vendido) {
        errores.push(`${def.etiqueta}: no hay riel ${plegado ? "plegado" : "entero"} de ${largo} cm`);
        continue;
      }
      agregarPieza(piezaRiel(def.riel, largo, plegado, agujeros));
      for (const doble of sel.doble ? [false, true] : [false]) {
        const composicion = composicionKit(sel.tipo, largo, plegado, doble, agujeros);
        for (const l of composicion) if (l.tipo === "base" && l.pieza in PIEZAS_COMUNES) agregarPieza(PIEZAS_COMUNES[l.pieza]);
        kits.push({
          nombre: nombreKit(sel.tipo, largo, plegado, doble),
          nota: `${agujeros} agujeros${plegado ? ", riel plegado" : ""}${doble ? ", dos hojas" : ""}`,
          composicion,
        });
      }
    }
  }

  return { piezas: [...piezas.values()], kits, errores };
}

// Roles que necesita un plan (para pedirle al dueño sólo esos materiales).
export function rolesUsados(plan: Plan): Rol[] {
  const usados = new Set<Rol>();
  for (const p of plan.piezas) for (const l of p.receta) usados.add(l.rol);
  for (const k of plan.kits) for (const l of k.composicion) if (l.tipo === "insumo") usados.add(l.rol);
  return (Object.keys(ROLES) as Rol[]).filter((r) => usados.has(r));
}
