-- RitsuScope, step 1 of the Location Breakdown move:
--   * macro areas: every zone has a kind (Block, Zone, Area, Room);
--   * levels can be linked to the "Floor" location they create in the Location Breakdown;
--   * feature licensing inside RitsuScope: sheets, levels and zoning stay open to every company;
--     takeoff, wall types, the material library, framing, share links and IFC need the
--     RitsuScope license (enforced here, not only in the screens).

-- ---------------------------------------------------------------- 1. macro areas
alter table public.takeoff_zones
  add column if not exists zone_kind text not null default 'room'
  check (zone_kind in ('block', 'zone', 'area', 'room'));

create index if not exists takeoff_zones_location_idx on public.takeoff_zones (location_id);

-- ---------------------------------------------------------------- 2. floors from levels
alter table public.takeoff_levels
  add column if not exists location_id uuid references public.locations(id) on delete set null;

create index if not exists takeoff_levels_location_idx on public.takeoff_levels (location_id);

-- ---------------------------------------------------------------- 3. license checks
-- A company is licensed when its license is trial/active and includes RitsuScope.
create or replace function private.organization_has_ritsuscope(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.organization_workspace_entitlements w
      left join public.organization_commercial_entitlements ce on ce.organization_id = w.organization_id
     where w.organization_id = target_organization_id
       and w.workspace_key = 'ritsuscope'
       and w.is_entitled
       and coalesce(ce.commercial_status, 'active') in ('trial', 'active')
  );
$$;

-- A project can use the paid tools when the platform owner works on it or its company is licensed.
create or replace function private.project_has_ritsuscope(target_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_platform_owner()
      or exists (
        select 1 from public.projects p
         where p.id = target_project_id
           and private.organization_has_ritsuscope(p.organization_id)
      );
$$;

revoke all on function private.organization_has_ritsuscope(uuid) from public, anon;
revoke all on function private.project_has_ritsuscope(uuid) from public, anon;
grant execute on function private.organization_has_ritsuscope(uuid) to authenticated;
grant execute on function private.project_has_ritsuscope(uuid) to authenticated;

-- The company library (materials, recipes, reference sources, library wall types) is edited only
-- by licensed companies; the RitsuFlow standard library stays with the platform owner.
create or replace function private.ritsuscope_can_edit_library(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when target_organization_id is null then private.is_platform_owner()
              else private.is_platform_owner()
                   or (private.has_organization_role(target_organization_id, array['owner', 'admin', 'planner'])
                       and private.organization_has_ritsuscope(target_organization_id)) end;
$$;

-- ---------------------------------------------------------------- 4. paid project data
-- Reading stays open (a company that stops paying still sees its takeoff); writing needs the license.
do $$
declare t text;
begin
  foreach t in array array['takeoff_layers', 'takeoff_elements', 'takeoff_framing_defaults', 'takeoff_share_links'] loop
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.can_manage_project(project_id) and private.project_has_ritsuscope(project_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.can_manage_project(project_id) and private.project_has_ritsuscope(project_id)) with check (private.can_manage_project(project_id) and private.project_has_ritsuscope(project_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.can_manage_project(project_id) and private.project_has_ritsuscope(project_id))', t || '_delete', t);
  end loop;
end $$;

-- Sheets: PDF pages are open to everyone; IFC storeys need the license.
drop policy if exists takeoff_sources_insert on public.takeoff_sources;
create policy takeoff_sources_insert on public.takeoff_sources for insert to authenticated
  with check (private.can_manage_project(project_id) and (kind = 'pdf_page' or private.project_has_ritsuscope(project_id)));

-- Project wall types follow the project license; library wall types follow the library rule above.
drop policy if exists takeoff_wall_types_insert on public.takeoff_wall_types;
drop policy if exists takeoff_wall_types_update on public.takeoff_wall_types;
drop policy if exists takeoff_wall_types_delete on public.takeoff_wall_types;
create policy takeoff_wall_types_insert on public.takeoff_wall_types for insert to authenticated
  with check (case when project_id is null then private.ritsuscope_can_edit_library(organization_id)
                   else private.can_manage_project(project_id) and private.project_has_ritsuscope(project_id) end);
create policy takeoff_wall_types_update on public.takeoff_wall_types for update to authenticated
  using (case when project_id is null then private.ritsuscope_can_edit_library(organization_id)
              else private.can_manage_project(project_id) and private.project_has_ritsuscope(project_id) end)
  with check (case when project_id is null then private.ritsuscope_can_edit_library(organization_id)
                   else private.can_manage_project(project_id) and private.project_has_ritsuscope(project_id) end);
create policy takeoff_wall_types_delete on public.takeoff_wall_types for delete to authenticated
  using (case when project_id is null then private.ritsuscope_can_edit_library(organization_id)
              else private.can_manage_project(project_id) and private.project_has_ritsuscope(project_id) end);
