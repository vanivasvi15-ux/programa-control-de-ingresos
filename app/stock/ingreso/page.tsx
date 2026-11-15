"use client";
// app/stock/ingreso/page.tsx — ingreso de piezas terminadas por escaneo.
// Pensada para la pantalla del sector de embalaje con un lector USB o
// Bluetooth: el lector escribe el código y aprieta Enter, y la caja de
// escaneo siempre se queda con el cursor.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Encabezado from "@/components/Encabezado";
import Ayuda, { Ejemplo } from "@/components/Ayuda";
import Icono from "@/components/Icono";
import { Tarjeta, Boton, Chip, EstadoVacio, inputClase } from "@/components/ui";
import { formatearCantidad } from "@/lib/tipos-stock";

type Reciente = {
  id: number;
  codigo: string;
  cantidad: number;
  estado: "activo" | "deshecho";
  creado: string;
  piezaId: number;
  pieza: string;
  usuario: string | null;
};
type DeHoy = { piezaId: number; nombre: string; total: number };
type Mensaje =
  | { tipo: "ok"; pieza: string; cantidad: number; stockPieza: number; enRojo: { nombre: string; stock: number; unidad: string }[] }
  | { tipo: "error" | "aviso"; texto: string };
type DeSesion = { id: number; nombre: string; cantidad: number; deshecho: boolean };

// Pitidos con el propio navegador (sin archivos de sonido).
function usePitido() {
  const ctx = useRef<AudioContext | null>(null);
  return useCallback((tipo: "ok" | "error") => {
    try {
      const AC =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx.current ??= new AC();
      const c = ctx.current;
      if (c.state === "suspended") void c.resume();
      const tonos = tipo === "ok" ? [[880, 0, 0.12]] : [[220, 0, 0.16], [220, 0.22, 0.16]];
      for (const [hz, desde, dur] of tonos) {
        const o = c.createOscillator();
        const g = c.createGain();
        o.frequency.value = hz;
        o.connect(g);
        g.connect(c.destination);
        g.gain.setValueAtTime(0.15, c.currentTime + desde);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + desde + dur);
        o.start(c.currentTime + desde);
        o.stop(c.currentTime + desde + dur);
      }
    } catch {
      // sin sonido no pasa nada
    }
  }, []);
}

