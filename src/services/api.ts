import {
  Movimiento,
  ItemInventario,
  KpiMetrics,
  ParsedVoiceMovement,
  AspectRatioType,
  UmbralStockConfig,
  AlertaStockEmail,
  IntegrityCheckReport,
  ReconcileResult,
  UserProfile,
  UserRole,
} from '../types';
import { supabase } from '../lib/supabaseClient';

async function extractErrorMessage(error: { message: string; context?: Response }): Promise<string> {
  const ctx = error.context;
  if (ctx && typeof ctx.clone === 'function') {
    try {
      const parsed = await ctx.clone().json();
      if (parsed?.error) return parsed.error as string;
    } catch {
      // el cuerpo no era JSON parseable; se conserva el mensaje genérico
    }
  }
  return error.message;
}

/**
 * supabase-js reporta un mensaje genérico ("Edge Function returned a non-2xx
 * status code") cuando una función responde con error -- el motivo real que sí
 * mandamos en el cuerpo JSON (ej. "Sesión inválida o expirada") se pierde. Esta
 * función invoca y, si falla, intenta leer el mensaje real del cuerpo.
 *
 * Además, si el motivo es una sesión vencida (frecuente en pestañas que llevan
 * mucho tiempo abiertas en segundo plano, donde el navegador retrasa la
 * renovación automática del token), se fuerza un refresco de sesión y se
 * reintenta una sola vez antes de rendirse -- así el usuario no tiene que
 * recargar la página manualmente.
 */
async function invokeFn<T>(name: string, body: unknown, isRetry = false): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const message = await extractErrorMessage(error);

    if (!isRetry && /sesión inválida o expirada/i.test(message)) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed?.session) {
        return invokeFn<T>(name, body, true);
      }
    }

    throw new Error(message);
  }
  return data as T;
}

// ============================================================
// Movimientos e Inventario
// ============================================================

const MOVIMIENTO_SELECT =
  'id, codigoLote:codigo_lote, fecha, tipoMovimiento:tipo_movimiento, tipoEquipo:tipo_equipo, ' +
  'claseEquipo:clase_equipo, estadoEquipo:estado_equipo, ancho, largo, profundidad, ' +
  'unidadMedida:unidad_medida, cantidad, procedenciaDestino:procedencia_destino, responsable, ' +
  'contactoResponsable:contacto_responsable, observaciones, saldoResultante:saldo_resultante, ' +
  'imagenDiagramaUrl:imagen_diagrama_url, creadoPorId:creado_por, creadoPorNombre:creado_por_nombre, ' +
  'creadoPorRol:creado_por_rol, creadoEn:creado_en';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMovimiento(row: any): Movimiento {
  return {
    id: row.id,
    codigoLote: row.codigoLote,
    fecha: row.fecha,
    tipoMovimiento: row.tipoMovimiento,
    tipoEquipo: row.tipoEquipo,
    claseEquipo: row.claseEquipo,
    estadoEquipo: row.estadoEquipo,
    ancho: Number(row.ancho),
    largo: Number(row.largo),
    profundidad: Number(row.profundidad),
    unidadMedida: row.unidadMedida,
    cantidad: row.cantidad,
    procedenciaDestino: row.procedenciaDestino,
    responsable: row.responsable,
    contactoResponsable: row.contactoResponsable,
    observaciones: row.observaciones,
    saldoResultante: row.saldoResultante,
    imagenDiagramaUrl: row.imagenDiagramaUrl,
    creadoPor: { id: row.creadoPorId, nombre: row.creadoPorNombre, rol: row.creadoPorRol },
    creadoEn: row.creadoEn,
  };
}

export async function fetchMovements(params?: {
  tipo?: string;
  busqueda?: string;
  desde?: string;
  hasta?: string;
  responsable?: string;
}): Promise<{ total: number; data: Movimiento[] }> {
  let query = supabase
    .from('movimientos')
    .select(MOVIMIENTO_SELECT, { count: 'exact' })
    .eq('anulado', false)
    .order('fecha', { ascending: false });

  if (params?.tipo) query = query.eq('tipo_movimiento', params.tipo);
  if (params?.responsable) query = query.ilike('responsable', `%${params.responsable}%`);
  if (params?.desde) query = query.gte('fecha', params.desde);
  if (params?.hasta) query = query.lte('fecha', `${params.hasta}T23:59:59`);
  if (params?.busqueda) {
    query = query.textSearch('search_vector', params.busqueda, { type: 'websearch', config: 'spanish' });
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message || 'Error al consultar movimientos');
  return { total: count ?? 0, data: (data ?? []).map(mapMovimiento) };
}

