import { Movimiento, ItemInventario } from '../types';

/**
 * Exporta el historial de movimientos en formato Excel (.xlsx) o CSV (.csv)
 * garantizando compatibilidad 100% con la plantilla original del negocio Sedimec.
 */
/** Lógica pura de armado de filas -- separada para poder probarla sin DOM. */
export function buildMovimientosRows(movimientos: Movimiento[]) {
  return movimientos.map((m) => ({
    'Fecha': new Date(m.fecha).toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
    'Tipo de Movimiento': m.tipoMovimiento,
    'Tipo de Equipo': m.tipoEquipo,
    'Clase de Equipo': m.claseEquipo,
    'Estado del Equipo': m.estadoEquipo,
    'Ancho (cm)': m.ancho,
    'Largo (cm)': m.largo,
    'Profundidad (cm)': m.profundidad,
    'Cantidad': m.cantidad,
    'Procedencia / Destino': m.procedenciaDestino,
    'Responsable': m.responsable,
    'Contacto del Responsable': m.contactoResponsable,
    'Observaciones': m.observaciones || '',
    'Código Lote / SKU': m.codigoLote,
    'Saldo Resultante': m.saldoResultante !== undefined ? m.saldoResultante : '',
    'Registrado Por': m.creadoPor?.nombre || '',
  }));
}

export async function exportarMovimientosExcel(
  movimientos: Movimiento[],
  formato: 'xlsx' | 'csv' = 'xlsx',
  nombreArchivo: string = 'Sedimec_Movimientos'
) {
  const XLSX = await import('xlsx');
  const rows = buildMovimientosRows(movimientos);
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Auto-ajuste de anchos de columna
  const colWidths = [
    { wch: 18 }, // Fecha
    { wch: 18 }, // Tipo de Movimiento
    { wch: 20 }, // Tipo de Equipo
    { wch: 22 }, // Clase de Equipo
    { wch: 18 }, // Estado del Equipo
    { wch: 12 }, // Ancho
    { wch: 12 }, // Largo
    { wch: 16 }, // Profundidad
    { wch: 10 }, // Cantidad
    { wch: 28 }, // Procedencia / Destino
    { wch: 22 }, // Responsable
    { wch: 24 }, // Contacto
    { wch: 30 }, // Observaciones
    { wch: 18 }, // Codigo Lote
    { wch: 16 }, // Saldo Resultante
    { wch: 18 }, // Registrado Por
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Movimientos Sedimec');

  const fechaStr = new Date().toISOString().slice(0, 10);
  const fileName = `${nombreArchivo}_${fechaStr}.${formato}`;

  if (formato === 'csv') {
    const csvData = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    descargarBlob(blob, fileName);
  } else {
    XLSX.writeFile(workbook, fileName);
  }
}

/**
 * Exporta el inventario consolidado actual (Saldo = Entradas - Salidas)
 */
/** Lógica pura de armado de filas -- separada para poder probarla sin DOM. */
export function buildInventarioRows(items: ItemInventario[]) {
  return items.map((item, index) => ({
    'N°': index + 1,
    'Tipo de Equipo': item.tipoEquipo,
    'Clase de Equipo': item.claseEquipo,
    'Estado': item.estadoEquipo,
    'Ancho (cm)': item.ancho,
    'Largo (cm)': item.largo,
    'Profundidad (cm)': item.profundidad,
    'Total Entradas Históricas': item.totalEntradas,
    'Total Salidas Históricas': item.totalSalidas,
    'Saldo Actual (Existencias)': item.saldoActual,
    'Volumen Unitario (m³)': Number(item.volumenUnitarioM3.toFixed(4)),
    'Volumen Total Almacenado (m³)': Number(item.volumenTotalM3.toFixed(3)),
    'Umbral Mínimo Configurado': item.umbralMinimo,
    'Alerta Stock Bajo': item.alertaStockBajo ? 'SÍ (Bajo Stock)' : 'NORMAL',
    'Último Movimiento': item.ultimoMovimientoFecha
      ? new Date(item.ultimoMovimientoFecha).toLocaleDateString('es-CO')
      : '-',
  }));
}

export async function exportarInventarioConsolidadoExcel(
  items: ItemInventario[],
  formato: 'xlsx' | 'csv' = 'xlsx'
) {
  const XLSX = await import('xlsx');
  const rows = buildInventarioRows(items);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventario Existencias');

  const fechaStr = new Date().toISOString().slice(0, 10);
  const fileName = `Sedimec_Inventario_Consolidado_${fechaStr}.${formato}`;

  if (formato === 'csv') {
    const csvData = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    descargarBlob(blob, fileName);
  } else {
    XLSX.writeFile(workbook, fileName);
  }
}

function descargarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
