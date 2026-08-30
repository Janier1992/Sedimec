import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  AlertTriangle,
  Mic,
  Info,
  ChevronDown,
  ChevronUp,
  Sliders
} from 'lucide-react';
import { Movimiento, TipoMovimiento, EstadoEquipo, ItemInventario, UnidadMedida, ParsedVoiceMovement } from '../types';

interface MovementFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Movimiento>) => Promise<void>;
  initialTipo?: TipoMovimiento;
  initialItem?: ItemInventario | null;
  /** Campos ya extraídos por el asistente de voz -- tiene prioridad sobre initialItem. */
  initialParsedVoice?: ParsedVoiceMovement | null;
  inventoryItems: ItemInventario[];
  onOpenVoiceModal: () => void;
  onOpenDiagramGenerator: (info: {
    tipoEquipo: string;
    claseEquipo: string;
    ancho: number;
    largo: number;
    profundidad: number;
    estadoEquipo: string;
  }) => void;
}

const COMMON_TIPOS = [
  'Estructura Metálica',
  'Perfil Estructural',
  'Chapa / Plancha',
  'Soportes y Anclajes',
  'Tubo / Tubería',
  'Accesorio / Misceláneo',
];

const COMMON_CLASES = [
  'Viga IPE 300',
  'Viga IPE 200',
  'Viga HEA 200',
  'Tubo Rectangular 100x50',
  'Tubo Cuadrado 100x100',
  'Plancha Estructural A36',
  'Ángulo Estructural 2x2x1/4',
  'Canal U 150x50',
  'Soporte Base Columna 400x400',
];