export async function createMovement(payload: Partial<Movimiento>): Promise<{
  success: boolean;
  mensaje: string;
  movimiento: Movimiento;
  saldoActualizado: number;
}> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('No hay una sesión activa.');

  const { data, error } = await supabase
    .from('movimientos')
    .insert({
      fecha: payload.fecha,
      tipo_movimiento: payload.tipoMovimiento,
      tipo_equipo: payload.tipoEquipo,
      clase_equipo: payload.claseEquipo,
      estado_equipo: payload.estadoEquipo,
      ancho: payload.ancho,
      largo: payload.largo,
      profundidad: payload.profundidad,
      cantidad: payload.cantidad,
      procedencia_destino: payload.procedenciaDestino,
      responsable: payload.responsable,
      contacto_responsable: payload.contactoResponsable,
      observaciones: payload.observaciones,
      imagen_diagrama_url: payload.imagenDiagramaUrl,
      creado_por: userData.user.id,
    })
    .select(MOVIMIENTO_SELECT)
    .single();

  if (error) throw new Error(error.message || 'Error al registrar el movimiento');
  const movimiento = mapMovimiento(data);

  return {
    success: true,
    mensaje: `${movimiento.tipoMovimiento} de ${movimiento.cantidad} unidades registrada con éxito. Saldo actual: ${movimiento.saldoResultante} und.`,
    movimiento,
    saldoActualizado: movimiento.saldoResultante ?? 0,
  };
}

/** Anula (soft-delete) un movimiento. Solo Administrador (reforzado por RLS/RPC). */
export async function deleteMovement(id: string, motivo?: string): Promise<{ success: boolean; mensaje: string }> {
  const { data, error } = await supabase.rpc('anular_movimiento', { p_id: id, p_motivo: motivo ?? null });
  if (error) throw new Error(error.message || 'Error al anular movimiento');
  return { success: true, mensaje: `Movimiento #${data.codigo_lote} anulado correctamente.` };
}

/**
 * Elimina una referencia completa del inventario anulando (soft-delete) todos los
 * movimientos que la componen -- el inventario no es una tabla propia, es calculado
 * desde el libro de movimientos, así que "borrar una fila de inventario" significa
 * anular todo su historial. Se anula del más reciente al más antiguo para que nunca
 * se intente anular una Entrada mientras una Salida posterior de la misma clave siga activa.
 */
export async function deleteInventoryReference(item: {
  tipoEquipo: string;
  claseEquipo: string;
  estadoEquipo: string;
  ancho: number;
  largo: number;
  profundidad: number;
}): Promise<{ success: boolean; mensaje: string; totalAnulados: number }> {
  const { data: movs, error: fetchErr } = await supabase
    .from('movimientos')
    .select('id')
    .eq('anulado', false)
    .eq('tipo_equipo', item.tipoEquipo)
    .eq('clase_equipo', item.claseEquipo)
    .eq('estado_equipo', item.estadoEquipo)
    .eq('ancho', item.ancho)
    .eq('largo', item.largo)
    .eq('profundidad', item.profundidad)
    .order('fecha', { ascending: false });

  if (fetchErr) throw new Error(fetchErr.message || 'Error al buscar los movimientos de la referencia');
  if (!movs || movs.length === 0) {
    return { success: true, mensaje: 'No había movimientos activos para esta referencia.', totalAnulados: 0 };
  }

  let totalAnulados = 0;
  for (const m of movs) {
    const { error } = await supabase.rpc('anular_movimiento', {
      p_id: m.id,
      p_motivo: `Eliminación de referencia completa desde Inventario (${item.claseEquipo})`,
    });
    if (error) throw new Error(`Se anularon ${totalAnulados}/${movs.length} movimientos y luego falló: ${error.message}`);
    totalAnulados++;
  }

  return {
    success: true,
    mensaje: `Referencia "${item.claseEquipo}" eliminada: ${totalAnulados} movimiento(s) anulado(s).`,
    totalAnulados,
  };
}

const INVENTARIO_SELECT =
  'id, tipoEquipo:tipo_equipo, claseEquipo:clase_equipo, estadoEquipo:estado_equipo, ancho, largo, ' +
  'profundidad, totalEntradas:total_entradas, totalSalidas:total_salidas, saldoActual:saldo_actual, ' +
  'volumenUnitarioM3:volumen_unitario_m3, volumenTotalM3:volumen_total_m3, ' +
  'ultimoMovimientoFecha:ultimo_movimiento_fecha, ultimoTipoMovimiento:ultimo_tipo_movimiento, ' +
  'umbralMinimo:umbral_minimo, alertaStockBajo:alerta_stock_bajo';

