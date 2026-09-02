# bot-whatsapp — Herrería VyV

Proceso Node **aparte** de la app de Control de Caja. Escucha WhatsApp con
[Baileys](https://github.com/WhiskeySockets/Baileys), interpreta los mensajes
con la IA de Anthropic y carga los gastos/ingresos llamando a la app por HTTP.

Clonado del bot del POS de Steve's Burger: mismo patrón (proceso separado,
puente HTTP `/api/bot-whatsapp/*`, cola de comandos que se revisa cada 8 s,
escalado cuando la IA no entiende, respuestas predeterminadas). Lo único
reprogramado es **qué interpreta la IA**: en vez de pedidos de comida,
reconoce "gasté 15000 en nafta" / "cobré 45000 de una venta".

## Puesta en marcha

```bash
cd bot-whatsapp
npm install
cp .env.example .env      # y completá los valores (ver abajo)
npm start
```

La primera vez imprime que está esperando un QR. Abrí **`/dinero/bot`** en la
app (como dueño): ahí aparece el QR. Escanealo desde WhatsApp → *Dispositivos
vinculados*. Conviene usar un **número dedicado** para el bot.

## `.env`

| variable | qué es |
|---|---|
| `APP_URL` | dónde corre la app (ej. `http://localhost:3000`) |
| `BOT_TOKEN` | secreto compartido. Poné el **mismo** valor en `BOT_TOKEN` de la app (`.env.local`). Vacío en ambos lados = sin protección (sólo desarrollo local). |
| `ANTHROPIC_API_KEY` | clave de la API de Anthropic |
| `ANTHROPIC_MODEL` | modelo (default `claude-haiku-4-5-20251001`, alcanza para extraer monto + categoría) |
| `CONFIANZA_MINIMA` | 0–1: por debajo de esto la conversación se **escala** en vez de anotar algo dudoso |

## Cómo funciona

1. **Mensaje entrante** → se registra en la app (`POST /api/bot-whatsapp/mensajes`).
2. Si la IA está pausada (desde el panel) o la conversación la tomó una
   persona → sólo se registra, el bot no responde.
3. `GET /api/bot-whatsapp/contexto?numero=…` → quién escribe (para el permiso)
   y la lista de categorías activas.
4. **Número no habilitado** (no es un usuario `dueño`/`encargado` activo con
   ese WhatsApp) → responde una línea fija y no anota nada.
5. La IA devuelve `{esMovimiento, tipo, monto, categoria, confianza}`.
   - No es un movimiento → responde una ayuda corta.
   - Falta el monto o la categoría, o la confianza es baja → **escala**
     (`estado = escalada`, aparece en `/dinero/bot`, con notificación del
     navegador). El bot **no manda texto libre**: la persona responde con un
     mensaje predeterminado.
   - Todo ok → `POST /api/bot-whatsapp/movimiento` (queda con
     `origen = whatsapp` y el `usuario_id` de quien escribió) y responde
     "✅ Anotado: …".
6. **Cola de comandos** (`bot_comandos`, revisada cada 8 s): mensajes del
   sistema, respuestas manuales del panel, avisos del cron de alertas, y
   comandos `control` (reactivar / bloquear la IA de una conversación).
7. **Controles del panel** (revisados cada 10 s): pausar IA, apagar/prender
   la conexión, pedir cambiar de número (logout + QR nuevo). El bot reporta
   su conexión y el QR a `PUT /api/bot-whatsapp/estado`.

## Dejarlo corriendo siempre

En Windows: Programador de tareas con "Al iniciar sesión" → `npm start` en
esta carpeta, o [pm2](https://pm2.keymetrics.io/) (`pm2 start index.js`).

## Archivos que NO se versionan

`auth/` (credenciales de la sesión de WhatsApp) y `.env`. Están en
`.gitignore`.
