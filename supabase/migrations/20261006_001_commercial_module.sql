-- Commercial: the standalone bid / estimating workspace (DRAFT — for Eduardo's approval).
--   * A bid is a projects row with stage = 'bid'; RitsuScope works on it unchanged.
--   * New license key 'commercial'; a company needs Projects, Commercial, or both.
--   * Company library: price book, labor rates, pricing templates (standard + company).
--   * Per bid: the bid record, estimates (one row per revision) and their items.
--   * RitsuScope recipes gain labor productivity lines (additive; RitsuScope ignores them for now).
-- Additive only: no existing column changes meaning; every existing project stays stage = 'contract'.

-- ---------------------------------------------------------------- 1. projects: bid stage
alter table public.projects
  add column if not exists stage text not null default 'contract'
    check (stage in ('bid', 'contract')),
  add column if not exists converted_at timestamptz;

create index if not exists projects_org_stage_idx on public.projects (organization_id, stage);

-- ---------------------------------------------------------------- 2. RitsuScope recipes: labor productivity
-- Lines: {"trade": "drywall_installer", "hours": 0.32, "base": "m2", "note": null}
alter table public.takeoff_recipes
  add column if not exists labor jsonb not null default '[]'::jsonb
    check (jsonb_typeof(labor) = 'array');

-- ---------------------------------------------------------------- 3. license key and helpers
alter table public.organization_workspace_entitlements
  drop constraint organization_workspace_entitlements_workspace_key_check;
alter table public.organization_workspace_entitlements
  add constraint organization_workspace_entitlements_workspace_key_check
  check (workspace_key = any (array['projects', 'precon', 'fieldop', 'ritsuscope', 'commercial']));

create or replace function private.organization_has_commercial(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.organization_workspace_entitlements w
      left join public.organization_commercial_entitlements ce on ce.organization_id = w.organization_id
     where w.organization_id = target_organization_id
       and w.workspace_key = 'commercial'
       and w.is_entitled
       and coalesce(ce.commercial_status, 'active') in ('trial', 'active')
  );
$$;

create or replace function private.project_has_commercial(target_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_platform_owner()
      or exists (
        select 1 from public.projects p
         where p.id = target_project_id
           and private.organization_has_commercial(p.organization_id)
      );
$$;

-- Library rows: standard rows (no company) are read by every signed-in member and edited by the
-- platform owner; company rows are read by the company and edited by owner / admin / manager / planner
-- of a company licensed for Commercial.
create or replace function private.commercial_can_read_library(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when target_organization_id is null then auth.uid() is not null
              else private.is_organization_member(target_organization_id) or private.is_platform_owner() end;
$$;

create or replace function private.commercial_can_edit_library(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when target_organization_id is null then private.is_platform_owner()
              else private.is_platform_owner()
                   or (private.has_organization_role(target_organization_id, array['owner', 'admin', 'manager', 'planner'])
                       and private.organization_has_commercial(target_organization_id)) end;
$$;

revoke all on function private.organization_has_commercial(uuid) from public, anon;
revoke all on function private.project_has_commercial(uuid) from public, anon;
revoke all on function private.commercial_can_read_library(uuid) from public, anon;
revoke all on function private.commercial_can_edit_library(uuid) from public, anon;
grant execute on function private.organization_has_commercial(uuid) to authenticated;
grant execute on function private.project_has_commercial(uuid) to authenticated;
grant execute on function private.commercial_can_read_library(uuid) to authenticated;
grant execute on function private.commercial_can_edit_library(uuid) to authenticated;

-- ---------------------------------------------------------------- 4. company library
create table public.commercial_pricing_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  name text not null check (length(trim(name)) > 0),
  -- Ordered add-on lines: {"key","label","applies_to","method","rate"}
  --   applies_to: direct | material | labor | equipment | subcontract | subtotal
  --   method:     percent (adds base x rate, in order) | divisor (taxes on price, summed, applied last)
  --   rate:       percent, e.g. 4.0 = 4%
  lines jsonb not null default '[]'::jsonb check (jsonb_typeof(lines) = 'array'),
  is_default boolean not null default false,
  notes text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index commercial_pricing_templates_name_key on public.commercial_pricing_templates
  (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), country_code, lower(name));
create unique index commercial_pricing_templates_default_key on public.commercial_pricing_templates
  (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), country_code) where is_default;

create table public.commercial_price_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  kind text not null default 'material' check (kind in ('material', 'equipment', 'subcontract', 'other')),
  material_id uuid references public.takeoff_materials(id) on delete set null,
  code text,
  name text not null check (length(trim(name)) > 0),
  unit text not null,
  unit_cost numeric not null check (unit_cost >= 0),
  supplier text,
  valid_from date not null default current_date,
  notes text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index commercial_price_items_material_idx on public.commercial_price_items (organization_id, material_id, valid_from desc);
create index commercial_price_items_lookup_idx on public.commercial_price_items (organization_id, country_code, kind, lower(name));

create table public.commercial_labor_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  trade text not null check (trade ~ '^[a-z0-9_]+$'),  -- code used by takeoff_recipes.labor[].trade
  name text not null,
  base_rate_hour numeric not null check (base_rate_hour >= 0),
  burden_pct numeric not null default 0 check (burden_pct >= 0),  -- encargos sociais (BR) / labor burden (US)
  valid_from date not null default current_date,
  notes text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index commercial_labor_rates_key on public.commercial_labor_rates (organization_id, country_code, trade, valid_from);

-- ---------------------------------------------------------------- 5. per bid
create sequence if not exists public.commercial_bid_number_seq;
grant usage on sequence public.commercial_bid_number_seq to authenticated;

create table public.commercial_bids (
  project_id uuid primary key references public.projects(id) on delete cascade,
  bid_number text not null unique default ('BID-' || lpad(nextval('public.commercial_bid_number_seq')::text, 4, '0')),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'won', 'lost', 'no_bid')),
  due_at timestamptz,
  submitted_at timestamptz,
  decided_at timestamptz,
  outcome_note text,
  pricing_template_id uuid references public.commercial_pricing_templates(id) on delete set null,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index commercial_bids_status_idx on public.commercial_bids (status, due_at);

create table public.commercial_estimates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  revision integer not null default 0 check (revision >= 0),
  name text not null default 'Rev 0',
  status text not null default 'draft' check (status in ('draft', 'issued')),
  is_baseline boolean not null default false,
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  priced_on date not null default current_date,  -- price book and labor rates valid on this date
  pricing_lines jsonb not null default '[]'::jsonb check (jsonb_typeof(pricing_lines) = 'array'),
  proposal jsonb not null default '{}'::jsonb check (jsonb_typeof(proposal) = 'object'),
  direct_material numeric not null default 0,
  direct_labor numeric not null default 0,
  direct_equipment numeric not null default 0,
  direct_subcontract numeric not null default 0,
  direct_total numeric not null default 0,
  price_total numeric not null default 0,
  issued_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, revision),
  unique (id, project_id)
);
create unique index commercial_estimates_baseline_key on public.commercial_estimates (project_id) where is_baseline;

