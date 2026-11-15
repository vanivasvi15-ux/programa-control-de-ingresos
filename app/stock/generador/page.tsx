"use client";
// app/stock/generador/page.tsx — crea de una vez los rieles, jotas, piezas
// chicas y kits de puerta granero con las medidas reales del taller.

import { useEffect, useMemo, useState } from "react";
import Encabezado from "@/components/Encabezado";
import Ayuda, { Ejemplo } from "@/components/Ayuda";
import { Tarjeta, Boton, Chip, inputClase } from "@/components/ui";
import {
  AGUJEROS_ENTEROS,
  AGUJEROS_GIRATORIOS,
  AGUJEROS_PLEGADOS,
  ORDEN_TIPOS_KIT,
  ROLES,
  TIPOS_KIT,
  agujerosRiel,
  type Rol,
  type TipoKit,
} from "@/lib/generador-datos";
import type { ResumenGenerador } from "@/lib/generador";
import type { Insumo } from "@/lib/tipos-stock";

type Marca = { enteros: number[]; plegados: number[]; doble: boolean };
const VACIA: Marca = { enteros: [], plegados: [], doble: false };

const ESTADO_MATERIAL: Record<string, { texto: string; color: "verde" | "ambar" | "indigo" }> = {
  existente: { texto: "ya existe", color: "verde" },
  elegido: { texto: "elegido por vos", color: "indigo" },
  se_crea: { texto: "se va a crear", color: "ambar" },
  creado: { texto: "creado", color: "verde" },
};

