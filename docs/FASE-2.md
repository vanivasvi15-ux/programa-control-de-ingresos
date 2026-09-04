# Fase 2 — Stock, producción, tienda propia e integraciones

Notas de planificación (todavía NO se empezó a construir). La Fase 1
(Control de Caja) está terminada — ver [../CLAUDE.md](../CLAUDE.md).

Esta fase es la que el prompt original de Herrería VyV anticipaba:
"después sumo stock/materia prima y tienda propia".

---

## Objetivo

Un sistema tipo el POS de Steve's Burger, adaptado a la herrería:

- **Tienda pública** (reemplaza la de Wix, que está fuera de línea) con
  info + catálogo + carrito + checkout.
- **Pedidos**: cola unificada de la tienda + **ventas de Mercado Libre
  importadas** + carga manual.
- **Preparación de pedidos** (tipo `/caja` del POS): ver qué armar, marcar
  empaquetado, imprimir la etiqueta de envío de ML.
- **Productos, piezas y stock** de producto terminado, piezas fabricadas y
  materia prima.
- **Chatbot** para clientes (WhatsApp) y para las **preguntas de Mercado
  Libre**.
- Todo engancha con la Fase 1: una venta enviada → un `ingreso`; comprar
  materia prima → un `gasto`.

---

## El producto: 3 niveles

Ejemplo real: **Kit Puerta Granero**.

El kit (lo que se vende) se compone de:

| Componente | Cant. | Tipo |
|---|---|---|
| Carro | 2 | **producto base** (se fabrica) |
| Riel | 1 | **producto base** (se fabrica; variante: con/sin bisagra) |
| Tope de fin de riel | 2 | **producto base** |
| Tope de piso | 1 | **producto base** |
| Separador de riel | 4 | herraje |
| Tornillo tirafondo | 4 | herraje |
| Tarugo | 4 | herraje |
| Tornillo con rosca | 4 | herraje |
| Tuerca | 4 | herraje |
| Arandela | 4 | herraje |

Cada **producto base** (ej. el Carro) se fabrica con:

- **Materia prima** — planchuela (varios grosores), ángulo (varios
  grosores), ruedas, tornillería interna. Físico, se descuenta del stock,
  y **bloquea** el armado si falta.
- **Consumibles de fabricación** — gas para soldar, alambre de soldar,
  discos de corte, discos de desbaste, electricidad. Entran en el
  **costo**, pero NO bloquean el envío de una pieza ya hecha.

A diferencia de Steve's (un solo nivel: ingredientes → producto), acá hay
dos niveles de receta: **materia prima → producto base → producto final**,
y el producto final además puede llevar herrajes comprados directo, sin
pieza intermedia.

---

## Modelo de datos (borrador)

| Tabla | Qué guarda |
|---|---|
| `insumos` | todo lo que tiene stock y no se vende suelto. `tipo`: `materia_prima` \| `herraje` \| `consumible` · `unidad` (m, kg, unidad) · `stock` · `alerta_minimo` · `costo_unitario` |
| `productos_base` | piezas fabricadas (carro, riel, topes). `stock` (las ya hechas) · `costo_calculado` |
| `productos` | lo que se vende (Kit...). `precio` · `costo_calculado` · `ml_item_id` · variantes |
| `receta_base` | `(producto_base_id, insumo_id, cantidad, bloqueante)` — bloqueante=1 para materia prima/herrajes, 0 para consumibles |
| `composicion_producto` | `(producto_id, item_tipo: base\|insumo, item_id, cantidad)` |
| `ordenes_produccion` | "fabricar N carros" → descuenta insumos según receta, suma N al stock del carro |
| `movimientos_stock` | historial (compra, producción, venta, ajuste) por insumo/pieza/producto |

### Reglas

- **Kit completo para enviar**: un kit se puede enviar si, para *cada*
  componente bloqueante, hay stock propio ≥ lo pedido **o** se puede
  fabricar la pieza que falta (recursivo; mira materia prima/herrajes,
  ignora consumibles). El pedido muestra "listo para armar" o
  "faltan: 1 carro, riel".
- **Costos hacia arriba**: costo del producto base = Σ materia prima +
  Σ consumibles (+ mano de obra opcional, tarifa por hora). Costo del kit
  = Σ productos base + Σ herrajes.
- **Compra de insumos**: una pantalla de "compra" sube el stock del insumo
  y de paso genera un `gasto` en el Control de Caja (categoría a elección).
- **Venta enviada**: descuenta stock (piezas/productos) y genera un
  `ingreso`.

---

## Integraciones

### Mercado Pago — factible

- Una o **varias cuentas** (Viviana, Cristian, las que sumen). Cada cuenta
  tiene su propio Access Token (panel de desarrolladores de MP). Para
  cuentas propias no hace falta OAuth.
- Se puede traer: pagos recibidos, y el **"Reporte de liberación de
  dinero" / resumen de cuenta** (el mismo PDF que se cargó a mano en la
  Fase 1, pero la API lo genera y baja en CSV/Excel).
- Plan: tarea programada que baja el reporte de cada cuenta, lo interpreta
  y arma `movimientos` con `origen = 'mercadopago'`, aplicando **reglas de
  categorización** (ej. "Liquidación de dinero" → Ventas; "Pago Edenor" →
  Luz) que se cargan una vez. Reemplaza la carga manual de PDF.

### Mercado Libre — factible y bastante completo

- OAuth una vez por cuenta de vendedor; el programa guarda y renueva el
  token.
- Órdenes / ventas (comprador, ítems, cantidades, estado, pago) → alimentan
  la cola de pedidos.
