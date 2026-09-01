# CLAUDE.md

Guía para Claude Code (claude.ai/code) al trabajar en este repo.

# Control de Caja — Herrería VyV

## Qué es esto

Módulo **"Control de Caja"** para Herrería VyV: la Fase 1 de un sistema
integral más grande (después se suma stock/materia prima y tienda propia, así
que el diseño de datos no debería pelearse con eso).

Está construido copiando los patrones ya resueltos del POS de Steve's Burger
(repo aparte, privado): login por cuenta, `SidebarLayout`, `lib/db.ts` con
`node:sqlite`, API Routes como única fuente de verdad, y —en la Fase 3— el bot
de WhatsApp como proceso Node aparte (Baileys + IA), que le reporta todo a la
app por HTTP y nunca se conecta directo desde el panel.

El dueño no es programador de formación: explicaciones simples, paso a paso,
**con confirmación entre cada paso**.

## Stack técnico

- Next.js 16.1.6 + React 19.2.3 + TypeScript
- Tailwind v4, configuración por CSS (sin `tailwind.config.js`)
- SQLite vía `node:sqlite` (módulo nativo de Node 24). **NUNCA**
  `better-sqlite3` (falla en Windows, necesita compilador C++).
- Node 24
- Repo privado en GitHub. Se trabaja desde dos computadoras, sincronizadas
  por `git push` / `git pull`.
- `data.db` está en `.gitignore` — nunca viaja por GitHub. Cada compu tiene su
  propia base local. Al primer `npm run dev` se crea sola con el esquema de
  `lib/db.ts`.

## Comandos

- `npm run dev` — servidor de desarrollo
- `npm run build` — build de producción
- `npm run start` — levanta el build de producción
- `npm run lint` — ESLint
- `node scripts/crear-usuario.js "<nombre>" <usuario> <clave> [rol]` — crea un
  usuario para `/login` (varias veces, uno por persona). rol: `dueño`
  (default) | `encargado` | `contador`

No hay suite de tests.

## Arquitectura

- `lib/db.ts`: conexión única a SQLite (singleton vía `global.__db` para
  sobrevivir al hot-reload de Next en dev) + todas las tablas
  (`CREATE TABLE IF NOT EXISTS`) + un array `migraciones` de `ALTER TABLE` en
  try/catch para bases ya existentes (hoy vacío).
- **Foreign keys ACTIVADAS** por defecto en `node:sqlite`: antes de agregar un
  `DELETE` sobre una tabla referenciada por otra (`REFERENCES` en `lib/db.ts`),
  limpiar primero las filas que la referencian o el borrado falla entero.
- Rutas API en `app/api/.../route.ts`, siempre con
  `export const dynamic = "force-dynamic"`.
- Params dinámicos: `{ params }: { params: Promise<{ id: string }> }` y luego
  `const { id } = await params`.
- Alias de import `@/*` apunta a la raíz (`tsconfig.json`), ej. `@/lib/db`.
- **Auth**: tabla `usuarios` (contraseña scrypt), tabla `sesiones` (token en
  cookie httpOnly `vyv_session`). `lib/auth.ts` expone `usuarioActual()` para
  resolver permisos del lado del servidor en cada endpoint.
- Pantallas internas bajo `/dinero`, protegidas por `app/dinero/layout.tsx`
  (chequea sesión → `redirect("/login")`). En el paso 2 ese layout además va a
  envolver todo con `SidebarLayout` (copiar de `components/` del POS).

## Roles

Se resuelven **siempre del lado del servidor** por `usuarios.rol`:

| rol | qué puede |
|---|---|
| `dueño` | ve y edita todo; único que administra categorías y usuarios |
| `encargado` | carga movimientos y ve/edita **sólo los que cargó él** |
| `contador` | sólo lectura (rol pensado para el futuro; ya está en el esquema) |

## Base de datos (esquema en `lib/db.ts`)

- `usuarios` — `id, nombre, nombre_usuario UNIQUE, password_hash,
  password_salt, rol CHECK(dueño|encargado|contador), numero_whatsapp,
  activo, creado`. `nombre` = para mostrar; `nombre_usuario` = login. El bot
  (Fase 3) identifica por `numero_whatsapp`.
