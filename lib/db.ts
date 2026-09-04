import { DatabaseSync } from "node:sqlite";
import path from "path";

// Conexión única a SQLite (mismo patrón que el POS de Steve's Burger):
// - `node:sqlite` nativo de Node 24, NUNCA better-sqlite3 (necesita
//   compilador C++ que no está en Windows).
// - Singleton vía `global.__db` para sobrevivir al hot-reload de Next.js
//   en desarrollo (si no, cada recarga abre una conexión nueva).
// - Conexión PEREZOSA: no se abre al importar el módulo, sino en la
//   primera consulta real. Así `next build` (que carga los módulos de las
//   rutas para juntar metadata, con varios procesos a la vez) no abre la
//   base ni pelea por el lock ("database is locked").
// - Foreign keys vienen ACTIVADAS por defecto en node:sqlite: cualquier
//   DELETE sobre una fila referenciada por otra tabla falla entero si no
//   se borran antes las filas que la referencian.

const DB_PATH = path.join(process.cwd(), "data.db");

declare global {
  var __db: DatabaseSync | undefined;
}

// ============================================================
// TRANSACCIONES
// ============================================================
// Envuelve varias escrituras en un BEGIN/COMMIT: salen todas o ninguna.
// Guarda contra anidamiento — SQLite tira error con BEGIN dentro de BEGIN,
// así que si ya estamos en una transacción sólo se corre la función (el
// COMMIT/ROLLBACK lo maneja el nivel de más afuera).
let txProfundidad = 0;
function conTransaccion<T>(conn: DatabaseSync, fn: () => T): T {
  if (txProfundidad > 0) return fn();
  txProfundidad++;
  conn.exec("BEGIN");
  try {
    const r = fn();
    conn.exec("COMMIT");
    return r;
  } catch (e) {
    try {
      conn.exec("ROLLBACK");
    } catch {
      // si el ROLLBACK falla igual propagamos el error original
    }
    throw e;
  } finally {
    txProfundidad--;
  }
}

// ============================================================
// MIGRACIONES
// ============================================================
// Cada entrada se corre UNA vez y queda registrada en `migraciones_aplicadas`.
// A diferencia del viejo array de ALTER TABLE con `catch {}` mudo, acá los
// errores se propagan y cortan el arranque con un mensaje claro.
//
// Reglas:
// - Las tablas nuevas NO necesitan migración: van como `CREATE TABLE IF NOT
//   EXISTS` en el esquema y aparecen solas en las bases que ya existían.
// - Sólo necesitan migración los cambios que `IF NOT EXISTS` no cubre:
//   modificar un CHECK, cambiar el tipo de una columna, etc.
// - Cada `ejecutar` debe ser idempotente / auto-chequeante: mira el estado
//   real de la base y no hace nada si el cambio ya está.

type Migracion = {
  id: string;
  descripcion: string;
  ejecutar: (conn: DatabaseSync) => void;
};

