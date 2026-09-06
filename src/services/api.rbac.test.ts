import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Prueba que el control de acceso por rol (RBAC) se refuerza en el servidor
 * (RLS + funciones RPC), no solo en la interfaz -- un usuario no admin no
 * debe poder escribir aunque intente llamar directamente a la API, sin pasar
 * por ningún botón de la UI.
 *
 * Requiere 3 cuentas de prueba dedicadas en .env.local (admin, operador,
 * auditor). Si faltan, el bloque se omite en vez de fallar.
 */

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const ADMIN_EMAIL = import.meta.env.VITE_TEST_E2E_EMAIL as string | undefined;
const ADMIN_PASSWORD = import.meta.env.VITE_TEST_E2E_PASSWORD as string | undefined;
const OPERADOR_EMAIL = import.meta.env.VITE_TEST_E2E_OPERADOR_EMAIL as string | undefined;
const OPERADOR_PASSWORD = import.meta.env.VITE_TEST_E2E_OPERADOR_PASSWORD as string | undefined;
const AUDITOR_EMAIL = import.meta.env.VITE_TEST_E2E_AUDITOR_EMAIL as string | undefined;
const AUDITOR_PASSWORD = import.meta.env.VITE_TEST_E2E_AUDITOR_PASSWORD as string | undefined;

const hasAllCreds =
  URL && ANON_KEY && ADMIN_EMAIL && ADMIN_PASSWORD && OPERADOR_EMAIL && OPERADOR_PASSWORD && AUDITOR_EMAIL && AUDITOR_PASSWORD;

const runRbac = hasAllCreds ? describe : describe.skip;

if (!hasAllCreds) {
  console.warn(
    'api.rbac.test.ts: omitido (faltan credenciales de las 3 cuentas de prueba en .env.local).'
  );
}

runRbac('RBAC reforzado en el servidor (RLS + RPC), no en la UI', () => {
  const tipoEquipo = 'Prueba Automatizada RBAC';
  const claseEquipo = `Test RBAC ${Date.now()}`;
  const dims = { ancho: 7, largo: 7, profundidad: 7 };

  let adminClient: SupabaseClient;
  let operadorClient: SupabaseClient;
  let auditorClient: SupabaseClient;
  const movimientosParaLimpiar: string[] = [];

  beforeAll(async () => {
    // Cada rol necesita su propia sesión: se crean clientes independientes en
    // vez de reutilizar el cliente único de la app (que solo maneja una sesión).
    adminClient = createClient(URL!, ANON_KEY!);
    operadorClient = createClient(URL!, ANON_KEY!);
    auditorClient = createClient(URL!, ANON_KEY!);

    const [a, o, u] = await Promise.all([
      adminClient.auth.signInWithPassword({ email: ADMIN_EMAIL!, password: ADMIN_PASSWORD! }),
      operadorClient.auth.signInWithPassword({ email: OPERADOR_EMAIL!, password: OPERADOR_PASSWORD! }),
      auditorClient.auth.signInWithPassword({ email: AUDITOR_EMAIL!, password: AUDITOR_PASSWORD! }),
    ]);
    if (a.error) throw new Error(`Login admin falló: ${a.error.message}`);
    if (o.error) throw new Error(`Login operador falló: ${o.error.message}`);
    if (u.error) throw new Error(`Login auditor falló: ${u.error.message}`);
  });

  afterAll(async () => {
    for (const id of movimientosParaLimpiar) {
      try {
        await adminClient.rpc('anular_movimiento', { p_id: id, p_motivo: 'Limpieza automática de test RBAC' });
      } catch {
        // best-effort cleanup
      }
    }
    try {
      await adminClient.from('umbrales_stock').delete().eq('tipo_equipo', tipoEquipo);
    } catch {
      // best-effort cleanup
    }
    await Promise.all([adminClient.auth.signOut(), operadorClient.auth.signOut(), auditorClient.auth.signOut()]);
  });

  it('el auditor NO puede registrar un movimiento', async () => {
    const { error } = await auditorClient.from('movimientos').insert({
      tipo_movimiento: 'Entrada',
      tipo_equipo: tipoEquipo,
      clase_equipo: claseEquipo,
      estado_equipo: 'Bueno',
      ...dims,
      cantidad: 1,
      procedencia_destino: 'Proveedor Test',
      responsable: 'Script RBAC',
      creado_por: (await auditorClient.auth.getUser()).data.user!.id,
    });
    expect(error).not.toBeNull();
  });

  it('el auditor SÍ puede leer el inventario (solo lectura, no denegado)', async () => {
    const { error } = await auditorClient.from('inventario_actual').select('*').limit(1);
    expect(error).toBeNull();
  });

  it('el auditor NO puede configurar umbrales de stock', async () => {
    const { error } = await auditorClient
      .from('umbrales_stock')
      .insert({ tipo_equipo: tipoEquipo, clase_equipo: claseEquipo, umbral_minimo: 5 });
    expect(error).not.toBeNull();
  });

  it('el auditor NO puede ejecutar la conciliación de inventario', async () => {
    const { error } = await auditorClient.rpc('reconcile_movimientos');
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/administrador/i);
  });

  let movimientoDeOperadorId: string;

  it('el operador SÍ puede registrar un movimiento', async () => {
    const { data: userData } = await operadorClient.auth.getUser();
    const { data, error } = await operadorClient
      .from('movimientos')
      .insert({
        tipo_movimiento: 'Entrada',
        tipo_equipo: tipoEquipo,
        clase_equipo: claseEquipo,
        estado_equipo: 'Bueno',
        ...dims,
        cantidad: 5,
        procedencia_destino: 'Proveedor Test',
        responsable: 'Script RBAC',
        creado_por: userData.user!.id,
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    movimientoDeOperadorId = data!.id;
    movimientosParaLimpiar.push(data!.id);
  });

  it('el operador NO puede anular el movimiento que él mismo creó', async () => {
    const { error } = await operadorClient.rpc('anular_movimiento', {
      p_id: movimientoDeOperadorId,
      p_motivo: 'Intento no autorizado',
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/administrador/i);
  });

  it('el operador NO puede configurar umbrales de stock', async () => {
    const { error } = await operadorClient
      .from('umbrales_stock')
      .insert({ tipo_equipo: tipoEquipo, clase_equipo: `${claseEquipo}-b`, umbral_minimo: 5 });
    expect(error).not.toBeNull();
  });

  it('el admin SÍ puede anular el movimiento y SÍ puede configurar umbrales', async () => {
    const { error: anularError } = await adminClient.rpc('anular_movimiento', {
      p_id: movimientoDeOperadorId,
      p_motivo: 'Limpieza de test RBAC',
    });
    expect(anularError).toBeNull();
    movimientosParaLimpiar.length = 0; // ya se anuló, no repetir en afterAll

    const { error: umbralError } = await adminClient
      .from('umbrales_stock')
      .insert({ tipo_equipo: tipoEquipo, clase_equipo: `${claseEquipo}-b`, umbral_minimo: 5 });
    expect(umbralError).toBeNull();
  });

  it('nadie puede escalar su propio rol directamente en la tabla profiles', async () => {
    const { data: userData } = await operadorClient.auth.getUser();
    const { error } = await operadorClient.from('profiles').update({ rol: 'admin' }).eq('id', userData.user!.id);
    // La política RLS permite el UPDATE en general (autoedición), pero el
    // trigger prevent_role_self_escalation debe bloquear el cambio de rol.
    expect(error).not.toBeNull();
  });
});
