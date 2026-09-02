// lib/bot-numero.ts
//
// Resuelve un número de WhatsApp (o jid) a un usuario de la caja.
// WhatsApp manda el número con prefijos que varían (+54, 9, 0, 15…), así
// que se compara por los últimos 8 dígitos, que en Argentina identifican
// al abonado sin ambigüedad práctica.

import { db } from "./db";
import type { Rol } from "./auth";

export type UsuarioBot = {
  id: number;
  nombre: string;
  rol: Rol;
  activo: boolean;
  puedeCargar: boolean;
};

export function soloDigitos(v: string): string {
  return (v || "").replace(/\D/g, "");
}

export function resolverUsuarioPorNumero(numeroOJid: string): UsuarioBot | null {
  const digitos = soloDigitos(numeroOJid.split("@")[0]);
  if (digitos.length < 6) return null;
  const cola = digitos.slice(-8);

  const filas = db
    .prepare(
      `SELECT id, nombre, rol, activo, numero_whatsapp
       FROM usuarios WHERE numero_whatsapp IS NOT NULL AND numero_whatsapp != ''`
    )
    .all() as { id: number; nombre: string; rol: Rol; activo: number; numero_whatsapp: string }[];

  const match = filas.find((u) => soloDigitos(u.numero_whatsapp).slice(-8) === cola);
  if (!match) return null;

  return {
    id: match.id,
    nombre: match.nombre,
    rol: match.rol,
    activo: !!match.activo,
    puedeCargar: !!match.activo && (match.rol === "dueño" || match.rol === "encargado"),
  };
}
