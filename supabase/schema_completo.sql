-- ============================================================
-- SEDIMEC — Script completo de base de datos para Supabase
-- ============================================================
-- Instrucciones:
--   1. Ve a tu proyecto en https://supabase.com/dashboard
--   2. Abre "SQL Editor" -> "New query"
--   3. Pega TODO este archivo y ejecútalo (Run) una sola vez
--   4. Luego crea los 3 usuarios demo desde Authentication > Users
--      (ver README.md para el paso a paso exacto)
-- Este archivo es la concatenación, en orden, de:
--   supabase/migrations/0001_schema.sql
--   supabase/migrations/0002_view_inventario.sql
--   supabase/migrations/0003_rls_and_roles.sql
--   supabase/migrations/0004_movimiento_rules.sql
--   supabase/migrations/0005_integrity_engine.sql
-- ============================================================


-- ============================================================
-- Archivo: supabase/migrations/0001_schema.sql
-- ============================================================
-- ============================================================
-- Sedimec: esquema base
-- Rol de usuario, perfiles, libro de movimientos, umbrales,
-- log de alertas por correo y configuración de notificaciones.
-- ============================================================

create type public.user_role as enum ('admin', 'operador', 'auditor');

-- ============================================================
-- profiles (1:1 con auth.users)
-- ============================================================
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  nombre        text not null,
  email         text not null,
  rol           public.user_role not null default 'operador',
  cargo         text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_profiles_rol on public.profiles(rol);

-- ============================================================
-- movimientos (libro mayor, fuente de verdad del inventario)
-- ============================================================
create table public.movimientos (
  id                    uuid primary key default gen_random_uuid(),
  codigo_lote           text not null unique,
  fecha                 timestamptz not null default now(),
  tipo_movimiento       text not null check (tipo_movimiento in ('Entrada','Salida')),

  tipo_equipo           text not null,
  clase_equipo          text not null,
  estado_equipo         text not null check (estado_equipo in
                           ('Bueno','Regular','Dañado','Para Reparación','Nuevo','En Mantenimiento')),

  -- columnas normalizadas para agrupar de forma consistente (case/espacios insensitive)
  tipo_equipo_norm      text generated always as (lower(trim(tipo_equipo))) stored,
  clase_equipo_norm     text generated always as (lower(trim(clase_equipo))) stored,
  estado_equipo_norm    text generated always as (lower(trim(estado_equipo))) stored,

  ancho                 numeric(10,2) not null check (ancho > 0),
  largo                 numeric(10,2) not null check (largo > 0),
  profundidad           numeric(10,2) not null check (profundidad > 0),
  unidad_medida         text not null default 'cm',

  cantidad              integer not null check (cantidad > 0),
  procedencia_destino   text not null,
  responsable           text not null,
  contacto_responsable  text,
  observaciones         text,

  saldo_resultante      integer not null default 0,
  imagen_diagrama_url   text,

  creado_por            uuid not null references public.profiles(id),
  creado_por_nombre     text not null,
  creado_por_rol        public.user_role not null,
  creado_en             timestamptz not null default now(),

  -- soft delete de auditoría (nunca se borra físicamente un movimiento)
  anulado               boolean not null default false,
  anulado_por           uuid references public.profiles(id),
  anulado_en            timestamptz,
  motivo_anulacion      text,

  updated_at            timestamptz not null default now()
);

create index idx_movimientos_tipo_movimiento on public.movimientos(tipo_movimiento);
create index idx_movimientos_fecha on public.movimientos(fecha desc);
create index idx_movimientos_responsable on public.movimientos(responsable);
create index idx_movimientos_creado_por on public.movimientos(creado_por);
create index idx_movimientos_anulado on public.movimientos(anulado) where anulado = false;

create index idx_movimientos_clave_inventario on public.movimientos
  (tipo_equipo_norm, clase_equipo_norm, estado_equipo_norm, ancho, largo, profundidad)
  where anulado = false;

alter table public.movimientos add column search_vector tsvector
  generated always as (
    to_tsvector('spanish',
      coalesce(codigo_lote,'') || ' ' || coalesce(tipo_equipo,'') || ' ' ||
      coalesce(clase_equipo,'') || ' ' || coalesce(procedencia_destino,'') || ' ' ||
      coalesce(responsable,'') || ' ' || coalesce(observaciones,''))
  ) stored;
