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
