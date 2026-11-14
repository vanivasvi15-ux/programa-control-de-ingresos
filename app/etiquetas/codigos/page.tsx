"use client";
// app/etiquetas/codigos/page.tsx — etiquetas chicas (60 × 40 mm) con el
// código de barras de piezas o productos, para pegar en estantes, cajas y
// piezas del taller. Se abre desde Piezas y Productos.
//   /etiquetas/codigos?tipo=base|producto&ids=1,2,3&copias=2

import { useEffect, useState } from "react";
import CodigoBarras from "@/components/CodigoBarras";
import type { PiezaBase, Producto } from "@/lib/tipos-stock";

type Item = { id: number; nombre: string; codigo: string | null };

export default function EtiquetasCodigosPage() {
  const [tipo, setTipo] = useState<"base" | "producto">("base");
  const [items, setItems] = useState<Item[] | null>(null);
  const [copias, setCopias] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = q.get("tipo") === "producto" ? "producto" : "base";
    const ids = (q.get("ids") ?? "")
      .split(",")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0);
    setTipo(t);
    setCopias(Math.min(50, Math.max(1, Math.floor(Number(q.get("copias"))) || 1)));
    if (ids.length === 0) {
      setError("No se indicó qué etiquetas imprimir.");
      return;
    }
    fetch(t === "base" ? "/api/productos-base" : "/api/productos")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("No se pudieron cargar los datos"))))
      .then((filas: (PiezaBase | Producto)[]) =>
        setItems(
          filas
            .filter((f) => ids.includes(f.id))
            .map((f) => ({ id: f.id, nombre: f.nombre, codigo: f.codigoBarras }))
        )
      )
      .catch((e: Error) => setError(e.message));
  }, []);

  const conCodigo = (items ?? []).filter((i) => i.codigo);
  const hojas = conCodigo.flatMap((i) => Array.from({ length: copias }, (_, n) => ({ ...i, n })));

  return (
    <div className="cod-pantalla">
      <style>{`
        @page { size: 60mm 40mm; margin: 0; }
        .cod-pantalla { background: #e5e5e5; min-height: 100vh; padding: 16px; color: #000; }
        .cod-barra { max-width: 420px; margin: 0 auto 16px; display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; font: 14px system-ui, sans-serif; }
        .cod-barra input { width: 64px; padding: 6px 8px; border: 1px solid #999; border-radius: 6px; font: 14px system-ui, sans-serif; }
        .cod-barra button { background: #111; color: #fff; border: 0; border-radius: 8px; padding: 10px 16px; font: 600 14px system-ui, sans-serif; cursor: pointer; }
        .cod-barra button:disabled { opacity: .4; cursor: default; }
        .cod-etiqueta { width: 60mm; height: 40mm; background: #fff; color: #000; margin: 0 auto 12px; padding: 2.5mm 3mm; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; font-family: Arial, Helvetica, sans-serif; overflow: hidden; border: 1px solid #bbb; }
        .cod-tipo { font-size: 6pt; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
        .cod-nombre { font-size: 9pt; font-weight: 700; line-height: 1.15; max-height: 2.4em; overflow: hidden; word-break: break-word; }
        .cod-svg { text-align: center; line-height: 0; }
        .cod-svg svg { width: 100%; height: 17mm; }
        @media print {
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          .cod-pantalla { background: #fff; padding: 0; min-height: 0; }
          .cod-barra { display: none !important; }
          .cod-etiqueta { margin: 0; border: 0; page-break-after: always; break-after: page; }
          .cod-etiqueta:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>

      <div className="cod-barra">
        <span>
          {items
            ? `${hojas.length} etiqueta${hojas.length === 1 ? "" : "s"} · 60 × 40 mm`
            : error ?? "Cargando…"}
        </span>
        <label>
          Copias de cada una{" "}
          <input
            type="number"
            min={1}
            max={50}
            value={copias}
            onChange={(e) => setCopias(Math.min(50, Math.max(1, Math.floor(Number(e.target.value)) || 1)))}
          />
        </label>
        <button onClick={() => window.print()} disabled={hojas.length === 0}>
          Imprimir
        </button>
      </div>

      {error && <p style={{ textAlign: "center", font: "14px system-ui" }}>{error}</p>}
      {items && items.length > conCodigo.length && (
        <p style={{ textAlign: "center", font: "13px system-ui" }}>
          {items.length - conCodigo.length} sin código quedaron afuera.
        </p>
      )}

      {hojas.map((h) => (
        <div className="cod-etiqueta" key={`${h.id}-${h.n}`}>
          <div>
            <div className="cod-tipo">{tipo === "base" ? "Pieza" : "Producto"}</div>
            <div className="cod-nombre">{h.nombre}</div>
          </div>
          <div className="cod-svg">
            <CodigoBarras valor={h.codigo!} alto={60} ancho={2} tamanoTexto={16} />
          </div>
        </div>
      ))}
    </div>
  );
}
