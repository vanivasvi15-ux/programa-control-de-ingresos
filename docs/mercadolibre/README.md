# Exports de Mercado Libre — análisis para cargar el catálogo

Archivos originales en esta carpeta (bajados desde el panel de "modificación
masiva" de Mercado Libre, 04-09-2026):

- `Fichas_tecnicas-2026_09_04-08_02.xlsx`
- `Publicaciones-2026_09_04-08_01.xlsx`

**Todavía no se importó nada** — esto es el análisis, a la espera de que el
dueño elija una de las opciones de más abajo. Se relaciona con el **Paso 4
(Mercado Libre)** de `../FASE-2.md` y `../PENDIENTE.md`.

---

## Qué tiene cada archivo

### `Fichas_tecnicas-*.xlsx` — 181 publicaciones, sin precio ni stock

Una hoja por categoría de Mercado Libre:

| Categoría ML | Publicaciones |
|---|---|
| Herramientas y artículos… (kits puerta granero, carros, sistemas plegables) | 141 |
| Soportes para vigas y tirantes (bases, codos, soportes T) | 13 |
| Picaportes y manijones | 13 |
| Pérgolas (kits de soporte) | 11 |
| Rieles para muebles | 2 |
| Kits de herrajes para armarios | 1 |

Trae: título, número de publicación (`MLA…`), **código de modelo** (`K1.60`,
`K2.20`, `PL130`, `B01`…), marca, y atributos técnicos (medidas, material,
terminación, unidades por pack). Filas 1-4 de cada hoja son encabezados del
propio formato de ML (`FIXED`/`ATTRIBUTE`, nombres de columna en inglés y
español); los datos reales arrancan en la fila 5.

### `Publicaciones-*.xlsx` — sólo 24, con datos comerciales

Una sola hoja ("Publicaciones"), con precio, stock propio (`STOCK_FLEX`),
stock en depósito de ML (`STOCK_FULL`), estado y categoría — pero **sólo
para la línea de pérgolas/soportes**. Los 141 kits de puerta granero **no
vinieron** en este export (quedó filtrado por categoría al descargarlo).

Ejemplos reales:

| MLA | Precio | Stock propio | Título |
|---|---|---|---|
| MLA1471490163 | $ 28.000 | 97 | Base Viga 3x3 Para Pérgolas |
| MLA2022602680 | $ 220.000 | 23 | Kit De Soportes De Acero Para Pérgolas 3x3 |
| MLA1500405941 | $ 230.000 | 88 | Kit Para Armado De Pérgola Viga 3x3 |
| … | … | … | (24 en total, todas "Activa") |

---

## El problema real: son avisos, no productos

El mismo producto está publicado muchas veces con títulos distintos (táctica
de SEO de ML). El código de `MODEL` identifica el producto real en algunos
casos pero no en todos:

- **Confiables**: `K1.60`, `K2.20`, `PL130`, `B01`/`B02` (base 3x3 / 4x4)…
- **Sobrecargados**: `K1` aparece en 10 publicaciones, `K2` en 8, `K3` en 7 —
  y cruzan productos **distintos entre sí** ("hasta 2m", "hasta 3m", "hasta
  80cm", "colgante", "doble puerta"). Ahí la separación fina sólo la sabe el
  dueño.

**181 avisos ≈ 50–70 productos reales.** Esto encaja con el esquema que ya
existe (Fase 2, Paso 1): `productos` es "el modelo interno, uno por receta
distinta"; `publicaciones` son "los avisos concretos, muchos por producto"
(`producto_id`, `canal`, `ml_item_id`, `titulo`, `UNIQUE(canal, ml_item_id)`).

## Lo que NO está en estos archivos (no puede estarlo — es interno)

- La **receta** de cada kit: qué piezas base (carro, riel, topes) y qué
  herrajes lleva, y cuántos de cada uno.
- El **costo**.

Eso se carga a mano en `/stock` sobre los productos ya creados.

---

## Opciones para cargar (a decidir por el dueño)

| Opción | Qué haría Claude | Resultado |
|---|---|---|
| **A** | Importar los 181 avisos como `publicaciones` + un `producto` borrador por (categoría + modelo). | Todo adentro rápido; después hay que fusionar/separar en el panel y cargar recetas y costos. Queda trabajo de limpieza (sobre todo K1/K2/K3). |
| **B** | Sólo los ~24 de pérgola/soportes que ya tienen precio y stock, como productos + publicaciones limpios. | Empieza chico y prolijo, con datos completos. |
| **C** | El dueño vuelve a exportar **"Publicaciones" sin filtro de categoría** (los 181, con precio y stock) y se hace la A completa con eso. | Todo adentro con precio/stock real desde el vamos. |
| **D** | Esperar al Paso 4 (integración con la API de Mercado Libre): OAuth por cuenta y el programa trae los avisos con precio/stock en vivo, sin exportar nada a mano. | Lo más prolijo, pero es un paso más adelante (necesita crear la app en el portal de desarrolladores de ML y autorizarla en cada cuenta — ver `../PENDIENTE.md` § Paso 4). |

**Recomendación**: **C**, y con eso la **A** — reexportar el archivo
completo, importar avisos + productos borrador, y limpiar/cargar recetas
encima. Si se prefiere no tocar más exports manuales, ir directo a la
**D** cuando se llegue al Paso 4.

Todavía no se armó el script de importación — depende de qué opción se
elija.