const MIGRACIONES: Migracion[] = [
  {
    id: "2026-09-03-01-columnas-legacy-movimientos",
    descripcion:
      "Agrega frecuencia y generado_por_fijo_id a bases anteriores al Paso 2 (antes de reconstruir movimientos)",
    ejecutar(conn) {
      for (const sql of [
        "ALTER TABLE movimientos ADD COLUMN frecuencia TEXT",
        "ALTER TABLE movimientos ADD COLUMN generado_por_fijo_id INTEGER REFERENCES movimientos(id)",
      ]) {
        try {
          conn.exec(sql);
        } catch (e) {
          // "duplicate column name" = la columna ya existía; cualquier otro
          // error sí es un problema real y se propaga.
          if (!String(e).toLowerCase().includes("duplicate column")) throw e;
        }
      }
    },
  },
  {
    id: "2026-09-03-02-origen-amplio",
    descripcion:
      "Amplía movimientos.origen a whatsapp/panel/compra/tienda/mercadolibre/mercadopago",
    ejecutar(conn) {
      const fila = conn
        .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='movimientos'`)
        .get() as { sql: string } | undefined;
      // Ya reconstruida (base nueva con el esquema de abajo) o todavía no
      // existe: nada que hacer.
      if (!fila || fila.sql.includes("'mercadopago'")) return;

      conTransaccion(conn, () => {
        // defer_foreign_keys se puede activar DENTRO de una transacción (a
        // diferencia de PRAGMA foreign_keys) y se apaga solo al COMMIT.
        conn.exec("PRAGMA defer_foreign_keys = ON");
        conn.exec(`
          CREATE TABLE movimientos_nueva (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'gasto')),
            monto INTEGER NOT NULL,
            categoria_id INTEGER NOT NULL REFERENCES categorias(id),
            fecha TEXT NOT NULL,
            recurrencia TEXT NOT NULL DEFAULT 'unico'
              CHECK (recurrencia IN ('unico', 'fijo', 'variable_recurrente')),
            proxima_fecha TEXT,
            frecuencia TEXT,
            generado_por_fijo_id INTEGER REFERENCES movimientos(id),
            origen TEXT NOT NULL DEFAULT 'panel'
              CHECK (origen IN ('whatsapp', 'panel', 'compra', 'tienda', 'mercadolibre', 'mercadopago')),
            usuario_id INTEGER REFERENCES usuarios(id),
            estado TEXT NOT NULL DEFAULT 'activo'
              CHECK (estado IN ('activo', 'pausado', 'anulado')),
            nota TEXT,
            creado TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            actualizado TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
          );
        `);
        conn.exec(`
          INSERT INTO movimientos_nueva
            (id, tipo, monto, categoria_id, fecha, recurrencia, proxima_fecha, frecuencia,
             generado_por_fijo_id, origen, usuario_id, estado, nota, creado, actualizado)
          SELECT
            id, tipo, monto, categoria_id, fecha, recurrencia, proxima_fecha, frecuencia,
            generado_por_fijo_id, origen, usuario_id, estado, nota, creado, actualizado
          FROM movimientos;
        `);
        conn.exec(`DROP TABLE movimientos;`);
        conn.exec(`ALTER TABLE movimientos_nueva RENAME TO movimientos;`);
        conn.exec(`CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos(fecha);`);
        conn.exec(`CREATE INDEX IF NOT EXISTS idx_movimientos_categoria ON movimientos(categoria_id);`);
        conn.exec(`CREATE INDEX IF NOT EXISTS idx_movimientos_usuario ON movimientos(usuario_id);`);
      });
    },
  },
];

function correrMigraciones(conn: DatabaseSync) {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS migraciones_aplicadas (
      id TEXT PRIMARY KEY,
      aplicada TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);
  const aplicadas = new Set(
    (conn.prepare(`SELECT id FROM migraciones_aplicadas`).all() as { id: string }[]).map(
      (r) => r.id
    )
  );
  for (const m of MIGRACIONES) {
    if (aplicadas.has(m.id)) continue;
    try {
      m.ejecutar(conn);
      conn.prepare(`INSERT INTO migraciones_aplicadas (id) VALUES (?)`).run(m.id);
      console.log(`[db] migración aplicada: ${m.id} — ${m.descripcion}`);
    } catch (e) {
      throw new Error(
        `Falló la migración "${m.id}" (${m.descripcion}): ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  }
}

