// app/stock/ayuda/page.tsx — guía en palabras simples del Taller: el recorrido
// completo, un ejemplo de punta a punta, glosario y preguntas frecuentes.

import Link from "next/link";
import Encabezado from "@/components/Encabezado";
import Icono from "@/components/Icono";
import { Tarjeta } from "@/components/ui";

const PASOS: { titulo: string; texto: string; href: string; boton: string; icono: React.ComponentProps<typeof Icono>["nombre"] }[] = [
  {
    titulo: "1. Cargá tus materiales",
    texto: "Planchuela, ángulo, ruedas, tornillos… con su stock y su costo. Es lo que se gasta al fabricar.",
    href: "/stock/insumos",
    boton: "Ir a Insumos",
    icono: "caja",
  },
  {
    titulo: "2. Armá las piezas",
    texto: "Carro, riel, tope… Cada una con su receta (qué material lleva y cuánto). Así el sistema sabe lo que cuesta.",
    href: "/stock/piezas",
    boton: "Ir a Piezas",
    icono: "pieza",
  },
  {
    titulo: "3. Armá lo que vendés",
    texto: "Los kits o productos, hechos con piezas. Les ponés el precio y los vinculás con tus avisos.",
    href: "/stock/productos",
    boton: "Ir a Productos",
    icono: "etiqueta",
  },
  {
    titulo: "4. Anotá tus compras",
    texto: "Cuando comprás material, cargás la compra: el stock sube y se actualiza el costo.",
    href: "/stock/compras",
    boton: "Ir a Compras",
    icono: "carrito",
  },
  {
    titulo: "5. Fabricá",
    texto: "Con una orden de producción, o escaneando la etiqueta de cada pieza terminada en Ingreso.",
    href: "/stock/ingreso",
    boton: "Ir a Ingreso",
    icono: "descargar",
  },
  {
    titulo: "6. Vendé y despachá",
    texto: "La lista del día con los datos del cliente. Imprimís la etiqueta del paquete y despachás.",
    href: "/stock/despacho",
    boton: "Ir a Despacho",
    icono: "camion",
  },
];

const GLOSARIO: [string, string][] = [
  ["Insumo", "Material que comprás: planchuela, ángulo, ruedas, tornillos, discos, gas."],
  ["Pieza", "Algo que fabricás en el taller con tus materiales (carro, riel, tope). También se llama «producto base»."],
  ["Receta", "Qué materiales y cuánto lleva una pieza. Con eso se calcula su costo y qué se descuenta al fabricarla."],
  ["Producto / kit", "Lo que vendés. Está hecho de piezas y herrajes (su «composición»). No tiene stock propio: se calcula con el de sus piezas."],
  ["Publicación (aviso)", "Un aviso de Mercado Libre o de la tienda. Varios avisos distintos pueden apuntar al mismo producto."],
  ["Stock", "Cuánto hay ahora de algo. Sube y baja solo con las operaciones (compra, fabricación, venta, recuento)."],
  ["Costo y margen", "Costo = lo que cuesta fabricar lo que lleva. Margen = precio de venta − costo."],
  ["Recuento", "Contar lo que hay de verdad (sobre todo gas, discos…) para que el sistema se acomode a la realidad."],
  ["Bulto", "Cada paquete de una venta. Se imprime una etiqueta por bulto."],
  ["Se deshizo (anulación)", "Marca en el Historial de que se revirtió algo: por ejemplo, tocaste «Deshacer» en un ingreso. Devuelve lo mismo al revés; no es un error."],
  ["Código de barras", "Número de cada pieza o producto (PB00001, PF00001…). Se imprime en etiquetas y se escanea con un lector."],
];

