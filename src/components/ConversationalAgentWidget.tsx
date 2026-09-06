import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot,
  X,
  Send,
  Volume2,
  VolumeX, 
  Copy, 
  Check, 
  RotateCcw, 
  Mic, 
  Square, 
  Maximize2,
  Minimize2,
  Package,
  HelpCircle
} from 'lucide-react';
import Markdown from 'react-markdown';
import { askConversationalAgent, ChatMessage, generateTtsSpeech } from '../services/api';
import { playTtsAudio } from '../utils/audio';
import { useTheme } from '../context/ThemeContext';

interface ConversationalAgentWidgetProps {
  onNavigateToTab?: (tab: 'dashboard' | 'inventario' | 'movimientos') => void;
  onOpenVoiceMovementModal?: () => void;
  onOpenThresholdsModal?: () => void;
  onOpenNewMovement?: (tipo: 'Entrada' | 'Salida') => void;
}

const DEFAULT_QUESTIONS = [
  { label: 'Resumen de stock en patio', prompt: 'Dame un resumen de las existencias actuales de materiales en patio y el cubicaje total en metros cúbicos.' },
  { label: 'Piezas en nivel crítico', prompt: '¿Cuáles piezas están actualmente en nivel crítico o por debajo de su umbral mínimo?' },
  { label: 'Últimos movimientos', prompt: '¿Cuáles fueron los últimos movimientos de entrada y salida registrados?' },
  { label: 'Integridad y balance', prompt: '¿Cómo está la integridad del inventario? ¿Existe algún descuadre?' },
  { label: '¿Cómo dictar por voz?', prompt: 'Explícame paso a paso cómo registrar una entrada o salida usando el asistente de voz.' },
];

