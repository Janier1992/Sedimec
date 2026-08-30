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
