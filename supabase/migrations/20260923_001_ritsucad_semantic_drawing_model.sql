-- RitsuCAD semantic drawing model
-- Foundation: Drawing -> Revision -> View -> Layer -> Construction Object -> Geometry -> Quantity

create table if not exists public.ritsucad_drawings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  document_id uuid references public.project_documents(id) on delete set null,
  name text not null,
  drawing_number text,
  discipline text,
  description text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ritsucad_drawing_revisions (
  id uuid primary key default gen_random_uuid(),
  drawing_id uuid not null references public.ritsucad_drawings(id) on delete cascade,
  document_id uuid not null references public.project_documents(id) on delete restrict,
  revision_code text not null default '00',
  revision_date date,
  description text,
  is_current boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (drawing_id, revision_code)
);

create unique index if not exists ritsucad_drawing_revisions_one_current_idx
  on public.ritsucad_drawing_revisions(drawing_id)
  where is_current;

create table if not exists public.ritsucad_views (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  drawing_revision_id uuid not null references public.ritsucad_drawing_revisions(id) on delete cascade,
  name text not null,
  view_type text not null default 'custom',
  page_number integer not null default 1 check (page_number > 0),
  description text,
  is_coordination_view boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (drawing_revision_id, page_number, name)
);

create table if not exists public.ritsucad_layers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  drawing_revision_id uuid not null references public.ritsucad_drawing_revisions(id) on delete cascade,
  name text not null,
  discipline text,
  object_type text not null,
  type_code text,
  description text,
  is_visible boolean not null default true,
  is_locked boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (drawing_revision_id, name)
);

create table if not exists public.ritsucad_view_layers (
  view_id uuid not null references public.ritsucad_views(id) on delete cascade,
  layer_id uuid not null references public.ritsucad_layers(id) on delete cascade,
  is_visible boolean not null default true,
  display_order integer not null default 0,
  primary key (view_id, layer_id)
);

create table if not exists public.ritsucad_objects (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  drawing_revision_id uuid not null references public.ritsucad_drawing_revisions(id) on delete cascade,
  layer_id uuid not null references public.ritsucad_layers(id) on delete restrict,
  location_id uuid references public.locations(id) on delete set null,
  object_type text not null,
  object_code text,
  type_code text,
  name text,
  page_number integer not null default 1 check (page_number > 0),
  properties jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','superseded','deleted')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ritsucad_object_geometries (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.ritsucad_objects(id) on delete cascade,
  geometry_type text not null check (geometry_type in ('point','line','polyline','polygon','rectangle')),
  geometry jsonb not null,
  calibration jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (object_id)
);

create table if not exists public.ritsucad_object_quantities (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.ritsucad_objects(id) on delete cascade,
  quantity_type text not null,
  value numeric not null,
  unit text not null,
  calculation_source text not null default 'geometry',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (object_id, quantity_type)
);

-- A wall is semantic: centerline length + height produces gross area;
-- openings can later be associated and deducted to produce net area.
create table if not exists public.ritsucad_wall_properties (
  object_id uuid primary key references public.ritsucad_objects(id) on delete cascade,
  height numeric check (height is null or height >= 0),
  thickness numeric check (thickness is null or thickness >= 0),
  height_unit text not null default 'm',
  thickness_unit text not null default 'm',
  assembly_code text,
  exterior boolean,
  notes text
);

create index if not exists ritsucad_drawings_project_idx on public.ritsucad_drawings(project_id);
create index if not exists ritsucad_views_project_idx on public.ritsucad_views(project_id);
create index if not exists ritsucad_layers_project_idx on public.ritsucad_layers(project_id);
create index if not exists ritsucad_objects_project_idx on public.ritsucad_objects(project_id);
create index if not exists ritsucad_objects_revision_idx on public.ritsucad_objects(drawing_revision_id);
create index if not exists ritsucad_objects_layer_idx on public.ritsucad_objects(layer_id);
create index if not exists ritsucad_objects_location_idx on public.ritsucad_objects(location_id);

