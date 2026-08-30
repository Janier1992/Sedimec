import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Mic, 
  Square, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Check, 
  AlertTriangle, 
  ArrowDownLeft, 
  ArrowUpRight,
  RefreshCw,
  Edit3,
  Bot,
  HelpCircle
} from 'lucide-react';
import { ParsedVoiceMovement } from '../types';
import { AudioRecorder, playTtsAudio } from '../utils/audio';
import { transcribeAudio, parseVoiceText, generateTtsSpeech } from '../services/api';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Abre el formulario de Entrada/Salida con estos campos ya diligenciados para revisión/edición. */
  onReviewInForm: (parsed: ParsedVoiceMovement, rawTranscript: string) => void;
}

const SAMPLE_VOICE_PROMPTS = [
  'Registrar entrada de 15 vigas, clase Viga IPE 300, ancho 15, largo 600, profundidad 30, estado bueno, procedencia Siderúrgica del Norte, responsable Carlos Ruiz, teléfono 3124589921',
  'Registrar salida de 5 tubos, clase Tubo Rectangular 100x50, ancho 10, largo 600, profundidad 5, estado nuevo, destino Obra Puente Río Claro, responsable David Ospina',
  'Registrar entrada de 20 planchas estructurales A36, ancho 120, largo 240, profundidad 1.2, estado bueno, procedencia Aceros del Valle, responsable Hernando Caicedo',
];

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  onReviewInForm,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'idle' | 'recording' | 'processing' | 'review'>('idle');
  const [rawTranscript, setRawTranscript] = useState('');
  const [parsedData, setParsedData] = useState<ParsedVoiceMovement | null>(null);
  const [validationAlerts, setValidationAlerts] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlayingTts, setIsPlayingTts] = useState(false);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      handleReset();
    }
  }, [isOpen]);

  const handleReset = () => {
    if (recorderRef.current) {
      recorderRef.current.cancel();
      recorderRef.current = null;
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    setIsLoading(false);
    setStep('idle');
    setRawTranscript('');
    setParsedData(null);
    setValidationAlerts([]);
    setErrorMessage(null);
  };

  const startRecording = async () => {
    try {
      setErrorMessage(null);
      const recorder = new AudioRecorder();
      recorderRef.current = recorder;
      await recorder.start();

      setIsRecording(true);
      setRecordingSeconds(0);
      setStep('recording');

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      console.warn('Error accediendo a MediaRecorder:', err);
      // Fallback to browser SpeechRecognition if MediaRecorder is blocked
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        try {
          const rec = new SpeechRec();
          rec.lang = 'es-CO';
          rec.continuous = false;
          rec.interimResults = false;
          setIsRecording(true);
          setStep('recording');

          rec.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setIsRecording(false);
            processDirectText(transcript);
          };
          rec.onerror = (e: any) => {
            console.error('Speech recognition error:', e);
            setIsRecording(false);
            setStep('idle');
            setErrorMessage('No se pudo capturar audio por micrófono. Puedes seleccionar uno de los ejemplos directos para probar.');
          };
          rec.onend = () => {
            setIsRecording(false);
          };
          rec.start();
          return;
        } catch (recErr) {
          console.error('SpeechRec error:', recErr);
        }
      }
      setErrorMessage('No se pudo acceder al micrófono. Verifique los permisos del navegador o utilice los ejemplos directos a continuación.');
      setStep('idle');
    }
  };

  const stopRecordingAndProcess = async () => {
    if (!recorderRef.current) return;

    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsRecording(false);
    setStep('processing');
    setIsLoading(true);

    try {
      // 1. Get base64 audio
      const { base64Audio, mimeType } = await recorderRef.current.stop();
      recorderRef.current = null;

      // 2. Transcribe audio using gemini-3.5-transcribe
      const { transcript } = await transcribeAudio(base64Audio, mimeType);
      setRawTranscript(transcript);

      // 3. Parse into typed JSON using gemini-3.7-flash
      const parseResult = await parseVoiceText(transcript);
      setParsedData(parseResult.parsed);
      setValidationAlerts(parseResult.alertasValidacion || []);
      setStep('review');

      // 4. Play spoken feedback confirmation using gemini-3.1-flash-tts-preview
      try {
        const ttsText = `Comando interpretado: ${parseResult.parsed.tipoMovimiento} de ${parseResult.parsed.cantidad} unidades de ${parseResult.parsed.claseEquipo}. Verifique los datos en pantalla para confirmar.`;
        handlePlayTts(ttsText);
      } catch {
        // Non-blocking TTS
      }
    } catch (err: unknown) {
      console.error('Error procesando audio:', err);
      const msg = err instanceof Error ? err.message : 'Error al procesar el dictado';
      setErrorMessage(msg);
      setStep('idle');
    } finally {
      setIsLoading(false);
    }
  };

  // Direct text processing (for sample prompts or typing)
  const processDirectText = async (text: string) => {
    setIsLoading(true);
    setStep('processing');
    setErrorMessage(null);
    setRawTranscript(text);

    try {
      const parseResult = await parseVoiceText(text);
      setParsedData(parseResult.parsed);
      setValidationAlerts(parseResult.alertasValidacion || []);
      setStep('review');

      const ttsText = `Comando interpretado: ${parseResult.parsed.tipoMovimiento} de ${parseResult.parsed.cantidad} unidades de ${parseResult.parsed.claseEquipo}.`;
      handlePlayTts(ttsText);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al estructurar el texto';
      setErrorMessage(msg);
      setStep('idle');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayTts = async (text: string) => {
    try {
      setIsPlayingTts(true);
      const { base64Audio } = await generateTtsSpeech(text, 'Kore');
      await playTtsAudio(base64Audio);
    } catch (err) {
      console.error('TTS playback error:', err);
    } finally {
      setIsPlayingTts(false);
    }
  };

  const handleConfirm = () => {
    if (!parsedData) return;
    onReviewInForm(parsedData, rawTranscript);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-300 rounded-xl">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Asistente de Voz Inteligente Sedimec
              </h2>
              <p className="text-xs text-amber-200/90">
                Transcripción con gemini-3.5-transcribe + Estructuración IA
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

        {/* Modal Content */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: IDLE / RECORDING */}
          {step === 'idle' || step === 'recording' ? (
            <div className="space-y-6 text-center py-4">
              <div className="flex flex-col items-center justify-center">
                <button
                  type="button"
                  onClick={isRecording ? stopRecordingAndProcess : startRecording}
                  className={`h-24 w-24 rounded-full flex items-center justify-center shadow-xl transition-all cursor-pointer ${
                    isRecording
                      ? 'bg-rose-600 text-white animate-pulse ring-8 ring-rose-500/30'
                      : 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white hover:scale-105 ring-8 ring-indigo-500/10'
                  }`}
                >
                  {isRecording ? (
                    <Square className="h-10 w-10 fill-current" />
                  ) : (
                    <Mic className="h-10 w-10" />
                  )}
                </button>

                <div className="mt-4">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                    {isRecording ? `Grabando audio... ${recordingSeconds}s` : 'Presione para hablar'}
                  </span>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    {isRecording
                      ? 'Dicte el tipo de movimiento, pieza, dimensiones en cm, cantidad, procedencia y responsable.'
                      : 'Utilice el micrófono para ingresar movimientos rápidamente sin teclear.'}
                  </p>
                </div>
              </div>

              {/* Sample Quick Voice Prompts */}
              <div className="pt-4 border-t border-slate-100 text-left">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-2">
                  <HelpCircle className="h-3.5 w-3.5" />
                  O pruebe con estos ejemplos con 1 clic:
                </span>
                <div className="space-y-1.5">
                  {SAMPLE_VOICE_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => processDirectText(prompt)}
                      className="w-full text-left p-2 bg-slate-50 hover:bg-violet-50 hover:border-violet-200 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium transition-all cursor-pointer truncate"
                    >
                      <span className="text-violet-600 font-bold mr-1.5">Ej {idx + 1}:</span>
                      "{prompt}"
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {/* STEP 2: PROCESSING */}
          {step === 'processing' && (
            <div className="py-12 text-center space-y-4">
              <div className="relative inline-flex">
                <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 animate-spin">
                  <RefreshCw className="h-8 w-8" />
                </div>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Transcribiendo y Extrayendo Datos...
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Procesando con <span className="font-mono text-violet-700 font-bold">gemini-3.5-transcribe</span> y esquema JSON estructurado
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW & CONFIRM */}
          {step === 'review' && parsedData && (
            <div className="space-y-4">
              {/* Transcript Speech Bubble */}
              <div className="p-3 bg-violet-50/70 border border-violet-200/70 rounded-xl">
                <div className="flex items-center justify-between text-[11px] font-bold text-violet-900 mb-1">
                  <span>Transcripción de Voz:</span>
                  <button
                    onClick={() => handlePlayTts(rawTranscript)}
                    className="flex items-center gap-1 text-violet-700 hover:text-violet-900 cursor-pointer"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    <span>Escuchar</span>
                  </button>
                </div>
                <p className="text-xs text-slate-800 italic">"{rawTranscript}"</p>
              </div>

              {/* Parsed Attributes Card */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                        parsedData.tipoMovimiento === 'Entrada'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {parsedData.tipoMovimiento}
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      {parsedData.claseEquipo} ({parsedData.tipoEquipo})
                    </span>
                  </div>
                  <span className="text-xs font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg">
                    {parsedData.cantidad} unidades
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-semibold">Dimensiones</span>
                    <span className="font-mono font-bold">
                      {parsedData.ancho} × {parsedData.largo} × {parsedData.profundidad} cm
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-semibold">Estado</span>
                    <span className="font-bold">{parsedData.estadoEquipo}</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-semibold">
                      {parsedData.tipoMovimiento === 'Entrada' ? 'Procedencia' : 'Destino'}
                    </span>
                    <span className="font-bold truncate block">{parsedData.procedenciaDestino}</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-semibold">Responsable</span>
                    <span className="font-bold truncate block">{parsedData.responsable}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Dictar de nuevo
                </button>

                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex-1 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>Revisar y Confirmar en Formulario</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
