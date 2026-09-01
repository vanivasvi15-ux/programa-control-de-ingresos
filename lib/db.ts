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
    -- "origen": si lo cargó el bot de WhatsApp o alguien desde el panel.
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
      origen TEXT NOT NULL DEFAULT 'panel'
        CHECK (origen IN ('whatsapp', 'panel')),
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
  `);

  // Migraciones defensivas para bases que ya existían de una versión
  // anterior (mismo patrón que el POS): cada ALTER TABLE va en su try/catch
  // porque si la columna ya existe SQLite tira "duplicate column" y eso es
  // esperable. Por ahora no hay ninguna — se van sumando acá a medida que
  // el esquema cambie, sin borrar la base.
  const migraciones: string[] = [];
  for (const sql of migraciones) {
    try {
      db.exec(sql);
    } catch {
      // la columna ya existía, no hay nada que hacer
    }
  }

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
