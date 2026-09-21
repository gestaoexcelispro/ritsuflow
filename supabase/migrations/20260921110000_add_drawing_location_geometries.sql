create table if not exists public.project_drawing_location_geometries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  drawing_map_id uuid not null references public.project_drawing_maps(id) on delete cascade,
  document_id uuid not null references public.project_documents(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  page_number integer not null default 1 check (page_number > 0),
  geometry_type text not null default 'polygon' check (geometry_type = 'polygon'),
  geometry jsonb not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (drawing_map_id, location_id)
);

create index if not exists project_drawing_location_geometries_project_idx
  on public.project_drawing_location_geometries(project_id);
create index if not exists project_drawing_location_geometries_document_idx
  on public.project_drawing_location_geometries(document_id);
create index if not exists project_drawing_location_geometries_location_idx
  on public.project_drawing_location_geometries(location_id);

alter table public.project_drawing_location_geometries enable row level security;

create policy project_drawing_location_geometries_select
  on public.project_drawing_location_geometries
  for select using (private.can_access_project(project_id));

create policy project_drawing_location_geometries_insert
  on public.project_drawing_location_geometries
  for insert with check (private.can_manage_project(project_id) and created_by = auth.uid());

create policy project_drawing_location_geometries_update
  on public.project_drawing_location_geometries
  for update using (private.can_manage_project(project_id))
  with check (private.can_manage_project(project_id));

create policy project_drawing_location_geometries_delete
  on public.project_drawing_location_geometries
  for delete using (private.can_manage_project(project_id));
