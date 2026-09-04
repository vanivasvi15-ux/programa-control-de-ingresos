# Fase 2 · Paso 1 — Datos + API de stock y producción

Plan detallado del primer paso de la [Fase 2](FASE-2.md). **Todavía NO se
escribió código**: este documento es para revisar y aprobar antes de empezar.

Igual que en la Fase 1: se hace un paso, se prueba, se confirma, y recién
ahí el siguiente.

> Revisión 2 (2026-09-03): tras la vuelta del dueño — todas las piezas se
> pueden vender, publicación separada del producto, consumibles fuera de la
> receta con recuento periódico.

---

## Qué entrega el Paso 1

- Las **tablas nuevas** para insumos, piezas que se fabrican, productos que
  se venden, publicaciones, recetas, órdenes de producción y el historial
  de stock.
- La **API** (las direcciones internas que usa el panel) para leer y cargar
  todo eso.
- El **cálculo del costo** de cada pieza y de cada kit, hacia arriba: si
  cambia el precio de la planchuela, cambia solo lo que sale un carro y lo
  que sale el kit.
- Dos arreglos internos de plomería (migraciones y transacciones) que
  explico abajo en criollo.

## Qué NO entrega (viene después)

- **Pantallas.** El Paso 1 no tiene nada visual. Se prueba con datos de
  ejemplo. Las pantallas de `/stock` son el Paso 2.
- **Tienda, pedidos, Mercado Libre, Mercado Pago, chatbot.** Pasos 3 a 6.
- **Producción/tareas, personal/fichadas, instructivos, sugerencia de la
  IA.** Módulos posteriores — ver [FASE-2.md](FASE-2.md).
- El enganche "comprar material = un gasto en el Control de Caja" queda
  **preparado** (hay un campo para eso) pero se completa en el Paso 2.
- El **aviso** y la **pantalla** del recuento periódico de consumibles: las
  tablas entran ahora, el resto en el Paso 2.

---

## Las tablas nuevas, en criollo

### 1. `insumos` — todo lo que tiene stock y no se vende armado

Planchuela, ángulo, ruedas, tornillería interna, separadores, tirafondos,
tuercas, arandelas, gas, discos de corte, alambre de soldar, etc.

Cada insumo guarda:

| Campo | Qué es | Ejemplo |
|---|---|---|
| nombre | — | "Planchuela 1 1/4 x 1/8" |
| tipo | `materia_prima`, `herraje` o `consumible` | materia_prima |
| unidad en que se **compra** | cómo viene del proveedor | tira |
| unidad en que se **consume** | cómo lo pide la receta | cm |
| factor | cuántas unidades de consumo entran en **una** de compra | 600 — una tira de 6 m da 600 cm para gastar en recetas |
| stock | cuánto hay, en unidad de consumo | 4300 (cm) |
| alerta_minimo | avisar cuando baja de acá (vacío = sin aviso) | 1200 |
| costo | lo que sale **una unidad de compra** (último precio pagado) | 38000 (la tira) |
| activo | si se sigue usando | sí |

- Para el metal el factor es siempre 600 (tira de 6 m, receta en cm). Para
  ruedas, tuercas, etc. la unidad de compra y de consumo son la misma
  ("unidad") y el factor es 1.
- El **costo es el último precio que pagaste**. Cuando cargás una compra más
  cara, se actualiza y todo lo que use ese insumo se recalcula.
- Los **consumibles** (gas, discos, alambre, electricidad) viven acá con su
  stock y su alerta de mínimo, **pero no entran en las recetas** (ver
  `receta_base`). Su stock se controla con el **recuento periódico**.

### 2. `productos_base` — las piezas que fabrica la herrería

El carro, el riel (uno por cada largo, y con/sin bisagra), el tope de fin
de riel, el tope de piso. Tienen su propio stock: las que ya están hechas y
esperando para armar un kit o venderse.

| Campo | Qué es | Ejemplo |
|---|---|---|
| nombre | — | "Riel 200 con bisagra" |
| stock | piezas ya fabricadas | 6 |
| minutos_mano_obra | cuánto lleva fabricar una (opcional, para el costo) | 25 |
| costo_calculado | lo que sale fabricar una, lo calcula el sistema | 8900 |
| activo | — | sí |