function ListaDeLargos({
  titulo,
  largos,
  marcados,
  etiquetaAgujeros,
  onChange,
}: {
  titulo: string;
  largos: number[];
  marcados: number[];
  etiquetaAgujeros: (largo: number) => number;
  onChange: (nuevos: number[]) => void;
}) {
  const todos = marcados.length === largos.length;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">{titulo}</p>
        <button
          type="button"
          className="text-xs text-[var(--color-accent)] hover:underline"
          onClick={() => onChange(todos ? [] : largos)}
        >
          {todos ? "quitar todos" : "marcar todos"}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {largos.map((l) => {
          const on = marcados.includes(l);
          return (
            <button
              key={l}
              type="button"
              onClick={() => onChange(on ? marcados.filter((x) => x !== l) : [...marcados, l])}
              title={`${etiquetaAgujeros(l)} agujeros`}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                on
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                  : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
              }`}
            >
              {l}
              <span className="ml-1 opacity-70">· {etiquetaAgujeros(l)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function GeneradorPage() {
  const [marcas, setMarcas] = useState<Record<TipoKit, Marca>>(
    () => Object.fromEntries(ORDEN_TIPOS_KIT.map((t) => [t, { ...VACIA }])) as Record<TipoKit, Marca>
  );
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [materiales, setMateriales] = useState<Partial<Record<Rol, string>>>({});
  const [resumen, setResumen] = useState<ResumenGenerador | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/insumos")
      .then((r) => (r.ok ? r.json() : []))
      .then(setInsumos);
  }, []);

  const elegidos = useMemo(
    () => ORDEN_TIPOS_KIT.filter((t) => marcas[t].enteros.length + marcas[t].plegados.length > 0),
    [marcas]
  );

  function cambiar(tipo: TipoKit, parte: Partial<Marca>) {
    setMarcas((m) => ({ ...m, [tipo]: { ...m[tipo], ...parte } }));
    setResumen(null);
    setVistaPrevia(false);
  }

  async function enviar(aplicar: boolean) {
    setTrabajando(true);
    setError(null);
    const r = await fetch("/api/generador", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        aplicar,
        selecciones: elegidos.map((tipo) => ({ tipo, ...marcas[tipo] })),
        materiales,
      }),
    });
    const data = await r.json();
    setTrabajando(false);
    if (!r.ok) {
      setError(data.error ?? "No se pudo");
      return;
    }
    setResumen(data);
    setVistaPrevia(!aplicar);
  }

  const kitsSimples = resumen ? resumen.kitsNuevos.length + resumen.kitsExistentes.length : 0;

  return (
    <div className="space-y-5">
      <Encabezado
        titulo="Generador de kits"
        subtitulo="Crea de una vez los rieles, jotas y kits con las medidas del taller"
      />

      <Ayuda>
        <p>
          Marcá qué kits querés (tipo y largo de riel) y el sistema crea <strong>todo lo necesario</strong>: el riel de
          cada largo, las jotas, los topes, los tubitos y el kit completo con la cantidad exacta de tirafondos, tarugos,
          arandelas y separadores según los <strong>agujeros</strong> de ese riel.
        </p>
        <Ejemplo>
          Marcás «Estándar» y los largos 140 y 160. Se crean «Riel común 140 cm», «Riel común 160 cm», «Jota estándar» y
          los kits «Kit estándar 140 cm» y «Kit estándar 160 cm». Cada kit de 4 agujeros lleva 4 tubitos, 4 arandelas y
          6 tirafondos y 6 tarugos (4 del riel + 2 del tope de piso).
        </Ejemplo>
        <p>
          El número chico al lado de cada largo es la cantidad de agujeros. Lo que ya exista con el mismo nombre{" "}
          <strong>no se toca</strong>, así que se puede usar varias veces. Los precios de los materiales se cargan
          después en Compras.
        </p>
      </Ayuda>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">1. ¿Qué kits querés crear?</h2>
        {ORDEN_TIPOS_KIT.map((tipo) => {
          const def = TIPOS_KIT[tipo];
          const marca = marcas[tipo];
          const largosEnteros = Object.keys(def.riel === "giratorio" ? AGUJEROS_GIRATORIOS : AGUJEROS_ENTEROS).map(Number);
          const largosPlegados = Object.keys(AGUJEROS_PLEGADOS).map(Number);
          return (
            <Tarjeta key={tipo} className={`space-y-3 p-4 ${def.jota ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold">{def.etiqueta}</p>
                {def.jota && (
                  <span className="text-xs text-[var(--color-muted)]">
                    jota: {def.jota.partes.map((p) => p.cm).join(" + ")} cm
                    {def.jota.topeJota ? " + tope jota" : ""}
                  </span>
                )}
                {!def.jota && <Chip color="ambar">Falta un dato: {def.pendiente}</Chip>}
              </div>
              {def.jota && (
                <>
                  <ListaDeLargos
                    titulo="Riel entero (cm · agujeros)"
                    largos={largosEnteros}
                    marcados={marca.enteros}
                    etiquetaAgujeros={(l) => agujerosRiel(def.riel, l, false) ?? 0}
                    onChange={(v) => cambiar(tipo, { enteros: v })}
                  />
                  {def.plegable && (
                    <ListaDeLargos
                      titulo="Riel plegado (cm · agujeros)"
                      largos={largosPlegados}
                      marcados={marca.plegados}
                      etiquetaAgujeros={(l) => agujerosRiel(def.riel, l, true) ?? 0}
                      onChange={(v) => cambiar(tipo, { plegados: v })}
                    />
                  )}
                  {def.permiteDoble && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={marca.doble}
                        onChange={(e) => cambiar(tipo, { doble: e.target.checked })}
                      />
                      Crear también la versión <strong>doble</strong> (dos hojas: 4 jotas, 8 tornillos con tuerca, 2
                      topes de piso)
                    </label>
                  )}
                </>
              )}
            </Tarjeta>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">2. Materiales (opcional)</h2>
        <Tarjeta className="space-y-2 p-4">
          <p className="text-sm text-[var(--color-muted)]">
            Para cada material podés elegir uno que ya tengas cargado; si dejás «automático», se usa el que tenga el
            nombre sugerido o se crea uno nuevo (con precio 0, para completar en Compras).
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(ROLES) as Rol[]).map((rol) => (
              <label key={rol} className="block text-sm">
                <span className="font-medium">{ROLES[rol].nombre}</span>
                <span className="block text-xs text-[var(--color-muted)]">{ROLES[rol].ayuda}</span>
                <select
                  className={`${inputClase} mt-1`}
                  value={materiales[rol] ?? ""}
                  onChange={(e) => {
                    setMateriales((m) => ({ ...m, [rol]: e.target.value }));
                    setResumen(null);
                    setVistaPrevia(false);
                  }}
                >
                  <option value="">Automático</option>
                  {insumos
                    .filter((i) => i.activo)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nombre}
                      </option>
                    ))}
                </select>
              </label>
            ))}
          </div>
        </Tarjeta>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">3. Revisá y creá</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Boton variante="suave" disabled={elegidos.length === 0 || trabajando} onClick={() => enviar(false)}>
            Ver qué se va a crear
          </Boton>
          <Boton
            variante="primario"
            icono="check"
            disabled={!vistaPrevia || trabajando || !resumen || resumen.kitsNuevos.length + resumen.piezasNuevas.length === 0}
            onClick={() => enviar(true)}
          >
            Crear ahora
          </Boton>
          {elegidos.length === 0 && (
            <span className="text-sm text-[var(--color-muted)]">Marcá al menos un largo de riel.</span>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-[var(--color-expense-soft)] px-3 py-2 text-sm text-[var(--color-expense)]">{error}</p>
        )}

        {resumen && (
          <Tarjeta className="space-y-4 p-4">
            <p className="text-sm font-semibold">
              {resumen.aplicado ? "Listo, se creó:" : "Esto es lo que se va a crear (todavía no se guardó nada):"}
            </p>
            <ul className="space-y-1 text-sm">
              <li>
                <strong>{resumen.kitsNuevos.length}</strong> kits nuevos
                {resumen.kitsExistentes.length > 0 && (
                  <span className="text-[var(--color-muted)]"> ({resumen.kitsExistentes.length} ya existían y no se tocan)</span>
                )}
              </li>
              <li>
                <strong>{resumen.piezasNuevas.length}</strong> piezas nuevas
                {resumen.piezasExistentes.length > 0 && (
                  <span className="text-[var(--color-muted)]"> ({resumen.piezasExistentes.length} ya existían)</span>
                )}
              </li>
            </ul>

            {resumen.errores.length > 0 && (
              <div className="rounded-lg bg-[var(--color-warn-soft)] px-3 py-2 text-sm text-[var(--color-warn)]">
                {resumen.errores.map((e) => (
                  <p key={e}>{e}</p>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Materiales</p>
              {resumen.materiales.map((m) => (
                <p key={m.rol} className="flex flex-wrap items-center gap-2 text-sm">
                  {m.nombre}
                  <Chip color={ESTADO_MATERIAL[m.estado].color}>{ESTADO_MATERIAL[m.estado].texto}</Chip>
                </p>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Así queda lo que lleva cada kit (primeros ejemplos)
              </p>
              {resumen.ejemplos.map((e) => (
                <details key={e.nombre} className="rounded-lg border border-[var(--color-border)]">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium">{e.nombre}</summary>
                  <ul className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)] text-sm">
                    {e.lineas.map((l) => (
                      <li key={l.texto} className="flex justify-between gap-3 px-3 py-1.5">
                        <span>{l.texto}</span>
                        <span className="font-semibold tabular-nums">× {l.cantidad}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>

            <details>
              <summary className="cursor-pointer text-sm text-[var(--color-accent)]">
                Ver los {kitsSimples} nombres de kits
              </summary>
              <ul className="mt-2 columns-1 gap-4 text-sm sm:columns-2">
                {[...resumen.kitsNuevos.map((n) => [n, true] as const), ...resumen.kitsExistentes.map((n) => [n, false] as const)].map(
                  ([n, nuevo]) => (
                    <li key={n} className={nuevo ? "" : "text-[var(--color-muted)]"}>
                      {n}
                      {!nuevo && " (ya existía)"}
                    </li>
                  )
                )}
              </ul>
            </details>

            {resumen.aplicado && (
              <p className="text-sm text-[var(--color-muted)]">
                Ahora cargá el precio de los materiales en <strong>Compras</strong> (así se calcula el costo) y el precio
                de venta de cada kit en <strong>Productos</strong>.
              </p>
            )}
          </Tarjeta>
        )}
      </section>
    </div>
  );
}
