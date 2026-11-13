// Etiquetas de paquetes para imprimir. Misma protección que /dinero y
// /stock (sin sesión → /login) pero SIN barra lateral: la hoja tiene que
// quedar limpia para la impresora.

import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/auth";

export default async function EtiquetasLayout({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioActual();
  if (!usuario) {
    redirect("/login");
  }
  return <>{children}</>;
}