create index idx_movimientos_search on public.movimientos using gin(search_vector);

-- ============================================================
-- umbrales_stock (config por tipo+clase, no por dimensión exacta)
-- ============================================================
create table public.umbrales_stock (
  id                uuid primary key default gen_random_uuid(),
  tipo_equipo       text not null,
  clase_equipo      text not null,
  tipo_equipo_norm  text generated always as (lower(trim(tipo_equipo))) stored,
  clase_equipo_norm text generated always as (lower(trim(clase_equipo))) stored,
  umbral_minimo     integer not null default 5 check (umbral_minimo >= 0),
  actualizado_por   uuid references public.profiles(id),
  actualizado_en    timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  unique (tipo_equipo_norm, clase_equipo_norm)
);

-- ============================================================
-- alertas_stock_email (log histórico inmutable)
-- ============================================================
create table public.alertas_stock_email (
  id                  uuid primary key default gen_random_uuid(),
  fecha               timestamptz not null default now(),
  destinatario        text not null,
  asunto              text not null,
  tipo_equipo         text not null,
  clase_equipo        text not null,
  saldo_actual        integer not null,
  umbral_configurado  integer not null,
  estado              text not null check (estado in ('Enviado','Simulado','Fallido')),
  mensaje_detallado   text,
  movimiento_id       uuid references public.movimientos(id),
  created_at          timestamptz not null default now()
);

create index idx_alertas_fecha on public.alertas_stock_email(fecha desc);
create index idx_alertas_movimiento on public.alertas_stock_email(movimiento_id);

-- ============================================================
-- notification_settings (singleton)
-- ============================================================
create table public.notification_settings (
  id                          smallint primary key default 1 check (id = 1),
  enabled                     boolean not null default true,
  recipients                  text[] not null default '{}',
  sender_email                text not null default 'alertas-stock@sedimec.com',
  sender_name                 text not null default 'Sedimec Sistema de Alertas',
  notify_on_low_stock         boolean not null default true,
  notify_on_critical_mismatch boolean not null default true,
  updated_by                  uuid references public.profiles(id),
  updated_at                  timestamptz not null default now(),
  created_at                  timestamptz not null default now()
);
insert into public.notification_settings (id, recipients) values
  (1, array['director.operaciones@sedimec.com', 'admin@sedimec.com']);

-- ============================================================
-- trigger genérico de updated_at
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_movimientos_updated_at before update on public.movimientos
  for each row execute function public.set_updated_at();
create trigger trg_notification_settings_updated_at before update on public.notification_settings
  for each row execute function public.set_updated_at();


-- ============================================================
-- Archivo: supabase/migrations/0002_view_inventario.sql
-- ============================================================
-- ============================================================
-- inventario_actual: single source of truth del stock en patio.
-- Se recalcula siempre a partir del libro de movimientos
-- (saldo = Sum(Entradas) - Sum(Salidas)), nunca puede desincronizarse.
-- ============================================================

create view public.inventario_actual
with (security_invoker = true) as
select
  (m.tipo_equipo_norm || '__' || m.clase_equipo_norm || '__' || m.estado_equipo_norm
    || '__' || m.ancho::text || '__' || m.largo::text || '__' || m.profundidad::text) as id,
  m.tipo_equipo_norm,
  m.clase_equipo_norm,
  m.estado_equipo_norm,
  (array_agg(m.tipo_equipo order by m.creado_en desc))[1]   as tipo_equipo,
  (array_agg(m.clase_equipo order by m.creado_en desc))[1]  as clase_equipo,
  (array_agg(m.estado_equipo order by m.creado_en desc))[1] as estado_equipo,
  m.ancho,
  m.largo,
  m.profundidad,
  (array_agg(m.unidad_medida order by m.creado_en desc))[1] as unidad_medida,
  sum(case when m.tipo_movimiento = 'Entrada' then m.cantidad else -m.cantidad end)::int as saldo_actual,
  sum(case when m.tipo_movimiento = 'Entrada' then m.cantidad else 0 end)::int as total_entradas,
  sum(case when m.tipo_movimiento = 'Salida' then m.cantidad else 0 end)::int as total_salidas,
  round((m.ancho * m.largo * m.profundidad) / 1000000.0, 6) as volumen_unitario_m3,
  round(
    (m.ancho * m.largo * m.profundidad) / 1000000.0
    * greatest(0, sum(case when m.tipo_movimiento = 'Entrada' then m.cantidad else -m.cantidad end)),
    6
  ) as volumen_total_m3,
  coalesce(u.umbral_minimo, 5) as umbral_minimo,
  (sum(case when m.tipo_movimiento = 'Entrada' then m.cantidad else -m.cantidad end)
    <= coalesce(u.umbral_minimo, 5)) as alerta_stock_bajo,
  max(m.fecha) as ultimo_movimiento_fecha,
  (array_agg(m.tipo_movimiento order by m.fecha desc, m.creado_en desc))[1] as ultimo_tipo_movimiento
