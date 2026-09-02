// lib/tipos.ts
//
// Formas de los objetos que devuelven las API Routes (ya en camelCase),
// para tiparlas igual en todas las pantallas del panel.

import type {
  TipoMovimiento,
  Recurrencia,
  EstadoMovimiento,
  Frecuencia,
} from "./movimientos-datos";

export type { TipoMovimiento, Recurrencia, EstadoMovimiento, Frecuencia };

export type Categoria = {
  id: number;
  nombre: string;
  tipo: TipoMovimiento;
  activo: boolean;
  creado: string;
};

export type Movimiento = {
  id: number;
  tipo: TipoMovimiento;
  monto: number;
  categoriaId: number;
  categoriaNombre: string | null;
  categoriaActiva: boolean | null;
  fecha: string;
  recurrencia: Recurrencia;
  proximaFecha: string | null;
  frecuencia: Frecuencia | null;
  generadoPorFijoId: number | null;
  origen: "whatsapp" | "panel";
  usuarioId: number | null;
  usuarioNombre: string | null;
  estado: EstadoMovimiento;
  nota: string | null;
  creado: string;
  actualizado: string;
};

export type UsuarioPanel = {
  id: number;
  nombre: string;
  nombreUsuario: string;
  rol: "dueño" | "encargado" | "contador";
  numeroWhatsapp: string | null;
  activo: boolean;
  creado: string;
};

export type FijoProximo = Movimiento & {
  diasRestantes: number | null;
  yaRegistradoEsteMes: boolean;
};

export type Resumen = {
  mes: string;
  mesAnterior: string;
  esMesActual: boolean;
  hoy: string;
  totales: { ingresos: number; gastos: number; balance: number };
  totalesMesAnterior: { ingresos: number; gastos: number; balance: number };
  porCategoria: { categoriaId: number; nombre: string; tipo: TipoMovimiento; total: number }[];
  serie: { mes: string; etiqueta: string; ingresos: number; gastos: number }[];
  proximosFijos: FijoProximo[];
  limites: {
    id: number;
    categoriaId: number;
    categoriaNombre: string;
    limite: number;
    gastado: number;
    porcentaje: number;
  }[];
  ultimos: Movimiento[];
  proyeccion: {
    ingresos: number;
    gastos: number;
    balance: number;
    pendientesIngreso: number;
    pendientesGasto: number;
  };
};

export type AlertaConfig = {
  id: number;
  tipo: "limite_categoria" | "fijo_por_vencer" | "resumen_periodico" | "inactividad";
  parametros: Record<string, unknown>;
  usuarioIdDestino: number | null;
  activo: boolean;
  creado: string;
};
