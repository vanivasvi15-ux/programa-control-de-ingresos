"use client";
// app/etiquetas/page.tsx — etiquetas de paquete de 10 × 15 cm (el tamaño
// estándar de las impresoras térmicas de envíos). Una etiqueta por bulto.
// Se imprime con el diálogo del navegador: elegir la impresora térmica y
// "Márgenes: ninguno" (el tamaño de hoja ya lo pide la propia página).

import { useEffect, useState } from "react";
import { formatearFecha } from "@/lib/formato";
import { NOMBRE_CANAL, NOMBRE_ENTREGA } from "@/lib/despacho-datos";
import type { Venta } from "@/lib/tipos-stock";

const REMITENTE = "Herrería VyV";

type Etiqueta = { venta: Venta; bulto: number };

export default function EtiquetasPage() {
  const [ventas, setVentas] = useState<Venta[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ids = new URLSearchParams(window.location.search).get("ids");
    if (!ids) {
      setError("No se indicó qué etiquetas imprimir.");
      return;
    }
    fetch(`/api/ventas?ids=${encodeURIComponent(ids)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("No se pudieron cargar las ventas"))))
      .then((vs: Venta[]) => setVentas(vs.filter((v) => v.estado !== "anulado")))
      .catch((e: Error) => setError(e.message));
  }, []);

  const etiquetas: Etiqueta[] = (ventas ?? []).flatMap((v) =>
    Array.from({ length: v.bultos }, (_, i) => ({ venta: v, bulto: i + 1 }))
  );

  return (
    <div className="etiquetas-pantalla">
      <style>{`
        @page { size: 100mm 150mm; margin: 0; }
        .etiquetas-pantalla { background: #e5e5e5; min-height: 100vh; padding: 16px; color: #000; }
        .etiquetas-barra { max-width: 100mm; margin: 0 auto 16px; display: flex; gap: 8px; align-items: center; justify-content: space-between; font: 14px system-ui, sans-serif; }
        .etiquetas-barra button { background: #111; color: #fff; border: 0; border-radius: 8px; padding: 10px 16px; font: 600 14px system-ui, sans-serif; cursor: pointer; }
        .etiqueta { width: 100mm; height: 150mm; background: #fff; color: #000; margin: 0 auto 16px; padding: 5mm; box-sizing: border-box; display: flex; flex-direction: column; gap: 3mm; font-family: Arial, Helvetica, sans-serif; overflow: hidden; border: 1px solid #bbb; }
        .et-cab { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 0.8mm solid #000; padding-bottom: 2mm; }
        .et-marca { font-size: 15pt; font-weight: 800; letter-spacing: 0.3px; }
        .et-sub { font-size: 8.5pt; text-align: right; line-height: 1.25; }
        .et-bulto { font-size: 22pt; font-weight: 800; line-height: 1; text-align: right; }
        .et-rotulo { font-size: 7.5pt; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
        .et-nombre { font-size: 19pt; font-weight: 800; line-height: 1.1; margin: 1mm 0; word-break: break-word; }
        .et-dato { font-size: 12pt; line-height: 1.3; word-break: break-word; }
        .et-caja { border: 0.6mm solid #000; padding: 2mm 3mm; }
        .et-entrega { font-size: 13pt; font-weight: 800; text-transform: uppercase; }
        .et-items { font-size: 10.5pt; line-height: 1.3; }
        .et-nota { font-size: 10pt; font-weight: 700; border: 0.5mm dashed #000; padding: 1.5mm 2.5mm; }
        .et-pie { margin-top: auto; font-size: 8pt; display: flex; justify-content: space-between; border-top: 0.4mm solid #000; padding-top: 1.5mm; }
        @media print {
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          .etiquetas-pantalla { background: #fff; padding: 0; min-height: 0; }
          .etiquetas-barra { display: none !important; }
          .etiqueta { margin: 0; border: 0; page-break-after: always; break-after: page; }
          .etiqueta:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>

      <div className="etiquetas-barra">
        <span>
          {ventas
            ? `${etiquetas.length} etiqueta${etiquetas.length === 1 ? "" : "s"} · 10 × 15 cm`
            : error ?? "Cargando…"}
        </span>
        <button onClick={() => window.print()} disabled={etiquetas.length === 0}>
          Imprimir
        </button>
      </div>

      {error && <p style={{ textAlign: "center", font: "14px system-ui" }}>{error}</p>}

      {etiquetas.map(({ venta: v, bulto }) => (
        <div className="etiqueta" key={`${v.id}-${bulto}`}>
          <div className="et-cab">
            <div>
              <div className="et-marca">{REMITENTE}</div>
              <div style={{ fontSize: "8pt" }}>
                {NOMBRE_CANAL[v.canal]}
                {v.numeroExterno ? ` · #${v.numeroExterno}` : ""}
              </div>
            </div>
            <div>
              {v.bultos > 1 ? (
                <div className="et-bulto">
                  {bulto}/{v.bultos}
                </div>
              ) : (
                <div className="et-sub">Venta #{v.id}</div>
              )}
            </div>
          </div>

          <div>
            <div className="et-rotulo">Destinatario</div>
            <div className="et-nombre">{v.clienteNombre}</div>
            {v.direccion && <div className="et-dato">{v.direccion}</div>}
            {(v.localidad || v.codigoPostal) && (
              <div className="et-dato">
                {[v.localidad, v.codigoPostal ? `CP ${v.codigoPostal}` : null].filter(Boolean).join(" · ")}
              </div>
            )}
            {v.provincia && <div className="et-dato">{v.provincia}</div>}
            {v.clienteTelefono && <div className="et-dato">Tel: {v.clienteTelefono}</div>}
          </div>

          <div className="et-caja">
            <div className="et-entrega">{NOMBRE_ENTREGA[v.entrega]}</div>
            {v.seguimiento && <div style={{ fontSize: "10pt" }}>Seguimiento: {v.seguimiento}</div>}
          </div>

          <div>
            <div className="et-rotulo">Contenido</div>
            <div className="et-items">
              {v.items.map((i) => (
                <div key={i.id}>
                  {i.cantidad} × {i.productoNombre ?? i.titulo}
                </div>
              ))}
            </div>
          </div>

          {v.nota && <div className="et-nota">{v.nota}</div>}

          <div className="et-pie">
            <span>Venta #{v.id}</span>
            <span>{formatearFecha(v.fecha)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
