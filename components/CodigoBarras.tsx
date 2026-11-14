"use client";
// components/CodigoBarras.tsx
//
// Dibuja un código Code128 como SVG (con el texto abajo). Usa colores fijos
// negro sobre blanco a propósito: un código de barras tiene que tener
// contraste alto aunque el panel esté en modo oscuro, y se imprime tal cual.

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export default function CodigoBarras({
  valor,
  alto = 50,
  ancho = 2,
  mostrarTexto = true,
  tamanoTexto = 14,
  className,
}: {
  valor: string;
  alto?: number;
  ancho?: number;
  mostrarTexto?: boolean;
  tamanoTexto?: number;
  className?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !valor) return;
    try {
      JsBarcode(ref.current, valor, {
        format: "CODE128",
        height: alto,
        width: ancho,
        displayValue: mostrarTexto,
        fontSize: tamanoTexto,
        margin: 6,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch {
      // código que Code128 no puede dibujar: se deja vacío en vez de romper
      ref.current.innerHTML = "";
    }
  }, [valor, alto, ancho, mostrarTexto, tamanoTexto]);

  return <svg ref={ref} className={className} role="img" aria-label={`Código de barras ${valor}`} />;
}
