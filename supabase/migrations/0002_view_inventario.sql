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
