-- RitsuScope: quantity takeoff (PDF / IFC sheets, levels, walls, areas, counts, zones, 3D share links)
-- and its library (materials, recipes, wall types). Same schema as the ExcelisPro takeoff module,
-- with RitsuFlow access rules:
--   * project data: read = private.can_access_project, write = private.can_manage_project
--   * library, two layers:
--       - RitsuFlow standard library (organization_id null): every member reads it, only the
--         platform owner edits it;
--       - company library (organization_id set): only that company reads and edits it
--         (owner / admin / planner). Rows created by a company user land there automatically.
--   * project-specific wall types follow the project rules.

-- ---------------------------------------------------------------- helpers
create or replace function private.ritsuscope_is_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    exists (select 1 from public.organization_members m where m.user_id = auth.uid() and m.status = 'active')
    or private.is_platform_owner()
  );
$$;

-- Library row visible: the standard library (no company) to every member; a company's rows to that company.
create or replace function private.ritsuscope_can_read_library(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when target_organization_id is null then private.ritsuscope_is_member()
              else private.is_organization_member(target_organization_id) or private.is_platform_owner() end;
$$;

-- Library row editable: the standard library by the platform owner; a company's rows by its owner / admin / planner.
create or replace function private.ritsuscope_can_edit_library(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when target_organization_id is null then private.is_platform_owner()
              else private.has_organization_role(target_organization_id, array['owner', 'admin', 'planner']) or private.is_platform_owner() end;
$$;

-- New library rows from a company user go to that company's library; the platform owner adds to the standard one.
create or replace function private.ritsuscope_library_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.organization_id is null and not private.is_platform_owner() then
    select m.organization_id into new.organization_id
      from public.organization_members m
     where m.user_id = auth.uid() and m.status = 'active'
     order by m.joined_at nulls last
     limit 1;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------- library
create table public.takeoff_reference_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  publisher text,
  edition text,
  published_on date,
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  url text,
  license_note text,
  notes text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.takeoff_recipes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  maker text,
  system text,
  kind text not null check (kind in ('linear', 'area', 'count')),
  height_basis_m numeric check (height_basis_m is null or height_basis_m > 0),
  waste_included_pct numeric not null default 0 check (waste_included_pct >= 0),
  status text not null default 'draft' check (status in ('draft', 'review', 'approved')),
  source jsonb not null default '{}'::jsonb,
  notes text,
  lines jsonb not null default '[]'::jsonb check (jsonb_typeof(lines) = 'array'),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  region text,
  source_id uuid references public.takeoff_reference_sources(id) on delete set null,
  mode text not null default 'fixed' check (mode in ('fixed', 'system'))
);

create table public.takeoff_materials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  code text,
  name text not null,
  category text not null default 'other' check (category in ('board', 'stud', 'track', 'screw', 'compound', 'tape', 'insulation', 'profile', 'accessory', 'other')),
  unit text not null,
  pack_size numeric check (pack_size is null or pack_size > 0),
  pack_name text,
  manufacturer text,
  notes text,
  status text not null default 'draft' check (status in ('draft', 'review', 'approved')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  supplier text
);
create unique index takeoff_materials_country_name_key on public.takeoff_materials (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), country_code, lower(name));
create index takeoff_materials_category_idx on public.takeoff_materials (country_code, category);
create index takeoff_materials_supplier_idx on public.takeoff_materials (country_code, supplier);