export const MovementFormModal: React.FC<MovementFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialTipo = 'Entrada',
  initialItem = null,
  initialParsedVoice = null,
  inventoryItems,
  onOpenVoiceModal,
  onOpenDiagramGenerator,
}) => {
  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimiento>(initialTipo);
  const [tipoEquipo, setTipoEquipo] = useState<string>('');
  const [claseEquipo, setClaseEquipo] = useState<string>('');
  const [estadoEquipo, setEstadoEquipo] = useState<EstadoEquipo>('Bueno');
  const [unidadMedida, setUnidadMedida] = useState<UnidadMedida>('cm');
  const [ancho, setAncho] = useState<string>('20');
  const [largo, setLargo] = useState<string>('600');
  const [profundidad, setProfundidad] = useState<string>('15');
  const [cantidad, setCantidad] = useState<string>('1');
  const [procedenciaDestino, setProcedenciaDestino] = useState<string>('');
  const [responsable, setResponsable] = useState<string>('');
  const [contactoResponsable, setContactoResponsable] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');
  const [fecha, setFecha] = useState<string>(new Date().toISOString().slice(0, 16));
  const [showDetails, setShowDetails] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Sync initial properties if provided (dictado por voz > pieza de inventario > valores por defecto)
  useEffect(() => {
    if (isOpen) {
      setFecha(new Date().toISOString().slice(0, 16));
      setFormError(null);
      setUnidadMedida('cm');

      if (initialParsedVoice) {
        setTipoMovimiento(initialParsedVoice.tipoMovimiento);
        setTipoEquipo(initialParsedVoice.tipoEquipo);
        setClaseEquipo(initialParsedVoice.claseEquipo);
        setEstadoEquipo(initialParsedVoice.estadoEquipo as EstadoEquipo);
        setAncho(String(initialParsedVoice.ancho));
        setLargo(String(initialParsedVoice.largo));
        setProfundidad(String(initialParsedVoice.profundidad));
        setCantidad(String(initialParsedVoice.cantidad));
        setProcedenciaDestino(initialParsedVoice.procedenciaDestino);
        setResponsable(initialParsedVoice.responsable);
        setContactoResponsable(initialParsedVoice.contactoResponsable || '');
        setObservaciones(initialParsedVoice.observaciones || '');
        // Si la voz capturó contacto u observaciones, mostrar el detalle para que se revise
        setShowDetails(!!(initialParsedVoice.contactoResponsable || initialParsedVoice.observaciones));
      } else if (initialItem) {
        setTipoMovimiento(initialTipo);
        setTipoEquipo(initialItem.tipoEquipo);
        setClaseEquipo(initialItem.claseEquipo);
        setEstadoEquipo(initialItem.estadoEquipo);
        setAncho(String(initialItem.ancho));
        setLargo(String(initialItem.largo));
        setProfundidad(String(initialItem.profundidad));
        setCantidad('1');
        setProcedenciaDestino('');
        setResponsable('');
        setContactoResponsable('');
        setObservaciones('');
        setShowDetails(false);
      } else {
        setTipoMovimiento(initialTipo);
        setTipoEquipo('Estructura Metálica');
        setClaseEquipo('Viga IPE 300');
        setAncho('20');
        setLargo('600');
        setProfundidad('15');
        setCantidad('1');
        setProcedenciaDestino('');
        setResponsable('');
        setContactoResponsable('');
        setObservaciones('');
        setShowDetails(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialTipo, initialItem, initialParsedVoice]);

  // Compute matching inventory item and real-time available stock
  const currentStockInfo = useMemo(() => {
    const numAncho = parseFloat(ancho) || 0;
    const numLargo = parseFloat(largo) || 0;
    const numProfundidad = parseFloat(profundidad) || 0;

    const match = inventoryItems.find(
      (i) =>
        i.tipoEquipo.trim().toLowerCase() === tipoEquipo.trim().toLowerCase() &&
        i.claseEquipo.trim().toLowerCase() === claseEquipo.trim().toLowerCase() &&
        i.estadoEquipo === estadoEquipo &&
        Math.abs(i.ancho - numAncho) < 0.01 &&
        Math.abs(i.largo - numLargo) < 0.01 &&
        Math.abs(i.profundidad - numProfundidad) < 0.01
    );

    const saldoActual = match ? match.saldoActual : 0;
    const numCantidad = parseInt(cantidad, 10) || 0;
    const nuevoSaldo = tipoMovimiento === 'Entrada' ? saldoActual + numCantidad : saldoActual - numCantidad;
    const esInvalido = tipoMovimiento === 'Salida' && numCantidad > saldoActual;

    return {
      matchFound: !!match,
      saldoActual,
      nuevoSaldo,
      esInvalido,
    };
  }, [inventoryItems, tipoEquipo, claseEquipo, estadoEquipo, ancho, largo, profundidad, cantidad, tipoMovimiento]);

  // Calculate cubic volume according to the selected unit
  const volumenM3 = useMemo(() => {
    const w = parseFloat(ancho) || 0;
    const l = parseFloat(largo) || 0;
    const d = parseFloat(profundidad) || 0;
    const q = parseInt(cantidad, 10) || 1;

    let unitario = 0;
    const u = (unidadMedida || 'cm').toLowerCase();
    if (u === 'm' || u === 'metro' || u === 'metros') {
      unitario = w * l * d;
    } else if (u === 'mm' || u === 'milimetro' || u === 'milimetros') {
      unitario = (w * l * d) / 1000000000;
    } else if (u === 'in' || u === 'pulg' || u === 'pulgada' || u === 'pulgadas') {
      unitario = (w * 2.54 * l * 2.54 * d * 2.54) / 1000000;
    } else if (u === 'ft' || u === 'pie' || u === 'pies') {
      unitario = (w * 30.48 * l * 30.48 * d * 30.48) / 1000000;
    } else {
      // cm por defecto
      unitario = (w * l * d) / 1000000;
    }

    const total = unitario * q;
    return { unitario, total };
  }, [ancho, largo, profundidad, unidadMedida, cantidad]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const rawAncho = parseFloat(ancho);
    const rawLargo = parseFloat(largo);
    const rawProfundidad = parseFloat(profundidad);
    const numCantidad = Number(cantidad);

    if (!tipoEquipo.trim() || !claseEquipo.trim()) {
      setFormError('Debe ingresar el tipo y clase de equipo.');
      return;
    }

    if (isNaN(rawAncho) || rawAncho <= 0 || isNaN(rawLargo) || rawLargo <= 0 || isNaN(rawProfundidad) || rawProfundidad <= 0) {
      setFormError('Las dimensiones (ancho, largo, profundidad) deben ser números positivos mayores a cero (> 0). No se permiten valores negativos ni cero.');
      return;
    }

    if (isNaN(numCantidad) || numCantidad <= 0 || !Number.isInteger(numCantidad)) {
      setFormError('La cantidad debe ser un número entero positivo mayor a cero (ej. 1, 5, 20). No se admiten decimales ni valores negativos.');
      return;
    }

    if (!procedenciaDestino.trim()) {
      setFormError(
        tipoMovimiento === 'Entrada'
          ? 'Especifique la Procedencia / Proveedor de origen.'
          : 'Especifique el Destino / Cliente / Obra.'
      );
      return;
    }

    if (!responsable.trim()) {
      setFormError('Especifique el nombre del Responsable de la operación o transporte.');
      return;
    }

    // Critical validation
    if (tipoMovimiento === 'Salida' && currentStockInfo.esInvalido) {
      setFormError(
        `Operación denegada: Stock insuficiente. Hay ${currentStockInfo.saldoActual} unidades disponibles en patio y se intenta despachar ${numCantidad}. No se admiten saldos negativos.`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        fecha,
        tipoMovimiento,
        tipoEquipo: tipoEquipo.trim(),
        claseEquipo: claseEquipo.trim(),
        estadoEquipo,
        ancho: rawAncho,
        largo: rawLargo,
        profundidad: rawProfundidad,
        unidadMedida,
        cantidad: numCantidad,
        procedenciaDestino: procedenciaDestino.trim(),
        responsable: responsable.trim(),
        contactoResponsable: contactoResponsable.trim(),
        observaciones: observaciones.trim(),
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar movimiento';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-1.5 rounded-lg font-bold ${
                tipoMovimiento === 'Entrada' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-sky-500/20 text-sky-300'
              }`}
            >
              {tipoMovimiento === 'Entrada' ? (
                <ArrowDownLeft className="h-4 w-4" />
              ) : (
                <ArrowUpRight className="h-4 w-4" />
              )}
            </div>
            <h2 className="text-sm font-bold text-white tracking-tight">
              {tipoMovimiento === 'Entrada' ? 'Nueva Entrada' : 'Nueva Salida'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Movement Type Toggle */}
        <div className="px-5 pt-3 pb-2 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/70 rounded-xl">
            <button
              type="button"
              onClick={() => setTipoMovimiento('Entrada')}
              className={`py-1.5 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                tipoMovimiento === 'Entrada'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="h-3.5 w-3.5" />
              <span>ENTRADA</span>
            </button>
            <button
              type="button"
              onClick={() => setTipoMovimiento('Salida')}
              className={`py-1.5 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                tipoMovimiento === 'Salida'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>SALIDA</span>
            </button>
          </div>
        </div>

        {/* Prominent Voice CTA */}
        <div className="px-5 pt-3">
          <button
            type="button"
            onClick={onOpenVoiceModal}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-extrabold shadow-md shadow-violet-600/20 transition-all cursor-pointer"
          >
            <Mic className="h-4 w-4" />
            <span>Dictar por Voz en vez de escribir</span>
          </button>
        </div>

        {/* Stock Balance Banner for Salidas */}
        {tipoMovimiento === 'Salida' && (
          <div
            className={`mx-5 mt-3 px-3.5 py-2.5 rounded-xl border text-xs flex items-center justify-between ${
              currentStockInfo.esInvalido
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-sky-50 border-sky-200 text-sky-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span>Disponible: <strong>{currentStockInfo.saldoActual} und</strong></span>
            </div>
            {currentStockInfo.esInvalido ? (
              <span className="text-rose-600 font-black">Insuficiente</span>
            ) : (
              <span className="font-bold text-sky-700">Saldo tras esta salida: {currentStockInfo.nuevoSaldo} und</span>
            )}
          </div>
        )}

        {/* Voice Dictation Banner */}
        {initialParsedVoice && (
          <div className="mx-5 mt-3 p-2.5 bg-violet-50 border border-violet-200 rounded-xl text-violet-800 text-xs font-semibold flex items-center gap-2">
            <Mic className="h-3.5 w-3.5 shrink-0 text-violet-600" />
            <span>Campos completados por voz. Revisa y ajusta antes de guardar.</span>
          </div>
        )}

        {/* Error Alert */}
        {formError && (
          <div className="mx-5 mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
        )}

        {/* Form Body -- solo lo esencial visible por defecto */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 max-h-[65vh] overflow-y-auto">

          {/* Pieza: tipo + clase */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Tipo de Equipo</label>
              <input
                type="text"
                list="tipos-sugeridos"
                placeholder="ej: Estructura Metálica"
                value={tipoEquipo}
                onChange={(e) => setTipoEquipo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-none"
              />
              <datalist id="tipos-sugeridos">
                {COMMON_TIPOS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Clase / Referencia</label>
              <input
                type="text"
                list="clases-sugeridas"
                placeholder="ej: Viga IPE 300"
                value={claseEquipo}
                onChange={(e) => setClaseEquipo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-none"
              />
              <datalist id="clases-sugeridas">
                {COMMON_CLASES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Dimensiones + cantidad + estado, compacto */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-1">Ancho (cm)</label>
              <input
                type="number" step="any" required value={ancho} onChange={(e) => setAncho(e.target.value)}
                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-1">Largo (cm)</label>
              <input
                type="number" step="any" required value={largo} onChange={(e) => setLargo(e.target.value)}
                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-1">Prof. (cm)</label>
              <input
                type="number" step="any" required value={profundidad} onChange={(e) => setProfundidad(e.target.value)}
                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-1">Cantidad</label>
              <input
                type="number" step="1" required value={cantidad} onChange={(e) => setCantidad(e.target.value)}
                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-black text-amber-700 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 -mt-1.5">
            <span>Cubicaje total: <strong className="text-slate-600">{volumenM3.total.toFixed(3)} m³</strong></span>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-amber-700 hover:underline font-semibold cursor-pointer"
            >
              Cambiar unidad ({unidadMedida})
            </button>
          </div>

          {/* Estado + Procedencia/Destino + Responsable */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Estado del Equipo</label>
              <select
                value={estadoEquipo}
                onChange={(e) => setEstadoEquipo(e.target.value as EstadoEquipo)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-none"
              >
                <option value="Bueno">Bueno</option>
                <option value="Nuevo">Nuevo</option>
                <option value="Regular">Regular</option>
                <option value="Para Reparación">Para Reparación</option>
                <option value="En Mantenimiento">En Mantenimiento</option>
                <option value="Dañado">Dañado</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {tipoMovimiento === 'Entrada' ? 'Procedencia' : 'Destino'}
              </label>
              <input
                type="text"
                required
                placeholder={tipoMovimiento === 'Entrada' ? 'ej: Siderúrgica del Norte' : 'ej: Obra Puente Río Claro'}
                value={procedenciaDestino}
                onChange={(e) => setProcedenciaDestino(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Responsable</label>
            <input
              type="text"
              required
              placeholder="ej: Carlos Humberto Ruiz"
              value={responsable}
              onChange={(e) => setResponsable(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Detalles opcionales, colapsados por defecto */}
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5" />
              Detalles opcionales (fecha, contacto, observaciones, unidad)
            </span>
            {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showDetails && (
            <div className="space-y-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Fecha y Hora</label>
                  <input
                    type="datetime-local"
                    required
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Unidad de Medida</label>
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-200 text-[11px] font-bold">
                    {(['cm', 'm', 'mm', 'in', 'pie'] as UnidadMedida[]).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setUnidadMedida(u)}
                        className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                          unidadMedida === u ? 'bg-amber-600 text-white font-black' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Contacto del Responsable</label>
                  <input
                    type="text"
                    placeholder="ej: +57 312 458 9921"
                    value={contactoResponsable}
                    onChange={(e) => setContactoResponsable(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Observaciones</label>
                  <input
                    type="text"
                    placeholder="ej: Remisión #4582"
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  onOpenDiagramGenerator({
                    tipoEquipo: tipoEquipo || 'Estructura Metálica',
                    claseEquipo: claseEquipo || 'Viga IPE 300',
                    ancho: parseFloat(ancho) || 20,
                    largo: parseFloat(largo) || 600,
                    profundidad: parseFloat(profundidad) || 15,
                    estadoEquipo,
                  })
                }
                className="text-[11px] font-bold text-violet-700 hover:text-violet-900 flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Generar plano técnico CAD de esta pieza</span>
              </button>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (tipoMovimiento === 'Salida' && currentStockInfo.esInvalido)}
              className={`px-5 py-2 rounded-xl text-xs font-extrabold text-white shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                tipoMovimiento === 'Entrada'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                  : 'bg-sky-600 hover:bg-sky-500 shadow-sky-600/20'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSubmitting ? (
                <div className="h-4 w-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
              ) : tipoMovimiento === 'Entrada' ? (
                <ArrowDownLeft className="h-4 w-4" />
              ) : (
                <ArrowUpRight className="h-4 w-4" />
              )}
              <span>{isSubmitting ? 'Guardando...' : `Registrar ${tipoMovimiento}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
