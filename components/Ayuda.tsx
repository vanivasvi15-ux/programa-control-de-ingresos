// components/Ayuda.tsx
//
// Recuadro desplegable "¿Cómo funciona esta pantalla?" para ponerle a cada
// pantalla una explicación corta y un ejemplo, sin ocupar lugar cuando ya se
// sabe usar. Usa <details>, así que no necesita JavaScript.

import Link from "next/link";

export default function Ayuda({
  titulo = "¿Cómo funciona esta pantalla?",
  children,
}: {
  titulo?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-medium text-[var(--color-accent)] [&::-webkit-details-marker]:hidden">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--color-accent-soft)] text-xs font-bold">
          ?
        </span>
        {titulo}
        <span className="ml-auto text-xs text-[var(--color-muted)] group-open:hidden">ver</span>
        <span className="ml-auto hidden text-xs text-[var(--color-muted)] group-open:inline">cerrar</span>
      </summary>
      <div className="space-y-2 border-t border-[var(--color-border)] px-4 py-3 text-sm leading-relaxed text-[var(--color-text)]">
        {children}
        <p className="pt-1 text-xs text-[var(--color-muted)]">
          Más explicaciones en{" "}
          <Link href="/stock/ayuda" className="text-[var(--color-accent)] hover:underline">
            la página Ayuda
          </Link>
          .
        </p>
      </div>
    </details>
  );
}

// Un renglón de ejemplo con estilo propio (para que se distinga del texto).
export function Ejemplo({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-[13px] text-[var(--color-muted)]">
      <span className="font-semibold text-[var(--color-text)]">Ejemplo: </span>
      {children}
    </p>
  );
}
