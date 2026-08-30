import React from 'react';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Boxes, 
  AlertTriangle, 
  Clock, 
  Mic, 
  FileSpreadsheet, 
  ChevronRight, 
  CheckCircle2, 
  Maximize2,
  Search, 
  X, 
  User,
  Shield
} from 'lucide-react';
import { KpiMetrics, Movimiento, ItemInventario, UserProfile } from '../types';
import { exportarInventarioConsolidadoExcel, exportarMovimientosExcel } from '../utils/excel';
import { MovementsTrendChart } from './MovementsTrendChart';

interface DashboardViewProps {
  kpis: KpiMetrics | null;
  currentUser?: UserProfile;
  onOpenAuthModal?: () => void;
  recentMovements: Movimiento[];
  inventoryItems: ItemInventario[];
  onOpenNewMovement: (tipo?: 'Entrada' | 'Salida') => void;
  onOpenVoiceModal: () => void;
  onSelectMovement: (mov: Movimiento) => void;
  onNavigateTab: (tab: 'inventario' | 'movimientos') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenSalidaForItem?: (item: ItemInventario) => void;
  onOpenDiagramModal?: (item: ItemInventario) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  kpis,
  currentUser,
  onOpenAuthModal,
  recentMovements,
  inventoryItems,
  onOpenNewMovement,
  onOpenVoiceModal,
  onSelectMovement,
  onNavigateTab,
  searchQuery,
  setSearchQuery,
  onOpenSalidaForItem,
  onOpenDiagramModal,
}) => {
  if (!kpis) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-amber-500"></div>
      </div>
    );
  }

  const criticalStockItems = inventoryItems.filter((i) => i.saldoActual <= (i.umbralMinimo || 5) && i.saldoActual >= 0);

  return (
    <div className="space-y-5 pb-8">

      {/* ── CABECERA SIMPLIFICADA CON ACCIONES Y PERFIL DE USUARIO ── */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Título & Perfil de Usuario */}
          <div className="flex items-center gap-3">
            {currentUser && onOpenAuthModal && (
              <button
                id="dashboard-user-profile-btn"
                type="button"
                onClick={onOpenAuthModal}
                title="Haga clic para cambiar de rol o usuario"
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer flex items-center gap-2 shrink-0 group"
              >
                <div className="p-1 rounded-lg bg-amber-500/20 text-amber-400 group-hover:bg-amber-500/30">
                  <User className="h-4 w-4" />
                </div>
                <div className="text-left hidden md:block">
                  <div className="text-xs font-bold leading-tight truncate max-w-[140px]">
                    {currentUser.nombre}
                  </div>
                  <div className="text-[10px] text-amber-400 font-semibold flex items-center gap-1 uppercase">
                    <Shield className="h-2.5 w-2.5" />
                    <span>{currentUser.rol}</span>
                  </div>
                </div>
              </button>
            )}

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-400 tracking-wider">
                  Sedimec S.A.
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-slate-400 font-mono">
                  {kpis.totalReferenciasDistintas} referencias
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white mt-0.5">
                Panel de Control Operativo
              </h1>
            </div>
          </div>

          {/* Acciones principales directas */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
            <button
              onClick={() => onOpenNewMovement('Entrada')}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <ArrowDownLeft className="h-4 w-4" />
              <span>+ Recepción</span>
            </button>
            <button
              onClick={() => onOpenNewMovement('Salida')}
              className="flex items-center gap-1.5 px-3 py-2 bg-sky-700 hover:bg-sky-600 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <ArrowUpRight className="h-4 w-4" />
              <span>- Despacho</span>
            </button>
            <button
              onClick={onOpenVoiceModal}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <Mic className="h-4 w-4 text-amber-400" />
              <span className="hidden sm:inline">Voz</span>
            </button>
          </div>
        </div>

        {/* Buscador Rápido Integrado */}
        <div className="mt-3.5 pt-3.5 border-t border-slate-800/80">
          <div className="relative flex items-center">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              id="dashboard-header-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar piezas, códigos o dimensiones (ej. Viga IPE, Tubo, 15x600x30)..."
              className="w-full pl-10 pr-20 py-2 bg-slate-950/90 hover:bg-slate-950 focus:bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-hidden transition-colors"
            />
            {searchQuery && (
              <div className="absolute right-2.5 flex items-center gap-1.5">
                <button
                  id="dashboard-header-search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="text-[10px]">Limpiar</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 4 INDICADORES OPERATIVOS CLAVE (KPIS) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* KPI 1: Stock Total */}
        <div 
          onClick={() => onNavigateTab('inventario')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition-colors cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Stock Disponible
            </span>
            <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Boxes className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight font-mono">
                {kpis.totalPiezasDisponibles}
              </span>
              <span className="text-xs font-medium text-slate-500">piezas</span>
            </div>
            <div className="mt-2 text-xs text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
              <span>{kpis.totalReferenciasDistintas} referencias</span>
              <span className="text-slate-700 font-semibold flex items-center gap-0.5">
                Ver detalle <ChevronRight className="h-3 w-3" />
              </span>
            </div>
          </div>
        </div>

        {/* KPI 2: Total Entradas */}
        <div 
          onClick={() => onNavigateTab('movimientos')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition-colors cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Recepciones
            </span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ArrowDownLeft className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-bold text-emerald-800 tracking-tight font-mono">
                {kpis.totalEntradasPeriodo}
              </span>
              <span className="text-xs font-medium text-emerald-700">ingresos</span>
            </div>
            <div className="mt-2 text-xs text-slate-500 border-t border-slate-100 pt-2">
              Ingreso acumulado a patio
            </div>
          </div>
        </div>

        {/* KPI 3: Total Salidas */}
        <div 
          onClick={() => onNavigateTab('movimientos')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition-colors cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Despachos
            </span>
            <div className="h-8 w-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-bold text-sky-800 tracking-tight font-mono">
                {kpis.totalSalidasPeriodo}
              </span>
              <span className="text-xs font-medium text-sky-700">salidas</span>
            </div>
            <div className="mt-2 text-xs text-slate-500 border-t border-slate-100 pt-2">
              Despachos a obra y traslados
            </div>
          </div>
        </div>

        {/* KPI 4: Cubicaje Total */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Cubicaje en Patio
            </span>
            <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Maximize2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight font-mono">
                {kpis.volumenTotalAlmacenadoM3}
              </span>
              <span className="text-xs font-medium text-slate-500">m³</span>
            </div>
            <div className="mt-2 text-xs text-slate-500 border-t border-slate-100 pt-2">
              Volumen dimensional calculado
            </div>
          </div>
        </div>

      </div>

      {/* ── GRÁFICO DE LÍNEAS RECHARTS: TENDENCIA 7 DÍAS (ENTRADAS VS SALIDAS) ── */}
      <MovementsTrendChart
        movements={recentMovements}
        kpis={kpis}
        onOpenNewMovement={onOpenNewMovement}
      />

      {/* ── DISTRIBUCIÓN DE EXISTENCIAS Y ALERTAS DE STOCK ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Distribución por Clase de Material y Estado Físico (6 cols en lg) */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Existencias por Clase de Pieza
                </h2>
                <p className="text-xs text-slate-500">
                  Distribución porcentual sobre el stock total en patio
                </p>
              </div>
              <button
                onClick={() => exportarInventarioConsolidadoExcel(inventoryItems, 'xlsx')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
                <span>Exportar</span>
              </button>
            </div>

            <div className="mt-3.5 space-y-2.5">
              {kpis.distribucionPorClase.slice(0, 5).map((item) => (
                <div key={item.clase} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <span className="font-medium truncate">{item.clase}</span>
                    <span className="font-mono font-bold text-slate-900">{item.total} und ({item.porcentaje}%)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-800 rounded-full"
                      style={{ width: `${Math.max(item.porcentaje, 4)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-2">
              Estado Físico del Material
            </span>
            <div className="grid grid-cols-2 gap-2">
              {kpis.distribucionPorEstado.map((est) => (
                <div key={est.estado} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                  <span className="text-slate-700 font-medium">{est.estado}</span>
                  <span className="font-mono font-bold text-slate-900">{est.total}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Alertas de Stock Mínimo (6 cols en lg) */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">
                    Alertas de Stock Bajo
                  </h2>
                  <p className="text-xs text-slate-500">
                    Artículos con existencia igual o inferior al umbral mínimo
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md shrink-0">
                {criticalStockItems.length} críticas
              </span>
            </div>

            <div className="pt-3">
              {criticalStockItems.length === 0 ? (
                <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl space-y-1">
                  <CheckCircle2 className="h-7 w-7 text-emerald-600 mx-auto" />
                  <p className="text-xs font-medium text-slate-700">Stock en niveles seguros</p>
                  <p className="text-[11px] text-slate-400">Ningún artículo se encuentra bajo el umbral de reposición.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {criticalStockItems.slice(0, 4).map((item) => (
                    <div 
                      key={item.id}
                      className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/70 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">{item.claseEquipo}</div>
                        <div className="text-[10px] text-slate-500 truncate font-mono">
                          {item.ancho}x{item.largo}x{item.profundidad} cm • {item.tipoEquipo}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="inline-block px-2 py-0.5 bg-amber-200 text-amber-950 font-bold font-mono text-xs rounded">
                          {item.saldoActual} disp.
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Revisión de existencias en tiempo real</span>
            <button
              onClick={() => onNavigateTab('inventario')}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
            >
              <span>Ir al inventario</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* ── REGISTRO RECIENTE DE MOVIMIENTOS ── */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-700" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Últimos Movimientos en Patio
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportarMovimientosExcel(recentMovements, 'xlsx')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
              <span>Exportar Excel</span>
            </button>
            <button
              onClick={() => onNavigateTab('movimientos')}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
            >
              <span>Ver historial completo</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {recentMovements.slice(0, 5).map((mov) => (
            <div
              key={mov.id}
              onClick={() => onSelectMovement(mov)}
              className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-xl transition-colors cursor-pointer gap-2"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold shrink-0 ${
                    mov.tipoMovimiento === 'Entrada'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-sky-100 text-sky-800'
                  }`}
                >
                  {mov.tipoMovimiento === 'Entrada' ? (
                    <ArrowDownLeft className="h-4 w-4" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900 truncate">{mov.claseEquipo}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                      {mov.codigoLote}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    {mov.tipoMovimiento === 'Entrada' ? 'Origen:' : 'Destino:'} {mov.procedenciaDestino}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className={`text-xs font-bold font-mono ${
                  mov.tipoMovimiento === 'Entrada' ? 'text-emerald-800' : 'text-sky-800'
                }`}>
                  {mov.tipoMovimiento === 'Entrada' ? `+${mov.cantidad}` : `-${mov.cantidad}`}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {new Date(mov.fecha).toLocaleDateString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
