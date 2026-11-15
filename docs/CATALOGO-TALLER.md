# Catálogo técnico del taller (dicho por el dueño el 2026-11-15)

Medidas que sirven para armar las piezas, las recetas y los kits. **Todo lo que
dice «a confirmar» todavía no está validado con el dueño.** Complementa a
`docs/PROCESO-TALLER.md`.

> **Actualización 2026-11-15:** los largos 120, 130, 210, 230 y 260 ya no se
> venden y no están en el Generador; lo que dicen las tablas de abajo para esos
> largos es sólo historia. Ver la sección 6c, que manda sobre el resto.

## 1. Rieles estándar y reforzados: largo → agujeros

Largo en cm. «Entero» = una sola barra. «Plegado» = viene en partes soldadas
con bisagra.

| Largo | Entero | Plegado | | Largo | Entero | Plegado |
|---|---|---|---|---|---|---|
| 120 | 3 | — | | 230 | — | 6 |
| 130 | 3 | — | | 240 | — | 6 |
| 140 | 4 | — | | 250 | — | 6 |
| 150 | 4 | — | | 260 | — | 6 |
| 160 | 4 | 6 | | 280 | — | 8 |
| 170 | 4 | 6 | | 300 | — | 8 |
| 180 | 5 | 6 | | 320 | — | 9 |
| 190 | 5 | 6 | | 360 | — | 9 |
| 200 | 5 | 6 | | 400 | — | 10 |
| 210 | — | 6 | | 220 | — | 6 |

Regla práctica: de **2 m para arriba casi todo es plegado** (el 200 puede ser
entero). Algunos más cortos (160 a 190) también se hacen plegados.

**Cómo se arman los plegados** (cada parte tiene los agujeros de una medida
entera):
- Hasta 300 cm: **2 partes** (la mitad cada una) unidas con bisagra. Ej.: 260 →
  2 × 130 (3 + 3 = 6); 300 → 2 × 150 (4 + 4 = 8).
- Más de 300 cm: **3 partes** con bisagra.
  - 320 → 105 + 105 + 110 (9 agujeros)
  - 360 → 118 + 118 + 124 (9 agujeros)
  - 400 → 130 + 130 + 140 (10 agujeros)

## 2. Rieles giratorios (planchuela gruesa, medidas cortas)

| Largo | 80 | 90 | 100 | 110 | 120 | 130 | 140 | 150 |
|---|---|---|---|---|---|---|---|---|
| Agujeros | 3 | 4 | 4 | 4 | 4 | 4 | 4 | 4 |

(En el cuaderno aparece también «PL1,60»: falta confirmar si existe.)

## 3. Tipos de jota y qué material usa cada kit

| Tipo de kit / jota | Jota | Riel | Lleva tope jota |
|---|---|---|---|
| Estándar | 29,5 cm | planchuela común | sí |
| Reforzado | 29,5 cm | planchuela gruesa | sí |
| Giratorio | 2 partes: 23 cm + 15 cm; gasta 1 arandela y 1 tornillo corto | planchuela gruesa | no |
| Superpuesto | (a confirmar) | planchuela gruesa | no |
| Rueda libre | 23 cm | planchuela común | sí |
| Económico («riel liviano») | (a confirmar) | la misma planchuela que las jotas estándar | (a confirmar) |

- La cantidad de agujeros por largo es **la misma para todos los estándares**.
- Los **rieles de ángulo** son publicaciones aparte y **pueden ir con cualquier
  jota**.
- **Tope jota**: pedacito de la misma planchuela de la jota, cortado a **2 cm**;
  se suelda en un lugar preciso de la jota para que la puerta haga tope arriba.
  Van **2 por kit** (uno por jota) — a confirmar.

## 4. Piezas chicas del kit

| Pieza | Material y medida |
|---|---|
| Tope de piso | ángulo de **4,5 cm** |
| Tope de fin de riel | ángulo de **2,5 cm** (2 por kit) |
| Separador de pared | tubito de **4,5 cm** |

## 5. Manijones doble T

Hechos con la planchuela del riel + hierro cuadrado.

| Tamaño | Base (planchuela) | Hierro cuadrado |
|---|---|---|
| Chico | 18 cm | 15 cm |
| Mediano | 25 cm | 20 cm |
| Grande | 40 cm | 30 cm |

## 6. Cantidades de la bolsita (según agujeros del riel)

