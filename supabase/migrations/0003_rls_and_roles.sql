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
