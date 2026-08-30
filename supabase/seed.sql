-- ============================================================
-- Datos de ejemplo para desarrollo local (mismos 9 movimientos
-- semilla que traía el prototipo de AI Studio en server.ts).
-- Los 3 usuarios demo (admin/operador/auditor) NO se crean aquí
-- porque auth.users requiere el Admin API de GoTrue; se crean con
-- el script scripts/seed-demo-users.mjs (ver README).
-- ============================================================

do $$
declare
  v_admin_id uuid;
  v_operador_id uuid;
begin
  select id into v_admin_id from public.profiles where rol = 'admin' limit 1;
  select id into v_operador_id from public.profiles where rol = 'operador' limit 1;

  if v_admin_id is null or v_operador_id is null then
    raise notice 'Sin usuarios demo todavía (ejecuta scripts/seed-demo-users.mjs primero) — se omite el seed de movimientos.';
    return;
  end if;

  insert into public.umbrales_stock (tipo_equipo, clase_equipo, umbral_minimo, actualizado_por) values
    ('Estructura Metálica', 'Viga IPE 300', 10, v_admin_id),
    ('Perfil Estructural', 'Tubo Rectangular 100x50', 8, v_admin_id),
    ('Chapa / Plancha', 'Plancha Estructural A36', 5, v_admin_id),
    ('Estructura Metálica', 'Viga HEA 200', 6, v_admin_id),
    ('Soportes y Anclajes', 'Soporte Base Columna 400x400', 12, v_admin_id),
    ('Perfil Estructural', 'Ángulo Estructural 2x2x1/4', 15, v_admin_id)
  on conflict (tipo_equipo_norm, clase_equipo_norm) do nothing;

  insert into public.movimientos
    (fecha, tipo_movimiento, tipo_equipo, clase_equipo, estado_equipo, ancho, largo, profundidad,
     cantidad, procedencia_destino, responsable, contacto_responsable, observaciones, creado_por)
  values
    ('2026-08-20T08:30:00', 'Entrada', 'Estructura Metálica', 'Viga IPE 300', 'Bueno', 15, 600, 30,
     25, 'Siderúrgica del Norte S.A.', 'Carlos Humberto Ruiz', '+57 312 458 9921',
     'Llegada en tractomula placa TRL-892. Inspección dimensional conforme a norma ASTM A36.', v_operador_id),
    ('2026-08-21T09:15:00', 'Entrada', 'Perfil Estructural', 'Tubo Rectangular 100x50', 'Nuevo', 10, 600, 5,
     40, 'Perfiles Andinos Ltda.', 'Jorge Mario Valencia', '+57 300 871 2234',
     'Material con acabado galvanizado por inmersión. 4 paquetes zunchados.', v_operador_id),
    ('2026-08-22T11:00:00', 'Entrada', 'Chapa / Plancha', 'Plancha Estructural A36', 'Bueno', 120, 240, 1.2,
     30, 'Aceros Industriales del Valle', 'Hernando Caicedo', '+57 318 642 1098',
     'Espesor verificado con micrómetro (12 mm / 1.2 cm). Sin óxido superficial.', v_operador_id),
    ('2026-08-23T14:30:00', 'Salida', 'Estructura Metálica', 'Viga IPE 300', 'Bueno', 15, 600, 30,
     8, 'Obra Puente Metálico Río Claro', 'David Fernando Ospina', '+57 315 901 8845',
     'Despacho autorizado por orden #ORD-4402 para montaje fase 1.', v_admin_id),
    ('2026-08-24T10:00:00', 'Entrada', 'Estructura Metálica', 'Viga HEA 200', 'Bueno', 20, 600, 19,
     18, 'Metalúrgica San Antonio', 'Marcos Antonio Peña', '+57 311 200 4578',
     'Recepción directa en patio 2.', v_operador_id),
    ('2026-08-25T15:20:00', 'Salida', 'Perfil Estructural', 'Tubo Rectangular 100x50', 'Nuevo', 10, 600, 5,
     15, 'Taller de Soldadura Especializada', 'Fabián Darío Cruz', '+57 320 541 3367',
     'Entrega para fabricación de cerchas y pórticos.', v_operador_id),
    ('2026-08-26T08:45:00', 'Entrada', 'Soportes y Anclajes', 'Soporte Base Columna 400x400', 'Nuevo', 40, 40, 2.5,
     50, 'Maquinados y Troqueles de Colombia', 'Guillermo León', '+57 314 789 0123',
     'Placas base perforadas con 4 orificios para pernos de 1 pulgada.', v_operador_id),
    ('2026-08-27T11:30:00', 'Salida', 'Chapa / Plancha', 'Plancha Estructural A36', 'Bueno', 120, 240, 1.2,
     10, 'Cliente Metalmecánica del Eje', 'Gustavo Adolfo Buitrago', '+57 317 334 9901',
     'Corte y dimensionado solicitado por cliente.', v_admin_id),
    ('2026-08-28T09:00:00', 'Entrada', 'Perfil Estructural', 'Ángulo Estructural 2x2x1/4', 'Bueno', 5, 600, 5,
     60, 'Distribuidora Siderúrgica Central', 'Héctor Fabio Ramírez', '+57 313 654 7890',
     'Lote de 60 unidades para refuerzo de estructuras.', v_operador_id);
end $$;