- Publicaciones y **stock** (leer y actualizar `available_quantity` — bajar
  el stock en ML cuando se acaba una pieza).
- **Envíos**: estado, seguimiento y la **etiqueta de envío (PDF)** para
  imprimir desde el programa.
- **Preguntas** de compradores (para el chatbot).
- Avisos automáticos (webhooks) o consulta programada. Para arrancar,
  consulta programada (como el bot hoy) — no necesita URL pública.

### Común a las dos

MP y ML comparten la plataforma de desarrolladores (ML es dueño de MP): una
sola app cubre ambas. Los tokens van en configuración / encriptados en la
base, **nunca en git**.

---

## Chatbot (clientes + preguntas de Mercado Libre)

Reusa la arquitectura del bot de la Fase 1 (proceso aparte, puente HTTP,
cola de comandos, escala cuando no sabe, respuestas predeterminadas).

- **Base de conocimiento** editable desde el panel: medidas, materiales,
  para qué puerta sirve, peso que soporta, precios, formas de pago, envío,
  garantía, FAQ.
- **WhatsApp / clientes**: responde pre-venta desde esa base; puede tomar
  el pedido.
- **Preguntas de Mercado Libre**: trae las preguntas sin responder por API,
  la IA redacta con la misma base y **responde sola si tiene confianza**, o
  la deja en el panel para aprobar/editar. Si falta el dato → **escala, no
  inventa**.

---

## Plan por pasos (a refinar con las referencias del dueño)

1. **[hecho] Datos + API** de catálogo y stock: `insumos`, `productos_base`,
   `productos`, `publicaciones`, `receta_base`, `composicion_producto`,
   `ordenes_produccion`, `movimientos_stock`, `compras_insumo`,
   `recuento_listas`. Sin tocar tienda ni bot. Ver
   [FASE-2-PASO-1.md](FASE-2-PASO-1.md).
2. **[hecho] Panel de stock y producción** (`/stock`, sección "Taller"):
   resumen con valor de stock / bajo mínimo / costos y márgenes, ABM de
   insumos, piezas con editor de receta, productos con composición y
   publicaciones, órdenes de producción (fabricar = descuenta insumos y suma
   piezas, o avisa qué falta), compras de material, listas de recuento con
   carga de conteo, e historial de stock.
   *Pendiente del Paso 2*: que la compra genere el `gasto` en el Control de
   Caja, y el aviso automático del recuento (cron).
3. **Tienda pública + pedidos**: catálogo público, carrito, checkout; cola
   de pedidos (tienda + manual); pantalla de preparación con "listo /
   faltan piezas" + descuento de stock al enviar + generación del ingreso.
4. **Integración Mercado Libre**: OAuth por cuenta, órdenes → pedidos,
   sincronizar stock hacia ML, etiquetas de envío.
5. **Integración Mercado Pago**: resumen de cada cuenta automático →
   movimientos, con reglas de categorización.
6. **Chatbot** de clientes + preguntas de ML con base de conocimiento.

Cada paso con confirmación entre medio, como en la Fase 1.

El detalle del **Paso 1** está en [FASE-2-PASO-1.md](FASE-2-PASO-1.md).

---

## Módulos adicionales pedidos por el dueño

Surgieron al planificar el Paso 1. No cambian los pasos 1–6; se suman
después, cada uno como su propio paso con confirmación.

### A. Producción / tareas

- La cola de pedidos (Paso 3) genera una **lista de tareas de fabricación**:
  qué piezas faltan para completar los pedidos, ordenadas por urgencia.
- **Áreas de trabajo** (corte, soldadura, armado, despacho…). Cada
  empleado tiene un área y ve las tareas de lo suyo: qué falta y qué hay
  que hacer según lo que se vendió.
- **Pantallas por sector**: cada encargado tiene una pantalla de inicio
  para su sector — hoy son **Producción** y **Embalaje**. Todos pueden
  entrar a todo el sistema; la pantalla de sector es solo el atajo a lo que
  cada uno usa siempre.
- Un empleado **toma** una tarea, la marca terminada, y eso alimenta una
  orden de producción y el descuento de stock.

### B. Sugerencia de producción (IA)

- Con el historial de ventas + el stock actual + los pedidos abiertos, la
  IA (la misma que ya usa el bot) arma una **lista sugerida de qué
  fabricar** para adelantarse a la demanda, no solo reaccionar a los
  pedidos.

### C. Personal

- **Fichadas**: hora de entrada y de salida de cada empleado.
- **Horas / minutos trabajados** por período → base para la liquidación.
- Tareas tomadas y **rendimiento** por empleado (tiempo real vs. estimado).
- **Liquidación de sueldos**: calcula lo a pagar y lo registra como un
  `gasto` en el Control de Caja (mismo enganche que las compras de insumo).

### D. Instructivos de fabricación

- Un **manual por pieza** (`producto_base`): medidas de cada corte, dónde
  doblar, dónde y de qué medida agujerear, en qué orden, con fotos o
  diagramas.
- Extiende la receta: los pasos del instructivo son la fuente de las
  cantidades de material.
- Sirve para entrenar gente nueva y para que las tareas del módulo A
  tengan las instrucciones al lado.

### E. Recuento periódico de stock

- Para los consumibles difíciles de medir (gas, discos, alambre): listas
  que el sistema recuerda revisar cada N días. El dueño/encargado carga el
  stock actual a mano y queda registrado.
- Las tablas entran ya en el Paso 1; el aviso y la pantalla, en el Paso 2.
