import { describe, it, expect } from 'vitest';
import { buildInventarioRows, buildMovimientosRows } from './excel';
import { ItemInventario, Movimiento } from '../types';

function makeItem(overrides: Partial<ItemInventario> = {}): ItemInventario {
  return {
    id: 'perfil-estructural__viga-ipe-300__bueno__15__600__30',
    tipoEquipo: 'Perfil Estructural',
    claseEquipo: 'Viga IPE 300',
    estadoEquipo: 'Bueno',
    ancho: 15,
    largo: 600,
    profundidad: 30,
    totalEntradas: 25,
    totalSalidas: 8,
    saldoActual: 17,
    volumenUnitarioM3: 0.27,
    volumenTotalM3: 4.59,
    ultimoMovimientoFecha: '2026-08-23T14:30:00',
    ultimoTipoMovimiento: 'Salida',
    umbralMinimo: 10,
    alertaStockBajo: false,
    ...overrides,
  };
}

function makeMovimiento(overrides: Partial<Movimiento> = {}): Movimiento {
  return {
    id: 'mov-1',
    codigoLote: 'SED-2026-001',
    fecha: '2026-08-20T08:30:00',
    tipoMovimiento: 'Entrada',
    tipoEquipo: 'Perfil Estructural',
    claseEquipo: 'Viga IPE 300',
    estadoEquipo: 'Bueno',
    ancho: 15,
    largo: 600,
    profundidad: 30,
    cantidad: 25,
    procedenciaDestino: 'Siderúrgica del Norte S.A.',
    responsable: 'Carlos Humberto Ruiz',
    contactoResponsable: '+57 312 458 9921',
    saldoResultante: 25,
    creadoPor: { id: 'usr-1', nombre: 'Andrés Morales', rol: 'operador' },
    creadoEn: '2026-08-20T08:35:00',
    ...overrides,
  };
}

describe('buildInventarioRows', () => {
  it('usa el umbral mínimo configurado, no un valor fijo, para marcar stock bajo', () => {
    const bajoUmbral = makeItem({ saldoActual: 8, umbralMinimo: 10, alertaStockBajo: true });
    const rows = buildInventarioRows([bajoUmbral]);
    expect(rows[0]['Alerta Stock Bajo']).toBe('SÍ (Bajo Stock)');
    expect(rows[0]['Umbral Mínimo Configurado']).toBe(10);
  });

  it('no marca alerta cuando el saldo está sobre su umbral, aunque sea un valor pequeño', () => {
    // Antes de la corrección, un umbral fijo de 3 hubiera marcado esto como bajo stock.
    const item = makeItem({ saldoActual: 4, umbralMinimo: 3, alertaStockBajo: false });
    const rows = buildInventarioRows([item]);
    expect(rows[0]['Alerta Stock Bajo']).toBe('NORMAL');
  });

  it('numera las filas consecutivamente desde 1', () => {
    const rows = buildInventarioRows([makeItem(), makeItem({ claseEquipo: 'Viga HEA 200' })]);
    expect(rows.map((r) => r['N°'])).toEqual([1, 2]);
  });
});

describe('buildMovimientosRows', () => {
  it('conserva el código de lote y el saldo resultante sellado', () => {
    const rows = buildMovimientosRows([makeMovimiento()]);
    expect(rows[0]['Código Lote / SKU']).toBe('SED-2026-001');
    expect(rows[0]['Saldo Resultante']).toBe(25);
  });

  it('no rompe si el movimiento no tiene creadoPor (usuario eliminado)', () => {
    const rows = buildMovimientosRows([
      makeMovimiento({ creadoPor: { id: null, nombre: 'Andrés Morales', rol: 'operador' } }),
    ]);
    expect(rows[0]['Registrado Por']).toBe('Andrés Morales');
  });
});
