create table if not exists public.fieldop_project_locations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  is_active boolean not null default true,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, location_id)
);

create index if not exists fieldop_project_locations_project_idx
  on public.fieldop_project_locations(project_id);

create index if not exists fieldop_project_locations_location_idx
  on public.fieldop_project_locations(location_id);

alter table public.fieldop_project_locations enable row level security;

create policy fieldop_project_locations_select
  on public.fieldop_project_locations
  for select
  using (private.rbac_can_project_action(project_id, 'projects.view'));

create policy fieldop_project_locations_insert
  on public.fieldop_project_locations
  for insert
  with check (
    created_by = auth.uid()
    and private.rbac_can_project_action(project_id, 'projects.edit')
  );

create policy fieldop_project_locations_update
  on public.fieldop_project_locations
  for update
  using (private.rbac_can_project_action(project_id, 'projects.edit'))
  with check (private.rbac_can_project_action(project_id, 'projects.edit'));

create policy fieldop_project_locations_delete
  on public.fieldop_project_locations
  for delete
  using (private.rbac_can_project_action(project_id, 'projects.edit'));