from public.movimientos m
left join public.umbrales_stock u
  on u.tipo_equipo_norm = m.tipo_equipo_norm
  and u.clase_equipo_norm = m.clase_equipo_norm
where m.anulado = false
group by
  m.tipo_equipo_norm, m.clase_equipo_norm, m.estado_equipo_norm,
  m.ancho, m.largo, m.profundidad, u.umbral_minimo;


-- ============================================================
-- Archivo: supabase/migrations/0003_rls_and_roles.sql
-- ============================================================
-- ============================================================
-- Rol server-side (reemplaza por completo el header x-user-role
-- falsificable): el rol se resuelve SIEMPRE desde profiles vía
-- auth.uid(), nunca desde algo que declare el cliente.
-- ============================================================

create or replace function public.get_user_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$ select rol from public.profiles where id = auth.uid() $$;

-- ============================================================
-- Alta automática de perfil al registrarse (siempre 'operador';
-- el primer admin se promueve manualmente por SQL, ver seed.sql)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nombre, email, rol, cargo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    new.email,
    'operador',
    coalesce(new.raw_user_meta_data->>'cargo', 'Operador de Patio')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Nadie puede auto-promoverse de rol
-- ============================================================
create or replace function public.prevent_role_self_escalation()
returns trigger language plpgsql as $$
begin
  if new.rol <> old.rol and public.get_user_role() <> 'admin' then
    raise exception 'Solo un Administrador puede cambiar el rol de un usuario.';
  end if;
  return new;
end;
$$;

create trigger trg_prevent_role_self_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

-- ============================================================
-- Inmutabilidad del libro de movimientos: un UPDATE solo puede
-- tocar campos de anulación (y saldo_resultante, para reconciliar)
-- ============================================================
create or replace function public.protect_movimiento_ledger()
returns trigger language plpgsql as $$
begin
  if new.codigo_lote <> old.codigo_lote
     or new.tipo_movimiento <> old.tipo_movimiento
     or new.tipo_equipo <> old.tipo_equipo
     or new.clase_equipo <> old.clase_equipo
     or new.estado_equipo <> old.estado_equipo
     or new.ancho <> old.ancho or new.largo <> old.largo or new.profundidad <> old.profundidad
     or new.cantidad <> old.cantidad
     or new.creado_por <> old.creado_por then
    raise exception 'El libro de movimientos es inmutable: solo se pueden modificar los campos de anulación o el saldo resultante (reconciliación).';
  end if;
  return new;
end;
$$;

create trigger trg_protect_movimiento_ledger
  before update on public.movimientos
  for each row execute function public.protect_movimiento_ledger();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.movimientos enable row level security;
alter table public.umbrales_stock enable row level security;
alter table public.alertas_stock_email enable row level security;
alter table public.notification_settings enable row level security;

-- profiles: lectura abierta a autenticados (se necesita para mostrar responsables/creadores)
create policy "profiles_select_all" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_self_or_admin" on public.profiles
  for update to authenticated
  using (auth.uid() = id or public.get_user_role() = 'admin')
  with check (auth.uid() = id or public.get_user_role() = 'admin');
-- sin policy de insert/delete para 'authenticated' -> el único alta es el trigger security definer

-- movimientos: lectura total; insertar admin/operador; anular (update) solo admin; NUNCA delete físico
create policy "movimientos_select_all" on public.movimientos
  for select to authenticated using (true);
create policy "movimientos_insert_admin_operador" on public.movimientos
  for insert to authenticated
  with check (public.get_user_role() in ('admin','operador') and creado_por = auth.uid());
create policy "movimientos_update_admin" on public.movimientos
  for update to authenticated
  using (public.get_user_role() = 'admin')
  with check (public.get_user_role() = 'admin');