- **Todas las piezas se pueden vender.** No hay una marca de "vendible": si
  querés vender un carro solo, se crea un `producto` "Carro (repuesto)" que
  por dentro lleva "1 carro" (hay un botón que lo arma). Así la venta
  suelta pasa por el mismo circuito que los kits.
- Una pieza base se fabrica **solo con insumos** (no lleva otras piezas
  base adentro). Si algún día un riel llevara un sub-conjunto fabricado, se
  agrega en su momento.
- Los minutos de mano de obra son opcionales: si no cargás una tarifa por
  minuto, no suman nada al costo.

### 3. `productos` — lo que se vende

El "modelo interno" de cada cosa que se vende: el kit, o un repuesto. Uno
por cada receta distinta.

| Campo | Qué es | Ejemplo |
|---|---|---|
| nombre | nombre ordenado, para uso interno | "Kit Puerta Granero — riel 200 con bisagra" |
| precio | precio de venta de referencia | 145000 |
| costo_calculado | lo que sale armarlo, lo calcula el sistema | 76000 |
| imagen | para la tienda propia (Paso 3) | (vacío por ahora) |
| activo | — | sí |

- El "riel 200 con bisagra" y el "riel 200 sin bisagra" son **dos
  productos** (la receta cambia).
- Varias publicaciones de Mercado Libre con nombres distintos que son **el
  mismo** kit apuntan **todas al mismo producto** — eso lo maneja la tabla
  `publicaciones`.

### 3b. `publicaciones` — cada aviso de Mercado Libre o de la tienda

Separa "el aviso" de "el producto". Muchas publicaciones cuelgan de un solo
producto.

| Campo | Qué es | Ejemplo |
|---|---|---|
| producto | a qué producto interno pertenece | Kit … riel 200 con bisagra |
| canal | `mercadolibre`, `tienda` u `otro` | mercadolibre |
| ml_item_id | el código de la publicación en ML (se completa en el Paso 4) | (vacío por ahora) |
| cuenta | etiqueta de la cuenta | "principal" |
| titulo | el nombre tal cual figura en ese aviso | "Kit Puerta Granero Corrediza Riel Reforzado 2mts Cierre Suave" |
| url | link al aviso | … |
| activo | — | sí |

- 5 avisos con títulos distintos que son el mismo kit → 5 filas acá, 1
  producto. Se vende por cualquiera → descuenta el mismo stock. Baja el
  stock → se sincroniza a los 5 (Paso 4).

### 4. `receta_base` — con qué se fabrica cada pieza

Una fila por ingrediente de una pieza. **Solo materia prima y herrajes.**
Ejemplo, el carro:

| pieza | insumo | cantidad | ¿frena si falta? |
|---|---|---|---|
| Carro | Planchuela 1 1/4 x 1/8 | 80 cm | sí |
| Carro | Ángulo 1 x 1/8 | 20 cm | sí |
| Carro | Rueda de nylon | 2 unidades | sí |

- "¿Frena si falta?" = **bloqueante**. La materia prima y los herrajes
  frenan el armado si no hay.
- Los **consumibles** (gas, discos, alambre) **no van en la receta** —
  eran difíciles de medir por pieza. Se controlan con el recuento
  periódico. Si más adelante querés que sumen al costo, se agrega un
  "costo indirecto" fijo o un porcentaje por pieza.

### 5. `composicion_producto` — de qué se compone un producto

Una fila por componente. Puede ser una **pieza fabricada** o un **insumo**
(herraje comprado que va directo, sin pieza intermedia).

