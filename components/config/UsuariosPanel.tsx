"use client";
// components/config/UsuariosPanel.tsx — personal que entra al panel.

import { useEffect, useState } from "react";
import { Tarjeta, Boton, Chip, Modal, Campo, inputClase, EstadoVacio } from "@/components/ui";
import Switch from "@/components/Switch";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useUsuario } from "@/components/UsuarioContext";
import type { UsuarioPanel } from "@/lib/tipos";

const ROLES = ["dueño", "encargado", "contador"] as const;
const DESC_ROL: Record<string, string> = {
  dueño: "Ve y edita todo",
  encargado: "Carga y ve sólo lo suyo",
  contador: "Sólo lectura",
};

function UsuarioModal({
  usuario,
  onCerrar,
  onGuardado,
}: {
  usuario: UsuarioPanel | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const edicion = !!usuario;
  const [nombre, setNombre] = useState(usuario?.nombre ?? "");
  const [nombreUsuario, setNombreUsuario] = useState(usuario?.nombreUsuario ?? "");
  const [rol, setRol] = useState(usuario?.rol ?? "encargado");
  const [numeroWhatsapp, setNumeroWhatsapp] = useState(usuario?.numeroWhatsapp ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setError(null);
    setGuardando(true);
    const body: Record<string, unknown> = { nombre, rol, numeroWhatsapp: numeroWhatsapp || null };
    if (!edicion) body.nombreUsuario = nombreUsuario;
    if (password) body.password = password;
    const res = await fetch(edicion ? `/api/usuarios/${usuario!.id}` : "/api/usuarios", {
      method: edicion ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
      titulo={edicion ? `Editar ${usuario!.nombre}` : "Nuevo usuario"}
      onCerrar={onCerrar}
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
        <Campo label="Nombre para mostrar">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClase} autoFocus />
        </Campo>
        <Campo label="Usuario (para entrar)" hint={edicion ? "No se puede cambiar" : undefined}>
          <input
            value={nombreUsuario}
            onChange={(e) => setNombreUsuario(e.target.value)}
            disabled={edicion}
            className={`${inputClase} disabled:opacity-60`}
          />
        </Campo>
        <Campo label="Rol">
          <select value={rol} onChange={(e) => setRol(e.target.value as typeof rol)} className={inputClase}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r} — {DESC_ROL[r]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="WhatsApp" hint="Con código de país, ej: 5491122334455. Lo usa el bot (paso 3).">
          <input
            value={numeroWhatsapp}
            onChange={(e) => setNumeroWhatsapp(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            className={inputClase}
          />
        </Campo>
        <Campo label={edicion ? "Nueva contraseña" : "Contraseña"} hint={edicion ? "Dejala vacía para no cambiarla" : "Mínimo 6 caracteres"}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClase}
          />
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

export default function UsuariosPanel() {
  const yo = useUsuario();
  const [usuarios, setUsuarios] = useState<UsuarioPanel[]>([]);
  const [modal, setModal] = useState<null | { usuario: UsuarioPanel | null }>(null);
  const [borrar, setBorrar] = useState<UsuarioPanel | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = () =>
    fetch("/api/usuarios")
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsuarios);

  useEffect(() => {
    cargar();
  }, []);

  async function toggleActivo(u: UsuarioPanel, activo: boolean) {
    const res = await fetch(`/api/usuarios/${u.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo }),
    });
    if (!res.ok) setAviso((await res.json()).error ?? null);
    cargar();
  }

  async function borrarUsuario() {
    if (!borrar) return;
    const res = await fetch(`/api/usuarios/${borrar.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBorrar(null);
    if (data?.desactivado) setAviso(data.mensaje ?? null);
    else if (!res.ok) setAviso(data.error ?? null);
    cargar();
  }

  return (
    <Tarjeta className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <p className="text-sm font-bold">Personal</p>
        <Boton variante="primario" icono="mas" onClick={() => setModal({ usuario: null })}>
          Nuevo usuario
        </Boton>
      </div>

      {aviso && (
        <p className="border-b border-[var(--color-border)] bg-[var(--color-warn-soft)] px-4 py-2 text-xs text-[var(--color-warn)]">
          {aviso}
        </p>
      )}

      {usuarios.length === 0 ? (
        <EstadoVacio icono="usuarios" titulo="Sin usuarios" />
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {usuarios.map((u) => (
            <div key={u.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${!u.activo ? "opacity-60" : ""}`}>
              <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-xs font-bold">
                {u.nombre.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  {u.nombre}
                  {u.id === yo.id && <Chip color="indigo">vos</Chip>}
                  <Chip>{u.rol}</Chip>
                  {!u.activo && <Chip color="ambar">inactivo</Chip>}
                </p>
                <p className="text-xs text-[var(--color-muted)]">
                  @{u.nombreUsuario}
                  {u.numeroWhatsapp ? ` · wa: ${u.numeroWhatsapp}` : ""}
                </p>
              </div>
              <Switch
                activo={u.activo}
                disabled={u.id === yo.id}
                onChange={(v) => toggleActivo(u, v)}
              />
              <Boton tamano="sm" variante="fantasma" icono="lapiz" onClick={() => setModal({ usuario: u })}>
                <span className="sr-only">Editar</span>
              </Boton>
              <Boton
                tamano="sm"
                variante="fantasma"
                icono="basura"
                disabled={u.id === yo.id}
                onClick={() => setBorrar(u)}
                className="text-[var(--color-expense)]"
              >
                <span className="sr-only">Borrar</span>
              </Boton>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <UsuarioModal
          usuario={modal.usuario}
          onCerrar={() => setModal(null)}
          onGuardado={() => {
            setModal(null);
            cargar();
          }}
        />
      )}
      {borrar && (
        <ConfirmDialog
          titulo="Borrar usuario"
          peligro
          textoConfirmar="Borrar"
          mensaje={
            <>
              Se borra <strong>{borrar.nombre}</strong>. Si tiene movimientos cargados, en vez de
              borrarse se <strong>desactiva</strong>.
            </>
          }
          onConfirmar={borrarUsuario}
          onCerrar={() => setBorrar(null)}
        />
      )}
    </Tarjeta>
  );
}
