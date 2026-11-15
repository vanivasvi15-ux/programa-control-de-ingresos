# Cómo trabaja el taller hoy (relevado el 2026-11-15)

Fuente: fotos del cuaderno de pedidos (del 31/10 al 12/11/2026) y la
explicación del dueño. Sirve para diseñar el sistema a partir del trabajo real.
**No se copian acá nombres ni documentos de clientes**, sólo cómo se organiza.

## 1. El recorrido de un pedido, hoy

1. Las **publicaciones** de Mercado Libre existen con fotos, descripción, stock.
2. Se **vende**. Cada día hábil pasa un **camión (colecta)** a una hora fija a
   retirar los paquetes.
3. Hay tres formas de entrega: **colecta** (el camión), **Flex** (se lleva a la
   logística) y **punto de Mercado Libre** (un local que escanea el paquete).
4. **Unas 4 horas antes de la colecta**, la mamá del dueño **anota a mano** todos
   los pedidos del día en el cuaderno.
5. Como casi no hay stock armado, **se trabaja al día**: se fabrica, se pinta, se
   embala y se arma el kit **el mismo día**, y muchas veces **no llega el
   tiempo**.
6. Antes se hacía un promedio general de lo vendido para reponer, pero era
   impreciso: a veces se producía menos de lo que se vendía o no se producía lo
   que hacía falta, y **nadie sabe la cantidad exacta que hay de cada cosa**.

## 2. Cómo es una línea del cuaderno

Cada línea es **un paquete** (si alguien compra 5, se anotan 5 líneas). Dice, en
este orden: tipo de producto y largo de guía · nombre y DNI del cliente · monto
cobrado · código de modelo (K1,40 / K2,20 / KIP / PL1,10 …).

Marcas con resaltador (**a confirmar con el dueño qué significa cada color**):
- **Verde**: la variante (Giratoria, Plegado, Doble, Reforzado, Riel liviano,
  Rueda libre, "+ Manija SC"…) y **Flex** (el envío).
- **Azul**: toda la línea (¿listo/despachado? ¿qué cuenta de ML?).
- **Tachado**: pedido cancelado.

Cantidad: entre unas 10 y 40 líneas por día (a ojo), con picos. Lo más repetido:
guías simples de 1,40 a 2,40 m, plegados, giratorias y rieles livianos.

Familias que aparecen: guías por largo (K1,20 … K3 Plus) · plegado (KIP) ·
doble · reforzado · riel liviano · giratoria (PL0,90 … PL1,60) · sin riel
(sólo herrajes) · grampas · manijas (M1/M3, chicas y grandes) · kits de
pérgola · bases 3×3 · codos y soportes 4×4.

## 3. Cómo se arma un kit de puerta granero

Un kit lleva (según el dueño):
- **1 riel** del largo del modelo. Cada riel tiene una **cantidad de agujeros
  definida**.
- **2 grampas J** (cada una: rueda + pieza de hierro).
- **1 bolsita de separadores de pared** (tubitos): la cantidad depende de los
  agujeros del riel.
- **2 topes de fin de riel** y **1 tope de piso**.
- **Tornillos tirafondo**: uno por agujero. **Tarugos**: la misma cantidad.
- **4 tornillos con tuerca** para las grampas J.
- **2 tornillos con tarugo** para el tope de piso.
- **Arandelas**: la misma cantidad que los separadores.

Todo se envuelve junto (film) y eso es el **kit = paquete final**, que se guarda
hasta que se vende.

Después de fabricarse, las piezas **se pintan** y pasan a **Embalaje** (algunas
se envolvían en film y otras no; la idea nueva es **embalar todo** y pegarle
código de barras).

## 4. Qué se quiere lograr

- **Saber apenas entra la venta** (sin esperar a que la anoten) para planificar.
- **Ahorrar el tiempo de anotar** pedidos y datos a mano.
- **Stock exacto** de cada pieza e insumo, y cómo sube/baja cada día.
- **Producir lo que hace falta**, no un promedio: cantidad y tipo exactos.
- Tener **kits armados de antemano** (stock de paquetes) para que a la hora de
  la colecta sólo haya que pegar la etiqueta.

## 5. Códigos de barras: dónde van

- **Piezas** (riel, grampa, topes…): código en cada pieza terminada y embalada.
- **Cosas imposibles de codificar una por una** (los tubitos separadores: son
  demasiados y están sueltos en una caja): código en **la bolsita** que va en el
  kit.
- **Kit completo (producto final)**: un código en el paquete.

## 6. Qué hay que cambiar o agregar en el sistema (propuesta)

| # | Qué | Por qué | ¿Necesita ML? |
|---|-----|---------|---------------|
| 1 | **«Qué fabricar hoy»**: con las ventas abiertas + el promedio de ventas por modelo, calcula cuántas piezas y kits hay que hacer y qué material falta | reemplaza el "promedio general" | No |
| 2 | **Kit armado con stock propio** (escaneás el código del kit al terminarlo: descuenta piezas y bolsita, suma 1 kit) y **despachar descuenta el kit armado** si hay, y si no, las piezas | hoy el sistema calcula el kit sólo desde sus piezas | No |
| 3 | **Agujeros del riel** como dato; los tornillos, tarugos, separadores y arandelas del kit **se calculan solos** | la receta cambia con cada largo | No |
| 4 | **Bolsita de separadores** como pieza con código (cada bolsa descuenta tubitos, arandelas, etc.) | los tubitos no se escanean uno por uno | No |
| 5 | **Entrega** en la venta: colecta / Flex / punto ML, y filtro en Despacho | hoy sólo se marca Flex en verde | No |
| 6 | **Variante** y **código de modelo** (K1,40, PL1,10…) visibles en la lista | es como lo piensan en el taller | No |
| 7 | **Importar el cuaderno** (31/10–12/11) como ventas históricas para calcular el promedio | datos reales desde el día 1 | No |
| 8 | **Pedidos de Mercado Libre entran solos** y etiqueta oficial | se acaba el cuaderno | Sí |

**Avance (2026-11-15):** hecho el punto 3 con el **Generador de kits**
(`/stock/generador`, `lib/generador-datos.ts` + `lib/generador.ts`): crea
rieles por largo, jotas, topes, tubitos y kits con las cantidades según los
agujeros. La bolsita **no** es una pieza aparte: sus contenidos (tubitos,
arandelas, tirafondos, tarugos) van directo en la composición del kit, porque
una receta de pieza sólo admite materiales y el tubito es una pieza. Faltan
los puntos 1, 2, 4, 5, 6, 7 y 8.

Puntos a decidir con el dueño (ver la conversación del 2026-11-15):
- ¿Se sigue el estado "sin pintar → pintada → embalada" o alcanza con escanear
  al terminar de embalar?
- ¿Qué colores/marcas del cuaderno hay que conservar como datos?
- Catálogo exacto de modelos (códigos K/PL/KIP/M…) y agujeros de cada riel.