export async function fetchInventory(): Promise<{ totalItems: number; data: ItemInventario[] }> {
  const { data, error } = await supabase
    .from('inventario_actual')
    .select(INVENTARIO_SELECT)
    .order('clase_equipo');

  if (error) throw new Error('Error al cargar existencias de inventario');
  const items = (data ?? []) as unknown as ItemInventario[];
  return { totalItems: items.length, data: items };
}

export async function fetchKpis(): Promise<KpiMetrics> {
  const [{ data: inventario }, { data: movimientosRecientes, count: totalMovs }] = await Promise.all([
    supabase.from('inventario_actual').select(INVENTARIO_SELECT),
    supabase
      .from('movimientos')
      .select('fecha, tipoMovimiento:tipo_movimiento, cantidad', { count: 'exact' })
      .eq('anulado', false),
  ]);

  const items = (inventario ?? []) as unknown as ItemInventario[];
  const movs = movimientosRecientes ?? [];

  const totalPiezasDisponibles = items.reduce((s, i) => s + Math.max(0, i.saldoActual), 0);
  const volumenTotalAlmacenadoM3 = items.reduce((s, i) => s + i.volumenTotalM3, 0);
  const totalEntradasPeriodo = movs.filter((m) => m.tipoMovimiento === 'Entrada').reduce((s, m) => s + m.cantidad, 0);
  const totalSalidasPeriodo = movs.filter((m) => m.tipoMovimiento === 'Salida').reduce((s, m) => s + m.cantidad, 0);
  const itemsStockBajo = items.filter((i) => i.saldoActual <= i.umbralMinimo && i.saldoActual >= 0).length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const movimientosHoy = movs.filter((m) => m.fecha.startsWith(todayStr)).length;

  const claseMap: Record<string, number> = {};
  items.forEach((i) => {
    if (i.saldoActual > 0) claseMap[i.claseEquipo] = (claseMap[i.claseEquipo] || 0) + i.saldoActual;
  });
  const distribucionPorClase = Object.entries(claseMap).map(([clase, total]) => ({
    clase,
    total,
    porcentaje: totalPiezasDisponibles > 0 ? Math.round((total / totalPiezasDisponibles) * 100) : 0,
  }));

  const estadoColors: Record<string, string> = {
    Bueno: '#10B981',
    Nuevo: '#06B6D4',
    Regular: '#F59E0B',
    'En Mantenimiento': '#8B5CF6',
    'Para Reparación': '#EC4899',
    Dañado: '#EF4444',
  };
  const estadoMap: Record<string, number> = {};
  items.forEach((i) => {
    if (i.saldoActual > 0) estadoMap[i.estadoEquipo] = (estadoMap[i.estadoEquipo] || 0) + i.saldoActual;
  });
  const distribucionPorEstado = Object.entries(estadoMap).map(([estado, total]) => ({
    estado,
    total,
    color: estadoColors[estado] || '#64748B',
  }));

  const fechaMap: Record<string, { entradas: number; salidas: number }> = {};
  movs.forEach((m) => {
    const f = m.fecha.slice(0, 10);
    if (!fechaMap[f]) fechaMap[f] = { entradas: 0, salidas: 0 };
    if (m.tipoMovimiento === 'Entrada') fechaMap[f].entradas += m.cantidad;
    else fechaMap[f].salidas += m.cantidad;
  });
  const flujoMovimientos = Object.entries(fechaMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-10)
    .map(([fecha, v]) => ({ fecha, entradas: v.entradas, salidas: v.salidas, saldoNeto: v.entradas - v.salidas }));

  return {
    totalPiezasDisponibles,
    totalEntradasPeriodo,
    totalSalidasPeriodo,
    volumenTotalAlmacenadoM3: Number(volumenTotalAlmacenadoM3.toFixed(3)),
    totalReferenciasDistintas: items.length,
    itemsStockBajo,
    movimientosHoy,
    distribucionPorClase,
    distribucionPorEstado,
    flujoMovimientos,
  };
}

// ============================================================
// Umbrales de stock
// ============================================================

