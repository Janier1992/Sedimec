import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Download, 
  RefreshCw, 
  Maximize2, 
  Image as ImageIcon,
  Check,
  Layers,
  Box
} from 'lucide-react';
import { AspectRatioType } from '../types';
import { generatePieceDiagram } from '../services/api';

interface PieceDiagramGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  pieceInfo: {
    tipoEquipo: string;
    claseEquipo: string;
    ancho: number;
    largo: number;
    profundidad: number;
    estadoEquipo: string;
  } | null;
}

const ASPECT_RATIOS: { value: AspectRatioType; label: string; icon: string }[] = [
  { value: '1:1', label: '1:1 Cuadrado', icon: '■' },
  { value: '4:3', label: '4:3 Estándar', icon: '▭' },
  { value: '16:9', label: '16:9 Panorámico', icon: '▬' },
  { value: '21:9', label: '21:9 Ultra-Wide', icon: '━' },
  { value: '3:4', label: '3:4 Vertical', icon: '▯' },
  { value: '9:16', label: '9:16 Historia', icon: '▍' },
  { value: '3:2', label: '3:2 Foto', icon: '▭' },
  { value: '2:3', label: '2:3 Retrato', icon: '▯' },
];

export const PieceDiagramGeneratorModal: React.FC<PieceDiagramGeneratorModalProps> = ({
  isOpen,
  onClose,
  pieceInfo,
}) => {
  const [aspectRatio, setAspectRatio] = useState<AspectRatioType>('16:9');
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);

      const res = await generatePieceDiagram({
        aspectRatio,
        prompt: customPrompt.trim() || undefined,
        piezaInfo: pieceInfo || undefined,
      });

      setGeneratedImage(res.imageUrl);
    } catch (err: unknown) {
      console.error('Error generating diagram:', err);
      const msg = err instanceof Error ? err.message : 'Error al generar la imagen con IA';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const a = document.createElement('a');
    a.href = generatedImage;
    a.download = `Sedimec_${pieceInfo?.claseEquipo || 'Plano'}_${aspectRatio}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Generador de Planos Técnicos & Diagramas 3D
              </h2>
              <p className="text-xs text-indigo-200">
                Renderizado de piezas industriales con control de Aspect Ratio
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {/* Piece Context Badge */}
          {pieceInfo && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Box className="h-4 w-4 text-amber-600" />
                <span className="font-bold text-slate-900 dark:text-white">{pieceInfo.claseEquipo}</span>
                <span className="text-slate-500 dark:text-slate-400">({pieceInfo.tipoEquipo})</span>
              </div>
              <div className="font-mono text-slate-600 dark:text-slate-400">
                {pieceInfo.ancho} × {pieceInfo.largo} × {pieceInfo.profundidad} cm
              </div>
            </div>
          )}

          {/* Aspect Ratio Selector (Required Feature) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Seleccionar Proporción de Imagen (Aspect Ratio)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ASPECT_RATIOS.map((ratio) => {
                const isSelected = aspectRatio === ratio.value;
                return (
                  <button
                    key={ratio.value}
                    type="button"
                    onClick={() => setAspectRatio(ratio.value)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{ratio.icon}</span>
                    <span>{ratio.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Prompt Override */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Instrucciones adicionales para el plano (Opcional)
            </label>
            <input
              type="text"
              placeholder="ej: Vista isométrica con cotas y acabado galvanizado industrial..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
            />
          </div>

          {/* Error Notice */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-700 dark:text-rose-400 font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Generated Image Result Display */}
          {generatedImage && (
            <div className="space-y-2">
              <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 max-h-72 flex items-center justify-center">
                <img
                  src={generatedImage}
                  alt="Plano técnico generado"
                  referrerPolicy="no-referrer"
                  className="max-h-72 object-contain w-full"
                />
                <span className="absolute top-2 right-2 px-2 py-0.5 bg-slate-950/80 text-white font-mono text-[10px] rounded-md backdrop-blur-xs">
                  {aspectRatio}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Descargar Imagen</span>
                </button>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cerrar
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={handleGenerate}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <div className="h-4 w-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 text-amber-300" />
              )}
              <span>{isLoading ? 'Generando plano 3D...' : 'Generar Plano con IA'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
