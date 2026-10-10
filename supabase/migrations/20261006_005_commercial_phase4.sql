-- Commercial, phase 4 (one migration for the whole open list):
--   1. Commercial editor: a per-member switch (organization_members.commercial_editor). An editor
--      edits the Commercial library and creates, sees and manages every bid of the company, including
--      the bid's takeoff in RitsuScope, whatever their role. After a bid becomes a project, normal
--      project access applies again.
--   2. Bid project type (fixed list) for win rate by type.
--   3. Estimate items: kind (base / alternate / allowance) and the company work package.
--   4. Proposal clause library (inclusions, exclusions, conditions), standard + company.
--   5. Actual costs in money on converted projects (manual entry or CSV import).
--   6. convert_bid_to_project also assigns the estimate's work packages to the new project.
--   7. Platform Admin list: active projects and workspaces per company.
-- Additive: no existing column changes meaning.

-- ---------------------------------------------------------------- 1. commercial editor
alter table public.organization_members
  add column if not exists commercial_editor boolean not null default false;

create or replace function private.is_commercial_editor(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and private.organization_has_commercial(target_organization_id)
     and exists (
       select 1 from public.organization_members m
        where m.organization_id = target_organization_id
          and m.user_id = auth.uid()
          and m.status = 'active'
          and m.commercial_editor
     );
$$;
revoke all on function private.is_commercial_editor(uuid) from public, anon;
grant execute on function private.is_commercial_editor(uuid) to authenticated;

-- Library: + commercial editors.
create or replace function private.commercial_can_edit_library(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when target_organization_id is null then private.is_platform_owner()
              else private.is_platform_owner()
                   or (private.has_organization_role(target_organization_id, array['owner', 'admin', 'manager', 'planner'])
                       and private.organization_has_commercial(target_organization_id))
                   or private.is_commercial_editor(target_organization_id) end;
$$;

-- Project management: + commercial editors on the company's bids (stage = 'bid' only).
create or replace function private.can_manage_project(target_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.projects as project
      where project.id = target_project_id
        and (
          project.created_by = auth.uid()
          or private.can_manage_organization(project.organization_id)
          or exists (
            select 1
            from public.project_members as member
            where member.project_id = target_project_id
              and member.user_id = auth.uid()
              and member.role in ('manager', 'planner')
          )
          or (project.stage = 'bid' and private.is_commercial_editor(project.organization_id))
        )
    );
$$;

-- Projects rows: editors read, create and edit bids (never contract projects).
drop policy if exists projects_select_commercial_bid on public.projects;
create policy projects_select_commercial_bid on public.projects for select to authenticated
  using (stage = 'bid' and private.is_commercial_editor(organization_id));
drop policy if exists projects_insert_commercial_bid on public.projects;
create policy projects_insert_commercial_bid on public.projects for insert to authenticated
  with check (created_by = auth.uid() and stage = 'bid' and private.is_commercial_editor(organization_id));
drop policy if exists projects_update_commercial_bid on public.projects;
create policy projects_update_commercial_bid on public.projects for update to authenticated
  using (stage = 'bid' and private.is_commercial_editor(organization_id))
  with check (stage = 'bid' and private.is_commercial_editor(organization_id));

-- Switch a member on / off (whoever manages the company's users).
create or replace function public.set_member_commercial_editor(p_organization_id uuid, p_user_id uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (private.is_platform_owner() or private.rbac_has_permission(p_organization_id, 'administration.users_manage')) then
    raise exception 'You are not authorized to manage organization users.' using errcode = '42501';
  end if;
  update public.organization_members
     set commercial_editor = coalesce(p_enabled, false)
   where organization_id = p_organization_id and user_id = p_user_id;
  if not found then
    raise exception 'This user does not belong to the organization.' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.set_member_commercial_editor(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_member_commercial_editor(uuid, uuid, boolean) to authenticated;

-- What the signed-in user may do in Commercial (the screens hide what the database would refuse).
create or replace function public.commercial_permissions(p_organization_id uuid, p_project_id uuid default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'edit_library', coalesce(private.commercial_can_edit_library(p_organization_id), false),
    'create_bids', p_organization_id is not null and (
                     private.is_platform_owner()
                     or (private.organization_has_commercial(p_organization_id)
                         and (private.rbac_has_permission(p_organization_id, 'projects.create')
                              or private.is_commercial_editor(p_organization_id)))),
    'manage_bid', case when p_project_id is null then null
                       else private.can_manage_project(p_project_id) and private.project_has_commercial(p_project_id) end,
    'editor', coalesce(private.is_commercial_editor(p_organization_id), false)
  );
$$;
revoke all on function public.commercial_permissions(uuid, uuid) from public, anon;
grant execute on function public.commercial_permissions(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------- 2. bid project type
alter table public.commercial_bids
  add column if not exists project_type text
    check (project_type is null or project_type in ('residential', 'commercial', 'industrial', 'institutional', 'infrastructure', 'renovation', 'other'));
create index if not exists commercial_bids_project_type_idx on public.commercial_bids (organization_id, project_type);

-- ---------------------------------------------------------------- 3. estimate items: kind and work package
-- base: in the price · allowance: in the price, shown apart on the proposal · alternate: priced
-- option outside the price (add or deduct, accepted by the client later).
alter table public.commercial_estimate_items
  add column if not exists kind text not null default 'base' check (kind in ('base', 'alternate', 'allowance')),
  add column if not exists organization_work_package_id uuid references public.organization_work_packages(id);
create index if not exists commercial_estimate_items_wp_idx on public.commercial_estimate_items (organization_work_package_id)
  where organization_work_package_id is not null;
alter table public.commercial_estimate_items drop constraint if exists commercial_estimate_items_id_project_key;
alter table public.commercial_estimate_items add constraint commercial_estimate_items_id_project_key unique (id, project_id);

-- ---------------------------------------------------------------- 4. clause library
create table if not exists public.commercial_clauses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,  -- null = RitsuFlow standard
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  kind text not null check (kind in ('inclusion', 'exclusion', 'condition')),
  body text not null check (length(trim(body)) > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists commercial_clauses_org_idx on public.commercial_clauses (organization_id, kind, sort_order);

drop trigger if exists commercial_clauses_set_updated_at on public.commercial_clauses;
create trigger commercial_clauses_set_updated_at before update on public.commercial_clauses
  for each row execute function private.set_updated_at();
drop trigger if exists commercial_clauses_library_owner on public.commercial_clauses;
create trigger commercial_clauses_library_owner before insert on public.commercial_clauses
  for each row execute function private.ritsuscope_library_owner();

alter table public.commercial_clauses enable row level security;
drop policy if exists commercial_clauses_select on public.commercial_clauses;
create policy commercial_clauses_select on public.commercial_clauses for select to authenticated
  using (private.commercial_can_read_library(organization_id));
drop policy if exists commercial_clauses_insert on public.commercial_clauses;
create policy commercial_clauses_insert on public.commercial_clauses for insert to authenticated
  with check (private.commercial_can_edit_library(organization_id));
drop policy if exists commercial_clauses_update on public.commercial_clauses;
create policy commercial_clauses_update on public.commercial_clauses for update to authenticated
  using (private.commercial_can_edit_library(organization_id)) with check (private.commercial_can_edit_library(organization_id));
drop policy if exists commercial_clauses_delete on public.commercial_clauses;
create policy commercial_clauses_delete on public.commercial_clauses for delete to authenticated
  using (private.commercial_can_edit_library(organization_id));

-- ---------------------------------------------------------------- 5. actual costs
create table if not exists public.commercial_actual_costs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  estimate_item_id uuid,
  category text not null check (category in ('material', 'labor', 'equipment', 'subcontract', 'other')),
  incurred_on date not null,
  description text not null check (length(trim(description)) > 0),
  supplier text,
  document text,                       -- invoice / receipt number
  quantity numeric check (quantity is null or quantity >= 0),
  unit text,
  amount numeric not null,             -- negative = credit / return
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  source text not null default 'manual' check (source in ('manual', 'import')),
  import_batch uuid,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (estimate_item_id, project_id) references public.commercial_estimate_items(id, project_id) on delete set null (estimate_item_id)
);
create index if not exists commercial_actual_costs_project_idx on public.commercial_actual_costs (project_id, incurred_on);
create index if not exists commercial_actual_costs_item_idx on public.commercial_actual_costs (estimate_item_id) where estimate_item_id is not null;
create index if not exists commercial_actual_costs_batch_idx on public.commercial_actual_costs (import_batch) where import_batch is not null;

drop trigger if exists commercial_actual_costs_set_updated_at on public.commercial_actual_costs;
create trigger commercial_actual_costs_set_updated_at before update on public.commercial_actual_costs
  for each row execute function private.set_updated_at();
drop trigger if exists commercial_actual_costs_audit on public.commercial_actual_costs;
create trigger commercial_actual_costs_audit after insert or update or delete on public.commercial_actual_costs
  for each row execute function public.takeoff_write_audit_log();

alter table public.commercial_actual_costs enable row level security;
drop policy if exists commercial_actual_costs_select on public.commercial_actual_costs;
create policy commercial_actual_costs_select on public.commercial_actual_costs for select to authenticated
  using (private.can_access_project(project_id));
drop policy if exists commercial_actual_costs_insert on public.commercial_actual_costs;
create policy commercial_actual_costs_insert on public.commercial_actual_costs for insert to authenticated
  with check (private.can_manage_project(project_id) and private.project_has_commercial(project_id));
drop policy if exists commercial_actual_costs_update on public.commercial_actual_costs;
create policy commercial_actual_costs_update on public.commercial_actual_costs for update to authenticated
  using (private.can_manage_project(project_id) and private.project_has_commercial(project_id))
  with check (private.can_manage_project(project_id) and private.project_has_commercial(project_id));
drop policy if exists commercial_actual_costs_delete on public.commercial_actual_costs;
create policy commercial_actual_costs_delete on public.commercial_actual_costs for delete to authenticated
  using (private.can_manage_project(project_id) and private.project_has_commercial(project_id));

-- ---------------------------------------------------------------- 6. conversion assigns work packages
create or replace function public.convert_bid_to_project(p_project_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_bid public.commercial_bids%rowtype;
  v_estimate public.commercial_estimates%rowtype;
  v_packages integer := 0;
begin
  if not private.can_manage_project(p_project_id) then raise exception 'Not allowed to manage this project'; end if;
  if not private.project_has_commercial(p_project_id) then raise exception 'Commercial license required'; end if;

  select * into v_bid from public.commercial_bids where project_id = p_project_id for update;
  if not found then raise exception 'This project has no bid'; end if;
  if v_bid.status <> 'won' then raise exception 'Only a won bid can become a project'; end if;

  -- Baseline: the latest issued revision, else the latest revision.
  select * into v_estimate from public.commercial_estimates
   where project_id = p_project_id
   order by (status = 'issued') desc, revision desc
   limit 1;

  if found then
    update public.commercial_estimates set is_baseline = false where project_id = p_project_id and is_baseline and id <> v_estimate.id;
    update public.commercial_estimates set is_baseline = true where id = v_estimate.id;

    -- The company work packages used by the baseline (alternates excluded) become the project's.
    insert into public.project_work_package_assignments (project_id, organization_work_package_id, is_active)
    select distinct p_project_id, w.id, true
      from public.commercial_estimate_items i
      join public.organization_work_packages w on w.id = i.organization_work_package_id
      join public.projects p on p.id = p_project_id and p.organization_id = w.organization_id
     where i.estimate_id = v_estimate.id and i.kind <> 'alternate'
    on conflict (project_id, organization_work_package_id) do update set is_active = true, updated_at = now();
    get diagnostics v_packages = row_count;
  end if;

  update public.projects
     set stage = 'contract',
         converted_at = now(),
         contract_value = coalesce(contract_value, nullif(v_estimate.price_total, 0)),
         currency_code = coalesce(v_estimate.currency_code, currency_code)
   where id = p_project_id and stage = 'bid';

  return jsonb_build_object('project_id', p_project_id, 'bid_number', v_bid.bid_number,
                            'baseline_estimate_id', v_estimate.id, 'contract_value', v_estimate.price_total,
                            'work_packages', v_packages);
end;
$$;

-- ---------------------------------------------------------------- 7. Platform Admin list
drop function if exists public.get_platform_commercial_organizations();
create function public.get_platform_commercial_organizations()
returns table (
  organization_id uuid, organization_name text, organization_number text, commercial_status text, plan_name text,
  active_project_limit integer, contract_start date, renewal_end_date date, commercial_reference text,
  projects_entitled boolean, precon_entitled boolean, fieldop_entitled boolean, ritsucad_entitled boolean,
  active_projects integer, open_bids integer, workspaces jsonb
)
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_owner() then
    raise exception 'Platform owner access required';
  end if;

  return query
  select
    o.id,
    o.name,
    o.organization_number,
    coalesce(ce.commercial_status, 'active'),
    coalesce(ce.plan_name, 'Commercial'),
    coalesce(ce.active_project_limit, 1),
    ce.contract_start,
    ce.renewal_end_date,
    ce.commercial_reference,
    coalesce((select bool_or(w.is_entitled) from public.organization_workspace_entitlements w where w.organization_id = o.id and w.workspace_key = 'projects'), false),
    coalesce((select bool_or(w.is_entitled) from public.organization_workspace_entitlements w where w.organization_id = o.id and w.workspace_key = 'precon'), false),
    coalesce((select bool_or(w.is_entitled) from public.organization_workspace_entitlements w where w.organization_id = o.id and w.workspace_key = 'fieldop'), false),
    coalesce((select bool_or(w.is_entitled) from public.organization_workspace_entitlements w where w.organization_id = o.id and w.workspace_key = 'ritsucad'), false),
    (select count(*)::integer from public.projects p where p.organization_id = o.id and p.stage = 'contract' and p.status = 'active'),
    (select count(*)::integer from public.commercial_bids b where b.organization_id = o.id and b.status in ('draft', 'submitted')),
    coalesce((select jsonb_object_agg(w.workspace_key, w.is_entitled) from public.organization_workspace_entitlements w where w.organization_id = o.id), '{}'::jsonb)
  from public.organizations o
  left join public.organization_commercial_entitlements ce on ce.organization_id = o.id
  order by o.name;
end;
$$;
revoke all on function public.get_platform_commercial_organizations() from public, anon;
grant execute on function public.get_platform_commercial_organizations() to authenticated;
