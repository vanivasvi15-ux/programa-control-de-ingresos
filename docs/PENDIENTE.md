# Qué falta hacer

Registro de lo que queda pendiente, ordenado por prioridad. Última
actualización: **2026-09-04**.

Lo que **ya está hecho y probado**: Fase 1 completa (caja, movimientos,
fijos, configuración, bot de WhatsApp, alertas) + Fase 2 Pasos 1 y 2 (datos,
API y panel `/stock` del taller). Ver `CLAUDE.md` y `README.md`.

---

## 0. Prioridad nueva (pedida el 2026-11-13): despacho diario + etiquetas

- **Lista de despacho del día**: todo lo vendido ese día (tienda + Mercado
  Libre) con datos del cliente y del producto, para preparar y enviar.
- **Impresión de etiquetas de paquete** con una impresora conectada.
- **Tienda pública** (base ya hecha en Wix) + **sistema interno** sólo para
  el dueño, conectado a **Mercado Libre**.
- Decisiones (2026-11-13): impresora térmica de etiquetas 10 × 15 cm; la
  tienda pública se rehace acá (Wix queda de referencia); se empieza por
  despacho + etiquetas.
- **[hecho] Despacho + etiquetas con ventas a mano**: `/stock/despacho` y
  `/etiquetas`. Detalle en `docs/FASE-2.md`.
- **[hecho] Códigos de barras** (2026-11-14) para piezas base y productos
  finales: PB00001 / PF00001 automáticos o propios, etiquetas 60 × 40 mm,
  escáner en el Resumen del Taller. Detalle en `docs/FASE-2.md`.
- **[hecho] Ingreso por escaneo** (2026-11-14): `/stock/ingreso`. Escanear la
  etiqueta de una pieza terminada suma al stock y descuenta los materiales de
  su receta. Detalle en `docs/FASE-2.md`.
- **Decisiones técnicas a tomar antes de usarlo en serio** (conversadas con el
  dueño el 2026-11-14):
  - **Dónde corre el sistema.** Hoy cada compu tiene su propia base (`data.db`
    no se sincroniza). Para que Embalaje, Despacho y el dueño usen lo mismo
    hace falta **una sola compu prendida en el taller como servidor** (las
    demás entran por el navegador a `http://IP-DE-ESA-COMPU:3001`), o ponerlo
    en un servidor online. Elegido para arrancar: la compu del taller.
  - **Cámara del celular**: el navegador sólo abre la cámara en una conexión
    segura (HTTPS), así que por red local común no anda. Opciones: lector
    Bluetooth/USB con el celular (anda sin HTTPS), un servicio de acceso seguro
    (túnel) o servidor online. Se deja para después de probar con lector.
  - **Base dentro de OneDrive**: `data.db` está en `Escritorio` y OneDrive la
    sincroniza; con SQLite eso puede dañarla. Mover la base fuera de OneDrive
    (ruta configurable) y programar copias de seguridad.
  - Comprar un **lector 2D (imager)**: lee barras y QR, y también desde una
    pantalla.
- **Falta de esto**:
  0. Probar con el lector USB y la impresora reales; que Despacho, Producción
     y Recuentos también trabajen escaneando; códigos para insumos.
  1. Probar la impresión con la impresora térmica real y ajustar la etiqueta
     (márgenes, tamaños, código de barras/QR, remitente editable).
  2. **Conectar Mercado Libre**: que las órdenes entren solas a `ventas`
     (`canal = mercadolibre`, `numero_externo` = id de orden) y usar la
     etiqueta oficial de Mercado Envíos. Necesita app de desarrollador + OAuth
     de las dos cuentas.
  3. **Tienda pública** dentro de este proyecto (catálogo, carrito,
     checkout) que cree ventas con `canal = tienda`; diseño tomando la base
     de Wix y el kiosco de Steve's Burger.
  4. Decidir si el sistema interno queda sólo para el dueño (hoy hay roles
     dueño / encargado / contador).
  5. Generar el ingreso en Caja al despachar (cuidando no duplicarlo con
     Mercado Pago, Paso 5).
  6. Test automático del flujo despachar/deshacer (hoy probado a mano con la
     API; sólo la validación tiene tests).

---

## 1. Cosas chicas que cierran la Fase 2 (se pueden hacer ya, sin nada de afuera)

### 1.1 Enganchar la compra de material con el gasto en el Control de Caja
- **Hoy**: cuando cargás una compra en `/stock/compras`, sube el stock del
  insumo pero **no** genera un gasto en `/dinero`. El campo `movimiento_id`
  de la tabla `compras_insumo` queda en `NULL`.
- **Falta**: al confirmar la compra, crear también un `movimiento` de tipo
  `gasto` (origen `panel`, con el monto total de la compra) y guardar su id
  en `compras_insumo.movimiento_id`. Al revertir la compra, anular ese
  movimiento.
