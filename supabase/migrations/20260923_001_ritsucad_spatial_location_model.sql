-- RitsuCAD spatial location model
-- Adds explicit macro/micro identity and persistent visual coding without
-- duplicating the project's canonical Location Breakdown Structure.

create table if not exists public.project_micro_locations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_location_id uuid not null references public.locations(id) on delete cascade,
  parent_micro_location_id uuid references public.project_micro_locations(id) on delete cascade,
  code text not null,
  name text not null,
  micro_type text not null default 'space',
  sequence_number integer not null default 0,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, parent_location_id, code)
);

create table if not exists public.project_location_styles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  location_scope text not null check (location_scope in ('macro','micro')),
  location_id uuid references public.locations(id) on delete cascade,
  micro_location_id uuid references public.project_micro_locations(id) on delete cascade,
  color_hex text not null default '#2F80ED' check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  fill_opacity numeric not null default 0.18 check (fill_opacity between 0 and 1),
  stroke_opacity numeric not null default 1 check (stroke_opacity between 0 and 1),
  stroke_width numeric not null default 2 check (stroke_width > 0),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (location_scope='macro' and location_id is not null and micro_location_id is null)
    or
    (location_scope='micro' and location_id is null and micro_location_id is not null)
  )
);

create unique index if not exists project_location_styles_macro_uidx
  on public.project_location_styles(project_id, location_id)
  where location_scope='macro';
create unique index if not exists project_location_styles_micro_uidx
  on public.project_location_styles(project_id, micro_location_id)
  where location_scope='micro';
create index if not exists project_micro_locations_parent_idx
  on public.project_micro_locations(project_id, parent_location_id);

alter table public.project_drawing_location_geometries
  add column if not exists location_scope text not null default 'macro'
    check (location_scope in ('macro','micro')),
  add column if not exists micro_location_id uuid references public.project_micro_locations(id) on delete cascade,
  add column if not exists color_hex text,
  add column if not exists fill_opacity numeric default 0.18 check (fill_opacity is null or fill_opacity between 0 and 1),
  add column if not exists stroke_opacity numeric default 1 check (stroke_opacity is null or stroke_opacity between 0 and 1),
  add column if not exists stroke_width numeric default 2 check (stroke_width is null or stroke_width > 0);

-- Existing records remain macro mappings. New micro mappings use micro_location_id.
alter table public.project_drawing_location_geometries
  alter column location_id drop not null;

alter table public.project_drawing_location_geometries
  drop constraint if exists project_drawing_location_geometries_location_identity_check;
alter table public.project_drawing_location_geometries
  add constraint project_drawing_location_geometries_location_identity_check check (
    (location_scope='macro' and location_id is not null and micro_location_id is null)
    or
    (location_scope='micro' and location_id is null and micro_location_id is not null)
  );

create unique index if not exists project_drawing_location_geometries_macro_uidx
  on public.project_drawing_location_geometries(drawing_map_id, location_id)
  where location_scope='macro';
create unique index if not exists project_drawing_location_geometries_micro_uidx
  on public.project_drawing_location_geometries(drawing_map_id, micro_location_id)
  where location_scope='micro';

alter table public.project_micro_locations enable row level security;
alter table public.project_location_styles enable row level security;

create policy project_micro_locations_select on public.project_micro_locations
  for select to authenticated using (private.can_access_project(project_id));
create policy project_micro_locations_insert on public.project_micro_locations
  for insert to authenticated with check (private.can_manage_project(project_id) and created_by=auth.uid());
create policy project_micro_locations_update on public.project_micro_locations
  for update to authenticated using (private.can_manage_project(project_id)) with check (private.can_manage_project(project_id));
create policy project_micro_locations_delete on public.project_micro_locations
  for delete to authenticated using (private.can_manage_project(project_id));

create policy project_location_styles_select on public.project_location_styles
  for select to authenticated using (private.can_access_project(project_id));
create policy project_location_styles_insert on public.project_location_styles
  for insert to authenticated with check (private.can_manage_project(project_id) and created_by=auth.uid());
create policy project_location_styles_update on public.project_location_styles
  for update to authenticated using (private.can_manage_project(project_id)) with check (private.can_manage_project(project_id));
create policy project_location_styles_delete on public.project_location_styles
  for delete to authenticated using (private.can_manage_project(project_id));

comment on table public.project_micro_locations is 'Detailed physical subdivisions inside canonical macro LBS locations, such as rooms, apartments, units and spaces.';
comment on table public.project_location_styles is 'Persistent visual identity for macro and micro locations across RitsuCAD drawings.';
