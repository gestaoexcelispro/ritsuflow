-- RitsuCAD drawing-to-location associations
-- A project drawing may represent one or more canonical LBS locations.

create table if not exists public.drawing_location_associations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  document_id uuid not null references public.project_documents(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  unique(document_id, location_id)
);

create index if not exists drawing_location_associations_project_idx on public.drawing_location_associations(project_id);
create index if not exists drawing_location_associations_document_idx on public.drawing_location_associations(document_id);
create index if not exists drawing_location_associations_location_idx on public.drawing_location_associations(location_id);

alter table public.drawing_location_associations enable row level security;

create policy drawing_location_associations_select on public.drawing_location_associations
for select to authenticated using (private.can_access_project(project_id));

create policy drawing_location_associations_insert on public.drawing_location_associations
for insert to authenticated with check (private.can_manage_project(project_id) and created_by = auth.uid());

create policy drawing_location_associations_delete on public.drawing_location_associations
for delete to authenticated using (private.can_manage_project(project_id));

create trigger audit_drawing_location_associations
after insert or update or delete on public.drawing_location_associations
for each row execute function public.audit_spatial_mapping_change();