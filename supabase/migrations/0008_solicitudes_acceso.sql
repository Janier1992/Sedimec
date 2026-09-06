-- ============================================================
-- Solicitudes de acceso: reemplaza el autorregistro por correo
-- (limitado por la cuota de envío de Supabase Auth) por un modelo
-- de aprobación manual. La cuenta se crea confirmada de una vez
-- (sin correo), pero queda en estado 'pendiente' hasta que un
-- Administrador la aprueba desde el portal de Administración.
-- ============================================================

alter table public.profiles
  add column estado text not null default 'aprobado'
    check (estado in ('pendiente', 'aprobado'));

create index idx_profiles_estado on public.profiles(estado);

-- ============================================================
-- get_user_role() ahora solo devuelve el rol si la cuenta está
-- aprobada -- una cuenta pendiente pasa toda verificación de rol
-- como si no tuviera ninguno (RLS la bloquea en todas las tablas).
-- ============================================================
create or replace function public.get_user_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$ select rol from public.profiles where id = auth.uid() and estado = 'aprobado' $$;

-- ============================================================
-- Alta de perfil: si el registro viene marcado como autoservicio
-- (raw_user_meta_data->>'self_registered' = 'true', puesto por la
-- función pública request-access), nace 'pendiente'. Cualquier otra
-- alta (creación directa por un Administrador vía admin-create-user)
-- nace 'aprobado', como hasta ahora.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nombre, email, rol, cargo, estado)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    new.email,
    'operador',
    coalesce(new.raw_user_meta_data->>'cargo', 'Operador de Patio'),
    case when new.raw_user_meta_data->>'self_registered' = 'true' then 'pendiente' else 'aprobado' end
  );
  return new;
end;
$$;

-- ============================================================
-- Nadie puede auto-aprobarse ni auto-promoverse de rol.
-- Se usa "is distinct from" en vez de "<>": con get_user_role()
-- devolviendo NULL para cuentas pendientes, "NULL <> 'admin'" es
-- NULL (falso) y el trigger dejaría pasar el cambio sin querer.
-- ============================================================
create or replace function public.prevent_role_self_escalation()
returns trigger language plpgsql as $$
begin
  if new.rol <> old.rol and public.get_user_role() is distinct from 'admin' then
    raise exception 'Solo un Administrador puede cambiar el rol de un usuario.';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_estado_self_approval()
returns trigger language plpgsql as $$
begin
  if new.estado <> old.estado and public.get_user_role() is distinct from 'admin' then
    raise exception 'Solo un Administrador puede aprobar el acceso de una cuenta.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_estado_self_approval on public.profiles;
create trigger trg_prevent_estado_self_approval
  before update on public.profiles
  for each row execute function public.prevent_estado_self_approval();

-- ============================================================
-- Mismo ajuste "is distinct from" en las dos RPC que ya
-- comprobaban el rol manualmente como defensa adicional a RLS.
-- ============================================================
create or replace function public.reconcile_movimientos()
returns jsonb language plpgsql security invoker as $$
declare
  v_before jsonb;
  v_total_corregidos int;
  v_after jsonb;
begin
  if public.get_user_role() is distinct from 'admin' then
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

create or replace function public.anular_movimiento(p_id uuid, p_motivo text default null)
returns public.movimientos language plpgsql security invoker as $$
declare
  v_mov public.movimientos;
  v_saldo_min_posterior int;
begin
  if public.get_user_role() is distinct from 'admin' then
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
-- RLS: una cuenta pendiente puede leer su propio perfil (para que
-- la app le muestre "cuenta pendiente de aprobación"), pero deja de
-- tener el acceso de lectura general que sí tienen las aprobadas.
-- ============================================================
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select to authenticated
  using (auth.uid() = id or public.get_user_role() is not null);

drop policy if exists "movimientos_select_all" on public.movimientos;
create policy "movimientos_select_all" on public.movimientos
  for select to authenticated using (public.get_user_role() is not null);

drop policy if exists "umbrales_select_all" on public.umbrales_stock;
create policy "umbrales_select_all" on public.umbrales_stock
  for select to authenticated using (public.get_user_role() is not null);

drop policy if exists "alertas_select_all" on public.alertas_stock_email;
create policy "alertas_select_all" on public.alertas_stock_email
  for select to authenticated using (public.get_user_role() is not null);

drop policy if exists "notif_select_all" on public.notification_settings;
create policy "notif_select_all" on public.notification_settings
  for select to authenticated using (public.get_user_role() is not null);
