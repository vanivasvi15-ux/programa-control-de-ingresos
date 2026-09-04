# Control de Caja — Herrería VyV

Fase 1 de un sistema integral de gestión para Herrería VyV: registro de
**ingresos y gastos** (únicos, fijos y variables recurrentes), panel web y
—más adelante— un bot de WhatsApp que carga movimientos en lenguaje natural.

Mismo stack que el POS de Steve's Burger: **Next.js (App Router) + TypeScript
+ SQLite vía `node:sqlite`** (sin ORM). Las API Routes son la única fuente de
verdad.

## Arrancar en una compu nueva

```bash
npm install
node scripts/crear-usuario.js "Vani" vani "unaClaveSegura" dueño
npm run dev
```

Abrir http://localhost:3000 → redirige a `/login`.

La base `data.db` se crea sola al primer arranque y **no se sube a GitHub**
(está en `.gitignore`): cada compu tiene la suya.

## Comandos

- `npm run dev` — servidor de desarrollo
- `npm run build` — build de producción
- `npm run start` — levanta el build
- `npm run lint` — ESLint
- `node scripts/crear-usuario.js "<nombre>" <usuario> <clave> [rol]` — crea un
  usuario para `/login`. rol: `dueño` (default) | `encargado` | `contador`
- `node scripts/cron-alertas.js` — revisa las alertas y encola avisos para el
  bot. Programalo 1×/día (Programador de tareas de Windows / cron).
- `node scripts/seed-datos.js --reset` — **BORRA todos los datos** de `data.db`
  y carga los de `scripts/seed-agosto-2026.json` (usuarios `viviana` y
  `cristian`, clave provisoria `vyv12345`; 624 movimientos de agosto 2026
  armados desde los resúmenes de Mercado Pago). Correlo en cada compu, porque
  `data.db` no se sincroniza.
- `node scripts/seed-stock.js --reset` — datos de PRUEBA de la Fase 2 (stock):
  insumos, piezas, dos kits, publicaciones y una lista de recuento. No toca
  nada de la Fase 1.
- `npm test` — tests de los cálculos puros de stock (Node `--test`).

## Bot de WhatsApp

Vive en `bot-whatsapp/` (proceso aparte). Ver
[bot-whatsapp/README.md](bot-whatsapp/README.md):

```bash
cd bot-whatsapp
npm install
cp .env.example .env    # completá ANTHROPIC_API_KEY y, opcional, BOT_TOKEN
npm start               # imprime que espera el QR; escanealo desde /dinero/bot
```

Si ponés `BOT_TOKEN` en `bot-whatsapp/.env`, poné el **mismo** valor en
`.env.local` de la app (ver `.env.example`).

## Estado

- [x] **Paso 1** — tablas + API de movimientos y categorías
- [x] **Paso 2** — panel web bajo `/dinero`:
  - `/dinero` — dashboard: balance del mes con comparación vs. mes anterior,
    ingresos vs. gastos de los últimos 6 meses, torta por categoría,
    proyección a fin de mes, próximos fijos, límites, últimos movimientos
  - `/dinero/movimientos` — filtros (período, tipo, categoría, estado,
    usuario, búsqueda), totales del filtro, exportar CSV, alta / edición /
    duplicar / anular
  - `/dinero/fijos` — recurrentes con estimado mensual, pausar / reactivar y
    "registrar" (crea el movimiento del período y corre la próxima fecha)
  - `/dinero/configuracion` (sólo dueño) — categorías, alertas y límites,
    usuarios
- [x] **Paso 3** — bot de WhatsApp + alertas automáticas:
  - carpeta `bot-whatsapp/` — proceso Node aparte (Baileys + IA de Anthropic)
    que interpreta "gasté 15000 en nafta" / "cobré 45000 de una venta" y lo
    carga por HTTP (`/api/bot-whatsapp/*`). Si no entiende, **escala** (no
    inventa) y una persona responde con un mensaje predeterminado.
  - `/dinero/bot` (sólo dueño) — QR, prender/apagar, pausar la IA, cambiar
    número, ver conversaciones y responder.
  - `scripts/cron-alertas.js` — se corre 1×/día; revisa `alertas_config` y
    encola avisos en la cola del bot (nunca le pega directo a WhatsApp).
- [x] **Fase 2 · Paso 1** — datos + API de stock y producción: insumos, piezas
      fabricadas, productos, publicaciones, recetas, composición, órdenes de
      producción, historial de stock, compras y recuentos. Mecanismo de
      migraciones y helper `transaccion()`. Detalle en
      [docs/FASE-2-PASO-1.md](docs/FASE-2-PASO-1.md).
- [x] **Fase 2 · Paso 2** — panel `/stock` (sección "Taller" de la barra
      lateral): resumen, insumos, piezas + receta, productos + composición +
      publicaciones, producción, compras, recuentos, historial.
- [ ] **Fase 2 · Pasos 3–6** — tienda propia, Mercado Libre, Mercado Pago,
      chatbot de clientes, y los módulos A–E (producción/tareas, personal,
      instructivos…). Todo en [docs/FASE-2.md](docs/FASE-2.md).

Ver [CLAUDE.md](CLAUDE.md) para el detalle de arquitectura y el plan completo.