- **Decisión pendiente del dueño**: ¿a qué categoría de gasto entra? Puede
  ser una categoría fija "Materia prima / Insumos", o elegirla en el
  momento de cargar la compra.
- **Dónde se toca**: `app/api/compras-insumo/route.ts` (POST) y
  `app/api/compras-insumo/[id]/route.ts` (DELETE); el modal
  `components/stock/CompraModal.tsx` si hay que elegir categoría.

### 1.2 Aviso automático de los recuentos
- **Hoy**: `/stock/recuentos` te muestra en pantalla cuáles "tocan revisar",
  pero nadie te avisa solo.
- **Falta**: que `scripts/cron-alertas.js` (el que ya corre 1×/día para las
  alertas de caja) también mire las `recuento_listas` y, si pasaron los
  días de `dias_cada` desde `ultima_revision`, encole un aviso
  (`bot_comandos.tipo = 'aviso'`), con anti-duplicado por día en
  `bot_avisos_log` igual que las otras alertas.
- **Dónde se toca**: `scripts/cron-alertas.js` y quizá `lib/alertas.ts`.

### 1.3 Repaso general del panel `/stock`
- Probar con datos reales cargados a mano (no sólo el seed).
- Revisar textos y ayudas para que se entiendan sin ser programador.
- Ver que ande bien en el celular (la barra lateral en cajón).

---

## 2. Fase 2 — Pasos que faltan (necesitan cuentas y claves reales)

Están descritos en `docs/FASE-2.md`. Resumen de qué hace falta de la persona
antes de poder programarlos:

### Paso 3 — Tienda propia (catálogo público)
- Página pública para mostrar los productos (kits) con foto y precio.
- **Falta**: fotos de los productos y decidir si la tienda va en el mismo
  dominio o aparte.

### Paso 4 — Mercado Libre
- Sincronizar publicaciones y stock con las dos cuentas de ML.
- **Falta de la persona**:
  - Crear una aplicación en el portal de desarrolladores de Mercado Libre
    (te da un `client_id` y `client_secret`).
  - Autorizar la app en **cada una** de las dos cuentas de ML (flujo OAuth,
    una vez por cuenta) para obtener los tokens de acceso.
  - Decidir la regla de stock cuando una pieza está en varias
    publicaciones / dos cuentas a la vez.
- **Análisis ya hecho** de dos exports reales de ML (04-09-2026, 181
  publicaciones): ver `docs/mercadolibre/README.md` (con los archivos
  originales al lado). Conclusión: el mismo producto está publicado varias
  veces con títulos distintos (SEO), así que 181 avisos ≈ 50-70 productos
  reales — no se puede importar 1 a 1. **Falta que el dueño elija** una de
  las 4 opciones planteadas ahí (A: importar todo con productos borrador a
  limpiar después · B: sólo los ~24 con precio/stock completos · C:
  reexportar "Publicaciones" sin filtro de categoría y ahí sí importar todo
  · D: esperar a la integración por API de arriba). Ninguna se ejecutó
  todavía.

### Paso 5 — Mercado Pago
- Registrar los cobros como ingresos en el Control de Caja automáticamente.
- **Falta de la persona**: el `access_token` de producción de Mercado Pago
  de cada cuenta, y definir a qué categoría de ingreso entran los cobros.

### Paso 6 — Chatbot de clientes (sobre el bot de WhatsApp)
- Que el mismo bot conteste consultas de clientes (precio, stock, demora),
  no sólo cargue gastos.
- **Falta**: definir qué puede responder solo y cuándo tiene que escalar a
  una persona; textos de respuesta.

---

## 3. Módulos más grandes (más adelante, ver `docs/FASE-2.md` sección "Módulos")

- **A — Producción y tareas**: órdenes de trabajo por pedido, estados,
  quién hace qué.
- **B — Personal**: horas, ausencias, un registro simple de sueldos.
- **C — Instructivos**: fichas de "cómo se arma" cada pieza, con fotos.
- **D — Sugerencias de la IA**: que mire los números y proponga (comprar
  ahora tal insumo, revisar tal precio).
- **E — Reportes**: exportables mensuales para el contador.

---

## Notas técnicas para retomar

- No hay suite de tests salvo `npm test` (cálculos puros de stock,
  `lib/stock-datos.test.ts`). Antes de dar algo por terminado: `npx tsc
  --noEmit`, `npm run lint`, `npm test`, `npm run build`.
- Datos de prueba de stock: `npm run seed-stock` (borra y recarga el stock,
  no toca la caja). Datos de caja de agosto: `node scripts/seed-datos.js
  --reset`.
- Usuario de pruebas creado a mano: `testqa` / `testqa123` (rol dueño).
  Borrarlo cuando no se use más.
- La base `data.db` no se versiona (está en `.gitignore`). Cada compu tiene
  la suya; se regenera sola al primer `npm run dev`.