create table public.takeoff_wall_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  region text,
  code text,
  name text not null,
  category text not null default 'other' check (category in ('non_rated', 'rated', 'shaft', 'furring', 'chase', 'exterior', 'other')),
  fire_rating_hr numeric check (fire_rating_hr is null or fire_rating_hr >= 0),
  stc_min integer check (stc_min is null or stc_min > 0),
  stc_max integer check (stc_max is null or stc_max > 0),
  rated_design text,
  thickness_m numeric check (thickness_m is null or thickness_m > 0),
  framing jsonb not null default '{}'::jsonb check (jsonb_typeof(framing) = 'object'),
  boards jsonb not null default '[]'::jsonb check (jsonb_typeof(boards) = 'array'),
  recipe_id uuid references public.takeoff_recipes(id) on delete set null,
  source_id uuid references public.takeoff_reference_sources(id) on delete set null,
  source_ref text,
  status text not null default 'draft' check (status in ('draft', 'review', 'approved')),
  notes text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  materials jsonb not null default '{}'::jsonb check (jsonb_typeof(materials) = 'object')
);
create unique index takeoff_wall_types_code_key on public.takeoff_wall_types (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), country_code, coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(code)) where code is not null;
create unique index takeoff_wall_types_name_key on public.takeoff_wall_types (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), country_code, coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
create index takeoff_wall_types_country_idx on public.takeoff_wall_types (country_code, region);
create index takeoff_wall_types_project_idx on public.takeoff_wall_types (project_id) where project_id is not null;

-- ---------------------------------------------------------------- project data
create table public.takeoff_levels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  elevation_m numeric not null default 0,
  height_m numeric check (height_m is null or height_m > 0),
  slab_m numeric check (slab_m is null or slab_m >= 0),
  typical_of uuid references public.takeoff_levels(id) on delete set null,
  sort_order integer not null default 0,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint takeoff_levels_not_self check (typical_of is null or typical_of <> id)
);
create unique index takeoff_levels_name_key on public.takeoff_levels (project_id, lower(name));
create index takeoff_levels_project_idx on public.takeoff_levels (project_id, elevation_m);

create table public.takeoff_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null check (kind in ('pdf_page', 'ifc_storey')),
  name text not null,
  file_path text not null,
  page_number integer check (page_number is null or page_number >= 1),
  ifc_storey_guid text,
  scale_pt_per_m numeric check (scale_pt_per_m is null or scale_pt_per_m > 0),
  calibration jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 10,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  origin_x numeric,
  origin_y numeric,
  origin_angle_deg numeric not null default 0,
  level_name text,
  level_elevation_m numeric,
  level_id uuid references public.takeoff_levels(id) on delete set null,
  unique (id, project_id),
  check ((kind = 'pdf_page' and page_number is not null) or (kind = 'ifc_storey' and ifc_storey_guid is not null)),
  constraint takeoff_sources_origin_pair check ((origin_x is null) = (origin_y is null))
);
create index takeoff_sources_project_idx on public.takeoff_sources (project_id);
create index takeoff_sources_level_idx on public.takeoff_sources (level_id) where level_id is not null;

create table public.takeoff_layers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null check (kind in ('linear', 'area', 'count')),
  name text not null,
  system text,
  color text not null default '#109d91',
  thickness_m numeric check (thickness_m is null or thickness_m >= 0),
  height_m numeric check (height_m is null or height_m >= 0),
  elevation_m numeric not null default 0,
  location_id uuid references public.locations(id) on delete set null,
  deduct_openings boolean not null default true,
  framing jsonb not null default '{}'::jsonb,
  is_visible boolean not null default true,
  sort_order integer not null default 10,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  recipe_id uuid references public.takeoff_recipes(id) on delete set null,
  wall_type_id uuid references public.takeoff_wall_types(id) on delete set null,
  unique (id, project_id)
);
create index takeoff_layers_project_idx on public.takeoff_layers (project_id);
create index takeoff_layers_recipe_idx on public.takeoff_layers (recipe_id) where recipe_id is not null;
create index takeoff_layers_wall_type_idx on public.takeoff_layers (wall_type_id) where wall_type_id is not null;

