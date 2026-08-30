import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, ArrowDownLeft, ArrowUpRight, Activity, Calendar } from 'lucide-react';
import { Movimiento, KpiMetrics } from '../types';
import { useTheme } from '../context/ThemeContext';

interface MovementsTrendChartProps {
  movements: Movimiento[];
  kpis: KpiMetrics | null;
  onOpenNewMovement?: (tipo?: 'Entrada' | 'Salida') => void;
}

interface DayData {
  dateStr: string;
  dayLabel: string;
  fullDate: string;
  entradas: number;
  salidas: number;
  saldoNeto: number;
  totalMovimientos: number;
}

export const MovementsTrendChart: React.FC<MovementsTrendChartProps> = ({
  movements,
  kpis,
  onOpenNewMovement,
}) => {
  const { isDark } = useTheme();
  const [activeMetric, setActiveMetric] = useState<'both' | 'entradas' | 'salidas'>('both');

  // Compute the last 7 days series
  const chartData: DayData[] = useMemo(() => {
    // 1. Build a 7-day chronological sequence ending today
    const now = new Date();
    const dayMap: { [key: string]: DayData } = {};
    const dateKeys: string[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      dateKeys.push(dateStr);

      const dayLabel = d.toLocaleDateString('es-CO', {
        weekday: 'short',
        day: 'numeric',
      });
      const fullDate = d.toLocaleDateString('es-CO', {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      dayMap[dateStr] = {
        dateStr,
        dayLabel: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1),
        fullDate: fullDate.charAt(0).toUpperCase() + fullDate.slice(1),
        entradas: 0,
        salidas: 0,
        saldoNeto: 0,
        totalMovimientos: 0,
      };
    }

    // 2. Aggregate movements
    let hasMovementsInCurrentRange = false;
    movements.forEach((m) => {
      const dStr = m.fecha.slice(0, 10);
      if (dayMap[dStr]) {
        hasMovementsInCurrentRange = true;
        if (m.tipoMovimiento === 'Entrada') {
          dayMap[dStr].entradas += m.cantidad;
        } else {
          dayMap[dStr].salidas += m.cantidad;
        }
        dayMap[dStr].totalMovimientos += 1;
      }
    });

    // 3. Fallback to latest historical entries from kpi data if current 7 days are completely empty
    if (!hasMovementsInCurrentRange && kpis?.flujoMovimientos && kpis.flujoMovimientos.length > 0) {
      const recentKpi = kpis.flujoMovimientos.slice(-7);
      return recentKpi.map((item) => {
        const d = new Date(item.fecha + 'T12:00:00');
        const dayLabel = d.toLocaleDateString('es-CO', {
          weekday: 'short',
          day: 'numeric',
        });
        const fullDate = d.toLocaleDateString('es-CO', {
          weekday: 'long',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });

        return {
          dateStr: item.fecha,
          dayLabel: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1),
          fullDate: fullDate.charAt(0).toUpperCase() + fullDate.slice(1),
          entradas: item.entradas,
          salidas: item.salidas,
          saldoNeto: item.entradas - item.salidas,
          totalMovimientos: item.entradas + item.salidas > 0 ? 1 : 0,
        };
      });
    }

    return dateKeys.map((k) => {
      const item = dayMap[k];
      return {
        ...item,
        saldoNeto: item.entradas - item.salidas,
      };
    });
  }, [movements, kpis?.flujoMovimientos]);

  // Aggregate 7-day stats
  const stats7d = useMemo(() => {
    let sumEntradas = 0;
    let sumSalidas = 0;
    let peakDay: DayData | null = null;
    let peakVolume = -1;

    chartData.forEach((d) => {
      sumEntradas += d.entradas;
      sumSalidas += d.salidas;
      const vol = d.entradas + d.salidas;
      if (vol > peakVolume) {
        peakVolume = vol;
        peakDay = d;
      }
    });

    return {
      sumEntradas,
      sumSalidas,
      neto: sumEntradas - sumSalidas,
      peakDay,
    };
  }, [chartData]);

  // Colors & styles adaptive to dark/light theme
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const entradaColor = isDark ? '#10b981' : '#059669';
  const salidaColor = isDark ? '#38bdf8' : '#0284c7';

  return (
    <div
      id="movements-trend-chart-card"
      className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
    >
      {/* Header with Title and Metric Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <TrendingUp className="h-4 w-4" />
            </div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Tendencia de Movimientos (Últimos 7 Días)
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Evolución diaria de piezas recibidas (Entradas) frente a despachadas (Salidas)
          </p>
        </div>

        {/* Metric Toggles */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveMetric('both')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              activeMetric === 'both'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Todas
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric('entradas')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              activeMetric === 'entradas'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
            }`}
          >
            <ArrowDownLeft className="h-3.5 w-3.5" />
            <span>Entradas</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric('salidas')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              activeMetric === 'salidas'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40'
            }`}
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span>Salidas</span>
          </button>
        </div>
      </div>

      {/* KPI Chips Summary for 7 Days */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-800">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            Total Recepciones (7d)
          </div>
          <div className="text-base sm:text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
            +{stats7d.sumEntradas} <span className="text-xs font-sans font-normal text-slate-500">und</span>
          </div>
        </div>

        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-800">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-sky-500"></span>
            Total Despachos (7d)
          </div>
          <div className="text-base sm:text-lg font-bold font-mono text-sky-700 dark:text-sky-400 mt-0.5">
            -{stats7d.sumSalidas} <span className="text-xs font-sans font-normal text-slate-500">und</span>
          </div>
        </div>

        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-800">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Activity className="h-3 w-3 text-amber-500" />
            Balance Neto (7d)
          </div>
          <div
            className={`text-base sm:text-lg font-bold font-mono mt-0.5 ${
              stats7d.neto >= 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-rose-700 dark:text-rose-400'
            }`}
          >
            {stats7d.neto >= 0 ? `+${stats7d.neto}` : stats7d.neto}{' '}
            <span className="text-xs font-sans font-normal text-slate-500">und</span>
          </div>
        </div>

        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-800">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Calendar className="h-3 w-3 text-indigo-500" />
            Mayor Actividad
          </div>
          <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">
            {stats7d.peakDay ? stats7d.peakDay.dayLabel : 'N/A'}
          </div>
        </div>
      </div>

      {/* Chart Canvas Container */}
      <div className="w-full h-64 sm:h-72 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="dayLabel"
              stroke={axisColor}
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: gridColor }}
            />
            <YAxis
              stroke={axisColor}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as DayData;
                  return (
                    <div className="bg-slate-900/95 text-white p-3 rounded-xl border border-slate-700 shadow-xl text-xs space-y-2 min-w-[170px] backdrop-blur-xs">
                      <div className="border-b border-slate-800 pb-1 font-semibold text-amber-400">
                        {data.fullDate}
                      </div>
                      <div className="space-y-1">
                        {(activeMetric === 'both' || activeMetric === 'entradas') && (
                          <div className="flex items-center justify-between gap-3 text-emerald-400">
                            <span className="flex items-center gap-1">
                              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                              Recepciones:
                            </span>
                            <span className="font-mono font-bold">+{data.entradas} und</span>
                          </div>
                        )}
                        {(activeMetric === 'both' || activeMetric === 'salidas') && (
                          <div className="flex items-center justify-between gap-3 text-sky-400">
                            <span className="flex items-center gap-1">
                              <span className="h-2 w-2 rounded-full bg-sky-400"></span>
                              Despachos:
                            </span>
                            <span className="font-mono font-bold">-{data.salidas} und</span>
                          </div>
                        )}
                        <div className="pt-1 border-t border-slate-800 flex items-center justify-between text-slate-300 font-medium">
                          <span>Balance Neto:</span>
                          <span
                            className={`font-mono font-bold ${
                              data.saldoNeto >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {data.saldoNeto >= 0 ? `+${data.saldoNeto}` : data.saldoNeto} und
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              height={36}
              content={() => (
                <div className="flex items-center justify-end gap-4 text-xs font-semibold pb-2">
                  {(activeMetric === 'both' || activeMetric === 'entradas') && (
                    <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                      <span>Recepciones (Entradas)</span>
                    </div>
                  )}
                  {(activeMetric === 'both' || activeMetric === 'salidas') && (
                    <div className="flex items-center gap-1.5 text-sky-700 dark:text-sky-400">
                      <span className="h-2.5 w-2.5 rounded-full bg-sky-500"></span>
                      <span>Despachos (Salidas)</span>
                    </div>
                  )}
                </div>
              )}
            />
            <ReferenceLine y={0} stroke={gridColor} />

            {/* Line for Entradas */}
            {(activeMetric === 'both' || activeMetric === 'entradas') && (
              <Line
                type="monotone"
                dataKey="entradas"
                name="Recepciones"
                stroke={entradaColor}
                strokeWidth={3}
                dot={{ r: 4, fill: entradaColor, strokeWidth: 2, stroke: isDark ? '#0f172a' : '#ffffff' }}
                activeDot={{ r: 6, fill: entradaColor, stroke: isDark ? '#0f172a' : '#ffffff', strokeWidth: 2 }}
              />
            )}

            {/* Line for Salidas */}
            {(activeMetric === 'both' || activeMetric === 'salidas') && (
              <Line
                type="monotone"
                dataKey="salidas"
                name="Despachos"
                stroke={salidaColor}
                strokeWidth={3}
                dot={{ r: 4, fill: salidaColor, strokeWidth: 2, stroke: isDark ? '#0f172a' : '#ffffff' }}
                activeDot={{ r: 6, fill: salidaColor, stroke: isDark ? '#0f172a' : '#ffffff', strokeWidth: 2 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Quick Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400 gap-2">
        <span>Datos actualizados en tiempo real según el registro cronológico del patio</span>
        {onOpenNewMovement && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenNewMovement('Entrada')}
              className="text-emerald-700 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
            >
              + Nueva Entrada
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => onOpenNewMovement('Salida')}
              className="text-sky-700 dark:text-sky-400 hover:underline font-semibold cursor-pointer"
            >
              + Nueva Salida
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