| producto | componente | cantidad |
|---|---|---|
| Kit … riel 200 con bisagra | Carro *(pieza)* | 2 |
| Kit … riel 200 con bisagra | Riel 200 con bisagra *(pieza)* | 1 |
| Kit … riel 200 con bisagra | Tope de fin de riel *(pieza)* | 2 |
| Kit … riel 200 con bisagra | Tope de piso *(pieza)* | 1 |
| Kit … riel 200 con bisagra | Separador de riel *(insumo)* | 4 |
| Kit … riel 200 con bisagra | Tornillo tirafondo *(insumo)* | 4 |
| Kit … riel 200 con bisagra | Tarugo *(insumo)* | 4 |
| Kit … riel 200 con bisagra | Tornillo con rosca *(insumo)* | 4 |
| Kit … riel 200 con bisagra | Tuerca *(insumo)* | 4 |
| Kit … riel 200 con bisagra | Arandela *(insumo)* | 4 |

El "Carro (repuesto)" es un producto con una sola fila: Carro *(pieza)* × 1.

### 6. `ordenes_produccion` — "fabricar N piezas"

Cuando la herrería hace una tanda de carros, se registra una orden.

| Campo | Qué es |
|---|---|
| pieza | qué se fabrica (ej. Carro) |
| cantidad | cuántas (ej. 8) |
| estado | `planificada` (todavía no se hizo) · `realizada` (se hizo) · `anulada` |
| fecha | cuándo |
| quién | usuario que la cargó |
| costo_total | lo que costó la tanda (lo calcula el sistema al marcarla realizada) |
| nota | — |

- Mientras está **planificada** no toca el stock (es una intención).
- Al marcarla **realizada**, en un solo movimiento el sistema: descuenta
  del stock los insumos de la receta × la cantidad, suma las N piezas al
  stock de la pieza, y anota todo en el historial. Si falta materia prima o
  algún herraje, **no hace nada** y te dice qué falta.
- Anular una orden ya realizada revierte esos movimientos.

### 7. `movimientos_stock` — el historial de stock

Una fila por cada cambio de stock. Nunca se pisa el número a lo bruto:
siempre queda registrado por qué cambió.

| Campo | Qué es | Ejemplo |
|---|---|---|
| qué cambió | un insumo o una pieza | Planchuela 1 1/4 |
| cuánto | con signo | −640 (cm) |
| stock después | cómo quedó | 3660 |
| motivo | `compra` · `produccion_consumo` · `produccion_alta` · `venta` · `ajuste` · `recuento` · `anulacion` | produccion_consumo |
| referencia | de qué orden / compra / pedido / recuento viene | orden de producción #12 |
| quién | usuario | Cristian |

Sirve para responder "¿por qué tengo 3 carros y no 5?", para costear con el
precio que tenía el material en ese momento, y para encontrar errores de
carga.

### 8. `compras_insumo` — cargar una compra de material

Sube el stock de un insumo. La pantalla para esto es el Paso 2, pero la
tabla y su API entran ahora para poder cargar el stock inicial y probar.

| Campo | Qué es |
|---|---|
| insumo | qué se compró |
| cantidad | en unidad de compra (ej. 10 tiras) |
| costo unitario | lo que salió cada unidad de compra esta vez |
| costo total | cantidad × costo unitario |
| actualiza_costo | si sí, deja este precio como el costo del insumo (último precio) |
| movimiento_id | el gasto que se genera en el Control de Caja *(se completa en el Paso 2)* |
| proveedor, fecha, nota, quién | — |

### 9. `recuento_listas` y `recuento_items` — control de lo difícil de medir

Vos armás listas ("Consumibles de soldadura", "Discos", …), le ponés cada
cuántos días revisarlas, y elegís qué insumos entran en cada una.

| `recuento_listas` | — |
|---|---|
| nombre | "Consumibles de soldadura" |
| dias_cada | 3 |
| ultima_revision | 2026-09-01 |
| activo | sí |

| `recuento_items` | — |
|---|---|
| lista | Consumibles de soldadura |
| insumo | Gas para soldar |

- El **aviso** ("pasaron 3 días, revisá esta lista") y la **pantalla** para
  cargar los números van en el Paso 2. Cuando respondés, cada número nuevo
  genera un `movimientos_stock` con motivo `recuento` y actualiza el stock.

---

## Cómo se calcula el costo (con números)

