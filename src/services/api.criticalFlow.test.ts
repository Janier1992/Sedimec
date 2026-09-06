import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Test de integración contra la base de datos REAL de Supabase (no mockeada):
 * las reglas de negocio críticas (saldo = entradas - salidas, no se admite
 * inventario negativo, protección de concurrencia) viven en triggers y RLS de
 * Postgres, no en este código -- mockear la base de datos no probaría nada real.
 *
 * Requiere VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY y una cuenta de prueba
 * dedicada (VITE_TEST_E2E_EMAIL/VITE_TEST_E2E_PASSWORD) en .env.local. Si no
 * están presentes (ej. en un entorno CI sin ese secret), el bloque se omite
 * en vez de fallar.
 *
 * Flujo crítico cubierto: Login -> Entrada -> Inventario -> Salida rechazada
 * por stock insuficiente -> Salida válida -> Inventario actualizado -> limpieza.
 */

const EMAIL = import.meta.env.VITE_TEST_E2E_EMAIL as string | undefined;
const PASSWORD = import.meta.env.VITE_TEST_E2E_PASSWORD as string | undefined;

const runIntegration = EMAIL && PASSWORD ? describe : describe.skip;

if (!EMAIL || !PASSWORD) {
  console.warn(
    'api.criticalFlow.test.ts: omitido (falta VITE_TEST_E2E_EMAIL/VITE_TEST_E2E_PASSWORD en .env.local).'
  );
}

runIntegration('Flujo crítico: Entrada -> Inventario -> Salida -> Inventario actualizado', () => {
  // Clave única por ejecución para no chocar con datos reales del negocio ni con
  // corridas anteriores del test.
  const claseEquipo = `Test E2E ${Date.now()}`;
  const tipoEquipo = 'Prueba Automatizada';
  const dims = { ancho: 9, largo: 9, profundidad: 9 };
  const movimientosCreados: string[] = [];

  let supabase: typeof import('../lib/supabaseClient').supabase;
  let api: typeof import('./api');

  beforeAll(async () => {
    ({ supabase } = await import('../lib/supabaseClient'));
    api = await import('./api');

    const { error } = await supabase.auth.signInWithPassword({ email: EMAIL!, password: PASSWORD! });
    if (error) throw new Error(`No se pudo iniciar sesión con la cuenta de prueba: ${error.message}`);
  });

  afterAll(async () => {
    // Se anula en orden inverso (Salida antes que Entrada): anular_movimiento
    // rechaza deshacer una Entrada mientras una Salida posterior de la misma
    // clave siga activa -- la misma regla que valida el segundo test de abajo.
    for (const id of [...movimientosCreados].reverse()) {
      await api.deleteMovement(id, 'Limpieza automática de test E2E').catch((err) => {
        console.warn(`No se pudo limpiar el movimiento de prueba ${id}:`, err);
      });
    }
    await supabase.auth.signOut();
  });

  it('registra una Entrada y el inventario refleja el saldo correcto', async () => {
    const res = await api.createMovement({
      tipoMovimiento: 'Entrada',
      tipoEquipo,
      claseEquipo,
      estadoEquipo: 'Bueno',
      ...dims,
      cantidad: 10,
      procedenciaDestino: 'Proveedor Test E2E',
      responsable: 'Script E2E',
    });
    movimientosCreados.push(res.movimiento.id);
    expect(res.saldoActualizado).toBe(10);

    const { data: items } = await api.fetchInventory();
    const item = items.find((i) => i.claseEquipo === claseEquipo);
    expect(item?.saldoActual).toBe(10);
  });

  it('rechaza una Salida que dejaría el inventario en negativo', async () => {
    await expect(
      api.createMovement({
        tipoMovimiento: 'Salida',
        tipoEquipo,
        claseEquipo,
        estadoEquipo: 'Bueno',
        ...dims,
        cantidad: 999,
        procedenciaDestino: 'Destino Test E2E',
        responsable: 'Script E2E',
      })
    ).rejects.toThrow(/insuficiente/i);
  });

  it('registra una Salida válida y el inventario se actualiza (Entradas - Salidas)', async () => {
    const res = await api.createMovement({
      tipoMovimiento: 'Salida',
      tipoEquipo,
      claseEquipo,
      estadoEquipo: 'Bueno',
      ...dims,
      cantidad: 4,
      procedenciaDestino: 'Destino Test E2E',
      responsable: 'Script E2E',
    });
    movimientosCreados.push(res.movimiento.id);
    expect(res.saldoActualizado).toBe(6);

    const { data: items } = await api.fetchInventory();
    const item = items.find((i) => i.claseEquipo === claseEquipo);
    expect(item?.saldoActual).toBe(6);
  });
});