export async function fetchThresholds(): Promise<{
  total: number;
  data: UmbralStockConfig[];
  analisis: Array<UmbralStockConfig & { saldoActualEnPatio: number; estaBajoUmbral: boolean }>;
}> {
  const [{ data: umbrales, error }, { data: inventario }] = await Promise.all([
    supabase
      .from('umbrales_stock')
      .select(
        'id, tipoEquipo:tipo_equipo, claseEquipo:clase_equipo, umbralMinimo:umbral_minimo, actualizadoPor:actualizado_por, actualizadoEn:actualizado_en'
      ),
    supabase.from('inventario_actual').select(INVENTARIO_SELECT),
  ]);

  if (error) throw new Error('Error al consultar configuración de umbrales');
  const items = (inventario ?? []) as unknown as ItemInventario[];
  const data = (umbrales ?? []) as UmbralStockConfig[];

  const analisis = data.map((u) => {
    const saldoActualEnPatio = items
      .filter(
        (i) =>
          i.tipoEquipo.trim().toLowerCase() === u.tipoEquipo.trim().toLowerCase() &&
          i.claseEquipo.trim().toLowerCase() === u.claseEquipo.trim().toLowerCase()
      )
      .reduce((s, i) => s + i.saldoActual, 0);
    return { ...u, saldoActualEnPatio, estaBajoUmbral: saldoActualEnPatio <= u.umbralMinimo };
  });

  return { total: data.length, data, analisis };
}

export async function saveThreshold(config: {
  tipoEquipo: string;
  claseEquipo: string;
  umbralMinimo: number;
}): Promise<{ success: boolean; mensaje: string; data: UmbralStockConfig }> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('umbrales_stock')
    .upsert(
      {
        tipo_equipo: config.tipoEquipo.trim(),
        clase_equipo: config.claseEquipo.trim(),
        umbral_minimo: config.umbralMinimo,
        actualizado_por: userData.user?.id,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: 'tipo_equipo_norm,clase_equipo_norm' }
    )
    .select('id, tipoEquipo:tipo_equipo, claseEquipo:clase_equipo, umbralMinimo:umbral_minimo')
    .single();

  if (error) throw new Error(error.message || 'Error al guardar configuración de umbral');
  return {
    success: true,
    mensaje: `Umbral de stock mínimo para "${config.claseEquipo}" actualizado a ${config.umbralMinimo} unidades.`,
    data: data as UmbralStockConfig,
  };
}

export async function deleteThreshold(id: string): Promise<{ success: boolean; mensaje: string }> {
  const { error } = await supabase.from('umbrales_stock').delete().eq('id', id);
  if (error) throw new Error(error.message || 'Error al eliminar umbral');
  return { success: true, mensaje: 'Umbral eliminado correctamente.' };
}

// ============================================================
// Alertas y configuración de notificaciones
// ============================================================

export async function fetchStockNotifications(): Promise<{ total: number; data: AlertaStockEmail[] }> {
  const { data, error, count } = await supabase
    .from('alertas_stock_email')
    .select(
      'id, fecha, destinatario, asunto, tipoEquipo:tipo_equipo, claseEquipo:clase_equipo, saldoActual:saldo_actual, umbralConfigurado:umbral_configurado, estado, mensajeDetallado:mensaje_detallado',
      { count: 'exact' }
    )
    .order('fecha', { ascending: false });

  if (error) throw new Error('Error al cargar historial de notificaciones');
  return { total: count ?? 0, data: (data ?? []) as unknown as AlertaStockEmail[] };
}

export async function fetchNotificationSettings(): Promise<{
  settings: {
    enabled: boolean;
    recipients: string[];
    senderEmail: string;
    senderName: string;
    notifyOnLowStock: boolean;
    notifyOnCriticalMismatch: boolean;
  };
  recentAlerts: AlertaStockEmail[];
}> {
  const [{ data: settingsRow, error }, { data: alerts }] = await Promise.all([
    supabase.from('notification_settings').select('*').eq('id', 1).single(),
    supabase
      .from('alertas_stock_email')
      .select(
        'id, fecha, destinatario, asunto, tipoEquipo:tipo_equipo, claseEquipo:clase_equipo, saldoActual:saldo_actual, umbralConfigurado:umbral_configurado, estado, mensajeDetallado:mensaje_detallado'
      )
      .order('fecha', { ascending: false })
      .limit(10),
  ]);

  if (error) throw new Error('Error al consultar configuración de notificaciones');
  return {
    settings: {
      enabled: settingsRow.enabled,
      recipients: settingsRow.recipients ?? [],
      senderEmail: settingsRow.sender_email,
      senderName: settingsRow.sender_name,
      notifyOnLowStock: settingsRow.notify_on_low_stock,
      notifyOnCriticalMismatch: settingsRow.notify_on_critical_mismatch,
    },
    recentAlerts: (alerts ?? []) as unknown as AlertaStockEmail[],
  };
}