**Costo de un insumo por unidad de consumo** = costo ÷ factor.
La tira de planchuela sale $38.000 y trae 600 cm → **$63,33 por cm**.

**Costo de una pieza base** = suma de (cantidad × costo por unidad de
consumo) de cada renglón de su receta, + mano de obra si se cargó una
tarifa. Ejemplo carro:

| renglón | cuenta | subtotal |
|---|---|---|
| 80 cm planchuela | 80 × 63,33 | 5.067 |
| 20 cm ángulo | 20 × 40,00 | 800 |
| 2 ruedas de nylon | 2 × 1.500 | 3.000 |
| mano de obra 25 min | 25 × 0 *(sin tarifa)* | 0 |
| **costo del carro** | | **8.867** |

**Costo de un producto** = suma de sus componentes: cada pieza por su
`costo_calculado`, cada insumo por su costo por unidad de consumo. Ejemplo
kit:

| componente | cuenta | subtotal |
|---|---|---|
| 2 carros | 2 × 8.867 | 17.734 |
| 1 riel 200 con bisagra | 1 × 21.000 | 21.000 |
| 2 topes de fin de riel | 2 × 2.400 | 4.800 |
| 1 tope de piso | 1 × 3.100 | 3.100 |
| 4 separadores + 4 tirafondos + 4 tarugos + 4 tornillos + 4 tuercas + 4 arandelas | … | 6.800 |
| **costo del kit** | | **53.434** |

Los costos quedan **guardados** en cada pieza y cada producto, y se
recalculan cuando cambia un precio, una receta o una composición. (Los
consumibles no están en esta cuenta por ahora; la ganancia fina —precio
menos costo, comisión de Mercado Libre e impuestos— es una pantalla aparte
que llega con la integración de ML.)

---

## La API (para referencia)

Mismo estilo que la Fase 1: rutas bajo `app/api/...`, permisos resueltos en
el servidor, `force-dynamic`.

| Ruta | Qué hace | Quién |
|---|---|---|
| `GET/POST /api/insumos` · `PUT/DELETE /api/insumos/[id]` | ABM de insumos. Borrar = desactivar si está en alguna receta. | todos (contador: solo lee) |
| `GET/POST /api/productos-base` · `PUT/DELETE /api/productos-base/[id]` | ABM de piezas fabricadas. | todos (contador: solo lee) |
| `GET/PUT /api/productos-base/[id]/receta` | Ver / reemplazar la receta completa de una pieza. | todos (contador: solo lee) |
| `GET/POST /api/productos` · `PUT/DELETE /api/productos/[id]` | ABM de productos que se venden. | todos (contador: solo lee) |
| `POST /api/productos/desde-pieza` | Crea un producto "envoltorio" para vender una pieza base suelta. | todos (contador: solo lee) |
| `GET/PUT /api/productos/[id]/composicion` | Ver / reemplazar la composición de un producto. | todos (contador: solo lee) |
| `GET/POST /api/publicaciones` · `PUT/DELETE /api/publicaciones/[id]` | Vincular avisos (ML/tienda) a un producto. | todos (contador: solo lee) |
| `GET/POST /api/ordenes-produccion` · `PUT/DELETE /api/ordenes-produccion/[id]` | Órdenes de producción. El `PUT` que pasa a `realizada` mueve el stock (o falla diciendo qué falta). | todos (contador: solo lee) |
| `GET/POST /api/compras-insumo` · `DELETE /api/compras-insumo/[id]` | Cargar / revertir una compra de material. | todos (contador: solo lee) |
| `GET/POST /api/recuento-listas` · `PUT/DELETE /api/recuento-listas/[id]` · `POST /api/recuento-listas/[id]/responder` | Listas de recuento y carga de los números. | todos (contador: solo lee) |
| `GET /api/movimientos-stock` | Historial de stock, con filtros por insumo/pieza, motivo y fechas. Solo lectura. | cualquiera logueado |
| `GET /api/stock/costos` · `POST /api/stock/costos/recalcular` | Ver / forzar el recálculo de todos los costos. | todos (contador: solo lee) |

