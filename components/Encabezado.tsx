// components/Encabezado.tsx
//
// Encabezado de pantalla: título, subtítulo opcional y espacio para
// acciones a la derecha.

export default function Encabezado({
  titulo,
  subtitulo,
  acciones,
}: {
  titulo: string;
  subtitulo?: string;
  acciones?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{titulo}</h1>
        {subtitulo && <p className="text-sm text-[var(--color-muted)]">{subtitulo}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  );
}
