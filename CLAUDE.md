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

- `lib/db.ts`: conexión SQLite **perezosa** (Proxy sobre `global.__db`: la
  base recién se abre en la primera consulta, no al importar — así
  `next build` con varios workers no pelea por el lock). Todas las tablas
  (`CREATE TABLE IF NOT EXISTS`) + un array `migraciones` de `ALTER TABLE` en
  try/catch para bases ya existentes.
- `lib/movimientos-datos.ts`: constantes, tipos y helpers de fecha de
  movimientos que **no** tocan la base (FRECUENCIAS, RECURRENCIAS,
  `esFechaValida`, `avanzarFecha`). Vive aparte de `lib/movimientos.ts`
  (que sí importa `node:sqlite`) para poder usarlo desde componentes del
  cliente sin arrastrar SQLite al bundle. Regla: los módulos que importan
  `@/lib/db` son sólo de servidor.
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
  (chequea sesión → `redirect("/login")`), que además envuelve todo con
  `SidebarLayout` y con `ProveedorUsuario` (contexto de cliente con el
  usuario logueado; se lee con `useUsuario()`, ver `components/UsuarioContext.tsx`).
- UI: Tailwind v4 con variables de color en `app/globals.css` (modo claro/
  oscuro automático según el sistema). Piezas comunes en `components/ui.tsx`
  (Tarjeta, Boton, Chip, Segmentado, Modal, EstadoVacio, Campo). Íconos SVG
  propios en `components/Icono.tsx` (sin librería). Gráficos con `recharts`
  en `components/Graficos.tsx` — con `isAnimationActive={false}` porque con
  React 19 la animación de entrada a veces queda trabada y no se ven las
  barras.
