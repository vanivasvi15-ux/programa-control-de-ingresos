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
- [ ] **Paso 3** — bot de WhatsApp clonado (proceso aparte, IA que interpreta
      gastos/ingresos en lenguaje libre) + alertas automáticas (cron diario)

Ver [CLAUDE.md](CLAUDE.md) para el detalle de arquitectura y el plan completo.
