import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Control de Caja — Herrería VyV",
  description: "Control de caja: ingresos, gastos, fijos y alertas de Herrería VyV",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      {/* suppressHydrationWarning: alguna extensión del navegador (antivirus,
          bloqueador de anuncios, etc.) le agrega un atributo tipo
          __processed_<id>__ al <body> antes de que React hidrate. No es un
          bug nuestro — no hay nada dinámico en este layout — así que se
          calla el aviso en vez de perseguir un fantasma. */}
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