export default function IngresoPage() {
  const [texto, setTexto] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [sonido, setSonido] = useState(true);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  const [sesion, setSesion] = useState<DeSesion[]>([]);
  const [recientes, setRecientes] = useState<Reciente[]>([]);
  const [hoy, setHoy] = useState<DeHoy[]>([]);
  const caja = useRef<HTMLInputElement>(null);
  const ultimo = useRef<{ codigo: string; t: number } | null>(null);
  const pitido = usePitido();
  // Los errores NO se pisan con el siguiente escaneo: quedan en pantalla hasta
  // que alguien los cierre, para que un escaneo fallido no pase desapercibido.
  const [errores, setErrores] = useState<string[]>([]);
  // Los escaneos se mandan de a uno y en orden, aunque el lector los dispare
  // muy seguidos; la caja nunca se bloquea.
  const cola = useRef<Promise<void>>(Promise.resolve());

  function agregarError(texto: string) {
    setErrores((e) => (e.includes(texto) ? e : [...e, texto].slice(-5)));
  }

  const cargar = useCallback(async () => {
    const r = await fetch("/api/escaneos");
    if (r.ok) {
      const d = await r.json();
      setRecientes(d.recientes);
      setHoy(d.hoy);
    }
  }, []);

  useEffect(() => {
    cargar();
    caja.current?.focus();
  }, [cargar]);

  async function procesar(ahora: number) {
    const codigo = texto.trim();
    setTexto("");
    if (!codigo) return;

    const cant = Math.min(500, Math.max(1, Math.floor(Number(cantidad)) || 1));
    setCantidad("1"); // la cantidad vale para un solo escaneo: evita errores de arrastre

    // Un lector a veces lee dos veces seguidas la misma etiqueta. Con una
    // pieza por escaneo, lo que llega repetido en menos de 1,5 s se ignora
    // (y se avisa, por si en realidad eran dos piezas).
    if (cant === 1 && ultimo.current?.codigo === codigo && ahora - ultimo.current.t < 1500) {
      setMensaje({ tipo: "aviso", texto: "Escaneo repetido muy seguido: se ignoró. Si era otra pieza, escaneala de nuevo." });
      if (sonido) pitido("error");
      return;
    }
    ultimo.current = { codigo, t: ahora };

    cola.current = cola.current.then(() => enviar(codigo, cant));
  }

  async function enviar(codigo: string, cant: number) {
    let res: Response;
    try {
      res = await fetch("/api/escaneos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, cantidad: cant }),
      });
    } catch {
      agregarError(`Sin conexión con el sistema: ${codigo} NO se registró. Volvé a escanearla.`);
      ultimo.current = null;
      if (sonido) pitido("error");
      return;
    }
    const d = await res.json().catch(() => ({}));

    if (res.ok) {
      setMensaje({ tipo: "ok", pieza: d.pieza, cantidad: d.cantidad, stockPieza: d.stockPieza, enRojo: d.enRojo ?? [] });
      setSesion((s) => [{ id: d.escaneoId, nombre: d.pieza, cantidad: d.cantidad, deshecho: false }, ...s]);
      if (sonido) pitido("ok");
      cargar();
    } else {
      agregarError(d.error ?? `No se pudo registrar el escaneo de ${codigo}`);
      ultimo.current = null;
      if (sonido) pitido("error");
    }
  }

  async function deshacer(r: Reciente) {
    const res = await fetch(`/api/escaneos/${r.id}`, { method: "DELETE" });
    if (res.ok) {
      setSesion((s) => s.map((x) => (x.id === r.id ? { ...x, deshecho: true } : x)));
      setMensaje({ tipo: "aviso", texto: `Se deshizo el ingreso de ${r.cantidad} × ${r.pieza}.` });
      cargar();
    } else {
      agregarError((await res.json().catch(() => ({}))).error ?? "No se pudo deshacer");
    }
    caja.current?.focus();
  }

  // Total de esta sesión de pantalla, por pieza.
  const tanda = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sesion) if (!s.deshecho) m.set(s.nombre, (m.get(s.nombre) ?? 0) + s.cantidad);
    return [...m.entries()];
  }, [sesion]);
  const totalTanda = tanda.reduce((s, [, n]) => s + n, 0);
  const totalHoy = hoy.reduce((s, h) => s + h.total, 0);

  const colorMensaje =
    mensaje?.tipo === "ok"
      ? "border-[var(--color-income)]/50 bg-[var(--color-income-soft)]"
      : mensaje?.tipo === "error"
        ? "border-[var(--color-expense)]/50 bg-[var(--color-expense-soft)]"
        : "border-[var(--color-warn)]/50 bg-[var(--color-warn-soft)]";

  return (
    <div className="space-y-5">
      <Encabezado
        titulo="Ingreso por escaneo"
        subtitulo="Escaneá la etiqueta de cada pieza terminada: suma al stock y descuenta los materiales de su receta"
        acciones={
          <button
            onClick={() => {
              setSonido((v) => !v);
              caja.current?.focus();
            }}
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            Sonido: {sonido ? "sí" : "no"}
          </button>
        }
      />

      <Ayuda>
        <p>
          Sirve para <strong>anotar piezas terminadas escaneando su etiqueta</strong>, sin escribir nada. Cada vez que
          escaneás, el sistema <strong>suma 1 pieza</strong> al stock y <strong>descuenta los materiales</strong> que
          lleva su receta.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Dejá el cursor en la caja de arriba y usá el lector: escribe el código y aprieta Enter solo. También podés
            escribir el código a mano y apretar Enter.
          </li>
          <li>
            ¿Varias piezas iguales juntas? Poné la <strong>cantidad</strong> y escaneá <strong>una sola vez</strong>.
          </li>
          <li>
            ¿Te equivocaste? En «Últimos ingresos» tocá <strong>Deshacer</strong>: devuelve los materiales y saca las
            piezas.
          </li>
          <li>
            Si dice <strong>falta material</strong>, la pieza igual se cuenta (ya existe), pero avisa que el stock de ese
            material en el sistema no alcanzaba: conviene cargar la compra o hacer un recuento.
          </li>
        </ul>
        <Ejemplo>
          Las chicas de embalaje terminan de envolver un Carro, le pegan la etiqueta <strong>PB00001</strong> y la
          escanean: «+1 Carro», el stock de Carro sube y se descuentan sus materiales. El código sale de Piezas →
          «Imprimir códigos».
        </Ejemplo>
      </Ayuda>

      <Tarjeta className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_130px]">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase text-[var(--color-muted)]">
              <Icono nombre="escaner" size={14} /> Código de la pieza
            </span>
            <input
              ref={caja}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && procesar(e.timeStamp)}
              onBlur={(e) => {
                // si el cursor se va a la nada, vuelve a la caja de escaneo
                const t = e.relatedTarget as HTMLElement | null;
                if (!t || !["INPUT", "BUTTON", "SELECT", "A", "TEXTAREA"].includes(t.tagName)) {
                  setTimeout(() => caja.current?.focus(), 30);
                }
              }}
              placeholder="Apuntá el lector a la etiqueta…"
              className={`${inputClase} py-3 font-mono text-lg`}
              autoComplete="off"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase text-[var(--color-muted)]">
              Cantidad (1 escaneo)
            </span>
            <input
              type="number"
              min={1}
              max={500}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className={`${inputClase} py-3 text-lg`}
              aria-label="Cantidad de piezas para el próximo escaneo"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          Para varias piezas iguales juntas: poné la cantidad y escaneá una sola vez. Vuelve a 1 después de cada escaneo.
        </p>
      </Tarjeta>

      {errores.length > 0 && (
        <div
          className="rounded-xl border border-[var(--color-expense)]/50 bg-[var(--color-expense-soft)] p-4"
          role="alert"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              {errores.map((t, i) => (
                <p key={i} className="flex items-start gap-2 text-sm font-semibold text-[var(--color-expense)]">
                  <Icono nombre="alerta" size={18} /> {t}
                </p>
              ))}
            </div>
            <Boton
              tamano="sm"
              variante="contorno"
              onClick={() => {
                setErrores([]);
                caja.current?.focus();
              }}
            >
              Entendido
            </Boton>
          </div>
        </div>
      )}

      {mensaje && (
        <div className={`rounded-xl border p-4 ${colorMensaje}`} role="status" aria-live="polite">
          {mensaje.tipo === "ok" ? (
            <>
              <p className="flex items-center gap-2 text-lg font-bold text-[var(--color-income)]">
                <Icono nombre="check" size={22} /> +{mensaje.cantidad} · {mensaje.pieza}
              </p>
              <p className="mt-0.5 text-sm">
                Stock de esta pieza ahora: <strong className="tabular">{formatearCantidad(mensaje.stockPieza)}</strong>
              </p>
              {mensaje.enRojo.length > 0 && (
                <div className="mt-2 rounded-lg bg-[var(--color-warn-soft)] px-3 py-2 text-sm text-[var(--color-warn)]">
                  <p className="font-semibold">La pieza se contó, pero faltan materiales según el stock cargado:</p>
                  <ul className="mt-0.5 list-disc pl-5">
                    {mensaje.enRojo.map((m, i) => (
                      <li key={i}>
                        {m.nombre}: quedó en {formatearCantidad(m.stock)} {m.unidad}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs">Conviene cargar la compra o hacer un recuento de ese insumo.</p>
                </div>
              )}
            </>
          ) : (
            <p
              className={`flex items-center gap-2 text-sm font-semibold ${
                mensaje.tipo === "error" ? "text-[var(--color-expense)]" : "text-[var(--color-warn)]"
              }`}
            >
              <Icono nombre="alerta" size={18} /> {mensaje.texto}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold">Esta tanda</p>
            <Chip color="indigo">
              {totalTanda} {totalTanda === 1 ? "pieza" : "piezas"}
            </Chip>
          </div>
          {tanda.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--color-muted)]">Todavía no escaneaste nada en esta pantalla.</p>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {tanda.map(([nombre, n]) => (
                <div key={nombre} className="flex items-center justify-between py-2 text-sm">
                  <span>{nombre}</span>
                  <strong className="tabular">× {n}</strong>
                </div>
              ))}
            </div>
          )}
        </Tarjeta>

        <Tarjeta className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold">Ingresado hoy (todos)</p>
            <Chip color="verde">
              {totalHoy} {totalHoy === 1 ? "pieza" : "piezas"}
            </Chip>
          </div>
          {hoy.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--color-muted)]">Hoy no entró ninguna pieza por escaneo.</p>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {hoy.map((h) => (
                <div key={h.piezaId} className="flex items-center justify-between py-2 text-sm">
                  <span>{h.nombre}</span>
                  <strong className="tabular">× {h.total}</strong>
                </div>
              ))}
            </div>
          )}
        </Tarjeta>
      </div>

      <Tarjeta className="overflow-hidden">
        <p className="border-b border-[var(--color-border)] px-4 py-3 text-sm font-bold">Últimos ingresos</p>
        {recientes.length === 0 ? (
          <EstadoVacio icono="escaner" titulo="Sin ingresos todavía" detalle="Cuando escanees una pieza va a aparecer acá." />
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {recientes.map((r) => (
              <div key={r.id} className={`flex items-center gap-3 px-4 py-2.5 ${r.estado === "deshecho" ? "opacity-50" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${r.estado === "deshecho" ? "line-through" : ""}`}>
                    {r.cantidad} × {r.pieza}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {r.creado.slice(11, 16)} · {r.usuario ?? "—"} · <span className="font-mono">{r.codigo}</span>
                    {r.estado === "deshecho" && " · deshecho"}
                  </p>
                </div>
                {r.estado === "activo" && (
                  <Boton tamano="sm" variante="contorno" onClick={() => deshacer(r)}>
                    Deshacer
                  </Boton>
                )}
              </div>
            ))}
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
