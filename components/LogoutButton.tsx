"use client";
// components/LogoutButton.tsx
//
// Cierra la sesión actual y manda a /login. Sirve en cualquier pantalla
// protegida.

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    setSaliendo(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={salir}
      disabled={saliendo}
      className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
    >
      {saliendo ? "Saliendo..." : "Cerrar sesión"}
    </button>
  );
}
