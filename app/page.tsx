import { redirect } from "next/navigation";

// La raíz manda al panel. Si no hay sesión, el layout de /dinero rebota
// solo a /login.
export default function Home() {
  redirect("/dinero");
}