create table public.takeoff_elements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  layer_id uuid not null,
  source_id uuid not null,
  points jsonb not null check (jsonb_typeof(points) = 'array'),
  height_override_m numeric check (height_override_m is null or height_override_m >= 0),
  z_rel_m numeric not null default 0,
  ifc_guid text,
  root_guid text,
  layer_guids text[] not null default '{}'::text[],
  openings jsonb not null default '[]'::jsonb check (jsonb_typeof(openings) = 'array'),
  faces jsonb not null default '{}'::jsonb,
  location_id uuid references public.locations(id) on delete set null,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (layer_id, project_id) references public.takeoff_layers(id, project_id) on delete cascade,
  foreign key (source_id, project_id) references public.takeoff_sources(id, project_id) on delete cascade
);
create index takeoff_elements_project_idx on public.takeoff_elements (project_id);
create index takeoff_elements_layer_idx on public.takeoff_elements (layer_id);
create index takeoff_elements_source_idx on public.takeoff_elements (source_id);
create index takeoff_elements_ifc_guid_idx on public.takeoff_elements (project_id, ifc_guid) where ifc_guid is not null;

create table public.takeoff_zones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_id uuid not null references public.takeoff_sources(id) on delete cascade,
  name text not null,
  color text not null default '#0F9D8A',
  points jsonb not null check (jsonb_typeof(points) = 'array'),
  ceiling_height_m numeric check (ceiling_height_m is null or ceiling_height_m > 0),
  location_id uuid references public.locations(id) on delete set null,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index takeoff_zones_project_idx on public.takeoff_zones (project_id, source_id);
create index takeoff_zones_location_idx on public.takeoff_zones (location_id) where location_id is not null;