- `sesiones` — `token PK, usuario_id, creado, expira` (7 días).
- `categorias` — `id, nombre, tipo CHECK(ingreso|gasto), activo, creado`,
  `UNIQUE(nombre, tipo)`. Editable desde el panel, nunca hardcodeada.
- `movimientos` — `id, tipo CHECK(ingreso|gasto), monto INTEGER (pesos, sin
  centavos), categoria_id → categorias, fecha 'YYYY-MM-DD', recurrencia
  CHECK(unico|fijo|variable_recurrente), proxima_fecha, origen
  CHECK(whatsapp|panel), usuario_id → usuarios, estado
  CHECK(activo|pausado|anulado), nota, creado, actualizado`. Índices por
  fecha, categoria_id y usuario_id.
- `alertas_config` — `id, tipo CHECK(limite_categoria|fijo_por_vencer|
  resumen_periodico|inactividad), parametros_json, usuario_id_destino →
  usuarios, activo, creado`. La tabla ya existe; su API y el cron llegan en
  el paso 3.

## API (paso 1)

- `GET /api/categorias` — login. Filtros `?tipo` `?activo`.
- `POST /api/categorias` — sólo `dueño`. `{ nombre, tipo }`. Si existe pero
  inactiva, la reactiva.
- `PUT /api/categorias/[id]` — sólo `dueño`. `{ nombre?, activo? }`.
- `DELETE /api/categorias/[id]` — sólo `dueño`. Si tiene movimientos →
  `activo = 0`; si no la usa nadie → borrado real.
- `GET /api/movimientos` — login. Filtros `?desde ?hasta ?tipo ?categoria_id
  ?usuario_id ?estado ?recurrencia`. `encargado` queda forzado a ver sólo lo
  suyo. Devuelve `categoriaNombre` y `usuarioNombre` ya resueltos.
- `POST /api/movimientos` — login; `contador` → 403. Valida que `tipo`
  coincida con el `tipo` de la categoría. `origen` se fija en `panel` y
  `usuario_id` en el usuario logueado.
- `PUT /api/movimientos/[id]` — `encargado` sólo los suyos; `contador` → 403.
- `DELETE /api/movimientos/[id]` — **no borra**: pone `estado = 'anulado'`.
  Para dar de baja temporal un fijo, `PUT` con `estado = 'pausado'`.

Validación compartida en `lib/movimientos.ts` (`validarDatosMovimiento`,
`esFechaValida`, serializador con joins).

## Plan por pasos

1. **[hecho]** Tablas + API de movimientos y categorías (sin tocar el bot).
2. **Panel web** bajo `/dinero`, protegido con el login:
   - `/dinero` — dashboard: balance del mes, ingresos vs. gastos, gráfico por
     categoría, próximos fijos a vencer
   - `/dinero/movimientos` — listado con filtros, editar/anular
   - `/dinero/fijos` — recurrentes (fijo y variable_recurrente), pausar/reactivar
   - `/dinero/configuracion` — categorías, límites por categoría, quién recibe
     cada alerta
   - Traer `SidebarLayout` + `Sidebar` del POS y sumarlos al layout de `/dinero`.
3. **Bot de WhatsApp** (clon del de Steve's Burger, instancia nueva y
   separada: otro número, otro proceso) con la IA reprogramada para
   reconocer gastos/ingresos en lenguaje natural ("gasté 15000 en nafta",
   "cobré 45000 de una venta") y armar el movimiento llamando a
   `/api/movimientos`. Reusa tal cual `conversaciones`, `mensajes`,
   `comandos` y `respuestas_predeterminadas`. Si la IA no entiende el monto
   o la categoría: **no inventa** — marca la conversación como `escalada`,
   llega el aviso al panel, y se responde con un mensaje predeterminado
   (nunca texto libre). **Alertas automáticas**: tarea programada 1×/día que
   revisa límites por categoría, fijos por vencer y resúmenes
   semanal/mensual, e inserta en la cola `comandos` un tipo nuevo `aviso`
   para que el bot lo mande en su próxima vuelta. El cron nunca le pega
   directo a WhatsApp.

## Flujo con dos computadoras

- `git pull` al empezar, `git push` al terminar.
- `npm install` si cambió `package.json`.
- La base `data.db` NO se sincroniza: si hace falta un usuario en la otra
  compu, correr de nuevo `node scripts/crear-usuario.js`.
