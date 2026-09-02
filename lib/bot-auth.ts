// lib/bot-auth.ts
//
// Autorización de las rutas /api/bot-whatsapp/*. Dos tipos de llamador:
//
//   - el PANEL (/dinero/bot): navegador con sesión de un usuario dueño.
//   - el BOT (proceso aparte "bot-whatsapp"): no tiene sesión; se
//     identifica con el header `x-bot-token`.
//
// Si la variable de entorno BOT_TOKEN está definida, el bot DEBE mandar
// ese valor en `x-bot-token`. Si no está definida (desarrollo en la misma
// máquina, igual que el POS), se acepta cualquier llamada como "bot".

import { NextRequest } from "next/server";
import { usuarioActual } from "./auth";

export async function autorizarBridge(req: NextRequest): Promise<{
  comoDueno: boolean;
  comoBot: boolean;
}> {
  const token = process.env.BOT_TOKEN;
  const header = req.headers.get("x-bot-token");
  const comoBot = token ? header === token : true;

  let comoDueno = false;
  try {
    const u = await usuarioActual();
    comoDueno = u?.rol === "dueño";
  } catch {
    comoDueno = false;
  }

  return { comoDueno, comoBot };
}
