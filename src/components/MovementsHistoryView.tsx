import React, { useState, useMemo } from 'react';
import { 
  History, 
  Search, 
  ArrowDownLeft, 
  ArrowUpRight, 
  FileSpreadsheet, 
  Eye, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  RotateCcw
} from 'lucide-react';
import { Movimiento, TipoMovimiento } from '../types';
import { exportarMovimientosExcel } from '../utils/excel';

interface MovementsHistoryViewProps {
  movements: Movimiento[];
  onSelectMovement: (mov: Movimiento) => void;
  onDeleteMovement: (id: string) => void;
  onOpenNewMovement: (tipo?: TipoMovimiento) => void;
  currentUserRol: string;
}

export const MovementsHistoryView: React.FC<MovementsHistoryViewProps> = ({
  movements,
  onSelectMovement,
  onDeleteMovement,
  onOpenNewMovement,
  currentUserRol,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTipo, setSelectedTipo] = useState<'todos' | 'Entrada' | 'Salida'>('todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [selectedResponsable, setSelectedResponsable] = useState('todos');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filtered movements
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const q = searchTerm.trim().toLowerCase();
      const matchSearch =
        !q ||
        m.claseEquipo.toLowerCase().includes(q) ||
        m.tipoEquipo.toLowerCase().includes(q) ||
        m.codigoLote.toLowerCase().includes(q) ||
        m.procedenciaDestino.toLowerCase().includes(q) ||
        m.responsable.toLowerCase().includes(q) ||
        (m.observaciones && m.observaciones.toLowerCase().includes(q));

      const matchTipo = selectedTipo === 'todos' || m.tipoMovimiento === selectedTipo;
      const matchResp = selectedResponsable === 'todos' || m.responsable === selectedResponsable;

      let matchDesde = true;
      if (fechaDesde) {
        matchDesde = new Date(m.fecha).getTime() >= new Date(fechaDesde).getTime();
      }

      let matchHasta = true;
      if (fechaHasta) {
        matchHasta = new Date(m.fecha).getTime() <= new Date(fechaHasta).getTime() + 86400000;
      }

      return matchSearch && matchTipo && matchResp && matchDesde && matchHasta;
    });
  }, [movements, searchTerm, selectedTipo, selectedResponsable, fechaDesde, fechaHasta]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredMovements.length / itemsPerPage));
  const paginatedMovements = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredMovements.slice(start, start + itemsPerPage);
  }, [filteredMovements, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 pb-8">
      {/* ── HEADER & ACCIONES DE AUDITORÍA ── */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-100 text-slate-800 rounded-xl shrink-0">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Libro de Movimientos y Trazabilidad
              </h1>
              <p className="text-xs text-slate-500">
                Registro cronológico inmutable de recepciones y despachos con comprobantes de entrega.
              </p>
            </div>
          </div>
        </div>

        {/* Botones de Exportación */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => exportarMovimientosExcel(filteredMovements, 'xlsx', 'Sedimec_Movimientos')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            <span>Descargar Excel</span>
          </button>
          <button
            onClick={() => exportarMovimientosExcel(filteredMovements, 'csv', 'Sedimec_Movimientos')}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            CSV
          </button>
        </div>
      </div>

      {/* ── PANEL DE BÚSQUEDA Y FILTROS ── */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar lote, pieza, responsable..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-amber-500 focus:bg-white transition-colors"
            />
          </div>

          {/* Tipo */}
          <div>
            <select
              value={selectedTipo}
              onChange={(e) => {
                setSelectedTipo(e.target.value as 'todos' | 'Entrada' | 'Salida');
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-amber-500 focus:bg-white transition-colors cursor-pointer"
            >
              <option value="todos">Todos los Movimientos</option>
              <option value="Entrada">Solo Recepciones (+)</option>
              <option value="Salida">Solo Despachos (-)</option>
            </select>
          </div>

          {/* Fecha Desde */}
          <div>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => {
                setFechaDesde(e.target.value);
                setCurrentPage(1);
              }}
              title="Fecha inicial"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:border-amber-500 focus:bg-white transition-colors"
            />
          </div>

          {/* Fecha Hasta */}
          <div>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => {
                setFechaHasta(e.target.value);
                setCurrentPage(1);
              }}
              title="Fecha final"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:border-amber-500 focus:bg-white transition-colors"
            />
          </div>
        </div>

        {/* Resumen de filtros */}
        {(searchTerm || selectedTipo !== 'todos' || fechaDesde || fechaHasta) && (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Encontrados <strong>{filteredMovements.length}</strong> movimientos
            </span>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedTipo('todos');
                setFechaDesde('');
                setFechaHasta('');
                setSelectedResponsable('todos');
                setCurrentPage(1);
              }}
              className="text-slate-700 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Limpiar filtros</span>
            </button>
          </div>
        )}
      </div>

      {/* ── TABLA DE MOVIMIENTOS ── */}
      {paginatedMovements.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-10 text-center text-slate-500 space-y-2">
          <History className="h-10 w-10 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">No se encontraron movimientos con los filtros indicados</p>
        </div>
      ) : (
        <>
          {/* Vista móvil */}
          <div className="md:hidden space-y-3">
            {paginatedMovements.map((mov) => {
              const isEntrada = mov.tipoMovimiento === 'Entrada';

              return (
                <div
                  key={`mobile-mov-${mov.id}`}
                  onClick={() => onSelectMovement(mov)}
                  className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-2.5 cursor-pointer hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isEntrada ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {mov.tipoMovimiento}
                      </span>
                      <span className="font-mono text-xs font-semibold text-slate-800">{mov.codigoLote}</span>
                    </div>

                    <span className={`text-xs font-bold font-mono ${
                      isEntrada ? 'text-emerald-800' : 'text-sky-800'
                    }`}>
                      {isEntrada ? `+${mov.cantidad}` : `-${mov.cantidad}`} und
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-xs text-slate-900 truncate">{mov.claseEquipo}</h3>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {mov.ancho} × {mov.largo} × {mov.profundidad} cm
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-2 space-y-1 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">{isEntrada ? 'Procedencia:' : 'Destino:'}</span>
                      <span className="font-medium text-slate-800 truncate max-w-[200px]">{mov.procedenciaDestino}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Responsable:</span>
                      <span className="text-slate-700 truncate max-w-[200px]">{mov.responsable}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200/60 pt-1 text-[11px]">
                      <span className="text-slate-400">Fecha:</span>
                      <span className="text-slate-500 font-mono">
                        {new Date(mov.fecha).toLocaleDateString('es-CO', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tabla de escritorio */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <th className="py-3 px-4">Remisión / Fecha</th>
                    <th className="py-3 px-3">Tipo</th>
                    <th className="py-3 px-3">Pieza / Equipo</th>
                    <th className="py-3 px-3">Dimensiones</th>
                    <th className="py-3 px-3 text-center">Cantidad</th>
                    <th className="py-3 px-3">Procedencia / Destino</th>
                    <th className="py-3 px-3">Responsable</th>
                    <th className="py-3 px-4 text-right">Comprobante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {paginatedMovements.map((mov) => {
                    const isEntrada = mov.tipoMovimiento === 'Entrada';

                    return (
                      <tr 
                        key={mov.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        {/* Lote & Fecha */}
                        <td className="py-3 px-4 font-mono">
                          <div className="font-bold text-slate-900">{mov.codigoLote}</div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(mov.fecha).toLocaleDateString('es-CO', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </td>

                        {/* Tipo */}
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isEntrada ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {isEntrada ? (
                              <ArrowDownLeft className="h-3 w-3" />
                            ) : (
                              <ArrowUpRight className="h-3 w-3" />
                            )}
                            <span>{mov.tipoMovimiento}</span>
                          </span>
                        </td>

                        {/* Pieza */}
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          <div>{mov.claseEquipo}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{mov.tipoEquipo}</div>
                        </td>

                        {/* Dimensiones */}
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-700">
                          {mov.ancho} × {mov.largo} × {mov.profundidad} cm
                        </td>

                        {/* Cantidad */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`font-mono font-bold text-xs ${
                              isEntrada ? 'text-emerald-800' : 'text-sky-800'
                            }`}
                          >
                            {isEntrada ? `+${mov.cantidad}` : `-${mov.cantidad}`}
                          </span>
                        </td>

                        {/* Procedencia / Destino */}
                        <td className="py-3 px-3 max-w-[180px]">
                          <div className="truncate font-medium text-slate-800" title={mov.procedenciaDestino}>
                            {mov.procedenciaDestino}
                          </div>
                        </td>

                        {/* Responsable */}
                        <td className="py-3 px-3 max-w-[150px]">
                          <div className="truncate text-slate-700" title={mov.responsable}>
                            {mov.responsable}
                          </div>
                        </td>

                        {/* Acciones */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => onSelectMovement(mov)}
                              title="Ver comprobante de remisión y detalle técnico"
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Voucher</span>
                            </button>

                            {currentUserRol === 'admin' && (
                              <button
                                onClick={() => {
                                  if (confirm(`¿Anular el movimiento ${mov.codigoLote}? Esto revertirá las existencias en inventario. El registro queda archivado como anulado para trazabilidad de auditoría, no se borra físicamente.`)) {
                                    onDeleteMovement(mov.id);
                                  }
                                }}
                                title="Anular registro (Solo Admin)"
                                className="px-2 py-1 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Anular</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginador */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs text-xs text-slate-600">
              <div>
                Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong> ({filteredMovements.length} movimientos)
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = i + 1;
                    if (totalPages > 5 && currentPage > 3) {
                      pageNum = currentPage - 3 + i;
                      if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`h-7 w-7 rounded-lg font-bold transition-colors cursor-pointer ${
                          currentPage === pageNum
                            ? 'bg-slate-900 text-white'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
};