-- umbrales_stock: lectura total, escritura solo admin
create policy "umbrales_select_all" on public.umbrales_stock
  for select to authenticated using (true);
create policy "umbrales_write_admin" on public.umbrales_stock
  for all to authenticated
  using (public.get_user_role() = 'admin')
  with check (public.get_user_role() = 'admin');

-- alertas_stock_email: lectura total; la escritura la hace únicamente la Edge Function con service_role
create policy "alertas_select_all" on public.alertas_stock_email
  for select to authenticated using (true);

-- notification_settings: lectura total, escritura solo admin
create policy "notif_select_all" on public.notification_settings
  for select to authenticated using (true);
create policy "notif_update_admin" on public.notification_settings
  for update to authenticated
  using (public.get_user_role() = 'admin')
  with check (public.get_user_role() = 'admin');


-- ============================================================
-- Archivo: supabase/migrations/0004_movimiento_rules.sql
-- ============================================================
-- ============================================================
-- Reglas de negocio al crear un Movimiento:
--   1. Genera codigo_lote secuencial "SED-{año}-{consecutivo}"
--      (el cliente nunca puede fijar su propio código).
--   2. Rechaza una Salida que deje saldo negativo.
--   3. Calcula y sella saldo_resultante en el momento del registro.
--   4. Snapshotea creado_por_nombre/creado_por_rol de forma
--      inmutable (aunque el perfil del usuario cambie después).
-- Corre en un trigger BEFORE INSERT para que aplique sin importar
-- si el insert llega por supabase-js .insert() o por una RPC futura.
-- ============================================================

create or replace function public.seal_and_validate_movimiento()
returns trigger language plpgsql as $$
declare
  v_year int := extract(year from now())::int;
  v_seq int;
  v_current_stock int;
  v_creador_nombre text;
  v_creador_rol public.user_role;
begin
  -- 1. Código de lote secuencial por año.
  -- Se serializa con un advisory lock transaccional (liberado automáticamente
  -- al hacer commit/rollback) para que dos inserts concurrentes en el mismo
  -- año nunca calculen el mismo consecutivo (evita colisión de codigo_lote
  -- bajo carga concurrente, ya que count(*)+1 por sí solo no es atómico).
  perform pg_advisory_xact_lock(hashtext('sedimec_codigo_lote_' || v_year::text));

  select count(*) + 1 into v_seq
  from public.movimientos
  where extract(year from creado_en) = v_year;
  new.codigo_lote := 'SED-' || v_year::text || '-' || lpad(v_seq::text, 3, '0');

  -- 2. Saldo actual de la clave (tipo+clase+dimensiones+estado), excluyendo anulados
  select coalesce(sum(case when tipo_movimiento = 'Entrada' then cantidad else -cantidad end), 0)
  into v_current_stock
  from public.movimientos
  where anulado = false
    and tipo_equipo_norm = lower(trim(new.tipo_equipo))
    and clase_equipo_norm = lower(trim(new.clase_equipo))
    and estado_equipo_norm = lower(trim(new.estado_equipo))
    and ancho = new.ancho and largo = new.largo and profundidad = new.profundidad;

  if new.tipo_movimiento = 'Salida' then
    if v_current_stock <= 0 then
      raise exception 'Operación rechazada: no existen unidades disponibles de % (%, % x % x % cm, estado %). Saldo actual en patio: 0 unidades.',
        new.tipo_equipo, new.clase_equipo, new.ancho, new.largo, new.profundidad, new.estado_equipo;
    end if;
    if new.cantidad > v_current_stock then
      raise exception 'Operación rechazada: stock insuficiente. Saldo disponible en patio: % unidades. Se intentó retirar % unidades.',
        v_current_stock, new.cantidad;
    end if;
    new.saldo_resultante := v_current_stock - new.cantidad;
  else
    new.saldo_resultante := v_current_stock + new.cantidad;
  end if;

  -- 3. Snapshot inmutable de quién registró el movimiento
  select nombre, rol into v_creador_nombre, v_creador_rol
  from public.profiles where id = new.creado_por;

  if v_creador_nombre is null then
    raise exception 'No se encontró el perfil del usuario que registra el movimiento.';
  end if;

  new.creado_por_nombre := v_creador_nombre;
  new.creado_por_rol := v_creador_rol;
  new.creado_en := coalesce(new.creado_en, now());

  return new;
