import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  Volume2, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Package, 
  User, 
  Calendar, 
  MapPin, 
  Phone, 
  FileText, 
  CheckCircle2,
  Box,
  Layers
} from 'lucide-react';
import { Movimiento } from '../types';
import { generateTtsSpeech } from '../services/api';
import { playTtsAudio } from '../utils/audio';

interface MovementDetailModalProps {
  movement: Movimiento | null;
  onClose: () => void;
}

export const MovementDetailModal: React.FC<MovementDetailModalProps> = ({
  movement,
  onClose,
}) => {
  const [isPlayingTts, setIsPlayingTts] = useState(false);

  if (!movement) return null;

  const isEntrada = movement.tipoMovimiento === 'Entrada';
  const volumenM3 = (movement.ancho * movement.largo * movement.profundidad * movement.cantidad) / 1000000;

  const handlePlayVoiceSummary = async () => {
    try {
      setIsPlayingTts(true);
      const text = `Comprobante de ${movement.tipoMovimiento}. Código de lote ${movement.codigoLote}. ${movement.cantidad} piezas de ${movement.claseEquipo}, dimensiones ${movement.ancho} por ${movement.largo} por ${movement.profundidad} centímetros. ${isEntrada ? 'Procedencia:' : 'Destino:'} ${movement.procedenciaDestino}. Responsable: ${movement.responsable}.`;
      const { base64Audio } = await generateTtsSpeech(text, 'Kore');
      await playTtsAudio(base64Audio);
    } catch (err) {
      console.error('Error playing TTS:', err);
    } finally {
      setIsPlayingTts(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 print:p-0 print:bg-white">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 print:border-none print:shadow-none">
        
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-slate-900 text-white flex items-center justify-between print:bg-slate-900 print:text-white shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl font-bold ${
                isEntrada ? 'bg-emerald-500/20 text-emerald-300' : 'bg-sky-500/20 text-sky-300'
              }`}
            >
              {isEntrada ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-amber-400">{movement.codigoLote}</span>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                    isEntrada ? 'bg-emerald-600 text-white' : 'bg-sky-600 text-white'
                  }`}
                >
                  {movement.tipoMovimiento}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                {isEntrada ? 'Acta de Recepción de Material' : 'Remisión de Despacho y Entrega'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handlePlayVoiceSummary}
              disabled={isPlayingTts}
              title="Escuchar resumen con voz IA"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-violet-300 rounded-xl transition-colors cursor-pointer"
            >
              <Volume2 className={`h-4 w-4 ${isPlayingTts ? 'animate-bounce text-amber-300' : ''}`} />
            </button>
            <button
              onClick={handlePrint}
              title="Imprimir comprobante"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {/* Piece Overview Box */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Información de la Pieza
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-full">
                Estado: {movement.estadoEquipo}
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{movement.claseEquipo}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">Categoría: {movement.tipoEquipo}</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-200/80 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">Ancho</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{movement.ancho} cm</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">Largo</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{movement.largo} cm</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">Profundidad</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{movement.profundidad} cm</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">Cantidad</span>
                <span className="font-mono font-black text-amber-700 dark:text-amber-400 text-sm">{movement.cantidad} und</span>
              </div>
            </div>
          </div>

          {/* Logistic & Responsible Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-amber-600" />
                {isEntrada ? 'Procedencia (Origen / Proveedor)' : 'Destino (Cliente / Obra)'}
              </span>
              <div className="font-bold text-slate-900 dark:text-white">{movement.procedenciaDestino}</div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-amber-600" />
                Responsable del Traslado / Conductor
              </span>
              <div className="font-bold text-slate-900 dark:text-white">{movement.responsable}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{movement.contactoResponsable || 'Sin contacto'}</div>
            </div>
          </div>

          {/* Volume & Balance */}
          <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-indigo-700 dark:text-indigo-400 font-bold uppercase">Cubicaje Calculado</span>
              <div className="font-mono font-extrabold text-indigo-950">{volumenM3.toFixed(4)} m³</div>
            </div>
            {movement.saldoResultante !== undefined && (
              <div className="text-right">
                <span className="text-[10px] text-indigo-700 dark:text-indigo-400 font-bold uppercase">Saldo Resultante</span>
                <div className="font-mono font-extrabold text-indigo-950">{movement.saldoResultante} unidades</div>
              </div>
            )}
          </div>

          {/* Observations */}
          {movement.observaciones && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Observaciones y Notas de Remisión
              </span>
              <p className="text-slate-800 dark:text-slate-100 italic">{movement.observaciones}</p>
            </div>
          )}

          {/* Audit Footer */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Registrado por: {movement.creadoPor?.nombre || 'Sistema'}</span>
            <span>{new Date(movement.fecha).toLocaleString('es-CO')}</span>
          </div>

          {/* Print Action / Close */}
          <div className="pt-2 flex items-center justify-end gap-2 print:hidden">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cerrar Detalle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