**Roles para `/stock`** (resuelto): **sin separación** — cualquier usuario
logueado maneja todo el stock y el catálogo (crear, editar, cargar). El
`contador` sigue siendo solo lectura. Las "pantallas por sector"
(Producción, Embalaje) son una comodidad de la interfaz del módulo de
producción/tareas —cada encargado tiene su pantalla de inicio pero puede
entrar a todo—, no un tema de permisos.

---

## Los dos arreglos internos (plomería, no hay que decidir nada)

### Migraciones

Cuando agregue las tablas nuevas hay que actualizar la base de datos que ya
tenés cargada (y la de la otra compu) **sin borrar nada**. Hoy el proyecto
hace eso de una forma que además esconde errores. Lo cambio por un
mecanismo que lleva la cuenta de qué cambios ya aplicó, sabe rehacer una
tabla cuando SQLite no deja modificarla en el lugar, y avisa si algo falla
de verdad. Es invisible para vos; solo hay que hacerlo antes de meter lo
nuevo.

El primer uso concreto: la tabla `movimientos` hoy solo acepta que un
movimiento venga de `whatsapp` o del `panel`. La Fase 2 necesita que
también pueda venir de una `compra` de material, de `mercadolibre`, de
`mercadopago` o de la `tienda`. Ese cambio se hace una sola vez ahora.

### Transacciones