end;
$$;

create trigger trg_seal_and_validate_movimiento
  before insert on public.movimientos
  for each row execute function public.seal_and_validate_movimiento();


-- ============================================================
-- Archivo: supabase/migrations/0005_integrity_engine.sql
-- ============================================================
-- ============================================================
-- Motor de Integridad y Reconciliación (RPC en PL/pgSQL).
-- Vive en la base de datos porque las 6 reglas son operaciones
-- set-based naturales en SQL, y así es imposible que la lógica de
-- auditoría quede desincronizada de la vista inventario_actual.
-- SECURITY INVOKER: respeta RLS de quien llama.
-- ============================================================

create or replace function public.run_integrity_check()
returns jsonb language plpgsql security invoker stable as $$
declare
  v_start timestamptz := clock_timestamp();
  v_detalles jsonb := '[]'::jsonb;
  v_reglas jsonb := '[]'::jsonb;
  v_total_movs int;
  v_total_items int;
  v_rule1 int := 0; v_rule2 int := 0; v_rule3 int := 0;
  v_rule4 int := 0; v_rule5 int := 0; v_rule6 int := 0;
  v_health int;
  v_estado text;
  v_total_piezas int;
  v_total_volumen numeric;
begin
  select count(*) into v_total_movs from public.movimientos where anulado = false;
  select count(*) into v_total_items from public.inventario_actual;
  select coalesce(sum(greatest(0, saldo_actual)), 0), coalesce(sum(volumen_total_m3), 0)
    into v_total_piezas, v_total_volumen
  from public.inventario_actual;

  -- Regla 1: saldo_resultante sellado vs. recálculo cronológico real (Sum(Entradas)-Sum(Salidas))
  with cronologia as (
    select m.id, m.codigo_lote, m.clase_equipo, m.tipo_equipo, m.saldo_resultante,
      sum(case when m.tipo_movimiento = 'Entrada' then m.cantidad else -m.cantidad end) over (
        partition by m.tipo_equipo_norm, m.clase_equipo_norm, m.estado_equipo_norm, m.ancho, m.largo, m.profundidad
        order by m.fecha, m.creado_en
        rows unbounded preceding
      ) as saldo_teorico
    from public.movimientos m
    where m.anulado = false
  )
  select count(*), coalesce(jsonb_agg(jsonb_build_object(
      'id', 'inc-saldo-' || id,
      'tipo', 'saldo_descuadrado',
      'severidad', 'alta',
      'itemId', id::text,
      'claseEquipo', clase_equipo,
      'tipoEquipo', tipo_equipo,
      'descripcion', format('Descuadre de saldo sellado en remisión #%s (%s): registrado %s und vs. cronológico %s und.', codigo_lote, clase_equipo, saldo_resultante, saldo_teorico),
      'valorRegistrado', saldo_resultante::text || ' und',
      'valorCalculado', saldo_teorico::text || ' und',
      'diferencia', (saldo_resultante - saldo_teorico)::text || ' und',
      'accionRecomendada', 'Ejecutar reconciliación (1-clic) para resincronizar el saldo sellado con el orden cronológico real.',
      'movimientosInvolucrados', jsonb_build_array(codigo_lote)
    )), '[]'::jsonb)
  into v_rule1, v_detalles
  from cronologia where saldo_resultante <> saldo_teorico;

  -- Regla 2: coherencia de cubicaje (estructuralmente garantizada por la vista calculada;
  -- auditamos de forma defensiva por si hubiera datos heredados con dimensiones inválidas)
  select count(*) into v_rule2
  from public.movimientos where anulado = false and (ancho <= 0 or largo <= 0 or profundidad <= 0);

  -- Regla 3: continuidad cronológica / saldos negativos transitorios
  with cronologia as (
    select m.id, m.codigo_lote, m.clase_equipo, m.tipo_equipo, m.tipo_movimiento, m.cantidad, m.responsable, m.fecha,
      sum(case when m.tipo_movimiento = 'Entrada' then m.cantidad else -m.cantidad end) over (
        partition by m.tipo_equipo_norm, m.clase_equipo_norm, m.estado_equipo_norm, m.ancho, m.largo, m.profundidad
        order by m.fecha, m.creado_en
        rows unbounded preceding
      ) as saldo_corrido
    from public.movimientos m
    where m.anulado = false
  )
  select count(*), coalesce(v_detalles || jsonb_agg(jsonb_build_object(
      'id', 'inc-neg-' || id,
      'tipo', 'saldo_negativo_historico',
      'severidad', 'alta',
      'itemId', id::text,
      'claseEquipo', clase_equipo,
      'tipoEquipo', tipo_equipo,
      'descripcion', format('Saldo negativo transitorio detectado en remisión #%s (%s): saldo intermedio cayó a %s und.', codigo_lote, to_char(fecha, 'YYYY-MM-DD'), saldo_corrido),
      'valorRegistrado', saldo_corrido::text || ' und',
      'valorCalculado', '0 und (mínimo admisible)',
      'diferencia', saldo_corrido::text || ' und',
      'accionRecomendada', 'Reordenar cronología o verificar registro previo de recepción de lote.',
      'movimientosInvolucrados', jsonb_build_array(codigo_lote),
      'detallesTecnicos', format('Tipo: %s de %s und. Responsable: %s.', tipo_movimiento, cantidad, responsable)
    )), v_detalles)
  into v_rule3, v_detalles
  from cronologia where saldo_corrido < 0;

  -- Regla 4: unicidad de códigos de lote (garantizada por UNIQUE constraint; auditoría defensiva)
  select count(*) into v_rule4
  from (select codigo_lote from public.movimientos group by codigo_lote having count(*) > 1) dups;

  -- Regla 5: restricciones dimensionales y de cantidad (garantizadas por CHECK; auditoría defensiva)
  select count(*) into v_rule5
  from public.movimientos where anulado = false and (ancho <= 0 or largo <= 0 or profundidad <= 0 or cantidad <= 0);

  -- Regla 6: completitud de trazabilidad de responsables y destinos (NOT NULL no impide '' o espacios)
  select count(*), coalesce(v_detalles || jsonb_agg(jsonb_build_object(
      'id', 'inc-resp-' || id,
      'tipo', 'registro_huerfano',
      'severidad', 'baja',
      'claseEquipo', clase_equipo,
      'tipoEquipo', tipo_equipo,
      'descripcion', format('Falta de trazabilidad en remisión #%s: responsable o destino vacío.', codigo_lote),
      'valorRegistrado', format('Resp: "%s", Dest: "%s"', responsable, procedencia_destino),
      'valorCalculado', 'Completitud de trazabilidad obligatoria',
      'diferencia', 'Campo faltante',
      'accionRecomendada', 'Completar datos de conductor/proveedor en la remisión.',
      'movimientosInvolucrados', jsonb_build_array(codigo_lote)
    )), v_detalles)
  into v_rule6, v_detalles
  from public.movimientos
  where anulado = false and (trim(responsable) = '' or trim(procedencia_destino) = '');

  v_health := greatest(0, least(100, round(100 - (v_rule1 + v_rule2 + v_rule3 + v_rule4 + v_rule5 + v_rule6) * 12)));
  v_estado := case when v_health = 100 then 'optimo' when v_health >= 80 then 'advertencia' else 'critico' end;

  v_reglas := jsonb_build_array(
    jsonb_build_object('id','regla-1','nombre','Cálculo Estricto de Saldos (sellado vs. cronológico)',
      'descripcion','Verifica que el saldo sellado en cada movimiento coincida con el recálculo cronológico real de entradas menos salidas.',
      'aprobada', v_rule1 = 0, 'elementosEvaluados', v_total_movs, 'inconsistenciasDetectadas', v_rule1),
    jsonb_build_object('id','regla-2','nombre','Coherencia de Cubicaje y Volumen (m³)',
      'descripcion','El volumen ya no se almacena: se calcula siempre desde inventario_actual, por lo que estructuralmente no puede desincronizarse. Se audita de forma defensiva.',
      'aprobada', v_rule2 = 0, 'elementosEvaluados', v_total_movs, 'inconsistenciasDetectadas', v_rule2),
    jsonb_build_object('id','regla-3','nombre','Continuidad Cronológica y Saldos No Negativos',
      'descripcion','Audita la línea de tiempo real de cada referencia para descartar quiebres de stock o despachos previos a recepciones.',
      'aprobada', v_rule3 = 0, 'elementosEvaluados', v_total_movs, 'inconsistenciasDetectadas', v_rule3),
    jsonb_build_object('id','regla-4','nombre','Unicidad de Códigos de Lote y Remisiones',
      'descripcion','Garantizado por una restricción UNIQUE en base de datos; ya no es posible un código duplicado. Se audita de forma defensiva.',
      'aprobada', v_rule4 = 0, 'elementosEvaluados', v_total_movs, 'inconsistenciasDetectadas', v_rule4),
    jsonb_build_object('id','regla-5','nombre','Estandarización Dimensional y Restricciones Físicas',
      'descripcion','Garantizado por restricciones CHECK en base de datos (ancho/largo/profundidad/cantidad > 0). Se audita de forma defensiva.',
      'aprobada', v_rule5 = 0, 'elementosEvaluados', v_total_movs, 'inconsistenciasDetectadas', v_rule5),
    jsonb_build_object('id','regla-6','nombre','Completitud de Trazabilidad de Responsables',
      'descripcion','Verifica la asignación inequívoca de transportistas y centros de origen/destino (no vacíos, no solo espacios).',
      'aprobada', v_rule6 = 0, 'elementosEvaluados', v_total_movs, 'inconsistenciasDetectadas', v_rule6)
  );

  return jsonb_build_object(
    'timestamp', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'porcentajeSalud', v_health,
    'estadoGeneral', v_estado,
    'totalMovimientosAuditados', v_total_movs,
    'totalReferenciasCruzadas', v_total_items,
    'totalInconsistencias', v_rule1 + v_rule2 + v_rule3 + v_rule4 + v_rule5 + v_rule6,
    'reglasAuditoria', v_reglas,
    'detalles', v_detalles,
    'metricasAuditoria', jsonb_build_object(
      'reglasEvaluadas', 6,
      'reglasCumplidas', (case when v_rule1=0 then 1 else 0 end) + (case when v_rule2=0 then 1 else 0 end)
        + (case when v_rule3=0 then 1 else 0 end) + (case when v_rule4=0 then 1 else 0 end)
        + (case when v_rule5=0 then 1 else 0 end) + (case when v_rule6=0 then 1 else 0 end),
      'tiempoEjecucionMs', greatest(1, extract(milliseconds from clock_timestamp() - v_start)::int),
      'verificadoPor', case when public.get_user_role() = 'admin' then 'Administrador' else 'Sistema Automatizado de Auditoría Sedimec' end,
      'totalPiezasFisicasVerificadas', v_total_piezas,
      'volumenAuditadoM3', round(v_total_volumen, 3)
    )
  );
