-- RitsuScope Tasks (planning layer): each wall step allocated to the location where the work is done,
-- and the settings of each activity (⚙ in the Tasks sidebar).
--   1. project_scopes.organization_work_package_id : the company catalogue work package (FRM, BRD, JNT,
--      INS…) of the scope line — the bridge to PreCon (Master plan / Lookahead / Weekly plan).
--   2. project_scopes.allocation_rule : how the line is spread over locations
--        face     = each face 100% to the room it looks into (board, joints, insulation)
--        carrier  = the whole wall to the room that carries it (framing)
--        position = by position (areas, counts; the former 50/50 split for walls)
--        manual   = no automatic split
--      null = the default of the step.
--   3. project_wall_carriers : the room that carries a dividing wall, when the planner overrides the
--      default (first room in the location flow). One row per wall (takeoff element).
--   4. project_scope_dependencies : predecessors of a scope line chosen by the planner; when a line has
--      none, the app uses the default wall sequence. link = same_location | carrier_location.
-- The scope register quantities and the Commercial estimate are not changed. Additive and safe to run
-- more than once.

-- 1 + 2. Scope line settings
alter table public.project_scopes
  add column if not exists organization_work_package_id uuid references public.organization_work_packages(id) on delete set null,
  add column if not exists allocation_rule text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'project_scopes_allocation_rule_check') then
    alter table public.project_scopes
      add constraint project_scopes_allocation_rule_check
      check (allocation_rule is null or allocation_rule in ('face', 'carrier', 'position', 'manual'));
  end if;
end $$;

create index if not exists project_scopes_work_package_idx on public.project_scopes (organization_work_package_id) where organization_work_package_id is not null;

-- 3. Carrier of dividing walls (planner's override)
create table if not exists public.project_wall_carriers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  element_id uuid not null references public.takeoff_elements(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_wall_carriers_element_key unique (element_id)
);
create index if not exists project_wall_carriers_project_idx on public.project_wall_carriers (project_id);

drop trigger if exists project_wall_carriers_set_updated_at on public.project_wall_carriers;
create trigger project_wall_carriers_set_updated_at before update on public.project_wall_carriers
  for each row execute function private.set_updated_at();

alter table public.project_wall_carriers enable row level security;
drop policy if exists project_wall_carriers_select on public.project_wall_carriers;
drop policy if exists project_wall_carriers_insert on public.project_wall_carriers;
drop policy if exists project_wall_carriers_update on public.project_wall_carriers;
drop policy if exists project_wall_carriers_delete on public.project_wall_carriers;
create policy project_wall_carriers_select on public.project_wall_carriers for select to authenticated using (private.can_access_project(project_id));
create policy project_wall_carriers_insert on public.project_wall_carriers for insert to authenticated with check (private.can_manage_project(project_id));
create policy project_wall_carriers_update on public.project_wall_carriers for update to authenticated using (private.can_manage_project(project_id)) with check (private.can_manage_project(project_id));
create policy project_wall_carriers_delete on public.project_wall_carriers for delete to authenticated using (private.can_manage_project(project_id));

-- 4. Predecessors of scope lines
create table if not exists public.project_scope_dependencies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scope_item_id uuid not null references public.project_scopes(id) on delete cascade,
  predecessor_scope_item_id uuid not null references public.project_scopes(id) on delete cascade,
  link text not null default 'same_location' check (link in ('same_location', 'carrier_location')),
  lag_days integer not null default 0 check (lag_days between -365 and 365),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint project_scope_dependencies_not_self check (scope_item_id <> predecessor_scope_item_id),
  constraint project_scope_dependencies_key unique (scope_item_id, predecessor_scope_item_id, link)
);
create index if not exists project_scope_dependencies_project_idx on public.project_scope_dependencies (project_id);

alter table public.project_scope_dependencies enable row level security;
drop policy if exists project_scope_dependencies_select on public.project_scope_dependencies;
drop policy if exists project_scope_dependencies_insert on public.project_scope_dependencies;
drop policy if exists project_scope_dependencies_update on public.project_scope_dependencies;
drop policy if exists project_scope_dependencies_delete on public.project_scope_dependencies;
create policy project_scope_dependencies_select on public.project_scope_dependencies for select to authenticated using (private.can_access_project(project_id));
create policy project_scope_dependencies_insert on public.project_scope_dependencies for insert to authenticated with check (private.can_manage_project(project_id));
create policy project_scope_dependencies_update on public.project_scope_dependencies for update to authenticated using (private.can_manage_project(project_id)) with check (private.can_manage_project(project_id));
create policy project_scope_dependencies_delete on public.project_scope_dependencies for delete to authenticated using (private.can_manage_project(project_id));