function crearConexion(): DatabaseSync {
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");

  db.exec(`
    -- ============================================================
    -- USUARIOS Y SESIONES
    -- ============================================================
    -- El bot de WhatsApp (fase 3) identifica quién escribe por su
    -- "numero_whatsapp"; el panel identifica por login con usuario y
    -- contraseña. El permiso siempre se resuelve del lado del servidor
    -- según "rol":
    --   dueño     -> ve y edita todo
    --   encargado -> sólo carga movimientos y ve los que él mismo cargó
    --   contador  -> sólo lectura (rol pensado para el futuro)
    -- "nombre" es el nombre para mostrar; "nombre_usuario" es el que se
    -- tipea en /login. La contraseña se guarda hasheada con scrypt
    -- (ver lib/auth.ts), nunca en texto plano.
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      nombre_usuario TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'encargado'
        CHECK (rol IN ('dueño', 'encargado', 'contador')),
      numero_whatsapp TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      creado TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS sesiones (
      token TEXT PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
      creado TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      expira TEXT NOT NULL
    );

    -- ============================================================
    -- CATEGORÍAS
    -- ============================================================
    -- Editable desde el panel, nunca hardcodeada. Cada categoría es de
    -- ingreso o de gasto; un movimiento siempre apunta a una categoría de
    -- su mismo "tipo". "activo" en 0 = no se ofrece al cargar movimientos
    -- nuevos, pero los movimientos viejos que la usaban siguen intactos.
    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'gasto')),
      activo INTEGER NOT NULL DEFAULT 1,
      creado TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE (nombre, tipo)
    );

    -- ============================================================
    -- MOVIMIENTOS (el corazón del control de caja)
    -- ============================================================
    -- "monto": entero en pesos, sin centavos (mismo criterio que los
    --   precios del POS).
    -- "recurrencia":
    --   unico               -> pasó una sola vez
    --   fijo                -> se repite por el mismo monto (ej. alquiler)
    --   variable_recurrente -> se repite pero el monto cambia (ej. luz)
    -- "proxima_fecha": sólo tiene sentido si recurrencia != 'unico';
    --   es la fecha en que toca volver a registrarlo / cobrarlo.
    -- "frecuencia": cada cuánto se repite un fijo / variable recurrente
    --   (mensual, quincenal, semanal, bimestral, trimestral, semestral,
    --   anual). NULL para los movimientos únicos. Al "registrar" un fijo
    --   desde /dinero/fijos se crea un movimiento único con su fecha y se
    --   corre proxima_fecha hacia adelante según esta frecuencia.
    -- "generado_por_fijo_id": si este movimiento nació de "registrar" un
    --   fijo, apunta al id de ese fijo (para saber que el mes ya está
    --   cubierto y para poder auditarlo).
    -- "origen": de dónde salió el movimiento. Fase 1: 'whatsapp' o 'panel'.
    --   Fase 2 suma 'compra' (compra de insumo), 'tienda', 'mercadolibre'
    --   y 'mercadopago'. Ver la migración 2026-09-03-02 para las bases
    --   creadas antes.
    -- "estado":
    --   activo   -> cuenta para los totales
    --   pausado  -> un fijo que se dejó de pagar por un tiempo (no cuenta)
    --   anulado  -> se dio de baja (no cuenta, pero queda el registro)
    -- Las fechas van como texto 'YYYY-MM-DD' para poder compararlas y
    -- ordenarlas directo en SQL.
    CREATE TABLE IF NOT EXISTS movimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'gasto')),
      monto INTEGER NOT NULL,
      categoria_id INTEGER NOT NULL REFERENCES categorias(id),
      fecha TEXT NOT NULL,
      recurrencia TEXT NOT NULL DEFAULT 'unico'
        CHECK (recurrencia IN ('unico', 'fijo', 'variable_recurrente')),
      proxima_fecha TEXT,
      frecuencia TEXT,
      generado_por_fijo_id INTEGER REFERENCES movimientos(id),
      origen TEXT NOT NULL DEFAULT 'panel'
        CHECK (origen IN ('whatsapp', 'panel', 'compra', 'tienda', 'mercadolibre', 'mercadopago')),
      usuario_id INTEGER REFERENCES usuarios(id),
      estado TEXT NOT NULL DEFAULT 'activo'
        CHECK (estado IN ('activo', 'pausado', 'anulado')),
      nota TEXT,
      creado TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      actualizado TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos(fecha);
    CREATE INDEX IF NOT EXISTS idx_movimientos_categoria ON movimientos(categoria_id);
    CREATE INDEX IF NOT EXISTS idx_movimientos_usuario ON movimientos(usuario_id);

    -- ============================================================
    -- CONFIGURACIÓN DE ALERTAS AUTOMÁTICAS
    -- ============================================================
    -- La tabla se crea ahora; su API y la tarea programada que la lee
    -- llegan en un paso posterior. Cada fila es una alerta configurada:
    --   limite_categoria  -> avisar si el gasto de una categoría supera X
    --   fijo_por_vencer   -> avisar N días antes de la proxima_fecha de un fijo
    --   resumen_periodico -> mandar un resumen semanal o mensual
    --   inactividad       -> avisar si no se cargó ningún movimiento en N días
    -- "parametros_json": los detalles puntuales de cada tipo (el monto
    --   límite, los días de aviso, si es semanal o mensual, etc.) como
    --   texto JSON, para no atarse a columnas fijas.
    -- "usuario_id_destino": a quién le llega el aviso por WhatsApp.
    CREATE TABLE IF NOT EXISTS alertas_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL CHECK (tipo IN (
        'limite_categoria', 'fijo_por_vencer', 'resumen_periodico', 'inactividad'
      )),
      parametros_json TEXT NOT NULL DEFAULT '{}',
      usuario_id_destino INTEGER REFERENCES usuarios(id),
      activo INTEGER NOT NULL DEFAULT 1,
      creado TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- ============================================================
    -- PUENTE CON EL BOT DE WHATSAPP (carpeta aparte "bot-whatsapp",
    -- proceso Node propio con Baileys + IA). Clonado del POS de Steve's
    -- Burger: el bot le reporta TODO a estas tablas por HTTP
    -- (/api/bot-whatsapp/*), nunca se conecta directo desde el panel.
    -- ============================================================
    -- Una fila por conversación (por jid de WhatsApp). "estado":
    --   activa      -> la IA la está llevando
    --   escalada    -> la IA no entendió algo (monto/categoría), necesita
    --                  que una persona responda desde el panel
    --   finalizada  -> ya se registró el movimiento / se cerró a mano
    -- "movimiento_id": el movimiento que generó esta conversación, si llegó
    -- a registrarse.
    CREATE TABLE IF NOT EXISTS bot_conversaciones (
      jid TEXT PRIMARY KEY,
      cliente TEXT,
      estado TEXT NOT NULL DEFAULT 'activa'
        CHECK (estado IN ('activa', 'escalada', 'finalizada')),
      motivo_escalado TEXT,
      movimiento_id INTEGER REFERENCES movimientos(id),
      creado TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      actualizado TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS bot_mensajes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jid TEXT NOT NULL,
      rol TEXT NOT NULL CHECK (rol IN ('cliente', 'bot', 'empleado')),
      texto TEXT NOT NULL,
      creado TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_bot_mensajes_jid ON bot_mensajes(jid);

    -- Fila única (id = 1). "pausado" frena SÓLO la IA (el bot sigue
    -- conectado y logueando). "conectar" en 0 = el panel pidió apagar la
    -- conexión entera (sigue vinculado al número, no hay que re-escanear).
    -- "cambiar_numero_solicitado" en 1 = el panel pidió logout de verdad
    -- para vincular otro número (el bot lo hace y lo vuelve a 0).
    -- "conectado" y "qr" los reporta el bot.
    CREATE TABLE IF NOT EXISTS bot_whatsapp_estado (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      pausado INTEGER NOT NULL DEFAULT 0,
      conectado INTEGER NOT NULL DEFAULT 0,
      qr TEXT,
      conectar INTEGER NOT NULL DEFAULT 1,
      cambiar_numero_solicitado INTEGER NOT NULL DEFAULT 0
    );

    -- Cola de mensajes que el sistema principal / el cron de alertas le
    -- piden al bot que mande. El bot la revisa cada 8 segundos.
    -- "tipo":
    --   mensaje -> texto automático del sistema (rol "bot")
    --   manual  -> respuesta escrita a mano desde el panel (rol "empleado";
    --              además bloquea la IA de esa conversación)
    --   control -> "reactivar" | "bloquear": no manda nada, el bot sólo
    --              cambia el estado en memoria de esa conversación
    --   aviso   -> alerta automática del cron (límite, fijo por vencer,
    --              resumen, inactividad) — rol "bot"
    -- "intentos": tope MAX_INTENTOS en GET /api/bot-whatsapp/comandos para
    -- que un comando que no se logra marcar "enviado" no se reintente
    -- para siempre.
    CREATE TABLE IF NOT EXISTS bot_comandos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telefono TEXT NOT NULL,
      mensaje TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'mensaje'
        CHECK (tipo IN ('mensaje', 'manual', 'control', 'aviso')),
      estado TEXT NOT NULL DEFAULT 'pendiente',
      error TEXT,
      intentos INTEGER NOT NULL DEFAULT 0,
      creado TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      enviado TEXT
    );

    -- Mensajes fijos para responder a mano desde el panel sin escribir
    -- texto libre (se sacó esa opción en el POS después de un bug real de
    -- reenvío en loop). "etiqueta" = lo que se ve en el botón.
    CREATE TABLE IF NOT EXISTS bot_respuestas_predeterminadas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      etiqueta TEXT NOT NULL,
      texto TEXT NOT NULL,
      orden INTEGER NOT NULL DEFAULT 0
    );

    -- Anti-duplicado del cron de alertas: una fila por (clave de alerta,
    -- día). El cron chequea acá antes de encolar para no mandar el mismo
    -- aviso dos veces el mismo día si corre más de una vez.
    CREATE TABLE IF NOT EXISTS bot_avisos_log (
      clave TEXT NOT NULL,
      fecha TEXT NOT NULL,
      creado TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      PRIMARY KEY (clave, fecha)
    );

    -- ============================================================
    -- FASE 2 — STOCK Y PRODUCCIÓN
    -- ============================================================
    -- Detalle en docs/FASE-2-PASO-1.md. Todas son tablas nuevas: aparecen
    -- solas en las bases que ya existían gracias a IF NOT EXISTS, sin
    -- necesidad de migración.

    -- Configuración chica clave/valor (evita hardcodear). Primer uso:
    -- 'tarifa_mano_obra_minuto' (pesos por minuto para el costeo de piezas;
    -- arranca en '0' = la mano de obra no suma al costo).
    CREATE TABLE IF NOT EXISTS config (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );

    -- Todo lo que tiene stock y no se vende armado: materia prima
    -- (planchuela, ángulo, ruedas), herrajes (tirafondos, tuercas…) y
    -- consumibles (gas, discos — estos NO van en las recetas, se controlan
    -- por recuento periódico).
    -- "unidad_compra"  -> cómo viene del proveedor (ej. 'tira', 'unidad', 'kg')
    -- "unidad_consumo" -> cómo lo pide la receta (ej. 'cm', 'unidad')
    -- "factor_compra"  -> cuántas unidades de consumo entran en 1 de compra
    --                     (tira de 6 m consumida en cm -> 600)
    -- "stock"          -> en unidad de consumo (REAL: el metal se fracciona)
    -- "costo_unitario" -> pesos por 1 unidad de COMPRA, último precio pagado
    CREATE TABLE IF NOT EXISTS insumos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('materia_prima', 'herraje', 'consumible')),
      unidad_compra TEXT NOT NULL DEFAULT 'unidad',
      unidad_consumo TEXT NOT NULL DEFAULT 'unidad',
      factor_compra REAL NOT NULL DEFAULT 1 CHECK (factor_compra > 0),
      stock REAL NOT NULL DEFAULT 0,
      alerta_minimo REAL,
      costo_unitario INTEGER NOT NULL DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1,
      nota TEXT,
      creado TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      actualizado TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- Piezas que fabrica la herrería (carro, riel 200 con bisagra, topes…).
    -- Tienen su propio stock (las ya hechas). Todas se pueden vender: para
    -- venderla suelta se crea un "producto" que la envuelve.
    -- "mano_obra_minutos" -> minutos que lleva fabricar una (para el costo;
    --   sólo suma si config.tarifa_mano_obra_minuto > 0).
    -- "costo_calculado" -> pesos, lo recalcula el sistema desde la receta.
    CREATE TABLE IF NOT EXISTS productos_base (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      stock INTEGER NOT NULL DEFAULT 0,
      mano_obra_minutos INTEGER NOT NULL DEFAULT 0,
      costo_calculado INTEGER,
      costo_actualizado TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      nota TEXT,
      creado TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      actualizado TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- Lo que se vende: el "modelo interno" de cada cosa (un kit, o un
    -- repuesto). Uno por cada receta distinta. Las publicaciones de
    -- Mercado Libre / tienda cuelgan de acá (tabla publicaciones): varios
    -- avisos con nombres distintos pueden apuntar al mismo producto.
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      sku TEXT UNIQUE,
      precio INTEGER NOT NULL DEFAULT 0,
      costo_calculado INTEGER,
      costo_actualizado TEXT,
      imagen TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      nota TEXT,
      creado TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      actualizado TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- Cada aviso concreto (Mercado Libre o tienda propia). Muchos por
    -- producto. "titulo" es el nombre tal cual figura en ese aviso;
    -- "ml_item_id" se completa con la integración de ML (Paso 4).
    CREATE TABLE IF NOT EXISTS publicaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      canal TEXT NOT NULL DEFAULT 'mercadolibre'
        CHECK (canal IN ('mercadolibre', 'tienda', 'otro')),
      ml_item_id TEXT,
      cuenta TEXT,
      titulo TEXT,
      url TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      creado TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE (canal, ml_item_id)
    );
    CREATE INDEX IF NOT EXISTS idx_publicaciones_producto ON publicaciones(producto_id);
    CREATE INDEX IF NOT EXISTS idx_publicaciones_ml ON publicaciones(ml_item_id);

    -- Con qué se fabrica cada pieza base. Sólo materia prima y herrajes
    -- (los consumibles no entran acá). "bloqueante" = frena el armado si
    -- falta (1 por defecto para materia prima/herrajes).
    CREATE TABLE IF NOT EXISTS receta_base (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_base_id INTEGER NOT NULL REFERENCES productos_base(id),
      insumo_id INTEGER NOT NULL REFERENCES insumos(id),
      cantidad REAL NOT NULL CHECK (cantidad > 0),
      bloqueante INTEGER NOT NULL DEFAULT 1,
      creado TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE (producto_base_id, insumo_id)
    );

    -- De qué se compone un producto: piezas base y/o insumos sueltos
    -- (herrajes que van directo al kit). "item_id" apunta a productos_base
    -- o a insumos según "item_tipo" (columna polimórfica, sin FK: se valida
    -- en la API).
    CREATE TABLE IF NOT EXISTS composicion_producto (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      item_tipo TEXT NOT NULL CHECK (item_tipo IN ('base', 'insumo')),
      item_id INTEGER NOT NULL,
      cantidad REAL NOT NULL CHECK (cantidad > 0),
      creado TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE (producto_id, item_tipo, item_id)
    );

    -- "Fabricar N piezas". Mientras está 'planificada' no toca el stock.
    -- Al pasar a 'realizada' (PUT) el sistema, en una transacción,
    -- descuenta los insumos de la receta × cantidad, suma N al stock de la
    -- pieza y anota todo en movimientos_stock (o falla diciendo qué falta).
    CREATE TABLE IF NOT EXISTS ordenes_produccion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_base_id INTEGER NOT NULL REFERENCES productos_base(id),
      cantidad INTEGER NOT NULL CHECK (cantidad > 0),
      estado TEXT NOT NULL DEFAULT 'planificada'
        CHECK (estado IN ('planificada', 'realizada', 'anulada')),
      fecha TEXT NOT NULL,
      costo_total INTEGER,
      usuario_id INTEGER REFERENCES usuarios(id),
      nota TEXT,
      creado TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      actualizado TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- El historial de stock: una fila por cada cambio, nunca se pisa el
    -- número a lo bruto. "item_tipo" = 'insumo' | 'base'. "delta" con signo.
    -- "stock_resultante" = cómo quedó (comodidad para auditar).
    -- "costo_unitario_momento" = costo del insumo cuando pasó (para costear
    -- con el precio de ese momento).
    CREATE TABLE IF NOT EXISTS movimientos_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_tipo TEXT NOT NULL CHECK (item_tipo IN ('insumo', 'base')),
      item_id INTEGER NOT NULL,
      delta REAL NOT NULL,
      stock_resultante REAL NOT NULL,
      motivo TEXT NOT NULL CHECK (motivo IN (
        'compra', 'produccion_consumo', 'produccion_alta', 'venta', 'ajuste', 'recuento', 'anulacion'
      )),
      referencia_tipo TEXT,
      referencia_id INTEGER,
      costo_unitario_momento INTEGER,
      usuario_id INTEGER REFERENCES usuarios(id),
      nota TEXT,
      creado TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_movstock_item ON movimientos_stock(item_tipo, item_id);
    CREATE INDEX IF NOT EXISTS idx_movstock_creado ON movimientos_stock(creado);

    -- Cargar una compra de material: sube el stock del insumo. Si
    -- "actualiza_costo" = 1, deja este precio como costo_unitario del
    -- insumo (último precio). "movimiento_id" -> el gasto en el Control de
    -- Caja (se completa en el Paso 2).
    CREATE TABLE IF NOT EXISTS compras_insumo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      insumo_id INTEGER NOT NULL REFERENCES insumos(id),
      cantidad_compra REAL NOT NULL CHECK (cantidad_compra > 0),
      costo_unitario INTEGER NOT NULL,
      costo_total INTEGER NOT NULL,
      actualiza_costo INTEGER NOT NULL DEFAULT 1,
      movimiento_id INTEGER REFERENCES movimientos(id),
      proveedor TEXT,
      fecha TEXT NOT NULL,
      usuario_id INTEGER REFERENCES usuarios(id),
      nota TEXT,
      creado TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- Listas de "cosas difíciles de medir" que el sistema recuerda revisar
    -- cada N días. El aviso y la pantalla de carga van en el Paso 2; al
    -- responder, cada número nuevo genera un movimientos_stock motivo
    -- 'recuento'.
    CREATE TABLE IF NOT EXISTS recuento_listas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      dias_cada INTEGER NOT NULL DEFAULT 3 CHECK (dias_cada > 0),
      ultima_revision TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      creado TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS recuento_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lista_id INTEGER NOT NULL REFERENCES recuento_listas(id),
      insumo_id INTEGER NOT NULL REFERENCES insumos(id),
      UNIQUE (lista_id, insumo_id)
    );
  `);

  // Semilla única de bot_respuestas_predeterminadas (sólo si está vacía).
  try {
    const yaHay = db.prepare(`SELECT 1 FROM bot_respuestas_predeterminadas LIMIT 1`).get();
    if (!yaHay) {
      const ins = db.prepare(
        `INSERT INTO bot_respuestas_predeterminadas (etiqueta, texto, orden) VALUES (?, ?, ?)`
      );
      const iniciales: [string, string][] = [
        [
          "No entendí el monto",
          "Perdón, no me quedó claro el monto 🤔. ¿Me lo repetís en números? Ej: \"gasté 15000 en nafta\".",
        ],
        [
          "No entendí la categoría",
          "¿En qué categoría lo anoto? Decime una (ej: nafta, hierro, sueldos, ventas…).",
        ],
        ["Anotado", "¡Listo, lo anoté! 📝"],
        [
          "Número no habilitado",
          "Este número todavía no está habilitado para cargar movimientos. Pedile al dueño que lo dé de alta en el panel.",
        ],
      ];
      iniciales.forEach(([e, t], i) => ins.run(e, t, i));
    }
  } catch {
    // si falla la semilla no es crítico
  }

  // Semilla de config (sólo las claves que falten).
  try {
    db.prepare(`INSERT OR IGNORE INTO config (clave, valor) VALUES ('tarifa_mano_obra_minuto', '0')`).run();
  } catch {
    // idem
  }

  // Migraciones defensivas para bases que ya existían de una versión
  // anterior. Ver el bloque MIGRACIONES arriba: cada una se corre una vez,
  // queda registrada, y los errores cortan el arranque (no más catch mudo).
  correrMigraciones(db);

  return db;
}

function obtenerDb(): DatabaseSync {
  if (!global.__db) {
    global.__db = crearConexion();
  }
  return global.__db;
}

// Se mantiene la ergonomía de `import { db }` y `db.prepare(...)` del POS,
// pero detrás hay un Proxy: la conexión real recién se abre cuando se
// toca la primera propiedad (una consulta), no al importar el módulo.
export const db: DatabaseSync = new Proxy({} as DatabaseSync, {
  get(_target, prop, receiver) {
    const real = obtenerDb();
    const valor = Reflect.get(real, prop, receiver);
    return typeof valor === "function" ? valor.bind(real) : valor;
  },
});

// Envuelve `fn` en una transacción (BEGIN/COMMIT, ROLLBACK si tira error).
// Anidada = no-op sobre la de afuera (evita el "cannot start a transaction
// within a transaction" de SQLite). Usar para toda operación que hace
// varias escrituras que deben salir todas o ninguna (órdenes de
// producción, compras, registrar un fijo, etc.).
export function transaccion<T>(fn: () => T): T {
  return conTransaccion(obtenerDb(), fn);
}