- ESLint: `react-hooks/set-state-in-effect` está en `off` (patrón normal
  acá: al montar una pantalla se hace fetch y se guarda en estado).

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
  CHECK(unico|fijo|variable_recurrente), proxima_fecha, frecuencia (semanal|
  quincenal|mensual|bimestral|trimestral|semestral|anual; sólo si recurrencia
  != unico; validada en la API), generado_por_fijo_id → movimientos (si el
  movimiento nació de "registrar" un fijo), origen CHECK(whatsapp|panel),
  usuario_id → usuarios, estado CHECK(activo|pausado|anulado), nota, creado,
  actualizado`. Índices por fecha, categoria_id y usuario_id.
- `alertas_config` — `id, tipo CHECK(limite_categoria|fijo_por_vencer|
  resumen_periodico|inactividad), parametros_json, usuario_id_destino →
  usuarios, activo, creado`. La forma de `parametros_json` según el tipo se
  valida en `lib/alertas.ts`. `scripts/cron-alertas.js` la lee y encola
  avisos.
- **Puente del bot** (clonado del POS, `pedido_id` → `movimiento_id`; sin
  `menu_imagenes`):
  - `bot_conversaciones` — `jid PK, cliente, estado CHECK(activa|escalada|
    finalizada), motivo_escalado, movimiento_id → movimientos, creado,
    actualizado`.
  - `bot_mensajes` — `id, jid, rol CHECK(cliente|bot|empleado), texto, creado`.
  - `bot_whatsapp_estado` — fila única id=1: `pausado` (frena sólo la IA),
    `conectado` + `qr` (los reporta el bot), `conectar` (prende/apaga la
    conexión entera), `cambiar_numero_solicitado` (logout para vincular otro
    número).
  - `bot_comandos` — cola que el bot revisa cada 8 s. `tipo CHECK(mensaje|
    manual|control|aviso)`, `intentos` (tope `MAX_INTENTOS=5`), `estado`,
    `error`, `enviado`.
  - `bot_respuestas_predeterminadas` — `id, etiqueta, texto, orden`
    (semilla de 4). Únicos textos que se pueden mandar a mano (no hay caja
    de texto libre).
  - `bot_avisos_log` — `(clave, fecha) PK`: anti-duplicado del cron.

## API

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
- `POST /api/movimientos/[id]/registrar` — "registra" un fijo: crea un
  movimiento `unico` con `generado_por_fijo_id` apuntando al fijo y corre
  `proxima_fecha` del fijo según su `frecuencia` (`avanzarFecha`). Body
  opcional `{ monto?, fecha?, nota? }` (para variable_recurrente pide el
  monto real de esa vez).
- `GET /api/resumen?mes=AAAA-MM` — todo lo del dashboard ya agregado del
  lado del servidor: totales del mes y del anterior, desglose por categoría,
  serie de 6 meses, próximos fijos (con `diasRestantes` y `yaRegistradoEsteMes`),
  límites con % gastado, últimos movimientos, y proyección a fin de mes
  (balance + fijos que faltan registrar este mes). Los totales cuentan sólo
  `recurrencia='unico'` y `estado='activo'`.
- `GET/POST /api/usuarios`, `PUT/DELETE /api/usuarios/[id]` — sólo `dueño`
  (el GET lo puede leer cualquiera logueado, para el filtro "por usuario").
  Nunca devuelve hash/salt. Guardas: no borrarte a vos mismo, tiene que
  quedar un dueño activo, si el usuario tiene movimientos se desactiva en
  vez de borrarse.
- `GET/POST /api/alertas-config`, `PUT/DELETE /api/alertas-config/[id]` —
  sólo `dueño`. `parametros` (objeto) se valida por tipo y se guarda como
  JSON en `parametros_json`.

### `/api/bot-whatsapp/*` (puente con el bot)

Autorización en `lib/bot-auth.ts` (`autorizarBridge`): un llamador es
`comoDueno` (sesión de un dueño en el navegador) o `comoBot` (header
`x-bot-token` == `process.env.BOT_TOKEN`; si `BOT_TOKEN` no está definido,
cualquiera cuenta como bot — dev local, igual que el POS).

- `GET/PUT /api/bot-whatsapp/estado` — dueño **o** bot.
- `POST /api/bot-whatsapp/mensajes` — bot. Loguea un mensaje y upsertea
  `bot_conversaciones` (acepta `estado`, `motivoEscalado`, `movimientoId`).
- `GET/POST /api/bot-whatsapp/comandos`, `PUT .../comandos/[id]` — GET y PUT
  son del bot; POST es dueño o bot (respuestas manuales del panel, avisos).
- `GET /api/bot-whatsapp/conversaciones` (+ `[jid]` PUT/DELETE, `[jid]/mensajes`
  GET) — sólo dueño. El PUT de estado encola además un comando `control`.
- `GET/POST /api/bot-whatsapp/respuestas` (+ `[id]` PUT/DELETE) — sólo dueño.
- `GET /api/bot-whatsapp/contexto?numero=` — bot. Devuelve `{ usuario, categorias }`
  (usuario resuelto por `numero_whatsapp`, ver `lib/bot-numero.ts`: compara
  por los últimos 8 dígitos).
- `POST /api/bot-whatsapp/movimiento` — bot. Crea un movimiento con
  `origen='whatsapp'` y el `usuario_id` de quien escribió. Empareja la
  categoría por nombre (normalizado, con tolerancia). Si algo no se puede
  resolver devuelve **422** con `motivo` (o 403 si el número no está
  habilitado) para que el bot **escale** en vez de inventar.

Validación compartida de movimientos en `lib/movimientos.ts`
(`validarDatosMovimiento`, serializador con joins); constantes y fechas en
`lib/movimientos-datos.ts`.

## Bot de WhatsApp (`bot-whatsapp/`)

Proceso Node **aparte**, con su propio `package.json` y `CLAUDE.md`/`README.md`.
`node --env-file=.env index.js` (`npm start`). Baileys + `@anthropic-ai/sdk`.

- No toca la base: todo por `/api/bot-whatsapp/*`.
- Al recibir un mensaje: lo loguea, pide `contexto`, y si el que escribe está
  habilitado y la IA (Haiku) devuelve `{esMovimiento, tipo, monto, categoria,
  confianza}` con confianza ≥ `CONFIANZA_MINIMA` → `POST .../movimiento` y
  confirma. Si falta el monto/categoría o la confianza es baja → **escala**
  (marca `estado='escalada'`, no manda texto libre).
- Cola de comandos cada 8 s; `control` (reactivar/bloquear la IA de una
  conversación) se maneja con un `Set` en memoria.
- Controles del panel cada 10 s (pausar, `conectar` on/off,
  `cambiar_numero_solicitado`). Reporta conexión/QR a `PUT .../estado`.
- `bot-whatsapp/auth/` (credenciales de sesión) y `.env` no se versionan.

## Plan por pasos

1. **[hecho]** Tablas + API de movimientos y categorías (sin tocar el bot).
2. **[hecho]** Panel web bajo `/dinero`, protegido con el login:
   - `/dinero` — dashboard (navegador de mes, KPIs con comparación vs. mes
     anterior, barras ingresos/gastos 6 meses, torta por categoría,
     proyección a fin de mes, próximos fijos, límites, últimos movimientos)
   - `/dinero/movimientos` — filtros (período con presets, tipo, categoría,
     estado, usuario, búsqueda), totales del filtro, exportar CSV, modal de
     alta/edición, duplicar, anular
   - `/dinero/fijos` — recurrentes con estimado mensual (normalizado por
     frecuencia), pausar/reactivar, "registrar", editar, anular
   - `/dinero/configuracion` (sólo dueño, con tabs) — categorías (alta/
     rename/activar/borrar), alertas y límites, usuarios
3. **[hecho]** Bot de WhatsApp (`bot-whatsapp/`, proceso aparte, Baileys +
   IA) que reconoce gastos/ingresos en lenguaje natural y los carga por
   `/api/bot-whatsapp/movimiento`. Escala en vez de inventar. Panel en
   `/dinero/bot`. **Alertas automáticas**: `scripts/cron-alertas.js`
   (1×/día) revisa `alertas_config` y encola avisos (`bot_comandos.tipo =
   'aviso'`); nunca le pega directo a WhatsApp. Anti-duplicado por día en
   `bot_avisos_log`.

   Pendiente de la persona: instalar deps del bot, cargar `ANTHROPIC_API_KEY`
   (y `BOT_TOKEN` en los dos lados), vincular un número dedicado escaneando
   el QR desde `/dinero/bot`, y programar el cron en el Programador de
   tareas de Windows. El `index.js` del bot está escrito a la misma
   arquitectura que el del POS pero NO se pudo probar contra WhatsApp real
   desde acá — conviene diffear contra el `bot-whatsapp/index.js` del POS.

## Flujo con dos computadoras

- `git pull` al empezar, `git push` al terminar.
- `npm install` si cambió `package.json`.
- La base `data.db` NO se sincroniza: si hace falta un usuario en la otra
  compu, correr de nuevo `node scripts/crear-usuario.js`.
