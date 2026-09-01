// Placeholder del paso 1: confirma que el login funciona y muestra quién
// entró. El dashboard de verdad (balance del mes, ingresos vs. gastos,
// gráfico por categoría, próximos fijos) llega en el paso 2.

import { usuarioActual } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function DineroHome() {
  const usuario = await usuarioActual();

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Control de Caja — Herrería VyV</h1>
        <LogoutButton />
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-5 text-neutral-700">
        <p>
          Sesión iniciada como <strong>{usuario?.nombre}</strong> (
          <code>{usuario?.rol}</code>).
        </p>
        <p className="mt-3 text-sm text-neutral-500">
          Paso 1 listo: base de datos y API de movimientos y categorías. Las
          pantallas (dashboard, movimientos, fijos, configuración) vienen en el
          paso 2.
        </p>
      </div>
    </div>
  );
}
