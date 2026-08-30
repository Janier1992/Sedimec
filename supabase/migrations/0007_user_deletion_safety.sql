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
