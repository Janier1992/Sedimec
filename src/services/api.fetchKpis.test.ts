import { describe, test, expect, vi } from 'vitest';

// ============================================================
// Mock mínimo y encadenable del cliente supabase-js, suficiente
// para simular exactamente las dos consultas que hace fetchKpis():
//   supabase.from('inventario_actual').select(...)
//   supabase.from('movimientos').select(...).eq('anulado', false)
// No se prueba contra una base de datos real: se inyectan filas
// ya con el mismo shape (camelCase) que produciría el alias .select().
// ============================================================
function makeThenableBuilder<T>(result: T) {
  const builder: Record<string, unknown> = {
    eq: () => builder,
    order: () => builder,
    then: (resolve: (value: T) => void) => resolve(result),
  };
  return builder;
}

function mockSupabaseFrom(responses: Record<string, unknown>) {
  return (table: string) => ({
    select: () => makeThenableBuilder(responses[table]),
  });
}

const INVENTARIO_ROWS = [
  {
    claseEquipo: 'Viga IPE 300',
    estadoEquipo: 'Bueno',
    saldoActual: 10,
    umbralMinimo: 5,
    volumenTotalM3: 1.2,
  },
  {
    claseEquipo: 'Tubo Rectangular 100x50',
    estadoEquipo: 'Regular',
    saldoActual: 2, // <= umbralMinimo -> debe contar como stock bajo
    umbralMinimo: 5,
    volumenTotalM3: 0.3,
  },
  {
    // Caso borde: saldo negativo histórico (nunca debería restar del total ni
    // contarse como "stock bajo", según la regla `i.saldoActual >= 0`).
    claseEquipo: 'Plancha Estructural A36',
    estadoEquipo: 'Dañado',
    saldoActual: -1,
    umbralMinimo: 3,
    volumenTotalM3: 0,
  },
];

const todayStr = new Date().toISOString().slice(0, 10);

const MOVIMIENTOS_ROWS = [
  { fecha: `${todayStr}T08:00:00.000Z`, tipoMovimiento: 'Entrada', cantidad: 10 },
  { fecha: `${todayStr}T09:00:00.000Z`, tipoMovimiento: 'Salida', cantidad: 3 },
  { fecha: '2000-01-01T00:00:00.000Z', tipoMovimiento: 'Entrada', cantidad: 5 },
];

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: mockSupabaseFrom({
      inventario_actual: { data: INVENTARIO_ROWS },
      movimientos: { data: MOVIMIENTOS_ROWS, count: MOVIMIENTOS_ROWS.length },
    }),
  },
}));

describe('fetchKpis', () => {
  test('calcula piezas disponibles ignorando saldos negativos', async () => {
    const { fetchKpis } = await import('./api');
    const kpis = await fetchKpis();
    // max(0,10) + max(0,2) + max(0,-1) = 12
    expect(kpis.totalPiezasDisponibles).toBe(12);
  });

  test('suma entradas y salidas del periodo por separado', async () => {
    const { fetchKpis } = await import('./api');
    const kpis = await fetchKpis();
    expect(kpis.totalEntradasPeriodo).toBe(15); // 10 + 5
    expect(kpis.totalSalidasPeriodo).toBe(3);
  });

  test('cuenta como stock bajo solo saldos >= 0 y <= umbral', async () => {
    const { fetchKpis } = await import('./api');
    const kpis = await fetchKpis();
    // Tubo Rectangular (2<=5) cuenta; Plancha con saldo -1 NO cuenta.
    expect(kpis.itemsStockBajo).toBe(1);
  });

  test('cuenta movimientos de hoy usando la fecha local del sistema', async () => {
    const { fetchKpis } = await import('./api');
    const kpis = await fetchKpis();
    expect(kpis.movimientosHoy).toBe(2);
  });

  test('excluye referencias con saldo <= 0 de la distribución por clase/estado', async () => {
    const { fetchKpis } = await import('./api');
    const kpis = await fetchKpis();
    const clases = kpis.distribucionPorClase.map((c) => c.clase);
    expect(clases).toContain('Viga IPE 300');
    expect(clases).toContain('Tubo Rectangular 100x50');
    expect(clases).not.toContain('Plancha Estructural A36');
  });
});