create table public.commercial_estimate_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null,
  project_id uuid not null,
  sort_order integer not null default 0,
  source text not null default 'manual' check (source in ('takeoff', 'manual')),
  takeoff_layer_id uuid references public.takeoff_layers(id) on delete set null,
  recipe_id uuid references public.takeoff_recipes(id) on delete set null,
  description text not null check (length(trim(description)) > 0),
  unit text not null,
  quantity numeric not null default 0 check (quantity >= 0),
  quantity_overridden boolean not null default false,
  material_unit_cost numeric not null default 0 check (material_unit_cost >= 0),
  labor_unit_cost numeric not null default 0 check (labor_unit_cost >= 0),
  equipment_unit_cost numeric not null default 0 check (equipment_unit_cost >= 0),
  subcontract_unit_cost numeric not null default 0 check (subcontract_unit_cost >= 0),
  breakdown jsonb not null default '{}'::jsonb check (jsonb_typeof(breakdown) = 'object'),
  notes text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (estimate_id, project_id) references public.commercial_estimates(id, project_id) on delete cascade
);
create index commercial_estimate_items_estimate_idx on public.commercial_estimate_items (estimate_id, sort_order);
create index commercial_estimate_items_layer_idx on public.commercial_estimate_items (takeoff_layer_id) where takeoff_layer_id is not null;

-- ---------------------------------------------------------------- 6. guards
-- An issued revision is frozen: neither it nor its items can change (except becoming the baseline).
create or replace function private.commercial_estimate_frozen()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Deleting the whole bid (the projects row) cascades here: let it through.
  if tg_op = 'DELETE' and not exists (select 1 from public.projects p where p.id = old.project_id) then
    return old;
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.status = 'issued' then
    if tg_op = 'UPDATE' and (to_jsonb(new) - array['is_baseline', 'updated_at']) = (to_jsonb(old) - array['is_baseline', 'updated_at']) then
      return new;
    end if;
    raise exception 'Issued revision % is frozen; create a new revision', old.revision;
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function private.commercial_item_frozen()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_estimate uuid := coalesce(new.estimate_id, old.estimate_id);
begin
  if exists (select 1 from public.commercial_estimates e where e.id = v_estimate and e.status = 'issued') then
    raise exception 'Items of an issued revision are frozen; create a new revision';
  end if;
  return coalesce(new, old);
