-- R5 · A new company gets its workspace licences
-- provision_platform_organization wrote the old seat licence
-- (private.organization_subscriptions + private.organization_modules), which no
-- licence check reads. Every workspace check (has_workspace_access) reads
-- organization_workspace_entitlements + organization_commercial_entitlements,
-- so a company created from Ritsu Admin could not open any workspace until the
-- platform owner set its licence again by hand.
--
-- provision_platform_company creates the company, its primary admin membership
-- and its commercial + workspace licences in one transaction, and writes nothing
-- to the old seat licence tables. get_platform_organizations now falls back to
-- the new licence record, so companies created this way show their status,
-- dates and workspaces in the Ritsu Admin list.

begin;

create or replace function public.provision_platform_company(
  target_name text,
  target_slug text,
  target_primary_admin_user_id uuid,
  target_plan_name text,
  target_active_project_limit integer,
  target_commercial_status text,
  target_contract_start date,
  target_renewal_end_date date,
  target_workspaces text[],
  target_default_locale text default 'en-US'
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_org_id uuid;
  v_name text := nullif(btrim(target_name), '');
  v_slug text := lower(nullif(btrim(target_slug), ''));
  v_locale text := coalesce(nullif(btrim(target_default_locale), ''), 'en-US');
  v_ws text[] := coalesce(target_workspaces, array[]::text[]);
begin
  if not private.is_platform_owner() then
    raise exception 'Platform owner authorization required.' using errcode = '42501';
  end if;

  if v_name is null then raise exception 'Organization name is required.'; end if;
  if v_slug is null then raise exception 'Organization slug is required.'; end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Organization slug is invalid.'; end if;
  if v_locale not in ('en-US', 'pt-BR', 'es') then raise exception 'Invalid organization locale.'; end if;
  if exists (select 1 from public.organizations o where o.slug = v_slug) then
    raise exception 'Organization slug already exists.';
  end if;
  if target_primary_admin_user_id is null
     or not exists (select 1 from auth.users au where au.id = target_primary_admin_user_id) then
    raise exception 'Primary Admin Auth user does not exist.';
  end if;
  if target_contract_start is null then raise exception 'License start date is required.'; end if;
  if target_renewal_end_date is not null and target_renewal_end_date < target_contract_start then
    raise exception 'License expiration date cannot be before the start date.';
  end if;
  if exists (select 1 from unnest(v_ws) w
             where w not in ('projects', 'precon', 'fieldop', 'ritsuscope', 'commercial')) then
    raise exception 'One or more selected workspaces are invalid.';
  end if;

  insert into public.organizations (name, slug, owner_user_id, default_locale)
  values (v_name, v_slug, target_primary_admin_user_id, v_locale)
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role, status, project_access_mode)
  values (v_org_id, target_primary_admin_user_id, 'admin', 'invited', 'all_projects');

  -- Same rules and record as the Ritsu Admin licence editor.
  perform public.set_platform_commercial_entitlements(
    p_organization_id      => v_org_id,
    p_commercial_status    => target_commercial_status,
    p_plan_name            => target_plan_name,
    p_active_project_limit => target_active_project_limit,
    p_contract_start       => target_contract_start,
    p_renewal_end_date     => target_renewal_end_date,
    p_commercial_reference => null,
    p_notes                => null,
    p_projects             => 'projects' = any (v_ws),
    p_precon               => 'precon' = any (v_ws),
    p_fieldop              => 'fieldop' = any (v_ws),
    p_ritsuscope           => 'ritsuscope' = any (v_ws),
    p_ritsucad             => null,
    p_commercial           => 'commercial' = any (v_ws)
  );

  return v_org_id;
end;
$$;

revoke all on function public.provision_platform_company(text, text, uuid, text, integer, text, date, date, text[], text) from public, anon;
grant execute on function public.provision_platform_company(text, text, uuid, text, integer, text, date, date, text[], text) to authenticated;

-- Ritsu Admin list: fall back to the workspace licence record.
create or replace function public.get_platform_organizations()
returns table (
  organization_id uuid, organization_name text, plan_code text, license_status text,
  seat_limit integer, seats_used bigint, starts_at date, expires_at date,
  primary_admin_name text, primary_admin_email text, enabled_modules text[]
)
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not private.is_platform_owner() then
    raise exception 'Platform owner authorization required.' using errcode = '42501';
  end if;

  return query
  select
    o.id,
    o.name::text,
    coalesce(os.plan_code, lower(ce.plan_name), 'standard')::text,
    coalesce(os.license_status, ce.commercial_status, 'active')::text,
    coalesce(os.seat_limit, ce.active_project_limit, 10)::integer,
    (select count(*) from public.organization_members c
      where c.organization_id = o.id and c.status = 'active')::bigint,
    coalesce(os.starts_at, ce.contract_start),
    coalesce(os.expires_at, ce.renewal_end_date),
    admin_user.name,
    admin_user.email,
    coalesce(
      (select array_agg(m.module_key order by m.module_key)
         from private.organization_modules m
        where m.organization_id = o.id and m.enabled = true),
      (select array_agg(w.workspace_key order by w.workspace_key)
         from public.organization_workspace_entitlements w
        where w.organization_id = o.id and w.is_entitled),
      array[]::text[]
    )
  from public.organizations o
  left join private.organization_subscriptions os on os.organization_id = o.id
  left join public.organization_commercial_entitlements ce on ce.organization_id = o.id
  left join lateral (
    select coalesce(au.raw_user_meta_data ->> 'full_name', split_part(au.email, '@', 1))::text as name,
           au.email::text as email
      from public.organization_members om
      join auth.users au on au.id = om.user_id
     where om.organization_id = o.id
       and om.status in ('active', 'invited')
       and (case when om.role = 'owner' then 'admin'
                 when om.role = 'planner' then 'manager'
                 when om.role = 'viewer' then 'user'
                 else om.role end) = 'admin'
     order by om.user_id
     limit 1
  ) admin_user on true
  order by o.name;
end;
$$;

commit;