alter table public.ritsucad_drawings enable row level security;
alter table public.ritsucad_drawing_revisions enable row level security;
alter table public.ritsucad_views enable row level security;
alter table public.ritsucad_layers enable row level security;
alter table public.ritsucad_view_layers enable row level security;
alter table public.ritsucad_objects enable row level security;
alter table public.ritsucad_object_geometries enable row level security;
alter table public.ritsucad_object_quantities enable row level security;
alter table public.ritsucad_wall_properties enable row level security;

create policy ritsucad_drawings_select on public.ritsucad_drawings for select using (private.can_access_project(project_id));
create policy ritsucad_drawings_insert on public.ritsucad_drawings for insert with check (private.can_manage_project(project_id) and created_by = auth.uid());
create policy ritsucad_drawings_update on public.ritsucad_drawings for update using (private.can_manage_project(project_id)) with check (private.can_manage_project(project_id));
create policy ritsucad_drawings_delete on public.ritsucad_drawings for delete using (private.can_manage_project(project_id));

create policy ritsucad_revisions_select on public.ritsucad_drawing_revisions for select using (exists (select 1 from public.ritsucad_drawings d where d.id = drawing_id and private.can_access_project(d.project_id)));
create policy ritsucad_revisions_manage on public.ritsucad_drawing_revisions for all using (exists (select 1 from public.ritsucad_drawings d where d.id = drawing_id and private.can_manage_project(d.project_id))) with check (exists (select 1 from public.ritsucad_drawings d where d.id = drawing_id and private.can_manage_project(d.project_id)));

create policy ritsucad_views_select on public.ritsucad_views for select using (private.can_access_project(project_id));
create policy ritsucad_views_manage on public.ritsucad_views for all using (private.can_manage_project(project_id)) with check (private.can_manage_project(project_id));
create policy ritsucad_layers_select on public.ritsucad_layers for select using (private.can_access_project(project_id));
create policy ritsucad_layers_manage on public.ritsucad_layers for all using (private.can_manage_project(project_id)) with check (private.can_manage_project(project_id));
create policy ritsucad_objects_select on public.ritsucad_objects for select using (private.can_access_project(project_id));
create policy ritsucad_objects_manage on public.ritsucad_objects for all using (private.can_manage_project(project_id)) with check (private.can_manage_project(project_id));

create policy ritsucad_view_layers_select on public.ritsucad_view_layers for select using (exists (select 1 from public.ritsucad_views v where v.id = view_id and private.can_access_project(v.project_id)));
create policy ritsucad_view_layers_manage on public.ritsucad_view_layers for all using (exists (select 1 from public.ritsucad_views v where v.id = view_id and private.can_manage_project(v.project_id))) with check (exists (select 1 from public.ritsucad_views v where v.id = view_id and private.can_manage_project(v.project_id)));

create policy ritsucad_geometries_select on public.ritsucad_object_geometries for select using (exists (select 1 from public.ritsucad_objects o where o.id = object_id and private.can_access_project(o.project_id)));
create policy ritsucad_geometries_manage on public.ritsucad_object_geometries for all using (exists (select 1 from public.ritsucad_objects o where o.id = object_id and private.can_manage_project(o.project_id))) with check (exists (select 1 from public.ritsucad_objects o where o.id = object_id and private.can_manage_project(o.project_id)));
create policy ritsucad_quantities_select on public.ritsucad_object_quantities for select using (exists (select 1 from public.ritsucad_objects o where o.id = object_id and private.can_access_project(o.project_id)));
create policy ritsucad_quantities_manage on public.ritsucad_object_quantities for all using (exists (select 1 from public.ritsucad_objects o where o.id = object_id and private.can_manage_project(o.project_id))) with check (exists (select 1 from public.ritsucad_objects o where o.id = object_id and private.can_manage_project(o.project_id)));
create policy ritsucad_wall_properties_select on public.ritsucad_wall_properties for select using (exists (select 1 from public.ritsucad_objects o where o.id = object_id and private.can_access_project(o.project_id)));
create policy ritsucad_wall_properties_manage on public.ritsucad_wall_properties for all using (exists (select 1 from public.ritsucad_objects o where o.id = object_id and private.can_manage_project(o.project_id))) with check (exists (select 1 from public.ritsucad_objects o where o.id = object_id and private.can_manage_project(o.project_id)));