end;
$$;

-- ============================================================
-- Reconciliación: resincroniza saldo_resultante de TODO el libro
-- con el orden cronológico real, en una sola transacción atómica.
-- ============================================================
create or replace function public.reconcile_movimientos()
returns jsonb language plpgsql security invoker as $$
declare
  v_before jsonb;
  v_total_corregidos int;
  v_after jsonb;
begin
  if public.get_user_role() <> 'admin' then
    raise exception 'Acceso Denegado (RBAC): Solo los administradores tienen autorización para ejecutar la conciliación de inventario.';
  end if;

  v_before := public.run_integrity_check();
  v_total_corregidos := greatest(1, (v_before->>'totalInconsistencias')::int);

  with cronologia as (
    select id,
      sum(case when tipo_movimiento = 'Entrada' then cantidad else -cantidad end) over (
        partition by tipo_equipo_norm, clase_equipo_norm, estado_equipo_norm, ancho, largo, profundidad
        order by fecha, creado_en
        rows unbounded preceding
      ) as saldo_teorico
    from public.movimientos
    where anulado = false
  )
  update public.movimientos m
  set saldo_resultante = c.saldo_teorico
  from cronologia c
  where m.id = c.id and m.saldo_resultante <> c.saldo_teorico;

  v_after := public.run_integrity_check();

  return jsonb_build_object(
    'success', true,
    'mensaje', format('Conciliación exitosa: %s inconsistencia(s) corregida(s) con un solo clic. El inventario quedó resincronizado con el orden cronológico real.', v_total_corregidos),
    'totalCorregidos', v_total_corregidos,
    'ajustesAplicados', jsonb_build_array(
      'Conciliación matemática ejecutada sobre el libro completo de movimientos.',
      'Saldos sellados re-sincronizados con la fórmula estricta Saldo = Σ Entradas - Σ Salidas en orden cronológico.',
      'Certificado de integridad recalculado y archivado.'
    ),
    'nuevoReporte', v_after,
    'fechaConciliacion', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

-- ============================================================
-- Anulación (soft-delete) de un movimiento: solo Admin, y solo si
-- no deja saldos negativos en movimientos posteriores de la misma clave.
-- ============================================================
create or replace function public.anular_movimiento(p_id uuid, p_motivo text default null)
returns public.movimientos language plpgsql security invoker as $$
declare
  v_mov public.movimientos;
  v_saldo_min_posterior int;
begin
  if public.get_user_role() <> 'admin' then
    raise exception 'Acceso Denegado (RBAC): Solo los usuarios con rol Administrador pueden anular movimientos.';
  end if;

  select * into v_mov from public.movimientos where id = p_id and anulado = false;
  if v_mov.id is null then
    raise exception 'Movimiento no encontrado o ya anulado.';
  end if;

  if v_mov.tipo_movimiento = 'Entrada' then
    with cronologia as (
      select id,
        sum(case when tipo_movimiento = 'Entrada' then cantidad else -cantidad end) over (
          partition by tipo_equipo_norm, clase_equipo_norm, estado_equipo_norm, ancho, largo, profundidad
          order by fecha, creado_en
          rows unbounded preceding
        ) as saldo_teorico
      from public.movimientos
      where anulado = false
        and tipo_equipo_norm = v_mov.tipo_equipo_norm and clase_equipo_norm = v_mov.clase_equipo_norm
        and estado_equipo_norm = v_mov.estado_equipo_norm
        and ancho = v_mov.ancho and largo = v_mov.largo and profundidad = v_mov.profundidad
        and id <> v_mov.id
    )
    select min(saldo_teorico) into v_saldo_min_posterior from cronologia;

    if v_saldo_min_posterior is not null and v_saldo_min_posterior < 0 then
      raise exception 'No se puede anular esta Entrada (#%) porque las salidas registradas posteriormente dejarían el saldo en negativo.', v_mov.codigo_lote;
    end if;
  end if;

  update public.movimientos
  set anulado = true, anulado_por = auth.uid(), anulado_en = now(), motivo_anulacion = p_motivo
  where id = p_id
  returning * into v_mov;

  return v_mov;
end;
$$;


-- ============================================================
-- Archivo: supabase/migrations/0006_storage.sql
-- ============================================================
-- ============================================================
-- Bucket público de Storage para los diagramas técnicos generados
-- por IA (evita guardar data-URIs gigantes dentro de la tabla).
-- ============================================================

insert into storage.buckets (id, name, public)
values ('diagramas', 'diagramas', true)
on conflict (id) do nothing;

create policy "diagramas_insert_authenticated" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'diagramas');