export async function updateNotificationSettings(settings: {
  enabled?: boolean;
  recipients?: string[];
  notifyOnLowStock?: boolean;
  notifyOnCriticalMismatch?: boolean;
  senderName?: string;
}): Promise<{ success: boolean; mensaje: string }> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('notification_settings')
    .update({
      enabled: settings.enabled,
      recipients: settings.recipients,
      notify_on_low_stock: settings.notifyOnLowStock,
      notify_on_critical_mismatch: settings.notifyOnCriticalMismatch,
      sender_name: settings.senderName,
      updated_by: userData.user?.id,
    })
    .eq('id', 1);

  if (error) throw new Error(error.message || 'Error al actualizar configuración');
  return { success: true, mensaje: 'Configuración de notificaciones por correo actualizada con éxito.' };
}

export async function sendTestEmailNotification(
  destinatario?: string
): Promise<{ success: boolean; mensaje: string; alerta: AlertaStockEmail }> {
  const data = await invokeFn<{ mensaje: string; data: AlertaStockEmail }>('send-stock-alert-email', {
    destinatario,
    tipoEquipo: 'Estructura Metálica',
    claseEquipo: 'Viga IPE 300',
    saldoActual: 3,
    umbralConfigurado: 10,
  });
  return { success: true, mensaje: data.mensaje, alerta: data.data };
}

export async function sendStockAlertEmail(params: {
  tipoEquipo: string;
  claseEquipo: string;
  saldoActual: number;
  umbralConfigurado: number;
  destinatario?: string;
}): Promise<{ success: boolean; mensaje: string; data: AlertaStockEmail }> {
  return invokeFn('send-stock-alert-email', params);
}

// ============================================================
// Funciones de IA (Edge Functions)
// ============================================================

export async function transcribeAudio(base64Audio: string, mimeType: string): Promise<{ transcript: string }> {
  return invokeFn('transcribe-audio', { base64Audio, mimeType });
}

export async function parseVoiceText(text: string): Promise<{
  parsed: ParsedVoiceMovement;
  alertasValidacion: string[];
  rawTranscript: string;
}> {
  return invokeFn('parse-movimiento-nlp', { text });
}

export async function generateTtsSpeech(text: string, voice: string = 'Puck'): Promise<{ base64Audio: string }> {
  return invokeFn('text-to-speech', { text, voice });
}

export async function generatePieceDiagram(params: {
  prompt?: string;
  aspectRatio: AspectRatioType;
  piezaInfo?: {
    tipoEquipo: string;
    claseEquipo: string;
    ancho: number;
    largo: number;
    profundidad: number;
    estadoEquipo: string;
  };
}): Promise<{ imageUrl: string; aspectRatio: string }> {
  return invokeFn('generate-diagram-image', params);
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  isError?: boolean;
}

export interface ChatAgentResponse {
  reply: string;
  timestamp: string;
  metrics?: {
    totalUnits: number;
    totalVolumeM3: number;
    lowStockCount: number;
    totalMovements: number;
  };
}

export async function askConversationalAgent(
  message: string,
  history?: Array<{ role: 'user' | 'model'; text: string }>
): Promise<ChatAgentResponse> {
  return invokeFn('chat-inventario', { message, history });
}

// ============================================================
// Auditoría de integridad
// ============================================================

export async function fetchIntegrityCheck(): Promise<IntegrityCheckReport> {
  const { data, error } = await supabase.rpc('run_integrity_check');
  if (error) throw new Error('Error al ejecutar verificación de integridad');
  return data as IntegrityCheckReport;
}

export async function reconcileIntegrity(): Promise<ReconcileResult> {
  const { data, error } = await supabase.rpc('reconcile_movimientos');
  if (error) throw new Error(error.message || 'Error al ejecutar conciliación de inventario');
  return data as ReconcileResult;
}

// ============================================================
// Gestión de usuarios (solo Administrador)
// ============================================================

export async function fetchUsers(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre, email, rol, cargo, avatarUrl:avatar_url')
    .order('nombre');
  if (error) throw new Error(error.message || 'Error al consultar usuarios');
  return (data ?? []) as UserProfile[];
}

export async function createUser(payload: {
  email: string;
  password: string;
  nombre: string;
  cargo?: string;
  rol: UserRole;
}): Promise<{ success: boolean; mensaje: string; user: UserProfile }> {
  return invokeFn('admin-create-user', payload);
}

export async function updateUserRole(userId: string, rol: UserRole): Promise<void> {
  const { error } = await supabase.from('profiles').update({ rol }).eq('id', userId);
  if (error) throw new Error(error.message || 'Error al actualizar el rol del usuario');
}

export async function deleteUser(userId: string): Promise<{ success: boolean; mensaje: string }> {
  return invokeFn('admin-delete-user', { userId });
}
