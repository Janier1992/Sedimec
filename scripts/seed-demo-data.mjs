// Carga los umbrales y los 9 movimientos de ejemplo usando el Admin API
// (equivalente a supabase/seed.sql, pero vía supabase-js). Requiere que
// scripts/seed-demo-users.mjs ya se haya ejecutado antes.
//
// Uso:
//   SUPABASE_URL="https://tu-proyecto.supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="tu_service_role_key" \
//   node scripts/seed-demo-data.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY como variables de entorno.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: profiles, error: profErr } = await admin.from('profiles').select('id, email, rol');
if (profErr) {
  console.error('Error leyendo profiles:', profErr.message);
  process.exit(1);
}

const adminUser = profiles.find((p) => p.rol === 'admin');
const operadorUser = profiles.find((p) => p.rol === 'operador');

if (!adminUser || !operadorUser) {
  console.error('No se encontraron usuarios admin/operador. Corre primero scripts/seed-demo-users.mjs.');
  process.exit(1);
}

const UMBRALES = [
  { tipo_equipo: 'Estructura Metálica', clase_equipo: 'Viga IPE 300', umbral_minimo: 10 },
  { tipo_equipo: 'Perfil Estructural', clase_equipo: 'Tubo Rectangular 100x50', umbral_minimo: 8 },
  { tipo_equipo: 'Chapa / Plancha', clase_equipo: 'Plancha Estructural A36', umbral_minimo: 5 },
  { tipo_equipo: 'Estructura Metálica', clase_equipo: 'Viga HEA 200', umbral_minimo: 6 },
  { tipo_equipo: 'Soportes y Anclajes', clase_equipo: 'Soporte Base Columna 400x400', umbral_minimo: 12 },
  { tipo_equipo: 'Perfil Estructural', clase_equipo: 'Ángulo Estructural 2x2x1/4', umbral_minimo: 15 },
];

for (const u of UMBRALES) {
  const { error } = await admin
    .from('umbrales_stock')
    .upsert({ ...u, actualizado_por: adminUser.id }, { onConflict: 'tipo_equipo_norm,clase_equipo_norm' });
  if (error) console.error(`Error en umbral ${u.clase_equipo}:`, error.message);
}
console.log(`${UMBRALES.length} umbrales configurados.`);

const MOVIMIENTOS = [
  ['2026-08-20T08:30:00', 'Entrada', 'Estructura Metálica', 'Viga IPE 300', 'Bueno', 15, 600, 30, 25, 'Siderúrgica del Norte S.A.', 'Carlos Humberto Ruiz', '+57 312 458 9921', 'Llegada en tractomula placa TRL-892. Inspección dimensional conforme a norma ASTM A36.', operadorUser.id],
  ['2026-08-21T09:15:00', 'Entrada', 'Perfil Estructural', 'Tubo Rectangular 100x50', 'Nuevo', 10, 600, 5, 40, 'Perfiles Andinos Ltda.', 'Jorge Mario Valencia', '+57 300 871 2234', 'Material con acabado galvanizado por inmersión. 4 paquetes zunchados.', operadorUser.id],
  ['2026-08-22T11:00:00', 'Entrada', 'Chapa / Plancha', 'Plancha Estructural A36', 'Bueno', 120, 240, 1.2, 30, 'Aceros Industriales del Valle', 'Hernando Caicedo', '+57 318 642 1098', 'Espesor verificado con micrómetro (12 mm / 1.2 cm). Sin óxido superficial.', operadorUser.id],
  ['2026-08-23T14:30:00', 'Salida', 'Estructura Metálica', 'Viga IPE 300', 'Bueno', 15, 600, 30, 8, 'Obra Puente Metálico Río Claro', 'David Fernando Ospina', '+57 315 901 8845', 'Despacho autorizado por orden #ORD-4402 para montaje fase 1.', adminUser.id],
  ['2026-08-24T10:00:00', 'Entrada', 'Estructura Metálica', 'Viga HEA 200', 'Bueno', 20, 600, 19, 18, 'Metalúrgica San Antonio', 'Marcos Antonio Peña', '+57 311 200 4578', 'Recepción directa en patio 2.', operadorUser.id],
  ['2026-08-25T15:20:00', 'Salida', 'Perfil Estructural', 'Tubo Rectangular 100x50', 'Nuevo', 10, 600, 5, 15, 'Taller de Soldadura Especializada', 'Fabián Darío Cruz', '+57 320 541 3367', 'Entrega para fabricación de cerchas y pórticos.', operadorUser.id],
  ['2026-08-26T08:45:00', 'Entrada', 'Soportes y Anclajes', 'Soporte Base Columna 400x400', 'Nuevo', 40, 40, 2.5, 50, 'Maquinados y Troqueles de Colombia', 'Guillermo León', '+57 314 789 0123', 'Placas base perforadas con 4 orificios para pernos de 1 pulgada.', operadorUser.id],
  ['2026-08-27T11:30:00', 'Salida', 'Chapa / Plancha', 'Plancha Estructural A36', 'Bueno', 120, 240, 1.2, 10, 'Cliente Metalmecánica del Eje', 'Gustavo Adolfo Buitrago', '+57 317 334 9901', 'Corte y dimensionado solicitado por cliente.', adminUser.id],
  ['2026-08-28T09:00:00', 'Entrada', 'Perfil Estructural', 'Ángulo Estructural 2x2x1/4', 'Bueno', 5, 600, 5, 60, 'Distribuidora Siderúrgica Central', 'Héctor Fabio Ramírez', '+57 313 654 7890', 'Lote de 60 unidades para refuerzo de estructuras.', operadorUser.id],
];

const COLUMNS = ['fecha', 'tipo_movimiento', 'tipo_equipo', 'clase_equipo', 'estado_equipo', 'ancho', 'largo', 'profundidad', 'cantidad', 'procedencia_destino', 'responsable', 'contacto_responsable', 'observaciones', 'creado_por'];

let ok = 0;
for (const row of MOVIMIENTOS) {
  const record = Object.fromEntries(COLUMNS.map((c, i) => [c, row[i]]));
  const { error } = await admin.from('movimientos').insert(record);
  if (error) {
    console.error(`Error insertando movimiento (${record.clase_equipo}, ${record.fecha}):`, error.message);
  } else {
    ok++;
  }
}
console.log(`${ok}/${MOVIMIENTOS.length} movimientos de ejemplo insertados.`);
