import React, { useState } from 'react';
import { 
  Sparkles, 
  Mic, 
  Search, 
  ShieldCheck, 
  Mail, 
  Layers, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  X,
  Volume2,
  Sliders,
  FileSpreadsheet,
  PlayCircle,
  ExternalLink
} from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenVoiceAssistant?: () => void;
  onOpenIntegrityCheck?: () => void;
  onNavigateToInventory?: () => void;
  onOpenThresholdsModal?: () => void;
}

const SAMPLE_VOICE_COMMANDS = [
  'Llegaron 25 vigas IPE 300 de 15 por 600 por 30 cm en buen estado de Siderúrgica del Norte, entregó Carlos Ruiz.',
  'Registrar salida de 8 tubos rectangulares 100x50 para la Obra Puente Río Claro, responsable David Ospina.',
  'Entrada de 30 planchas estructurales A36 de 120 por 240 por 1.2 cm de Aceros del Valle, responsable Hernando Caicedo.',
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onOpenVoiceAssistant,
  onOpenIntegrityCheck,
  onNavigateToInventory,
  onOpenThresholdsModal,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      title: 'Bienvenido a Sedimec',
      subtitle: 'Plataforma Inteligente de Gestión de Patio y Trazabilidad',
      badge: 'Paso 1 de 3',
      icon: <Layers className="w-8 h-8 text-amber-400" />,
      content: (
        <div className="space-y-4">
          <p className="text-slate-300 text-sm leading-relaxed">
            Sedimec centraliza el control de existencias, cubicaje volumétrico tridimensional y balance en tiempo real (
            <span className="font-semibold text-amber-400">Saldo = Σ Entradas - Σ Salidas</span>) para materiales y estructuras metálicas.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Cubicaje Automatizado</h4>
                <p className="text-xs text-slate-400 mt-0.5">Cálculo exacto de volumen unitario y total en m³ a partir de medidas estandarizadas en cm.</p>
              </div>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Exportación Oficial</h4>
                <p className="text-xs text-slate-400 mt-0.5">Descarga en 1 clic de reportes en Excel (.xlsx) y CSV con formato estándar de la empresa.</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Registro por Voz con IA Gemini',
      subtitle: 'Captura movimientos en segundos sin teclear',
      badge: 'Paso 2 de 3',
      icon: <Mic className="w-8 h-8 text-amber-400" />,
      content: (
        <div className="space-y-4">
          <p className="text-slate-300 text-sm leading-relaxed">
            Utiliza el dictado por voz para registrar entradas o salidas directamente en el patio de operaciones con modelos Gemini integrados.
          </p>

          <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                <Volume2 className="w-4 h-4" />
                <span>Ejemplos listos para probar:</span>
              </div>
              <span className="text-[10px] text-amber-300/80 font-mono">gemini-3.5-transcribe</span>
            </div>

            <div className="space-y-2">
              {SAMPLE_VOICE_COMMANDS.map((cmd, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    onClose();
                    if (onOpenVoiceAssistant) {
                      onOpenVoiceAssistant();
                    }
                  }}
                  className="p-2.5 bg-slate-950/80 hover:bg-amber-950/30 border border-slate-800 hover:border-amber-500/40 rounded-lg text-xs font-mono text-slate-200 cursor-pointer transition-all flex items-start gap-2 group"
                >
                  <PlayCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <span className="flex-1 italic">"{cmd}"</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>El motor IA extrae automáticamente dimensiones, cantidades, proveedor y responsable.</span>
            </div>
          </div>

          <button
            id="onboarding-try-voice-btn"
            type="button"
            onClick={() => {
              onClose();
              if (onOpenVoiceAssistant) {
                onOpenVoiceAssistant();
              }
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <Mic className="w-4 h-4" />
            <span>Abrir Asistente de Voz Ahora</span>
          </button>
        </div>
      ),
    },
    {
      title: 'Funcionalidades y Supervisión Activa',
      subtitle: 'Herramientas interactivas listas para usar',
      badge: 'Paso 3 de 3',
      icon: <ShieldCheck className="w-8 h-8 text-emerald-400" />,
      content: (
        <div className="space-y-3.5">
          <p className="text-slate-300 text-xs leading-relaxed">
            Todas las herramientas operativas están totalmente funcionales. Haz clic en cualquiera para abrirla de inmediato:
          </p>
          
          <div className="space-y-2.5">
            {/* Feature 1: Inventory Search */}
            <div className="bg-slate-900/80 border border-slate-800 hover:border-sky-500/40 rounded-xl p-3 flex items-center justify-between gap-3 transition-colors">
              <div className="flex items-start gap-2.5">
                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 shrink-0">
                  <Search className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Búsqueda y Filtros Rápidos</h4>
                  <p className="text-[11px] text-slate-400">Localiza cualquier pieza por referencia, tipo, estado o medidas en patio.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onNavigateToInventory) onNavigateToInventory();
                }}
                className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] rounded-lg shrink-0 flex items-center gap-1 transition-all cursor-pointer"
              >
                <span>Ir</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {/* Feature 2: Email Alerts & Thresholds */}
            <div className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 rounded-xl p-3 flex items-center justify-between gap-3 transition-colors">
              <div className="flex items-start gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Alertas por Correo (Nodemailer)</h4>
                  <p className="text-[11px] text-slate-400">Notificaciones automáticas y configuración de umbrales mínimos.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenThresholdsModal) onOpenThresholdsModal();
                }}
                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] rounded-lg shrink-0 flex items-center gap-1 transition-all cursor-pointer"
              >
                <span>Configurar</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {/* Feature 3: Integrity Audit & Reconciliation */}
            <div className="bg-slate-900/80 border border-emerald-500/30 hover:border-emerald-500/60 rounded-xl p-3 flex items-center justify-between gap-3 transition-colors">
              <div className="flex items-start gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Auditoría y Conciliación</h4>
                  <p className="text-[11px] text-slate-400">Cruza movimientos con existencias y repara inconsistencias con 1 clic.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenIntegrityCheck) onOpenIntegrityCheck();
                }}
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg shrink-0 flex items-center gap-1 transition-all cursor-pointer"
              >
                <span>Auditar</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      localStorage.setItem('sedimec_onboarding_completed', 'true');
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('sedimec_onboarding_completed', 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
              {steps[currentStep].icon}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 px-2 py-0.5 bg-amber-500/10 rounded-full border border-amber-500/20">
                {steps[currentStep].badge}
              </span>
              <h3 className="text-lg font-bold text-white mt-1">
                {steps[currentStep].title}
              </h3>
            </div>
          </div>
          <button
            id="onboarding-close-btn"
            onClick={handleDismiss}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Cerrar guía"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subtitle */}
        <div className="px-6 py-2 bg-slate-950/50 border-b border-slate-800/80">
          <p className="text-xs font-medium text-amber-300/80">
            {steps[currentStep].subtitle}
          </p>
        </div>

        {/* Content Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {steps[currentStep].content}
        </div>

        {/* Footer & Navigation */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === currentStep ? 'w-6 bg-amber-500' : 'w-2 bg-slate-700 hover:bg-slate-600'
                }`}
                title={`Paso ${idx + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                id="onboarding-prev-btn"
                onClick={handlePrev}
                className="py-2 px-3 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Anterior
              </button>
            )}
            <button
              id="onboarding-next-btn"
              onClick={handleNext}
              className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              {currentStep === steps.length - 1 ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Comenzar
                </>
              ) : (
                <>
                  Siguiente
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
