import { describe, test, expect } from 'vitest';
import { parseVoiceCommandRuleBased } from './voiceParser';

describe('parseVoiceCommandRuleBased', () => {
  test('interpreta una Entrada completa con dimensiones, cantidad y responsable', () => {
    const result = parseVoiceCommandRuleBased(
      'Llegaron 25 vigas IPE 300 de 15 por 600 por 30 en buen estado de Siderúrgica del Norte entregó Carlos Ruiz'
    );

    expect(result.tipoMovimiento).toBe('Entrada');
    expect(result.claseEquipo).toBe('Viga IPE 300');
    expect(result.tipoEquipo).toBe('Perfil Estructural');
    expect(result.cantidad).toBe(25);
    expect(result.ancho).toBe(15);
    expect(result.largo).toBe(600);
    expect(result.profundidad).toBe(30);
    expect(result.estadoEquipo).toBe('Bueno');
    expect(result.procedenciaDestino).toContain('Siderúrgica del Norte');
    expect(result.responsable).toContain('Carlos');
  });

  test('reconoce una Salida hacia una obra y estado dañado', () => {
    const result = parseVoiceCommandRuleBased(
      'Salieron 8 tubos rectangulares dañados para la obra Torre Central, entregó Ana Gómez'
    );

    expect(result.tipoMovimiento).toBe('Salida');
    expect(result.claseEquipo).toBe('Tubo Rectangular 100x50');
    expect(result.cantidad).toBe(8);
    expect(result.estadoEquipo).toBe('Dañado');
  });

  test('usa valores por defecto razonables cuando el dictado no trae dimensiones', () => {
    const result = parseVoiceCommandRuleBased('Llegaron 3 planchas nuevas de Aceros del Caribe');

    expect(result.tipoMovimiento).toBe('Entrada');
    expect(result.claseEquipo).toBe('Plancha Estructural A36');
    expect(result.cantidad).toBe(3);
    expect(result.estadoEquipo).toBe('Nuevo');
    // Dimensiones por defecto específicas de plancha (no las genéricas de viga)
    expect(result.ancho).toBe(120);
    expect(result.largo).toBe(240);
    expect(result.profundidad).toBe(1.2);
  });

  test('nunca lanza excepción con un texto vacío o irreconocible y siempre devuelve cantidad positiva', () => {
    const result = parseVoiceCommandRuleBased('');
    expect(result.cantidad).toBeGreaterThan(0);
    expect(result.tipoMovimiento === 'Entrada' || result.tipoMovimiento === 'Salida').toBe(true);
    expect(typeof result.claseEquipo).toBe('string');
  });

  test('detecta estado Regular y clase Ángulo Estructural', () => {
    const result = parseVoiceCommandRuleBased(
      'Recibimos 12 angulos en estado regular de Metalúrgica Andina, recibió Pedro Sánchez'
    );
    expect(result.estadoEquipo).toBe('Regular');
    expect(result.claseEquipo).toBe('Ángulo Estructural 2x2');
    expect(result.cantidad).toBe(12);
  });
});
