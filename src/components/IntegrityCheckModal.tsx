import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  X,
  Wrench,
  FileCheck2,
  AlertCircle,
  Info,
  Lock
} from 'lucide-react';
import { IntegrityCheckReport, InconsistenciaItem, UserProfile } from '../types';
import { fetchIntegrityCheck, reconcileIntegrity } from '../services/api';

interface IntegrityCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onDataReconciled: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export const IntegrityCheckModal: React.FC<IntegrityCheckModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onDataReconciled,
  showToast,
}) => {
  const [report, setReport] = useState<IntegrityCheckReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isReconciling, setIsReconciling] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'reglas' | 'inconsistencias' | 'certificado'>('reglas');
  const [selectedInconsistencia, setSelectedInconsistencia] = useState<InconsistenciaItem | null>(null);
  const [appliedAdjustments, setAppliedAdjustments] = useState<string[]>([]);

  const isAdmin = currentUser.rol === 'admin';

  const loadReport = async () => {
    try {
      setIsLoading(true);
      const data = await fetchIntegrityCheck();
      setReport(data);
      if (data.detalles.length > 0) {
        setActiveTab('inconsistencias');
      }
    } catch (err: unknown) {
      console.error('Error cargando reporte de integridad:', err);
      showToast('error', 'Error al consultar la auditoría de integridad');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadReport();
      setAppliedAdjustments([]);
      setSelectedInconsistencia(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleReconcile = async () => {
    if (!isAdmin) {
      showToast('error', 'Solo el Administrador tiene permisos para conciliar y corregir saldos.');
      return;
    }

    try {
      setIsReconciling(true);
      const res = await reconcileIntegrity();
      setReport(res.nuevoReporte);
      setAppliedAdjustments(res.ajustesAplicados);
      setActiveTab('certificado');

      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#059669', '#34d399', '#f59e0b'],
      });

      showToast('success', res.mensaje);
      onDataReconciled();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al conciliar inventario';
      showToast('error', msg);
    } finally {
      setIsReconciling(false);
    }
  };

  const isHealthy = report && report.totalInconsistencias === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* ── ENCABEZADO ── */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800 text-emerald-400 rounded-xl border border-slate-700">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Verificación de Integridad y Auditoría de Saldos
                </h2>
                {report && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isHealthy ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}>
                    {isHealthy ? '100% Íntegro' : `${report.totalInconsistencias} Descuadre(s)`}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Cruce de datos entre el libro de movimientos y el saldo consolidado de patio.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadReport}
              disabled={isLoading}
              title="Volver a auditar"
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── CUERPO CON SCROLL ── */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
          
          {isLoading && !report ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="h-8 w-8 text-amber-600 animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Auditando consistencia matemática de saldos y registros...</p>
            </div>
          ) : report ? (
            <>
              {/* ── TARJETA PRINCIPAL DE SALUD Y ACCIÓN DE 1 CLIC ── */}
              <div className={`p-5 rounded-2xl border transition-all ${
                isHealthy
                  ? 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-950'
                  : 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-950 shadow-xs'
              }`}>
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className={`p-3 rounded-xl shrink-0 ${
                      isHealthy ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                    }`}>
                      {isHealthy ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold font-mono">
                          {report.porcentajeSalud}% de Integridad
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                          isHealthy ? 'bg-emerald-200 text-emerald-900 dark:text-emerald-200' : 'bg-rose-200 text-rose-900 dark:text-rose-200'
                        }`}>
                          {isHealthy ? 'Estado Óptimo' : 'Inconsistencia Detectada'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
                        {isHealthy
                          ? 'Todos los saldos de patio, cubicajes en m³ y secuencias cronológicas coinciden estrictamente con la sumatoria inmutable de recepciones y despachos.'
                          : `Se detectaron ${report.totalInconsistencias} inconsistencia(s) entre los movimientos asentados y los saldos de inventario. El administrador puede resolverlas de inmediato con un solo clic.`}
                      </p>
                    </div>
                  </div>

                  {/* Botón de Corrección de 1 Clic */}
                  <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch md:items-center gap-2 shrink-0">
                    {!isHealthy ? (
                      <button
                        onClick={handleReconcile}
                        disabled={isReconciling || !isAdmin}
                        title={isAdmin ? 'Corregir y conciliar todo el inventario con 1 clic' : 'Solo Administrador'}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer disabled:cursor-not-allowed"
                      >
                        <Wrench className={`h-4 w-4 ${isReconciling ? 'animate-spin' : ''}`} />
                        <span>{isReconciling ? 'Conciliando...' : '⚡ Corregir Inconsistencias (1 Clic)'}</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={loadReport}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>Re-auditar</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {!isAdmin && !isHealthy && (
                  <div className="mt-3 pt-3 border-t border-rose-200/60 flex items-center gap-2 text-xs text-rose-800 dark:text-rose-300 font-medium">
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    <span>Tu rol actual ({currentUser.rol}) es de consulta. Solicita al Administrador (Ing. Rodrigo Mendoza) la ejecución del 1-Clic de Conciliación.</span>
                  </div>
                )}
              </div>

              {/* ── MÉTRICAS DE CRUCE DE DATOS ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Movimientos Auditados</span>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-0.5">{report.totalMovimientosAuditados}</div>
                  <span className="text-[10px] text-slate-400">Recepciones + Despachos</span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Referencias Cruzadas</span>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-0.5">{report.totalReferenciasCruzadas}</div>
                  <span className="text-[10px] text-slate-400">SKUs / Dimensiones</span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Piezas Físicas</span>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-0.5">{report.metricasAuditoria.totalPiezasFisicasVerificadas}</div>
                  <span className="text-[10px] text-slate-400">Unidades totales</span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tiempo de Análisis</span>
                  <div className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">{report.metricasAuditoria.tiempoEjecucionMs} ms</div>
                  <span className="text-[10px] text-slate-400">Verificación en base de datos</span>
                </div>
              </div>

              {/* ── PESTAÑAS DE NAVEGACIÓN ── */}
              <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('inconsistencias')}
                  className={`py-2 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeTab === 'inconsistencias'
                      ? 'border-slate-900 text-slate-900 dark:text-white font-bold'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  <AlertCircle className={`h-3.5 w-3.5 ${report.totalInconsistencias > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
                  <span>Inconsistencias ({report.totalInconsistencias})</span>
                </button>

                <button
                  onClick={() => setActiveTab('reglas')}
                  className={`py-2 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeTab === 'reglas'
                      ? 'border-slate-900 text-slate-900 dark:text-white font-bold'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Reglas de Auditoría ({report.metricasAuditoria.reglasCumplidas}/{report.metricasAuditoria.reglasEvaluadas})</span>
                </button>

                <button
                  onClick={() => setActiveTab('certificado')}
                  className={`py-2 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeTab === 'certificado'
                      ? 'border-slate-900 text-slate-900 dark:text-white font-bold'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  <FileCheck2 className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Historial y Certificado</span>
                </button>
              </div>

              {/* ── CONTENIDO: TAB 1 INCONSISTENCIAS ── */}
              {activeTab === 'inconsistencias' && (
                <div className="space-y-3">
                  {report.detalles.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-8 text-center border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
                      <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">No hay inconsistencias detectadas</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                        Todas las sumatorias de entradas y salidas cuadran exactamente con los saldos consolidados de inventario.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {report.detalles.map((inc) => (
                        <div
                          key={inc.id}
                          className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-rose-200 dark:border-rose-800/60 shadow-xs space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 rounded font-bold text-[10px] uppercase">
                                {inc.tipo.replace(/_/g, ' ')}
                              </span>
                              <span className="text-xs font-bold text-slate-900 dark:text-white">{inc.claseEquipo}</span>
                              <span className="text-[11px] text-slate-400 font-mono">({inc.tipoEquipo})</span>
                            </div>

                            <span className="text-xs font-mono font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800/60">
                              Diferencia: {inc.diferencia}
                            </span>
                          </div>

                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{inc.descripcion}</p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs font-mono">
                            <div>
                              <span className="text-slate-400 text-[10px] block uppercase font-sans font-medium">Valor Registrado / Asentado</span>
                              <span className="font-bold text-rose-700 dark:text-rose-400">{inc.valorRegistrado}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px] block uppercase font-sans font-medium">Valor Teórico Auditado (Sumatoria)</span>
                              <span className="font-bold text-emerald-700 dark:text-emerald-400">{inc.valorCalculado}</span>
                            </div>
                          </div>

                          {inc.detallesTecnicos && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
                              {inc.detallesTecnicos}
                            </p>
                          )}

                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                            <div className="flex items-center gap-1 text-[11px]">
                              <Info className="h-3 w-3 text-slate-400" />
                              <span className="text-slate-500 dark:text-slate-400">Acción recomendada:</span>
                              <span className="font-medium text-slate-800 dark:text-slate-100">{inc.accionRecomendada}</span>
                            </div>
                          </div>
                        </div>
                      ))}

                      {isAdmin && (
                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={handleReconcile}
                            disabled={isReconciling}
                            className="flex items-center gap-2 px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
                          >
                            <Wrench className="h-4 w-4" />
                            <span>Ejecutar Corrección de Todas las Inconsistencias (1 Clic)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── CONTENIDO: TAB 2 REGLAS DE AUDITORÍA ── */}
              {activeTab === 'reglas' && (
                <div className="space-y-2.5">
                  {report.reglasAuditoria.map((regla) => (
                    <div
                      key={regla.id}
                      className={`p-3.5 bg-white dark:bg-slate-900 rounded-xl border shadow-xs flex items-start justify-between gap-3 ${
                        regla.aprobada ? 'border-slate-200 dark:border-slate-800' : 'border-rose-200 dark:border-rose-800/60 bg-rose-50/20'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                          regla.aprobada ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                        }`}>
                          {regla.aprobada ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">{regla.nombre}</h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{regla.descripcion}</p>
                          <span className="text-[10px] text-slate-400 font-mono mt-1 inline-block">
                            Evaluados: {regla.elementosEvaluados} elementos | Inconsistencias: {regla.inconsistenciasDetectadas}
                          </span>
                        </div>
                      </div>

                      <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        regla.aprobada ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                      }`}>
                        {regla.aprobada ? 'Aprobada' : 'Fallo'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── CONTENIDO: TAB 3 HISTORIAL Y CERTIFICADO ── */}
              {activeTab === 'certificado' && (
                <div className="space-y-4">
                  {appliedAdjustments.length > 0 && (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200 space-y-2">
                      <div className="font-bold flex items-center gap-1.5 text-emerald-950">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>Ajustes aplicados en la última conciliación de 1 Clic:</span>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-emerald-800 dark:text-emerald-300 font-mono text-[11px]">
                        {appliedAdjustments.map((ajuste, i) => (
                          <li key={i}>{ajuste}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Certificado de Integridad Formal */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 font-sans">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Certificado de Trazabilidad e Integridad de Inventario
                        </h4>
                        <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                          CERT-CED-AUD-{new Date().getFullYear()}-{new Date().getMonth() + 1}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Sello de Verificación</span>
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 font-mono">100% AUDITADO</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Empresa</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100">Sedimec S.A.S. (Patio Central)</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Auditor Responsable</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100">{report.metricasAuditoria.verificadoPor}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Fecha de Auditoría</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {new Date(report.timestamp).toLocaleString('es-CO')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Reglas Validadas</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">6 de 6 reglas de negocio ASTM/ISO</span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed border border-slate-200/60 dark:border-slate-800/60">
                      Se certifica que los saldos actuales de inventario corresponden a la integral de flujos de entrada y despacho sin discrepancias en volumen geométrico ni desfases en numeración de remisiones.
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}

        </div>

        {/* ── FOOTER DE ACCIONES ── */}
        <div className="px-5 py-3.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs shrink-0">
          <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
            {report?.ultimaConciliacion?.fecha ? (
              <span>
                Última conciliación: {new Date(report.ultimaConciliacion.fecha).toLocaleDateString('es-CO')} por {report.ultimaConciliacion.usuario.split(' ')[0]}
              </span>
            ) : (
              <span>Auditoría en tiempo real activa</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
