// Se ejecuta ANTES de mostrar cualquier pantalla bajo /dinero. Revisa la
// cookie de sesión contra la base; si no es válida, manda a /login sin
// mostrar nada.
//
// En el paso 2 este layout además va a envolver el contenido con el
// SidebarLayout (barra lateral de navegación), igual que en el POS.

import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/auth";

export default async function DineroLayout({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioActual();
  if (!usuario) {
    redirect("/login");
  }
  return <>{children}</>;
}