create table public.takeoff_framing_defaults (
  project_id uuid primary key references public.projects(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.takeoff_share_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  token text not null unique check (length(token) >= 32),
  title text not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  snapshot_at timestamptz not null default now(),
  revoked_at timestamptz,
  expires_at timestamptz,
  view_count integer not null default 0,
  last_viewed_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index takeoff_share_links_project_idx on public.takeoff_share_links (project_id);

create table public.takeoff_audit_log (
  id bigint generated always as identity primary key,
  project_id uuid not null,
  table_name text not null,
  record_id text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb
);
create index takeoff_audit_log_project_idx on public.takeoff_audit_log (project_id, changed_at desc);

-- ---------------------------------------------------------------- triggers
create or replace function public.takeoff_write_audit_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.takeoff_audit_log (project_id, table_name, record_id, action, old_data, new_data)
  values (
    (v_row ->> 'project_id')::uuid,
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'project_id'),
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;
revoke execute on function public.takeoff_write_audit_log() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['takeoff_reference_sources', 'takeoff_recipes', 'takeoff_materials', 'takeoff_wall_types', 'takeoff_levels', 'takeoff_sources', 'takeoff_layers', 'takeoff_elements', 'takeoff_zones', 'takeoff_framing_defaults', 'takeoff_share_links'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()', t || '_set_updated_at', t);
  end loop;
  foreach t in array array['takeoff_levels', 'takeoff_sources', 'takeoff_layers', 'takeoff_elements', 'takeoff_zones', 'takeoff_framing_defaults', 'takeoff_share_links'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.takeoff_write_audit_log()', t || '_audit', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- row level security
do $$
declare t text;
begin
  -- Project data.
  foreach t in array array['takeoff_levels', 'takeoff_sources', 'takeoff_layers', 'takeoff_elements', 'takeoff_zones', 'takeoff_framing_defaults', 'takeoff_share_links'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.can_access_project(project_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.can_manage_project(project_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.can_manage_project(project_id)) with check (private.can_manage_project(project_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.can_manage_project(project_id))', t || '_delete', t);
  end loop;
  -- Shared library.
  foreach t in array array['takeoff_reference_sources', 'takeoff_recipes', 'takeoff_materials'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.ritsuscope_can_read_library(organization_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.ritsuscope_can_edit_library(organization_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.ritsuscope_can_edit_library(organization_id)) with check (private.ritsuscope_can_edit_library(organization_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.ritsuscope_can_edit_library(organization_id))', t || '_delete', t);
    execute format('create trigger %I before insert on public.%I for each row execute function private.ritsuscope_library_owner()', t || '_library_owner', t);
  end loop;
end $$;

-- Wall types: the library (no project) like the other library tables; project types like project data.
alter table public.takeoff_wall_types enable row level security;
create policy takeoff_wall_types_select on public.takeoff_wall_types for select to authenticated
  using (case when project_id is null then private.ritsuscope_can_read_library(organization_id) else private.can_access_project(project_id) end);
create policy takeoff_wall_types_insert on public.takeoff_wall_types for insert to authenticated
  with check (case when project_id is null then private.ritsuscope_can_edit_library(organization_id) else private.can_manage_project(project_id) end);
create policy takeoff_wall_types_update on public.takeoff_wall_types for update to authenticated
  using (case when project_id is null then private.ritsuscope_can_edit_library(organization_id) else private.can_manage_project(project_id) end)
  with check (case when project_id is null then private.ritsuscope_can_edit_library(organization_id) else private.can_manage_project(project_id) end);
create policy takeoff_wall_types_delete on public.takeoff_wall_types for delete to authenticated
  using (case when project_id is null then private.ritsuscope_can_edit_library(organization_id) else private.can_manage_project(project_id) end);

create trigger takeoff_wall_types_library_owner before insert on public.takeoff_wall_types
  for each row execute function private.ritsuscope_library_owner();

alter table public.takeoff_audit_log enable row level security;
create policy takeoff_audit_log_select on public.takeoff_audit_log for select to authenticated using (private.can_access_project(project_id));

-- ---------------------------------------------------------------- public 3D share links
create or replace function public.get_takeoff_share(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_link public.takeoff_share_links%rowtype;
  v_project text;
begin
  if p_token is null or length(p_token) < 32 then
    return null;
  end if;
  select * into v_link from public.takeoff_share_links
   where token = p_token and revoked_at is null and (expires_at is null or expires_at > now());
  if not found then
    return null;
  end if;
  select name into v_project from public.projects where id = v_link.project_id;
  update public.takeoff_share_links set view_count = view_count + 1, last_viewed_at = now() where id = v_link.id;
  return jsonb_build_object('title', v_link.title, 'project', v_project, 'snapshot_at', v_link.snapshot_at, 'snapshot', v_link.snapshot);
end;
$$;
grant execute on function public.get_takeoff_share(text) to anon, authenticated;

-- ---------------------------------------------------------------- file storage (paths start with the project id)
insert into storage.buckets (id, name, public) values ('takeoff-files', 'takeoff-files', false)
on conflict (id) do nothing;

create or replace function private.ritsuscope_file_project(object_name text)
returns uuid language sql immutable set search_path = '' as $$
  select case when split_part(object_name, '/', 1) ~ '^[0-9a-fA-F-]{36}$' then split_part(object_name, '/', 1)::uuid end;
$$;

create policy "RitsuScope files: read" on storage.objects for select to authenticated
  using (bucket_id = 'takeoff-files' and private.can_access_project(private.ritsuscope_file_project(name)));
create policy "RitsuScope files: upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'takeoff-files' and private.can_manage_project(private.ritsuscope_file_project(name)));
create policy "RitsuScope files: update" on storage.objects for update to authenticated
  using (bucket_id = 'takeoff-files' and private.can_manage_project(private.ritsuscope_file_project(name)))
  with check (bucket_id = 'takeoff-files' and private.can_manage_project(private.ritsuscope_file_project(name)));
create policy "RitsuScope files: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'takeoff-files' and private.can_manage_project(private.ritsuscope_file_project(name)));

grant execute on function private.ritsuscope_is_member() to authenticated;
grant execute on function private.ritsuscope_can_read_library(uuid) to authenticated;
grant execute on function private.ritsuscope_can_edit_library(uuid) to authenticated;
grant execute on function private.ritsuscope_file_project(text) to authenticated;
