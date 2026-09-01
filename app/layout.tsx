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
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
