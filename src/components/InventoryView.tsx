import React, { useState, useMemo } from 'react';
import {
  Layers,
  Search,
  ArrowUpRight,
  FileSpreadsheet,
  AlertCircle,
  RotateCcw,
  Box,
  SlidersHorizontal,
  ChevronRight,
  Trash2,
  Pencil,
  X as XIcon,
  Save
} from 'lucide-react';
import { ItemInventario } from '../types';
import { exportarInventarioConsolidadoExcel } from '../utils/excel';
import { saveThreshold } from '../services/api';

interface InventoryViewProps {
  items: ItemInventario[];
  onOpenSalidaForItem: (item: ItemInventario) => void;
  onOpenDiagramModal: (item: ItemInventario) => void;
  onOpenEntrada: () => void;
  onDeleteReference: (item: ItemInventario) => void;
  onDataChanged: () => void;
  isAdmin: boolean;
  searchTerm?: string;
  setSearchTerm?: (term: string) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  items,
  onOpenSalidaForItem,
  onOpenDiagramModal,
  onOpenEntrada,
  onDeleteReference,
  onDataChanged,
  isAdmin,
  searchTerm: externalSearchTerm,
  setSearchTerm: externalSetSearchTerm,
}) => {
  const [editingItem, setEditingItem] = useState<ItemInventario | null>(null);
  const [editUmbral, setEditUmbral] = useState('');
  const [isSavingUmbral, setIsSavingUmbral] = useState(false);

  const handleSaveUmbral = async () => {
    if (!editingItem) return;
    const numUmbral = parseInt(editUmbral, 10);
    if (isNaN(numUmbral) || numUmbral < 0) return;

    try {
      setIsSavingUmbral(true);
      await saveThreshold({
        tipoEquipo: editingItem.tipoEquipo,
        claseEquipo: editingItem.claseEquipo,
        umbralMinimo: numUmbral,
      });
      setEditingItem(null);
      onDataChanged();
    } catch (err) {
      console.error('Error guardando umbral:', err);
    } finally {
      setIsSavingUmbral(false);
    }
  };
  const [internalSearchTerm, setInternalSearchTerm] = useState('');
  const searchTerm = externalSearchTerm !== undefined ? externalSearchTerm : internalSearchTerm;
  const setSearchTerm = externalSetSearchTerm || setInternalSearchTerm;

  const [selectedTipo, setSelectedTipo] = useState<string>('todos');
  const [selectedEstado, setSelectedEstado] = useState<string>('todos');
  const [filterStockBajo, setFilterStockBajo] = useState<boolean>(false);

  const uniqueTipos = useMemo(() => {
    const set = new Set(items.map((i) => i.tipoEquipo));
    return Array.from(set);
  }, [items]);

  const uniqueEstados = useMemo(() => {
    const set = new Set(items.map((i) => i.estadoEquipo));
    return Array.from(set);
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      const matchSearch =
        !q ||
        item.claseEquipo.toLowerCase().includes(q) ||
        item.tipoEquipo.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.estadoEquipo.toLowerCase().includes(q) ||
        `${item.ancho}x${item.largo}x${item.profundidad}`.includes(q) ||
        `${item.ancho} x ${item.largo} x ${item.profundidad}`.includes(q);

      const matchTipo = selectedTipo === 'todos' || item.tipoEquipo === selectedTipo;
      const matchEstado = selectedEstado === 'todos' || item.estadoEquipo === selectedEstado;
      const matchStockBajo = !filterStockBajo || item.alertaStockBajo;

      return matchSearch && matchTipo && matchEstado && matchStockBajo;
    });
  }, [items, searchTerm, selectedTipo, selectedEstado, filterStockBajo]);

  const totalStockFiltrado = useMemo(() => {
    return filteredItems.reduce((acc, curr) => acc + curr.saldoActual, 0);
  }, [filteredItems]);

  const totalVolumenFiltrado = useMemo(() => {
    return filteredItems.reduce((acc, curr) => acc + curr.volumenTotalM3, 0);
  }, [filteredItems]);

  const lowStockCount = useMemo(() => {
    return filteredItems.filter((i) => i.alertaStockBajo).length;
  }, [filteredItems]);

  return (
    <div className="space-y-4 sm:space-y-5 pb-8">
      {/* ── HEADER Y ACCIONES PRINCIPALES ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Consolidado de Inventario en Patio
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Saldos disponibles calculados por fórmula estricta: <span className="font-mono font-medium text-slate-800 dark:text-slate-100">Saldo = Recepciones - Despachos</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => exportarInventarioConsolidadoExcel(filteredItems, 'xlsx')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            <span>Descargar Excel</span>
          </button>
          <button
            onClick={() => exportarInventarioConsolidadoExcel(filteredItems, 'csv')}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            CSV
          </button>
        </div>
      </div>

      {/* ── 4 RESÚMENES MÉTRICOS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Unidades en Stock</span>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">{totalStockFiltrado}</div>
          <span className="text-[11px] text-slate-400">Piezas disponibles en patio</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Referencias Activas</span>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">{filteredItems.length}</div>
          <span className="text-[11px] text-slate-400">Tipos de piezas catalogadas</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Cubicaje Total</span>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">{totalVolumenFiltrado.toFixed(3)} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">m³</span></div>
          <span className="text-[11px] text-slate-400">Volumen físico ocupado</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Stock Crítico</span>
          <div className={`text-2xl font-bold font-mono mt-1 ${lowStockCount > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
            {lowStockCount}
          </div>
          <span className="text-[11px] text-slate-400">Bajo el umbral mínimo (≤5)</span>
        </div>
      </div>

      {/* ── BARRA DE FILTROS ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          
          {/* Buscador */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar clase, ID, medidas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-amber-500 focus:bg-white dark:focus:bg-slate-900 transition-colors"
            />
          </div>

          {/* Filtro por Tipo */}
          <div>
            <select
              value={selectedTipo}
              onChange={(e) => setSelectedTipo(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-amber-500 focus:bg-white dark:focus:bg-slate-900 transition-colors cursor-pointer"
            >
              <option value="todos">Todos los Tipos ({uniqueTipos.length})</option>
              {uniqueTipos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Estado */}
          <div>
            <select
              value={selectedEstado}
              onChange={(e) => setSelectedEstado(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-amber-500 focus:bg-white dark:focus:bg-slate-900 transition-colors cursor-pointer"
            >
              <option value="todos">Todos los Estados ({uniqueEstados.length})</option>
              {uniqueEstados.map((e) => (
                <option key={e} value={e}>
                  Estado: {e}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro de Stock Crítico */}
          <div>
            <button
              type="button"
              onClick={() => setFilterStockBajo(!filterStockBajo)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                filterStockBajo
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <AlertCircle className={`h-3.5 w-3.5 ${filterStockBajo ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>Solo Crítico (≤5)</span>
              </span>
              <span
                className={`h-2 w-2 rounded-full ${
                  filterStockBajo ? 'bg-rose-600' : 'bg-slate-300'
                }`}
              />
            </button>
          </div>

        </div>

        {/* Resumen de filtros aplicados */}
        {(searchTerm || selectedTipo !== 'todos' || selectedEstado !== 'todos' || filterStockBajo) && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              Mostrando <strong>{filteredItems.length}</strong> de <strong>{items.length}</strong> referencias
            </span>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedTipo('todos');
                setSelectedEstado('todos');
                setFilterStockBajo(false);
              }}
              className="text-slate-700 dark:text-slate-300 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Limpiar filtros</span>
            </button>
          </div>
        )}
      </div>

      {/* ── TABLA CONSOLIDADA DE INVENTARIO ── */}
      {filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-10 text-center text-slate-500 dark:text-slate-400 space-y-2">
          <Box className="h-10 w-10 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No se encontraron piezas con los filtros seleccionados</p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedTipo('todos');
              setSelectedEstado('todos');
              setFilterStockBajo(false);
            }}
            className="text-xs text-amber-600 font-bold hover:underline cursor-pointer"
          >
            Restablecer filtros
          </button>
        </div>
      ) : (
        <>
          {/* Vista móvil para pantallas pequeñas */}
          <div className="md:hidden space-y-3">
            {filteredItems.map((item) => {
              const isUnderThreshold = item.alertaStockBajo;
              const isZero = item.saldoActual === 0;

              return (
                <div 
                  key={item.id}
                  className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded">
                        {item.tipoEquipo}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">{item.claseEquipo}</h3>
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {item.ancho} × {item.largo} × {item.profundidad} cm
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold font-mono ${
                        isUnderThreshold
                          ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                          : isZero
                          ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                      }`}>
                        {item.saldoActual} und
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-medium">Movimientos</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">+{item.totalEntradas} / -{item.totalSalidas}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-medium">Cubicaje Total</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{item.volumenTotalM3.toFixed(3)} m³</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => onOpenDiagramModal(item)}
                      className="flex-1 py-1.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    >
                      Plano 3D
                    </button>
                    <button
                      onClick={() => onOpenSalidaForItem(item)}
                      disabled={isZero}
                      className="flex-1 py-1.5 px-3 bg-sky-700 hover:bg-sky-600 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-40"
                    >
                      - Despachar
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => { setEditingItem(item); setEditUmbral(String(item.umbralMinimo)); }}
                          title="Editar umbral mínimo de esta referencia"
                          className="py-1.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteReference(item)}
                          title="Eliminar referencia (anula todo su historial)"
                          className="py-1.5 px-3 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tabla de escritorio */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    <th className="py-3 px-4">Pieza / Clase de Equipo</th>
                    <th className="py-3 px-3">Tipo</th>
                    <th className="py-3 px-3">Dimensiones (cm)</th>
                    <th className="py-3 px-3">Estado</th>
                    <th className="py-3 px-3 text-center">Entradas</th>
                    <th className="py-3 px-3 text-center">Salidas</th>
                    <th className="py-3 px-4 text-center">Saldo Actual</th>
                    <th className="py-3 px-3">Cubicaje (m³)</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
                  {filteredItems.map((item) => {
                    const isUnderThreshold = item.alertaStockBajo;
                    const isZero = item.saldoActual === 0;

                    return (
                      <tr 
                        key={item.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                          isUnderThreshold ? 'bg-rose-50/30 dark:bg-rose-950/20' : isZero ? 'bg-slate-50/50 opacity-60' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                          <div>{item.claseEquipo}</div>
                          <div className="text-[10px] text-slate-400 font-normal font-mono">
                            ID: {item.id.replace(/__/g, '-').slice(0, 20)}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded text-[11px]">
                            {item.tipoEquipo}
                          </span>
                        </td>

                        <td className="py-3 px-3 font-mono text-slate-800 dark:text-slate-100">
                          {item.ancho} × {item.largo} × {item.profundidad}
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                              item.estadoEquipo === 'Bueno' || item.estadoEquipo === 'Nuevo'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                : item.estadoEquipo === 'Regular'
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800'
                                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                            }`}
                          >
                            {item.estadoEquipo}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center font-bold font-mono text-emerald-700 dark:text-emerald-400">
                          +{item.totalEntradas}
                        </td>

                        <td className="py-3 px-3 text-center font-bold font-mono text-sky-700 dark:text-sky-400">
                          -{item.totalSalidas}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded font-bold font-mono text-xs ${
                              isUnderThreshold
                                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                                : isZero
                                ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            {item.saldoActual} und
                          </span>
                        </td>

                        <td className="py-3 px-3 font-mono text-slate-800 dark:text-slate-100">
                          <div>{item.volumenTotalM3.toFixed(3)} m³</div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => onOpenDiagramModal(item)}
                              title="Ver ficha dimensional 3D"
                              className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-medium transition-colors cursor-pointer"
                            >
                              3D
                            </button>

                            <button
                              onClick={() => onOpenSalidaForItem(item)}
                              disabled={isZero}
                              className="flex items-center gap-1 px-2.5 py-1 bg-sky-700 hover:bg-sky-600 disabled:opacity-40 text-white rounded text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                            >
                              <ArrowUpRight className="h-3 w-3" />
                              <span>Salida</span>
                            </button>

                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => { setEditingItem(item); setEditUmbral(String(item.umbralMinimo)); }}
                                  title="Editar umbral mínimo de esta referencia"
                                  className="p-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded transition-colors cursor-pointer"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => onDeleteReference(item)}
                                  title="Eliminar referencia (anula todo su historial de movimientos)"
                                  className="p-1 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 rounded transition-colors cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
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
        </>
      )}

      {/* Quick-edit del umbral mínimo de una referencia */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold">Editar Umbral Mínimo</h3>
              </div>
              <button onClick={() => setEditingItem(null)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-bold text-slate-800 dark:text-slate-100">{editingItem.claseEquipo}</span> ({editingItem.tipoEquipo})
              </div>
              <p className="text-[11px] text-slate-400">
                Las dimensiones y el tipo son parte del historial de movimientos y no se editan aquí; solo el umbral que dispara la alerta de stock bajo.
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Umbral mínimo (unidades)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editUmbral}
                  onChange={(e) => setEditUmbral(e.target.value)}
                  autoFocus
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-amber-700 dark:text-amber-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setEditingItem(null)}
                  className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveUmbral}
                  disabled={isSavingUmbral}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{isSavingUmbral ? 'Guardando...' : 'Guardar'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