Marcar una orden de producción como "realizada" hace varios cambios juntos
(descontar planchuela, descontar ángulo, descontar ruedas, sumar los
carros, anotar el historial). Tienen que salir **todos o ninguno**: si se
corta la luz a la mitad, no podés quedar con la planchuela descontada y los
carros sin sumar. Eso ya existe a medias en el código (en "registrar un
fijo"); lo dejo como una función ordenada que usan todas las operaciones de
la Fase 2.

---

## Notas técnicas (para Claude Code)

- **Tipos de columna**: plata en `INTEGER` de pesos (sin centavos), igual
  que `movimientos.monto`. Cantidades de stock y de receta en `REAL` (el
  metal se consume fraccionado). Fechas `TEXT` `'YYYY-MM-DD'`. Timestamps
  `TEXT` con `datetime('now','localtime')`. Booleanos como `INTEGER 0/1`.
- **`insumos`**: `tipo TEXT CHECK (tipo IN ('materia_prima','herraje','consumible'))`,
  `unidad_compra TEXT`, `unidad_consumo TEXT`, `factor_compra REAL NOT NULL DEFAULT 1`
  (unidades de consumo por 1 de compra), `stock REAL NOT NULL DEFAULT 0`
  (en unidad de consumo), `alerta_minimo REAL`, `costo_unitario INTEGER NOT
  NULL DEFAULT 0` (pesos por unidad de compra, último precio), `activo`,
  `nota`, `creado`, `actualizado`.
- **`productos_base`**: `nombre TEXT NOT NULL UNIQUE`, `stock INTEGER NOT
  NULL DEFAULT 0`, `mano_obra_minutos INTEGER NOT NULL DEFAULT 0`,
  `costo_calculado INTEGER`, `costo_actualizado TEXT`, `activo`, `nota`,
  timestamps. (Sin flag de "vendible": vender suelto = crear un `producto`
  envoltorio vía `POST /api/productos/desde-pieza`.)
- **`productos`**: `nombre TEXT NOT NULL`, `sku TEXT UNIQUE`, `precio
  INTEGER NOT NULL DEFAULT 0`, `costo_calculado INTEGER`, `costo_actualizado
  TEXT`, `imagen TEXT`, `activo`, `nota`, timestamps. (Sin `ml_item_id`:
  ahora vive en `publicaciones`.)
- **`publicaciones`**: `producto_id INTEGER NOT NULL REFERENCES
  productos(id)`, `canal TEXT NOT NULL DEFAULT 'mercadolibre' CHECK (canal
  IN ('mercadolibre','tienda','otro'))`, `ml_item_id TEXT`, `cuenta TEXT`,
  `titulo TEXT`, `url TEXT`, `activo INTEGER NOT NULL DEFAULT 1`, `creado`.
  Índice en `ml_item_id`; `UNIQUE(canal, ml_item_id)` (SQLite permite
  varios NULL).
- **`receta_base`**: `producto_base_id INTEGER NOT NULL REFERENCES
  productos_base(id)`, `insumo_id INTEGER NOT NULL REFERENCES insumos(id)`,
  `cantidad REAL NOT NULL`, `bloqueante INTEGER NOT NULL DEFAULT 1`,
  `UNIQUE(producto_base_id, insumo_id)`. La API rechaza agregar un insumo
  `tipo='consumible'` a una receta (van por recuento).
- **`composicion_producto`**: `producto_id INTEGER NOT NULL REFERENCES
  productos(id)`, `item_tipo TEXT NOT NULL CHECK (item_tipo IN
  ('base','insumo'))`, `item_id INTEGER NOT NULL`, `cantidad REAL NOT NULL`,
  `UNIQUE(producto_id, item_tipo, item_id)`. La columna polimórfica
  `item_id` no lleva FK: se valida en la API.
- **`ordenes_produccion`**: `producto_base_id INTEGER NOT NULL REFERENCES
  productos_base(id)`, `cantidad INTEGER NOT NULL CHECK (cantidad > 0)`,
  `estado TEXT NOT NULL DEFAULT 'planificada' CHECK (estado IN
  ('planificada','realizada','anulada'))`, `fecha TEXT NOT NULL`,
  `costo_total INTEGER`, `usuario_id INTEGER REFERENCES usuarios(id)`,
  `nota`, timestamps.
- **`movimientos_stock`**: `item_tipo TEXT NOT NULL CHECK (item_tipo IN
  ('insumo','base'))`, `item_id INTEGER NOT NULL`, `delta REAL NOT NULL`,
  `stock_resultante REAL NOT NULL`, `motivo TEXT NOT NULL CHECK (motivo IN
  ('compra','produccion_consumo','produccion_alta','venta','ajuste','recuento','anulacion'))`,
  `referencia_tipo TEXT`, `referencia_id INTEGER`, `costo_unitario_momento
  INTEGER`, `usuario_id INTEGER REFERENCES usuarios(id)`, `nota`, `creado`.
  Índices: `(item_tipo, item_id)` y `creado`.
- **`compras_insumo`**: `insumo_id INTEGER NOT NULL REFERENCES insumos(id)`,
  `cantidad_compra REAL NOT NULL CHECK (cantidad_compra > 0)`,
  `costo_unitario INTEGER NOT NULL`, `costo_total INTEGER NOT NULL`,
  `actualiza_costo INTEGER NOT NULL DEFAULT 1`, `movimiento_id INTEGER
  REFERENCES movimientos(id)`, `proveedor TEXT`, `fecha TEXT NOT NULL`,
  `usuario_id INTEGER REFERENCES usuarios(id)`, `nota`, `creado`.
- **`recuento_listas`**: `nombre TEXT NOT NULL`, `dias_cada INTEGER NOT NULL
  DEFAULT 3 CHECK (dias_cada > 0)`, `ultima_revision TEXT`, `activo INTEGER
  NOT NULL DEFAULT 1`, `creado`. **`recuento_items`**: `lista_id INTEGER NOT
  NULL REFERENCES recuento_listas(id)`, `insumo_id INTEGER NOT NULL
  REFERENCES insumos(id)`, `UNIQUE(lista_id, insumo_id)`.
- **`config`** (nueva, chica): `clave TEXT PRIMARY KEY, valor TEXT`. Primer
  uso: `tarifa_mano_obra_minuto` (pesos, default `'0'`). Evita hardcodear.
- **Mecanismo de migraciones**: tabla `migraciones_aplicadas (id TEXT
  PRIMARY KEY, aplicada TEXT DEFAULT (datetime('now','localtime')))`. En
  `lib/db.ts`, lista ordenada de `{ id, fn(db) }`. Al abrir la conexión,
  por cada `id` que no esté en la tabla: correr `fn` dentro de una
  transacción y registrarlo. Los errores **se propagan** (no más
  `catch {}` mudo); solo se tolera explícitamente "duplicate column" en las
  dos migraciones legacy ya existentes. La primera migración nueva
  reconstruye `movimientos` con el `CHECK` de `origen` ampliado a
  `('whatsapp','panel','compra','tienda','mercadolibre','mercadopago')`
  siguiendo el procedimiento de 12 pasos de SQLite (crear tabla nueva,
  copiar, borrar vieja, renombrar, recrear índices) con `PRAGMA
  foreign_keys = OFF` alrededor y todo dentro de la transacción.
- **Helper de transacciones**: `lib/db.ts` exporta `transaccion(fn)` que
  hace `BEGIN`/`COMMIT`/`ROLLBACK` con guarda contra anidamiento (SQLite
  tira error con `BEGIN` anidado). Reemplazar el `db.exec("BEGIN")` inline
  de `app/api/movimientos/[id]/registrar/route.ts` por este helper.
- **Cálculo de costos**: funciones **puras** en `lib/stock-datos.ts` (sin
  importar `node:sqlite`, patrón de `lib/movimientos-datos.ts`), para poder
  testearlas y usarlas desde el cliente. `lib/stock.ts` (con `node:sqlite`)
  arma los datos desde la base y llama a las puras. El rollup es de 2
  niveles: insumos → pieza base → producto; las piezas base no anidan otras
  piezas base (validar y rechazar en la API si alguien lo intenta).
- **Recalcular costos**: al cambiar el `costo_unitario` de un insumo, una
  `receta_base` o una `composicion_producto`, recalcular en cascada las
  piezas y productos afectados dentro de la misma transacción. Más un
  endpoint manual `POST /api/stock/costos/recalcular` que rehace todo.
- **"Listo para armar" / faltantes**: la función pura que, dado un producto
  y una cantidad, devuelve `{ listo, faltantes: [{tipo, nombre, faltan,
  unidad}] }` mirando solo renglones bloqueantes y pudiendo "fabricar" una
  pieza faltante si hay insumos — se escribe y testea en este paso (es
  pura), pero su pantalla es el Paso 3. Cuenta el stock por consulta, sin
  reservar: con varios pedidos a la vez puede contar dos veces el mismo
  stock; se avisa en pantalla en el Paso 3 y se evalúa reservar más
  adelante.
- **Semilla de prueba**: un `scripts/seed-stock.js` (aparte del
  `seed-datos.js` de la Fase 1) con un puñado de insumos, el carro, un par
  de rieles, los topes, un kit completo y una publicación de ejemplo, para
  probar el Paso 1 sin pantallas. Cuando llegue la lista de precios real
  del metal, se arma la semilla de insumos de metal con datos de verdad.

---

## Definiciones cerradas

1. **Roles de `/stock`**: sin separación. Todos los usuarios logueados
   manejan todo; `contador` solo lee.
2. **Mano de obra**: `tarifa_mano_obra_minuto = 0` por ahora. Todo el
   catálogo arranca vacío y editable.
3. **Lista de precios**: la pasó el dueño (lista mayorista de J.Gomez SRL,
   12/08/2026). Es un catálogo de proveedor, no la lista de materiales de
   los kits: sirve para poner **precios y familias reales** en la semilla
   de prueba, pero las **cantidades por pieza** (cuántos cm de tal
   planchuela lleva un carro) las define el dueño más adelante (módulo de
   instructivos) o a mano en `/stock`. La semilla usa, con precios
   aproximados de esa lista:
   - Planchuela 3/4" × 1/8, 1" × 1/8, 1 1/4" × 1/8 (tira 6 m).
   - Ángulo 3/4" × 1/8, 1" × 1/8 (tira 6 m).
   - Rueda canal V 60 mm y 75 mm (unidad).
   - Redondo liso 1/2" (tira 6 m), para ejes.
   - Disco de corte Tyrolit 115 × 1,6 y alambre de soldar por kg
     (consumibles, van a una lista de recuento).
   - Herrajes del kit (separador, tirafondo, tarugo, tornillo, tuerca,
     arandela) con precio inventado por unidad — no están en esa lista.