**Confirmado (2026-11-15):** 1 separador, 1 tirafondo, 1 tarugo y 1 arandela por
agujero. Además cada tope de piso lleva 2 tornillos con tarugo (el generador los
suma a los tirafondos y tarugos del kit).

## 6b. Respuestas del dueño (2026-11-15)

- **Bisagra** de los plegados: es un material (insumo) más, como el tope jota
  lo es de la jota. *Cuántas lleva cada riel no se dijo:* el generador supone
  **una por cada unión entre partes** (2 partes = 1; 3 partes = 2). Corregir si no.
- **Tope jota**: 2 por kit (uno por jota). Superpuesta y económica **no** llevan.
- **Económica**: jota de 23 cm con la planchuela de la jota estándar.
- **Superpuesta**: dos partes de planchuela soldadas; **medida no recordada**
  (el generador no la crea hasta tener el dato).
- **Doble**: 2 pares de jotas (4), 8 tornillos con tuerca y 2 topes de piso.
- **Giratoria**: la arandela y el tornillo corto son **uno por jota**.
- **Tubitos**: se cortan de un caño que viene en barras de 6 m (se corta a 3 m
  para guardarlo, y se pintan). Se modela como insumo «Caño» consumido en cm
  (4,5 cm por tubito).

Supuestos del generador sin confirmar (están marcados «SUPUESTO» en
`lib/generador-datos.ts`): qué planchuela usa la jota reforzada, la de rueda
libre y la giratoria; que el riel económico usa la planchuela de jota; y que
«Riel liviano» del cuaderno es el económico.

## 6c. Respuestas del dueño, tras revisar el sitio (2026-11-15)

Fuente del cruce: sitio de Wix `herreriavyv.wixsite.com/misitio` (la tienda de
Tiendanube que enlaza está suspendida).

- **Largos que ya no se venden** (sacados del Generador): rieles de 120, 130,
  210, 230 y 260 cm. Se siguen vendiendo 140–200 enteros, y plegados 160–200,
  220, 240, 250, 280, 300, 320, 360 y 400.
- **Reforzado**: sí lleva topes de fin de riel. Su jota es **igual a la estándar**
  (planchuela de jota 29,5 + tope jota) pero con **rueda de 60** (la estándar
  lleva rueda de 50). El riel reforzado sí es de planchuela gruesa.
- **Giratorio**: **no lleva topes de fin de riel**. Su **tope de piso es distinto**:
  una varilla de 6 mm cortada a 4,5 cm + un pedazo de planchuela de jota de 8 cm.
  Rieles giratorios de **160 a 200 cm: 5 agujeros** (80 a 200 cm en total).
- **Superpuesto**: siempre viene con **2 jotas reforzadas + 2 jotas superpuestas**
  (4 en total, 8 tornillos con tuerca, 1 tope de piso). La jota superpuesta son
  dos partes de la planchuela de jota estándar: **20 cm y 21 cm**, sin tope jota.
  Se vende en riel de 150, 200 y 300 cm.
- **Kits de pérgola**: se venden, todavía sin cargar (faltan sus medidas y qué llevan).
- **Mercado Libre**: casi todo se vende por ahí; el dueño no tiene control porque
  lo maneja su papá. Va a pasar la lista de publicaciones descargada de ML.

Supuestos nuevos sin confirmar: la jota superpuesta lleva rueda de 60; el riel
superpuesto de 3 m es plegado; la varilla se compra en barras de 6 m.

Cosas que el sitio muestra y el Generador todavía no tiene: kit con **riel de
ángulo** (150, 200 y 300 cm; lleva tirafondo y tarugos pero no separadores),
**carros sueltos** (estándar rueda 50, reforzado rueda 60, superpuesto,
giratoria, rueda libre), **manijas y manijones** (Manija SC, Manijón C, doble T,
Mega manijón doble T, rizado, omega) y porta llaves, perchero y porta tazas.

## 7. Cómo leer el cuaderno

- **Azul** = la etiqueta del pedido ya está pegada en un paquete preparado
  (la mamá imprime las etiquetas por la app de Mercado Libre y se las pone a los
  paquetes con el cuaderno en la mano). Cuando viene la colecta y dicen «faltan
  paquetes», se revisa qué pedidos no tienen azul: o no había paquete armado o
  faltaban piezas o nadie había pedido armarlo.
- **Verde**: variante y envío Flex. **Tachado**: pedido cancelado.
- En el sistema, «azul» equivale al estado **preparado** de `ventas`.
