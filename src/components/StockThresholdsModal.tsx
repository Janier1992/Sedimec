import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Mail,
  Send,
  BellRing,
  ShieldAlert,
  RefreshCw,
  Info,
  Clock,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { UmbralStockConfig, AlertaStockEmail, UserProfile, ItemInventario } from '../types';
import {
  fetchThresholds,
  saveThreshold,
  deleteThreshold,
  fetchStockNotifications,
  sendStockAlertEmail,
  fetchNotificationSettings,
  updateNotificationSettings,
  sendTestEmailNotification
} from '../services/api';

interface StockThresholdsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  inventoryItems: ItemInventario[];
  onThresholdsUpdated?: () => void;
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

export const StockThresholdsModal: React.FC<StockThresholdsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  inventoryItems,
  onThresholdsUpdated,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'umbrales' | 'notificaciones'>('umbrales');
  const [thresholds, setThresholds] = useState<
    Array<UmbralStockConfig & { saldoActualEnPatio: number; estaBajoUmbral: boolean }>
  >([]);
  const [notifications, setNotifications] = useState<AlertaStockEmail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state to add or edit threshold
  const [tipoEquipo, setTipoEquipo] = useState('Estructura Metálica');
  const [claseEquipo, setClaseEquipo] = useState('Viga IPE 300');
  const [umbralMinimo, setUmbralMinimo] = useState<number>(10);
  const [isSaving, setIsSaving] = useState(false);

  // Manual email test state
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);

  // Notification settings state (destinatarios, remitente, activación)
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [senderName, setSenderName] = useState('');
  const [newRecipient, setNewRecipient] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const isAdmin = currentUser.rol === 'admin';

  const loadThresholdsData = async () => {
    try {
      setIsLoading(true);
      const [threshRes, notifRes, settingsRes] = await Promise.all([
        fetchThresholds(),
        fetchStockNotifications(),
        fetchNotificationSettings(),
      ]);
      setThresholds(threshRes.analisis || []);
      setNotifications(notifRes.data || []);
      setNotifEnabled(settingsRes.settings.enabled);
      setRecipients(settingsRes.settings.recipients || []);
      setSenderName(settingsRes.settings.senderName || '');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar umbrales';
      setActionMessage({ type: 'error', text: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async (overrides?: { enabled?: boolean; recipients?: string[]; senderName?: string }) => {
    if (!isAdmin) return;
    try {
      setIsSavingSettings(true);
      const res = await updateNotificationSettings({
        enabled: overrides?.enabled ?? notifEnabled,
        recipients: overrides?.recipients ?? recipients,
        senderName: overrides?.senderName ?? senderName,
      });
      setActionMessage({ type: 'success', text: res.mensaje });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar configuración de notificaciones';
      setActionMessage({ type: 'error', text: msg });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleToggleEnabled = () => {
    const next = !notifEnabled;
    setNotifEnabled(next);
    handleSaveSettings({ enabled: next });
  };

  const handleAddRecipient = () => {
    const email = newRecipient.trim();
    if (!email || !email.includes('@') || recipients.includes(email)) return;
    const next = [...recipients, email];
    setRecipients(next);
    setNewRecipient('');
    handleSaveSettings({ recipients: next });
  };

  const handleRemoveRecipient = (email: string) => {
    const next = recipients.filter((r) => r !== email);
    setRecipients(next);
    handleSaveSettings({ recipients: next });
  };

  const handleSendGenericTestEmail = async () => {
    try {
      setIsSendingTestEmail(true);
      const res = await sendTestEmailNotification();
      setActionMessage({ type: 'success', text: res.mensaje });
      await loadThresholdsData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al enviar correo de prueba';
      setActionMessage({ type: 'error', text: msg });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadThresholdsData();
      setActionMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setActionMessage({
        type: 'error',
        text: 'Acceso Denegado (RBAC): Solo los administradores pueden configurar umbrales de stock mínimo.',
      });
      return;
    }

    if (!tipoEquipo.trim() || !claseEquipo.trim()) {
      setActionMessage({ type: 'error', text: 'Debe especificar el Tipo y la Clase de Equipo.' });
      return;
    }

    if (umbralMinimo < 0) {
      setActionMessage({ type: 'error', text: 'El umbral mínimo debe ser mayor o igual a cero.' });
      return;
    }

    try {
      setIsSaving(true);
      const res = await saveThreshold({
        tipoEquipo: tipoEquipo.trim(),
        claseEquipo: claseEquipo.trim(),
        umbralMinimo: Number(umbralMinimo),
      });
      setActionMessage({ type: 'success', text: res.mensaje });
      await loadThresholdsData();
      if (onThresholdsUpdated) onThresholdsUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar umbral';
      setActionMessage({ type: 'error', text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, clase: string) => {
    if (!isAdmin) {
      setActionMessage({
        type: 'error',
        text: 'Acceso Denegado (RBAC): Solo los administradores pueden eliminar umbrales.',
      });
      return;
    }

    if (!confirm(`¿Eliminar la regla de umbral para "${clase}"?`)) return;

    try {
      setIsLoading(true);
      const res = await deleteThreshold(id);
      setActionMessage({ type: 'success', text: res.mensaje });
      await loadThresholdsData();
      if (onThresholdsUpdated) onThresholdsUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar regla';
      setActionMessage({ type: 'error', text: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendTestEmail = async (item: UmbralStockConfig & { saldoActualEnPatio: number }) => {
    try {
      setIsSendingEmail(true);
      const res = await sendStockAlertEmail({
        tipoEquipo: item.tipoEquipo,
        claseEquipo: item.claseEquipo,
        saldoActual: item.saldoActualEnPatio,
        umbralConfigurado: item.umbralMinimo,
      });
      setActionMessage({ type: 'success', text: res.mensaje });
      await loadThresholdsData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al despachar alerta por correo';
      setActionMessage({ type: 'error', text: msg });
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Configuración de Umbrales de Stock Mínimo
                </h2>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                  isAdmin ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700 text-slate-300'
                }`}>
                  {isAdmin ? 'Modo Administrador' : 'Modo Consulta (RBAC)'}
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Parametrización por Tipo y Clase de Equipo con disparadores de alerta automática
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

        {/* Tab Selection */}
        <div className="px-6 pt-3 pb-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubTab('umbrales')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === 'umbrales'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300'
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Reglas de Umbrales ({thresholds.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('notificaciones')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === 'notificaciones'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300'
              }`}
            >
              <BellRing className="h-3.5 w-3.5" />
              <span>Bitácora de Notificaciones / Correos ({notifications.length})</span>
            </button>
          </div>

          <button
            onClick={loadThresholdsData}
            title="Recargar datos"
            className="p-1.5 text-slate-500 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Action feedback message */}
        {actionMessage && (
          <div
            className={`px-6 py-2.5 text-xs font-bold flex items-center justify-between border-b ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-600" />
              )}
              <span>{actionMessage.text}</span>
            </div>
            <button
              onClick={() => setActionMessage(null)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
          {activeSubTab === 'umbrales' ? (
            <>
              {/* Admin configuration form */}
              {isAdmin ? (
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                      <Plus className="h-4 w-4 text-amber-600" />
                      Definir o Actualizar Umbral Mínimo
                    </span>
                    <span className="text-[11px] text-amber-700">
                      Disparará alerta automática si el saldo desciende a este valor o menor
                    </span>
                  </div>

                  <form onSubmit={handleSaveThreshold} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Tipo de Equipo
                      </label>
                      <input
                        type="text"
                        list="modal-tipos-list"
                        value={tipoEquipo}
                        onChange={(e) => setTipoEquipo(e.target.value)}
                        placeholder="ej: Estructura Metálica"
                        required
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                      <datalist id="modal-tipos-list">
                        {COMMON_TIPOS.map((t) => (
                          <option key={t} value={t} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Clase de Equipo / Especificación
                      </label>
                      <input
                        type="text"
                        list="modal-clases-list"
                        value={claseEquipo}
                        onChange={(e) => setClaseEquipo(e.target.value)}
                        placeholder="ej: Viga IPE 300"
                        required
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                      <datalist id="modal-clases-list">
                        {COMMON_CLASES.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Stock Mínimo (piezas)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={umbralMinimo}
                        onChange={(e) => setUmbralMinimo(parseInt(e.target.value, 10) || 0)}
                        required
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-amber-700 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full py-2 px-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sliders className="h-3.5 w-3.5" />}
                        <span>Guardar Umbral</span>
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="p-3.5 bg-slate-100 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-slate-500" />
                  <span>
                    Está conectado como <strong>{currentUser.nombre} ({currentUser.rol})</strong>. La edición de umbrales está restringida al Administrador según políticas RBAC.
                  </span>
                </div>
              )}

              {/* Threshold Rules Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Reglas Parametrizadas ({thresholds.length})
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Comparación en tiempo real con inventario en patio
                  </span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-xs">
                  <table className="w-full text-left text-xs border-collapse min-w-[550px]">
                    <thead className="bg-slate-100/80 text-slate-600 text-[11px] font-extrabold uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Tipo de Equipo</th>
                        <th className="py-2.5 px-3">Clase / Referencia</th>
                        <th className="py-2.5 px-3 text-center">Umbral Mínimo</th>
                        <th className="py-2.5 px-3 text-center">Saldo en Patio</th>
                        <th className="py-2.5 px-3 text-center">Estado Alerta</th>
                        <th className="py-2.5 px-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {thresholds.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400">
                            No se han configurado reglas de stock mínimo.
                          </td>
                        </tr>
                      ) : (
                        thresholds.map((th) => (
                          <tr key={th.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-slate-700">
                              {th.tipoEquipo}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {th.claseEquipo}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-700">
                              {th.umbralMinimo} und
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-extrabold text-slate-900">
                              {th.saldoActualEnPatio} und
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {th.estaBajoUmbral ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-300">
                                  <AlertTriangle className="h-3 w-3" />
                                  STOCK CRÍTICO
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="h-3 w-3" />
                                  ABASTECIDO
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleSendTestEmail(th)}
                                  disabled={isSendingEmail}
                                  title="Disparar notificación por correo"
                                  className="p-1.5 text-slate-600 hover:text-amber-700 bg-slate-100 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Mail className="h-3.5 w-3.5" />
                                </button>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(th.id, th.claseEquipo)}
                                    title="Eliminar umbral"
                                    className="p-1.5 text-slate-400 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            /* Notification Dispatch Log Tab */
            <div className="space-y-4">
              {/* Configuración de destinatarios y remitente */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Configuración de Alertas por Correo
                  </span>
                  <button
                    type="button"
                    onClick={isAdmin ? handleToggleEnabled : undefined}
                    disabled={!isAdmin || isSavingSettings}
                    title={isAdmin ? 'Activar/desactivar el envío automático de alertas' : 'Solo el Administrador puede cambiar esto'}
                    className={`flex items-center gap-1.5 text-xs font-bold ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'} ${notifEnabled ? 'text-emerald-700' : 'text-slate-400'}`}
                  >
                    {notifEnabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                    <span>{notifEnabled ? 'Alertas activadas' : 'Alertas desactivadas'}</span>
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                    Nombre del remitente
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      onBlur={() => isAdmin && handleSaveSettings()}
                      disabled={!isAdmin}
                      placeholder="Sedimec Sistema de Alertas"
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:opacity-60"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                    Destinatarios ({recipients.length})
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {recipients.map((email) => (
                      <span
                        key={email}
                        className="flex items-center gap-1 pl-2.5 pr-1 py-1 bg-white border border-slate-200 rounded-full text-[11px] text-slate-700"
                      >
                        {email}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRecipient(email)}
                            className="p-0.5 hover:bg-rose-100 hover:text-rose-600 rounded-full cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    ))}
                    {recipients.length === 0 && (
                      <span className="text-[11px] text-slate-400">Sin destinatarios configurados.</span>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={newRecipient}
                        onChange={(e) => setNewRecipient(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddRecipient())}
                        placeholder="correo@sedimec.com"
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddRecipient}
                        disabled={isSavingSettings}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Agregar</span>
                      </button>
                    </div>
                  )}
                </div>

                {isAdmin && (
                  <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
                    <button
                      type="button"
                      onClick={handleSendGenericTestEmail}
                      disabled={isSendingTestEmail}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>{isSendingTestEmail ? 'Enviando...' : 'Enviar Correo de Prueba'}</span>
                    </button>
                    <span className="text-[10px] text-slate-400">
                      Requiere RESEND_API_KEY o SMTP_* configurado en los secrets de Supabase; de lo contrario queda como "Simulado".
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Historial de Notificaciones de Stock Mínimo Despachadas ({notifications.length})
                </h3>
                <span className="text-[11px] text-slate-500">
                  Monitoreo de alertas operativas enviadas al correo corporativo
                </span>
              </div>

              {notifications.length === 0 ? (
                <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                  No hay registros de alertas de stock enviadas.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{notif.asunto}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            {notif.estado}
                          </span>
                        </div>
                        <p className="text-slate-600 text-[11px]">{notif.mensajeDetallado}</p>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(notif.fecha).toLocaleString('es-CO')}
                          </span>
                          <span>Destinatario: {notif.destinatario}</span>
                        </div>
                      </div>

                      <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-center font-mono text-[11px]">
                        <span className="text-slate-500 block text-[9px] uppercase">Saldo / Umbral</span>
                        <span className="font-extrabold text-amber-700">{notif.saldoActual} und</span> / {notif.umbralConfigurado} und
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Info className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="text-[11px] sm:text-xs">Las alertas se emiten automáticamente cada vez que una Salida reduzca el saldo por debajo del umbral.</span>
          </div>

          <button
            onClick={onClose}
            className="py-1.5 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
