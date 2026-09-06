export type TipoMovimiento = 'Entrada' | 'Salida';

export type EstadoEquipo =
  | 'Bueno'
  | 'Regular'
  | 'Dañado'
  | 'Para Reparación'
  | 'Nuevo'
  | 'En Mantenimiento';

export type UserRole = 'admin' | 'operador' | 'auditor';

export type UnidadMedida = 'cm' | 'm' | 'mm' | 'in' | 'pulg' | 'ft' | 'pie' | string;

export interface Movimiento {
  id: string;
  codigoLote: string; // e.g. "CED-2026-001"
  fecha: string; // ISO string YYYY-MM-DDTHH:mm
  tipoMovimiento: TipoMovimiento;
  tipoEquipo: string; // e.g. "Estructura Metálica", "Viga", "Placa", "Perfil", "Tubo", "Soporte", "Chapa"
  claseEquipo: string; // e.g. "Viga IPE 300", "Viga HEA 200", "Tubo Rectangular 100x50", "Plancha A36", "Angulo 2x2"
  estadoEquipo: EstadoEquipo;
  ancho: number; // Dimensión de ancho según unidad ingresada
  largo: number; // Dimensión de largo según unidad ingresada
  profundidad: number; // Dimensión de profundidad/espesor según unidad ingresada
  unidadMedida?: string; // Unidad de medida (ej. cm, m, mm, in, pulg, ft, etc.)
  cantidad: number; // unidades enteras > 0
  procedenciaDestino: string; // Origen si Entrada, Destino si Salida
  responsable: string; // Nombre del transportista / recepcionista / cliente
  contactoResponsable: string; // Teléfono / Email / Identificación
  observaciones?: string;
  saldoResultante?: number; // Saldo tras este movimiento
  imagenDiagramaUrl?: string; // URL o base64 de imagen generada o diagrama
  creadoPor: {
    // Puede ser null si la cuenta del autor fue eliminada -- nombre/rol quedan
    // sellados como snapshot inmutable del historial, el vínculo en vivo no.
    id: string | null;
    nombre: string;
    rol: UserRole;
  };
  creadoEn: string;
}

export interface ItemInventario {
  id: string; // Composite key hash
  tipoEquipo: string;
  claseEquipo: string;
  estadoEquipo: EstadoEquipo;
  ancho: number;
  largo: number;
  profundidad: number;
  totalEntradas: number;
  totalSalidas: number;
  saldoActual: number;
  volumenUnitarioM3: number; // (ancho * largo * profundidad) / 1,000,000
  volumenTotalM3: number;
  ultimoMovimientoFecha: string;
  ultimoTipoMovimiento: TipoMovimiento;
  umbralMinimo: number; // Umbral configurado o 5 por defecto
  alertaStockBajo: boolean; // True si saldoActual <= umbralMinimo
}

export interface UmbralStockConfig {
  id: string;
  tipoEquipo: string;
  claseEquipo: string;
  umbralMinimo: number;
  actualizadoPor?: string;
  actualizadoEn?: string;
}

export interface AlertaStockEmail {
  id: string;
  fecha: string;
  destinatario: string;
  asunto: string;
  tipoEquipo: string;
  claseEquipo: string;
  saldoActual: number;
  umbralConfigurado: number;
  estado: 'Enviado' | 'Simulado';
  mensajeDetallado: string;
}

export interface UserProfile {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  cargo: string;
  avatarUrl?: string;
}

export interface KpiMetrics {
  totalPiezasDisponibles: number;
  totalEntradasPeriodo: number;
  totalSalidasPeriodo: number;
  volumenTotalAlmacenadoM3: number;
  totalReferenciasDistintas: number;
  itemsStockBajo: number;
  movimientosHoy: number;
  distribucionPorClase: { clase: string; total: number; porcentaje: number }[];
  distribucionPorEstado: { estado: string; total: number; color: string }[];
  flujoMovimientos: {
    fecha: string;
    entradas: number;
    salidas: number;
    saldoNeto: number;
  }[];
}

export interface ParsedVoiceMovement {
  tipoMovimiento: TipoMovimiento;
  tipoEquipo: string;
  claseEquipo: string;
  estadoEquipo: EstadoEquipo;
  ancho: number;
  largo: number;
  profundidad: number;
  cantidad: number;
  procedenciaDestino: string;
  responsable: string;
  contactoResponsable: string;
  observaciones?: string;
  confianza: number; // 0 a 1
  alertasValidacion: string[];
}

export type AspectRatioType = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '9:16' | '16:9' | '21:9';

export type InconsistenciaTipo = 
  | 'saldo_descuadrado'
  | 'volumen_discrepante'
  | 'saldo_negativo_historico'
  | 'registro_huerfano'
  | 'lote_duplicado'
  | 'anomalia_temporal';

export interface InconsistenciaItem {
  id: string;
  tipo: InconsistenciaTipo;
  severidad: 'alta' | 'media' | 'baja';
  itemId?: string;
  claseEquipo: string;
  tipoEquipo: string;
  descripcion: string;
  valorRegistrado: string | number;
  valorCalculado: string | number;
  diferencia: string | number;
  accionRecomendada: string;
  movimientosInvolucrados?: string[];
  detallesTecnicos?: string;
}

export interface ReglaAuditoriaStatus {
  id: string;
  nombre: string;
  descripcion: string;
  aprobada: boolean;
  elementosEvaluados: number;
  inconsistenciasDetectadas: number;
}

export interface IntegrityCheckReport {
  timestamp: string;
  porcentajeSalud: number; // 0 a 100
  estadoGeneral: 'optimo' | 'advertencia' | 'critico';
  totalMovimientosAuditados: number;
  totalReferenciasCruzadas: number;
  totalInconsistencias: number;
  reglasAuditoria: ReglaAuditoriaStatus[];
  detalles: InconsistenciaItem[];
  metricasAuditoria: {
    reglasEvaluadas: number;
    reglasCumplidas: number;
    tiempoEjecucionMs: number;
    verificadoPor: string;
    totalPiezasFisicasVerificadas: number;
    volumenAuditadoM3: number;
  };
  ultimaConciliacion?: {
    fecha: string;
    usuario: string;
    totalCorregidos: number;
  };
}

export interface ReconcileResult {
  success: boolean;
  mensaje: string;
  totalCorregidos: number;
  ajustesAplicados: string[];
  nuevoReporte: IntegrityCheckReport;
  fechaConciliacion: string;
}

