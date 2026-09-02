// Se ejecuta ANTES de mostrar cualquier pantalla bajo /dinero. Revisa la
// cookie de sesión contra la base; si no es válida, manda a /login sin
// mostrar nada. Después envuelve todo con la barra lateral de navegación
// y deja el usuario disponible a las pantallas (ProveedorUsuario).

import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/auth";
import SidebarLayout from "@/components/SidebarLayout";
import { ProveedorUsuario } from "@/components/UsuarioContext";

export default async function DineroLayout({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioActual();
  if (!usuario) {
    redirect("/login");
  }
  return (
    <ProveedorUsuario
      usuario={{
        id: usuario.id,
        nombre: usuario.nombre,
        nombreUsuario: usuario.nombre_usuario,
        rol: usuario.rol,
      }}
    >
      <SidebarLayout usuario={{ nombre: usuario.nombre, rol: usuario.rol }}>
        {children}
      </SidebarLayout>
    </ProveedorUsuario>
  );
}