export const ConversationalAgentWidget: React.FC<ConversationalAgentWidgetProps> = ({
  onNavigateToTab,
  onOpenVoiceMovementModal,
  onOpenThresholdsModal,
  onOpenNewMovement,
}) => {
  const { isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'model',
      text: '¡Hola! Soy el asistente virtual de Sedimec S.A. Estoy conectado en tiempo real al inventario de patio, balance de existencias, cálculo de cubicaje en m³ e historial de movimientos. ¿En qué te puedo colaborar hoy?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [liveMetrics, setLiveMetrics] = useState<{
    totalUnits?: number;
    totalVolumeM3?: number;
    lowStockCount?: number;
    totalMovements?: number;
  }>({});

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [playingTtsId, setPlayingTtsId] = useState<string | null>(null);
  const [isRecordingDictation, setIsRecordingDictation] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Build conversation history excluding errors
      const history = messages
        .filter((m) => !m.isError)
        .slice(-6)
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      const res = await askConversationalAgent(query, history);

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'model',
        text: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
      if (res.metrics) {
        setLiveMetrics(res.metrics);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Error consultando al Agente Sedimec';
      const errorBotMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        text: `⚠️ **Ocurrió un error al procesar tu consulta:** ${errMsg}. Por favor verifica la conexión e intenta de nuevo.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
      setMessages((prev) => [...prev, errorBotMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePlayTts = async (id: string, text: string) => {
    if (playingTtsId === id) {
      setPlayingTtsId(null);
      return;
    }

    try {
      setPlayingTtsId(id);
      // Clean markdown tags for audio speaking
      const cleanText = text.replace(/[*_#`[\]()]/g, '').slice(0, 400);
      const { base64Audio } = await generateTtsSpeech(cleanText, 'Kore');
      await playTtsAudio(base64Audio);
    } catch (err) {
      console.warn('TTS playback error, falling back to browser speech synthesis:', err);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const cleanText = text.replace(/[*_#`[\]()]/g, '').slice(0, 300);
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'es-ES';
        utterance.onend = () => setPlayingTtsId(null);
        utterance.onerror = () => setPlayingTtsId(null);
        window.speechSynthesis.speak(utterance);
        return;
      }
    } finally {
      setPlayingTtsId(null);
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'model',
        text: '¡Conversación reiniciada! ¿Qué deseas consultar sobre el estado operativo, existencias o reglas de negocio de Sedimec?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Direct Browser Speech Dictation for Chat Input
  const toggleVoiceDictation = () => {
    if (isRecordingDictation) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecordingDictation(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Tu navegador no soporta reconocimiento de voz nativo en el chat. Puedes usar los ejemplos predefinidos o escribir tu pregunta.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-CO';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsRecordingDictation(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsRecordingDictation(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error in chat:', event.error);
        setIsRecordingDictation(false);
        if (event.error === 'not-allowed') {
          alert(
            'El navegador bloqueó el acceso al micrófono para este sitio. Haz clic en el ícono de candado 🔒 junto a la URL, cambia "Micrófono" a "Permitir" y recarga la página.'
          );
        }
      };

      recognition.onend = () => {
        setIsRecordingDictation(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      setIsRecordingDictation(false);
    }
  };

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <div className="fixed bottom-5 right-5 z-40">
        {!isOpen && (
          <button
            id="fab-sedimec-agent-btn"
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Abrir Agente Inteligente Sedimec"
            title="Agente Sedimec IA en Tiempo Real"
            className="group relative flex items-center justify-center h-14 w-14 bg-gradient-to-br from-slate-900 to-amber-950 text-white rounded-full border border-amber-500/40 shadow-2xl shadow-amber-950/40 hover:border-amber-400 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
          >
            {/* Pulse Indicator */}
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 ring-2 ring-slate-950" />
            </span>

            <Bot className="w-6 h-6 text-amber-400 group-hover:rotate-12 transition-transform" />
          </button>
        )}
      </div>

      {/* Chat Window Dialog */}
      {isOpen && (
        <div 
          className={`fixed z-50 transition-all duration-300 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden ${
            isExpanded
              ? 'inset-4 sm:inset-10'
              : 'bottom-5 right-5 w-[88vw] sm:w-[360px] h-[560px] max-h-[80vh]'
          }`}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-slate-900 dark:bg-slate-950 border-b border-slate-800 flex items-center justify-between text-white shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl relative">
                <Bot className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-slate-950" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white tracking-tight">
                  Asistente Sedimec
                </h3>
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  Conectado al inventario en tiempo real
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleResetChat}
                title="Reiniciar conversación"
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Restaurar tamaño' : 'Maximizar'}
                className="hidden sm:block p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Minimizar agente"
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Live System Metrics Bar */}
          {(liveMetrics.totalUnits !== undefined || liveMetrics.totalVolumeM3 !== undefined) && (
            <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800/80 flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-400 shrink-0 overflow-x-auto">
              <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-semibold">
                <Package className="w-3 h-3 text-amber-500" />
                <span>Patio</span>
              </span>
              {liveMetrics.totalUnits !== undefined && (
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  <strong className="text-amber-600 dark:text-amber-400">{liveMetrics.totalUnits}</strong> unds
                </span>
              )}
              {liveMetrics.totalVolumeM3 !== undefined && (
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  <strong className="text-sky-600 dark:text-sky-400">{liveMetrics.totalVolumeM3}</strong> m³
                </span>
              )}
            </div>
          )}

          {/* Chat Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-100/70 dark:bg-slate-900/95">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 px-1">
                    <span className="font-bold">{isUser ? 'Tú' : 'Agente Sedimec'}</span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <div
                    className={`relative group max-w-[88%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                      isUser
                        ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-xs shadow-md shadow-amber-500/10'
                        : msg.isError
                        ? 'bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800/80 text-rose-900 dark:text-rose-200 rounded-tl-xs'
                        : 'bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 rounded-tl-xs shadow-sm dark:shadow-md dark:shadow-slate-950/20'
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    ) : (
                      <div className="markdown-body prose dark:prose-invert prose-xs max-w-none text-slate-800 dark:text-slate-200 leading-relaxed">
                        <Markdown>{msg.text}</Markdown>
                      </div>
                    )}

                    {/* Action Bar on Bot Messages */}
                    {!isUser && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700/50 flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyText(msg.id, msg.text)}
                            className="hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
                            title="Copiar respuesta"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span className="text-emerald-500 font-semibold">Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copiar</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePlayTts(msg.id, msg.text)}
                            className="hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
                            title="Escuchar con Gemini TTS"
                          >
                            {playingTtsId === msg.id ? (
                              <>
                                <VolumeX className="w-3 h-3 text-amber-500 animate-pulse" />
                                <span className="text-amber-500 font-semibold">Reproduciendo...</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3 h-3" />
                                <span>Escuchar</span>
                              </>
                            )}
                          </button>
                        </div>

                        <span className="text-[9px] text-slate-400">Sedimec IA</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-start gap-2">
                <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl rounded-tl-xs p-3 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-300 shadow-sm">
                  <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <span className="font-semibold">Consultando inventario y generando respuesta...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Chips */}
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 shrink-0 overflow-x-auto">
            <div className="flex items-center gap-1.5 pb-0.5">
              <span className="text-[10px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
                <HelpCircle className="w-3 h-3 text-amber-500" />
                Preguntas rápidas:
              </span>
              {DEFAULT_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(q.prompt)}
                  disabled={isLoading}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/80 hover:border-amber-500/40 text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 disabled:opacity-50 shadow-xs"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 shrink-0"
          >
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1 flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Pregunta sobre existencias, despachos, reglas o estado..."
                  disabled={isLoading}
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-amber-500 transition-colors disabled:opacity-50"
                />

                {/* Voice Dictation Button inside chat input */}
                <button
                  type="button"
                  onClick={toggleVoiceDictation}
                  title={isRecordingDictation ? 'Detener dictado' : 'Dictar pregunta por voz'}
                  className={`absolute right-2 p-1.5 rounded-lg transition-all cursor-pointer ${
                    isRecordingDictation
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {isRecordingDictation ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="p-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold rounded-xl shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                title="Enviar mensaje"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
