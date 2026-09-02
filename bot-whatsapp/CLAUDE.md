# CLAUDE.md — bot-whatsapp

Proceso Node **aparte** de la app de Control de Caja (carpeta hermana `../`).
Clon del bot del POS de Steve's Burger, con la IA reprogramada para
gastos/ingresos en vez de pedidos.

## Reglas que no se rompen

- **El bot NUNCA toca la base de datos.** Todo va por HTTP a
  `${APP_URL}/api/bot-whatsapp/*`. La app es la única fuente de verdad.
- **El bot no manda texto libre escrito por una persona.** Cuando la IA no
  entiende el monto o la categoría, se **escala** (`estado='escalada'`) y una
  persona responde desde `/dinero/bot` con un mensaje predeterminado. Los
  únicos textos que genera el bot solo son: la ayuda ("puedo anotar
  gastos…"), el "número no habilitado", y la confirmación ("✅ Anotado…").
- **No inventa datos.** Si `POST /api/bot-whatsapp/movimiento` devuelve 422,
  se escala con el `motivo` que vino en la respuesta.
- Bloqueo de IA por conversación: `Set` en memoria (`bloqueadas`),
  alimentado por escalados, respuestas `manual`, y comandos `control`.

## Stack

- `baileys` (WhatsApp), `@anthropic-ai/sdk` (IA, modelo Haiku por default),
  `qrcode` (QR → data URL para el panel), `pino` (logs).
- ESM (`"type": "module"`). Node 24 (`--env-file=.env`, sin dotenv).
- `auth/` = credenciales de la sesión de WhatsApp (Baileys
  `useMultiFileAuthState`). En `.gitignore`.

## Config (`.env`)

`APP_URL`, `BOT_TOKEN` (mismo valor que en la app), `ANTHROPIC_API_KEY`,
`ANTHROPIC_MODEL`, `INTERVALO_COMANDOS_MS`, `CONFIANZA_MINIMA`.

## Bucles

- `messages.upsert` → `manejarMensaje` (log, contexto, IA, alta o escalado).
- cada `INTERVALO_COMANDOS_MS` → `procesarComandos` (cola `bot_comandos`).
- cada 10 s → `bucleControl` (pausar / `conectar` on-off / cambiar número).
- `connection.update` → reporta `conectado`/`qr`; reconecta salvo `loggedOut`.

## Contrato con la app

Ver el `CLAUDE.md` de la raíz, sección **`/api/bot-whatsapp/*`**. Endpoints
que usa el bot: `estado` (GET/PUT), `mensajes` (POST), `comandos` (GET, PUT
`/[id]`), `contexto` (GET), `movimiento` (POST).
