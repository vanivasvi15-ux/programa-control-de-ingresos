import { redirect } from "next/navigation";

// La raíz todavía no tiene pantalla propia (el dashboard /dinero llega en el
// paso 2). Por ahora manda directo al login.
export default function Home() {
  redirect("/login");
}
