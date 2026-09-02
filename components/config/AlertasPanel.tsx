"use client";
// components/config/AlertasPanel.tsx
//
// Configuración de alertas: límites de gasto por categoría + otros avisos
// (fijo por vencer, resumen periódico, inactividad). Los mensajes se
// mandan por WhatsApp cuando el bot esté conectado (paso 3).

import { useCallback, useEffect, useState } from "react";
import { Tarjeta, Boton, Modal, Campo, inputClase, EstadoVacio } from "@/components/ui";
import Icono from "@/components/Icono";
import Switch from "@/components/Switch";
import ConfirmDialog from "@/components/ConfirmDialog";
import { formatearPesos } from "@/lib/formato";
import type { AlertaConfig, Categoria, UsuarioPanel, Resumen } from "@/lib/tipos";

const NOMBRE_TIPO: Record<AlertaConfig["tipo"], string> = {
  limite_categoria: "Límite de gasto por categoría",
  fijo_por_vencer: "Aviso de fijo por vencer",
  resumen_periodico: "Resumen periódico",
  inactividad: "Aviso de inactividad",
};

function soloDigitos(s: string) {
  return s.replace(/\D/g, "");
}
function conSep(d: string) {
  return d ? Number(d).toLocaleString("es-AR") : "";
}

function AlertaModal({
  alerta,
  tipoInicial,
  categorias,
  usuarios,
  onCerrar,
  onGuardado,
}: {
  alerta: AlertaConfig | null;
  tipoInicial: AlertaConfig["tipo"];
  categorias: Categoria[];
  usuarios: UsuarioPanel[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const edicion = !!alerta;
  const tipo = alerta?.tipo ?? tipoInicial;
  const p = alerta?.parametros ?? {};

  const [categoriaId, setCategoriaId] = useState<number | "">(
    (p.categoriaId as number) ?? ""
  );
  const [montoTxt, setMontoTxt] = useState(p.monto ? conSep(String(p.monto)) : "");
  const [diasAntes, setDiasAntes] = useState(String((p.diasAntes as number) ?? 3));
  const [periodo, setPeriodo] = useState<string>((p.periodo as string) ?? "mensual");
  const [dias, setDias] = useState(String((p.dias as number) ?? 7));
  const [destino, setDestino] = useState<number | "">(alerta?.usuarioIdDestino ?? "");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const gastoCats = categorias.filter((c) => c.tipo === "gasto" && c.activo);

  async function guardar() {
    setError(null);
    let parametros: Record<string, unknown> = {};
    if (tipo === "limite_categoria") {
      parametros = { categoriaId: Number(categoriaId), monto: Number(soloDigitos(montoTxt)) };
    } else if (tipo === "fijo_por_vencer") {
      parametros = { diasAntes: Number(diasAntes) };
    } else if (tipo === "resumen_periodico") {
      parametros = { periodo };
    } else if (tipo === "inactividad") {
      parametros = { dias: Number(dias) };
    }
    setGuardando(true);
    const body = { tipo, parametros, usuarioIdDestino: destino || null };
    const res = await fetch(edicion ? `/api/alertas-config/${alerta!.id}` : "/api/alertas-config", {
      method: edicion ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edicion ? { parametros, usuarioIdDestino: destino || null } : body),
    });
    setGuardando(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "No se pudo guardar");
      return;
    }
    onGuardado();
  }

  return (
    <Modal
      titulo={edicion ? "Editar alerta" : NOMBRE_TIPO[tipo]}
      onCerrar={onCerrar}
      ancho="max-w-md"
      footer={
        <>
          <Boton variante="fantasma" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton variante="primario" icono="check" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar"}
          </Boton>
        </>
      }
    >
      <div className="space-y-4">
        {tipo === "limite_categoria" && (
          <>
            <Campo label="Categoría de gasto">
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value ? Number(e.target.value) : "")}
                className={inputClase}
              >
                <option value="">Elegí una…</option>
                {gastoCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Límite mensual" hint="Se avisa cuando el gasto del mes en esa categoría lo supera.">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--color-muted)]">
                  $
                </span>
                <input
                  value={montoTxt}
                  onChange={(e) => setMontoTxt(conSep(soloDigitos(e.target.value)))}
                  inputMode="numeric"
                  className={`${inputClase} pl-7 font-bold tabular`}
                />
              </div>
            </Campo>
          </>
        )}

        {tipo === "fijo_por_vencer" && (
          <Campo label="Avisar con cuántos días de anticipación">
            <input
              type="number"
              min={0}
              max={60}
              value={diasAntes}
              onChange={(e) => setDiasAntes(e.target.value)}
              className={inputClase}
            />
          </Campo>
        )}

        {tipo === "resumen_periodico" && (
          <Campo label="Cada cuánto mandar el resumen">
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className={inputClase}>
              <option value="semanal">Semanal</option>
              <option value="mensual">Mensual</option>
            </select>
          </Campo>
        )}

        {tipo === "inactividad" && (
          <Campo label="Avisar si no se carga nada en X días">
            <input
              type="number"
              min={1}
              max={90}
              value={dias}
              onChange={(e) => setDias(e.target.value)}
              className={inputClase}
            />
          </Campo>
        )}

        <Campo label="¿A quién le llega?" hint="Por WhatsApp, cuando el bot esté activo.">
          <select
            value={destino}
            onChange={(e) => setDestino(e.target.value ? Number(e.target.value) : "")}
            className={inputClase}
          >
            <option value="">Sin destinatario definido</option>
            {usuarios
              .filter((u) => u.activo)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} {u.numeroWhatsapp ? "" : "(sin WhatsApp)"}
                </option>
              ))}
          </select>
        </Campo>

        {error && (
          <p className="rounded-lg bg-[var(--color-expense-soft)] px-3 py-2 text-sm text-[var(--color-expense)]">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

export default function AlertasPanel() {
  const [alertas, setAlertas] = useState<AlertaConfig[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioPanel[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [modal, setModal] = useState<null | { alerta: AlertaConfig | null; tipo: AlertaConfig["tipo"] }>(
    null
  );
  const [borrar, setBorrar] = useState<AlertaConfig | null>(null);

  const cargar = useCallback(async () => {
    const [ra, rc, ru, rr] = await Promise.all([
      fetch("/api/alertas-config"),
      fetch("/api/categorias"),
      fetch("/api/usuarios"),
      fetch("/api/resumen"),
    ]);
    if (ra.ok) setAlertas(await ra.json());
    if (rc.ok) setCategorias(await rc.json());
    if (ru.ok) setUsuarios(await ru.json());
    if (rr.ok) setResumen(await rr.json());
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const nombreDestino = (id: number | null) =>
    id ? usuarios.find((u) => u.id === id)?.nombre ?? "—" : null;

  async function toggle(a: AlertaConfig, activo: boolean) {
    await fetch(`/api/alertas-config/${a.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo }),
    });
    cargar();
  }
  async function borrarAlerta() {
    if (!borrar) return;
    await fetch(`/api/alertas-config/${borrar.id}`, { method: "DELETE" });
    setBorrar(null);
    cargar();
  }

  const limites = alertas.filter((a) => a.tipo === "limite_categoria");
  const otras = alertas.filter((a) => a.tipo !== "limite_categoria");

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-[var(--color-accent-soft)] px-3 py-2 text-xs text-[var(--color-accent)]">
        <Icono nombre="campana" size={13} className="mr-1 inline" />
        Estos avisos se enviarán por WhatsApp cuando el bot esté conectado (paso 3). Podés dejarlos
        configurados desde ahora.
      </p>

      {/* Límites */}
      <Tarjeta className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <p className="text-sm font-bold">Límites de gasto por categoría</p>
          <Boton
            variante="primario"
            icono="mas"
            onClick={() => setModal({ alerta: null, tipo: "limite_categoria" })}
          >
            Nuevo límite
          </Boton>
        </div>
        {limites.length === 0 ? (
          <EstadoVacio
            icono="etiqueta"
            titulo="Sin límites"
            detalle="Poné un tope mensual a una categoría de gasto (ej. Nafta) y te avisamos si lo pasás."
          />
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {limites.map((a) => {
              const catId = a.parametros.categoriaId as number;
              const monto = a.parametros.monto as number;
              const prog = resumen?.limites.find((l) => l.id === a.id);
              const cat = categorias.find((c) => c.id === catId);
              const pct = prog ? Math.min(prog.porcentaje, 100) : 0;
              return (
                <div key={a.id} className={`px-4 py-3 ${!a.activo ? "opacity-60" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {cat?.nombre ?? "(categoría borrada)"}{" "}
                        <span className="font-normal text-[var(--color-muted)]">
                          · tope {formatearPesos(monto)}/mes
                        </span>
                      </p>
                      {nombreDestino(a.usuarioIdDestino) && (
                        <p className="text-xs text-[var(--color-muted)]">
                          avisa a {nombreDestino(a.usuarioIdDestino)}
                        </p>
                      )}
                    </div>
                    <Switch activo={a.activo} onChange={(v) => toggle(a, v)} />
                    <Boton
                      tamano="sm"
                      variante="fantasma"
                      icono="lapiz"
                      onClick={() => setModal({ alerta: a, tipo: a.tipo })}
                    >
                      <span className="sr-only">Editar</span>
                    </Boton>
                    <Boton
                      tamano="sm"
                      variante="fantasma"
                      icono="basura"
                      onClick={() => setBorrar(a)}
                      className="text-[var(--color-expense)]"
                    >
                      <span className="sr-only">Borrar</span>
                    </Boton>
                  </div>
                  {prog && (
                    <div className="mt-2">
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                        <div
                          className={`h-full rounded-full ${
                            prog.porcentaje >= 100
                              ? "bg-[var(--color-expense)]"
                              : prog.porcentaje >= 80
                              ? "bg-[var(--color-warn)]"
                              : "bg-[var(--color-income)]"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                        {formatearPesos(prog.gastado)} este mes ({prog.porcentaje}%)
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Tarjeta>

      {/* Otros avisos */}
      <Tarjeta className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <p className="text-sm font-bold">Otros avisos</p>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {(["fijo_por_vencer", "resumen_periodico", "inactividad"] as const).map((t) => {
            const existentes = otras.filter((a) => a.tipo === t);
            return (
              <div key={t} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{NOMBRE_TIPO[t]}</p>
                  <Boton
                    tamano="sm"
                    variante="contorno"
                    icono="mas"
                    onClick={() => setModal({ alerta: null, tipo: t })}
                  >
                    Agregar
                  </Boton>
                </div>
                {existentes.map((a) => (
                  <div key={a.id} className={`mt-2 flex items-center gap-3 rounded-lg bg-[var(--color-surface-2)] px-3 py-2 ${!a.activo ? "opacity-60" : ""}`}>
                    <p className="flex-1 text-xs text-[var(--color-muted)]">
                      {t === "fijo_por_vencer" && `${a.parametros.diasAntes} días antes`}
                      {t === "resumen_periodico" && `resumen ${a.parametros.periodo}`}
                      {t === "inactividad" && `si no se carga nada en ${a.parametros.dias} días`}
                      {nombreDestino(a.usuarioIdDestino)
                        ? ` · avisa a ${nombreDestino(a.usuarioIdDestino)}`
                        : ""}
                    </p>
                    <Switch activo={a.activo} onChange={(v) => toggle(a, v)} />
                    <button
                      onClick={() => setModal({ alerta: a, tipo: a.tipo })}
                      className="text-[var(--color-muted)] hover:text-[var(--color-text)]"
                    >
                      <Icono nombre="lapiz" size={14} />
                    </button>
                    <button
                      onClick={() => setBorrar(a)}
                      className="text-[var(--color-muted)] hover:text-[var(--color-expense)]"
                    >
                      <Icono nombre="basura" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </Tarjeta>

      {modal && (
        <AlertaModal
          alerta={modal.alerta}
          tipoInicial={modal.tipo}
          categorias={categorias}
          usuarios={usuarios}
          onCerrar={() => setModal(null)}
          onGuardado={() => {
            setModal(null);
            cargar();
          }}
        />
      )}
      {borrar && (
        <ConfirmDialog
          titulo="Borrar alerta"
          peligro
          textoConfirmar="Borrar"
          mensaje="Se elimina esta alerta configurada."
          onConfirmar={borrarAlerta}
          onCerrar={() => setBorrar(null)}
        />
      )}
    </div>
  );
}
