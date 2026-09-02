"use client";
// components/ConfirmDialog.tsx
//
// Diálogo de confirmación genérico (anular un movimiento, borrar una
// categoría, etc.).

import { useState } from "react";
import { Modal, Boton } from "./ui";

export default function ConfirmDialog({
  titulo,
  mensaje,
  textoConfirmar = "Confirmar",
  peligro = false,
  onConfirmar,
  onCerrar,
}: {
  titulo: string;
  mensaje: React.ReactNode;
  textoConfirmar?: string;
  peligro?: boolean;
  onConfirmar: () => Promise<void> | void;
  onCerrar: () => void;
}) {
  const [trabajando, setTrabajando] = useState(false);

  async function confirmar() {
    setTrabajando(true);
    try {
      await onConfirmar();
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <Modal
      titulo={titulo}
      onCerrar={onCerrar}
      ancho="max-w-md"
      footer={
        <>
          <Boton variante="fantasma" onClick={onCerrar} disabled={trabajando}>
            Cancelar
          </Boton>
          <Boton
            variante={peligro ? "peligro" : "primario"}
            onClick={confirmar}
            disabled={trabajando}
          >
            {trabajando ? "Un momento…" : textoConfirmar}
          </Boton>
        </>
      }
    >
      <div className="text-sm text-[var(--color-text)]">{mensaje}</div>
    </Modal>
  );
}
