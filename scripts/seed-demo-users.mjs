// Crea (o actualiza el rol de) los 3 usuarios demo de Sedimec usando el
// Admin API de Supabase. Requiere la service_role key (NUNCA la pongas en
// .env.local ni en ningún archivo del frontend -- solo se usa aquí, de forma
// local y puntual).
//
// Uso:
//   SUPABASE_URL="https://tu-proyecto.supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="tu_service_role_key" \
//   node scripts/seed-demo-users.mjs

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

const DEMO_USERS = [
  { email: 'admin@sedimec.com', password: 'Sedimec2026!', rol: 'admin', nombre: 'Ing. Rodrigo Mendoza', cargo: 'Director de Operaciones' },
  { email: 'operador@sedimec.com', password: 'Sedimec2026!', rol: 'operador', nombre: 'Andrés Morales', cargo: 'Operador de Recepción y Patio' },
  { email: 'auditor@sedimec.com', password: 'Sedimec2026!', rol: 'auditor', nombre: 'Dra. Carolina Restrepo', cargo: 'Auditora de Control Interno' },
];

for (const u of DEMO_USERS) {
  let userId;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: { nombre: u.nombre, cargo: u.cargo },
  });

  if (createErr) {
    if (createErr.message?.includes('already been registered') || createErr.status === 422) {
      const { data: list } = await admin.auth.admin.listUsers();
      const existing = list?.users?.find((x) => x.email === u.email);
      if (!existing) {
        console.error(`No se pudo crear ni encontrar ${u.email}:`, createErr.message);
        continue;
      }
      userId = existing.id;
      console.log(`Usuario ${u.email} ya existía, se reutiliza.`);
    } else {
      console.error(`Error creando ${u.email}:`, createErr.message);
      continue;
    }
  } else {
    userId = created.user.id;
    console.log(`Usuario ${u.email} creado.`);
  }

  const { error: profileErr } = await admin
    .from('profiles')
    .update({ rol: u.rol, nombre: u.nombre, cargo: u.cargo })
    .eq('id', userId);

  if (profileErr) {
    console.error(`Error actualizando rol de ${u.email}:`, profileErr.message);
  } else {
    console.log(`Rol de ${u.email} establecido en '${u.rol}'.`);
  }
}

console.log('\nListo. Usuarios demo (contraseña para los 3: Sedimec2026!):');
DEMO_USERS.forEach((u) => console.log(`  - ${u.email} (${u.rol})`));