const PREGUNTAS: [string, React.ReactNode][] = [
  [
    "¿Para qué sirve el Historial?",
    "Es el registro de todo lo que subió o bajó, con el motivo y quién lo hizo. No se edita: sirve para entender por qué el stock está como está y para encontrar errores.",
  ],
  [
    "Escaneé una pieza por error, ¿qué hago?",
    "En Ingreso, en «Últimos ingresos», tocá «Deshacer» en esa fila. Se devuelven los materiales y se saca la pieza. En el Historial queda anotado como «Se deshizo».",
  ],
  [
    "¿Por qué un material aparece en negativo?",
    "Porque se fabricaron más piezas de las que el sistema creía que alcanzaban: el stock que figura no coincide con lo que hay de verdad. Se arregla cargando la compra que falta o haciendo un recuento de ese material.",
  ],
  [
    "¿Producción o Ingreso por escaneo?",
    "Las dos sirven para fabricar y las dos descuentan materiales. Usá una sola para cada pieza: si cargás la orden y además escaneás las etiquetas, se cuenta doble.",
  ],
  [
    "¿Dónde veo cuánto gano con cada producto?",
    "En el Resumen, en «Costos y márgenes». Si cambia el precio de un material, se recalcula solo.",
  ],
  [
    "¿Qué hago con una pieza que no tiene receta?",
    "Mientras no tenga receta, el sistema no puede calcular su costo ni descontar materiales. En Piezas, tocá el lápiz y agregá los insumos que lleva.",
  ],
  [
    "¿Tengo que cargar a mano todos los rieles y kits?",
    <>
      No. En <strong>Generador</strong> marcás el tipo de kit (estándar, reforzado, giratorio…) y los largos de riel, y el
      sistema crea el riel, las jotas, los topes, los tubitos y el kit con las cantidades según los agujeros. Lo que ya
      existe no se pisa, así que podés usarlo varias veces.
    </>,
  ],
  [
    "¿Cómo imprimo etiquetas?",
    <>
      Para <strong>paquetes</strong>: en Despacho, el botón de la impresora de cada venta. Para <strong>piezas y
      productos</strong> (con código de barras): en Piezas o Productos, el botón de la impresora de cada fila o
      «Imprimir códigos». En el diálogo de impresión elegí la impresora de etiquetas y márgenes «ninguno».
    </>,
  ],
];

export default function AyudaPage() {
  return (
    <div className="space-y-6">
      <Encabezado titulo="Ayuda" subtitulo="Cómo se usa el Taller, paso a paso y con ejemplos" />

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">El recorrido completo</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {PASOS.map((p) => (
            <Tarjeta key={p.titulo} className="flex flex-col gap-2 p-4">
              <p className="flex items-center gap-2 text-sm font-bold">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                  <Icono nombre={p.icono} size={16} />
                </span>
                {p.titulo}
              </p>
              <p className="flex-1 text-sm text-[var(--color-muted)]">{p.texto}</p>
              <Link href={p.href} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
                {p.boton} →
              </Link>
            </Tarjeta>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Un ejemplo de punta a punta</h2>
        <Tarjeta className="divide-y divide-[var(--color-border)]">
          {[
            ["Comprás material", "5 tiras de planchuela → el stock de planchuela sube 3.000 cm (cada tira son 600 cm).", "Compras"],
            ["Fabricás", "2 rieles → la planchuela baja 400 cm, el ángulo 80 cm, y el stock de rieles sube 2.", "Producción o Ingreso"],
            ["Vendés", "Te compran un kit por Mercado Libre y lo cargás como venta del día.", "Despacho"],
            ["Preparás y despachás", "Imprimís la etiqueta, armás el paquete y tocás «Despachar»: bajan las piezas del kit.", "Despacho"],
            ["Revisás", "Cada movimiento quedó anotado, con quién lo hizo. Y el Resumen te muestra cuánto ganaste.", "Historial y Resumen"],
          ].map(([titulo, texto, donde], i) => (
            <div key={titulo} className="flex gap-3 p-4">
              <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-xs font-bold">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {titulo} <span className="ml-1 text-xs font-normal text-[var(--color-muted)]">· {donde}</span>
                </p>
                <p className="text-sm text-[var(--color-muted)]">{texto}</p>
              </div>
            </div>
          ))}
        </Tarjeta>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Palabras que aparecen</h2>
        <Tarjeta className="divide-y divide-[var(--color-border)]">
          {GLOSARIO.map(([palabra, significado]) => (
            <div key={palabra} className="grid gap-1 p-3 sm:grid-cols-[190px_1fr] sm:gap-4">
              <p className="text-sm font-semibold">{palabra}</p>
              <p className="text-sm text-[var(--color-muted)]">{significado}</p>
            </div>
          ))}
        </Tarjeta>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">Preguntas frecuentes</h2>
        <div className="space-y-2">
          {PREGUNTAS.map(([pregunta, respuesta]) => (
            <details key={pregunta} className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                {pregunta}
                <Icono nombre="chevron-abajo" size={16} className="flex-shrink-0 text-[var(--color-muted)] transition-transform group-open:rotate-180" />
              </summary>
              <p className="border-t border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-muted)]">{respuesta}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