end;
$$;

-- projects.stage: never contract -> bid; bid -> contract only when the bid is won (or has no bid record).
create or replace function private.projects_stage_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.stage is distinct from old.stage then
    if old.stage = 'contract' then
      raise exception 'A project cannot go back to the bid stage';
    end if;
    if exists (select 1 from public.commercial_bids b where b.project_id = old.id and b.status <> 'won') then
      raise exception 'Only a won bid can become a project';
    end if;
    new.converted_at := coalesce(new.converted_at, now());
  end if;
  return new;
end;
$$;

create trigger projects_stage_guard before update of stage on public.projects
  for each row execute function private.projects_stage_guard();

-- ---------------------------------------------------------------- 7. triggers (updated_at, audit, library owner)
do $$
declare t text;
begin
  foreach t in array array['commercial_pricing_templates', 'commercial_price_items', 'commercial_labor_rates', 'commercial_bids', 'commercial_estimates', 'commercial_estimate_items'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()', t || '_set_updated_at', t);
  end loop;
  -- Per-bid tables use the takeoff audit log (it keys on project_id and records the table name).
  foreach t in array array['commercial_bids', 'commercial_estimates', 'commercial_estimate_items'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.takeoff_write_audit_log()', t || '_audit', t);
  end loop;
end $$;

create trigger commercial_estimates_frozen before update or delete on public.commercial_estimates
  for each row execute function private.commercial_estimate_frozen();
create trigger commercial_estimate_items_frozen before insert or update or delete on public.commercial_estimate_items
  for each row execute function private.commercial_item_frozen();

-- Company templates created by a company user land in that company (same rule as the RitsuScope library).
create trigger commercial_pricing_templates_library_owner before insert on public.commercial_pricing_templates
  for each row execute function private.ritsuscope_library_owner();

-- ---------------------------------------------------------------- 8. row level security
do $$
declare t text;
begin
  -- Per bid: read with project access; write with project management and a Commercial license.
  foreach t in array array['commercial_bids', 'commercial_estimates', 'commercial_estimate_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.can_access_project(project_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.can_manage_project(project_id) and private.project_has_commercial(project_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.can_manage_project(project_id) and private.project_has_commercial(project_id)) with check (private.can_manage_project(project_id) and private.project_has_commercial(project_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.can_manage_project(project_id) and private.project_has_commercial(project_id))', t || '_delete', t);
  end loop;
  -- Library: company rows (price book, labor rates) and standard + company rows (templates).
  foreach t in array array['commercial_pricing_templates', 'commercial_price_items', 'commercial_labor_rates'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.commercial_can_read_library(organization_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.commercial_can_edit_library(organization_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.commercial_can_edit_library(organization_id)) with check (private.commercial_can_edit_library(organization_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.commercial_can_edit_library(organization_id))', t || '_delete', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- 9. convert a won bid
create or replace function public.convert_bid_to_project(p_project_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_bid public.commercial_bids%rowtype;
  v_estimate public.commercial_estimates%rowtype;
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
  end if;

  update public.projects
     set stage = 'contract',
         converted_at = now(),
         contract_value = coalesce(contract_value, nullif(v_estimate.price_total, 0)),
         currency_code = coalesce(v_estimate.currency_code, currency_code)
   where id = p_project_id and stage = 'bid';

  return jsonb_build_object('project_id', p_project_id, 'bid_number', v_bid.bid_number,
                            'baseline_estimate_id', v_estimate.id, 'contract_value', v_estimate.price_total);
end;
$$;
revoke all on function public.convert_bid_to_project(uuid) from public, anon;
grant execute on function public.convert_bid_to_project(uuid) to authenticated;

-- ---------------------------------------------------------------- 10. Platform Admin: Commercial, Projects optional
drop function public.set_platform_commercial_entitlements(uuid,text,text,integer,date,date,text,text,boolean,boolean,boolean,boolean,boolean);

create function public.set_platform_commercial_entitlements(
  p_organization_id uuid, p_commercial_status text, p_plan_name text, p_active_project_limit integer,
  p_contract_start date default null, p_renewal_end_date date default null,
  p_commercial_reference text default null, p_notes text default null,
  p_projects boolean default true, p_precon boolean default false, p_fieldop boolean default false,
  p_ritsuscope boolean default null, p_ritsucad boolean default null, p_commercial boolean default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  k text;
  v boolean;
  v_ritsuscope boolean := coalesce(p_ritsuscope, p_ritsucad, false);
  -- null = keep the company's current Commercial license (older callers don't send it)
  v_commercial boolean := coalesce(p_commercial, (
    select w.is_entitled from public.organization_workspace_entitlements w
     where w.organization_id = p_organization_id and w.workspace_key = 'commercial'), false);
begin
  if not private.is_platform_owner() then raise exception 'Platform owner access required'; end if;
  if not exists(select 1 from public.organizations where id=p_organization_id) then raise exception 'Organization not found'; end if;
  if p_commercial_status not in ('trial','active','suspended','cancelled','expired') then raise exception 'Invalid commercial status'; end if;
  if p_active_project_limit < 0 then raise exception 'Active project limit cannot be negative'; end if;
  if not (p_projects or v_commercial) then raise exception 'A company needs Projects, Commercial, or both'; end if;

  insert into public.organization_commercial_entitlements(
    organization_id,commercial_status,plan_name,license_basis,active_project_limit,contract_start,renewal_end_date,commercial_reference,notes,updated_at
  ) values (
    p_organization_id,p_commercial_status,coalesce(nullif(trim(p_plan_name),''),'Commercial'),'active_projects',p_active_project_limit,p_contract_start,p_renewal_end_date,p_commercial_reference,p_notes,now()
  ) on conflict (organization_id) do update set
    commercial_status=excluded.commercial_status,
    plan_name=excluded.plan_name,
    license_basis='active_projects',
    active_project_limit=excluded.active_project_limit,
    contract_start=excluded.contract_start,
    renewal_end_date=excluded.renewal_end_date,
    commercial_reference=excluded.commercial_reference,
    notes=excluded.notes,
    updated_at=now();

  for k,v in select * from (values ('projects',p_projects),('precon',p_precon),('fieldop',p_fieldop),('ritsuscope',v_ritsuscope),('commercial',v_commercial)) x(workspace_key,is_entitled)
  loop
    insert into public.organization_workspace_entitlements(organization_id,workspace_key,is_entitled,entitled_at,revoked_at,updated_at)
    values(p_organization_id,k,v,case when v then now() else null end,case when not v then now() else null end,now())
    on conflict (organization_id,workspace_key) do update set
      is_entitled=excluded.is_entitled,
      entitled_at=case when excluded.is_entitled and not organization_workspace_entitlements.is_entitled then now() else organization_workspace_entitlements.entitled_at end,
      revoked_at=case when not excluded.is_entitled then now() else null end,
      updated_at=now();
  end loop;

  return public.get_platform_commercial_organization(p_organization_id);
end;
$function$;

revoke all on function public.set_platform_commercial_entitlements(uuid,text,text,integer,date,date,text,text,boolean,boolean,boolean,boolean,boolean,boolean) from public, anon;
grant execute on function public.set_platform_commercial_entitlements(uuid,text,text,integer,date,date,text,text,boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;

-- ---------------------------------------------------------------- 11. standard templates (labels only, 0% rates)
insert into public.commercial_pricing_templates (organization_id, country_code, name, is_default, lines, notes) values
(null, 'BR', 'Brasil — BDI (TCU)', true, '[
  {"key":"ac","label":"Administração central (AC)","applies_to":"direct","method":"percent","rate":0},
  {"key":"s","label":"Seguros (S)","applies_to":"direct","method":"percent","rate":0},
  {"key":"g","label":"Garantias (G)","applies_to":"direct","method":"percent","rate":0},
  {"key":"r","label":"Riscos (R)","applies_to":"direct","method":"percent","rate":0},
  {"key":"df","label":"Despesas financeiras (DF)","applies_to":"subtotal","method":"percent","rate":0},
  {"key":"l","label":"Lucro (L)","applies_to":"subtotal","method":"percent","rate":0},
  {"key":"pis","label":"PIS","applies_to":"subtotal","method":"divisor","rate":0},
  {"key":"cofins","label":"COFINS","applies_to":"subtotal","method":"divisor","rate":0},
  {"key":"iss","label":"ISS","applies_to":"subtotal","method":"divisor","rate":0},
  {"key":"cprb","label":"CPRB","applies_to":"subtotal","method":"divisor","rate":0}
]'::jsonb, 'BDI = [(1+AC+S+R+G)(1+DF)(1+L)/(1-I)] - 1. Set the rates for your company.'),
(null, 'US', 'USA — Markups', true, '[
  {"key":"gc","label":"General conditions","applies_to":"direct","method":"percent","rate":0},
  {"key":"oh","label":"Overhead","applies_to":"subtotal","method":"percent","rate":0},
  {"key":"profit","label":"Profit","applies_to":"subtotal","method":"percent","rate":0},
  {"key":"bond","label":"Bond","applies_to":"subtotal","method":"percent","rate":0},
  {"key":"sales_tax","label":"Sales tax","applies_to":"material","method":"percent","rate":0}
]'::jsonb, 'Compounding markups; sales tax on materials only. Set the rates for your company.');