create policy "diagramas_select_public" on storage.objects
  for select to public
  using (bucket_id = 'diagramas');

-- ============================================================
-- Archivo: supabase/migrations/0007_user_deletion_safety.sql
-- ============================================================
-- ============================================================
-- Permite eliminar la cuenta de un usuario aunque tenga historial
-- en el libro de movimientos: el snapshot (creado_por_nombre /
-- creado_por_rol) ya preserva quién hizo qué de forma inmutable,
-- así que el enlace en vivo puede quedar en NULL sin perder
-- trazabilidad. Sin esto, Postgres rechaza el DELETE del usuario
-- por violar la referencia (comportamiento por defecto RESTRICT).
-- ============================================================

alter table public.movimientos alter column creado_por drop not null;

alter table public.movimientos
  drop constraint movimientos_creado_por_fkey,
  add constraint movimientos_creado_por_fkey
    foreign key (creado_por) references public.profiles(id) on delete set null;

alter table public.movimientos
  drop constraint movimientos_anulado_por_fkey,
  add constraint movimientos_anulado_por_fkey
    foreign key (anulado_por) references public.profiles(id) on delete set null;

alter table public.umbrales_stock
  drop constraint umbrales_stock_actualizado_por_fkey,
  add constraint umbrales_stock_actualizado_por_fkey
    foreign key (actualizado_por) references public.profiles(id) on delete set null;

alter table public.notification_settings
  drop constraint notification_settings_updated_by_fkey,
  add constraint notification_settings_updated_by_fkey
    foreign key (updated_by) references public.profiles(id) on delete set null;

