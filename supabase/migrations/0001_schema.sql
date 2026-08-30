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
