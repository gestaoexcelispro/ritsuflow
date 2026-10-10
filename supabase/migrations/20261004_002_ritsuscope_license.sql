-- RitsuScope replaces the RitsuCAD placeholder as the licensable takeoff workspace,
-- and the app can ask whether the signed-in user's company is licensed for a workspace.

-- 1. Workspace licenses: the key 'ritsucad' becomes 'ritsuscope'.
alter table public.organization_workspace_entitlements
  drop constraint organization_workspace_entitlements_workspace_key_check;
update public.organization_workspace_entitlements set workspace_key = 'ritsuscope' where workspace_key = 'ritsucad';
alter table public.organization_workspace_entitlements
  add constraint organization_workspace_entitlements_workspace_key_check
  check (workspace_key = any (array['projects','precon','fieldop','ritsuscope']));

-- 2. User workspace access lists.
update public.user_profiles
   set workspace_access = array_replace(workspace_access, 'ritsucad', 'ritsuscope')
 where 'ritsucad' = any(workspace_access);

-- 3. Scope quantity source "Takeoff". 'ritsucad' stays allowed until the new app is live
--    (the app reads both as RitsuScope); a later cleanup can drop it.
alter table public.project_scopes drop constraint project_scopes_quantity_source_check;
update public.project_scopes set quantity_source = 'ritsuscope' where quantity_source = 'ritsucad';
alter table public.project_scopes
  add constraint project_scopes_quantity_source_check
  check (quantity_source = any (array['contract','manual','ritsuscope','ritsucad','unknown']));

-- 4. Platform Admin license editor: adds p_ritsuscope. p_ritsucad is still accepted (same meaning)
--    so the app currently in production keeps working until the new app is merged; a later
--    cleanup can drop it.
drop function public.set_platform_commercial_entitlements(uuid,text,text,integer,date,date,text,text,boolean,boolean,boolean,boolean);

create function public.set_platform_commercial_entitlements(
  p_organization_id uuid, p_commercial_status text, p_plan_name text, p_active_project_limit integer,
  p_contract_start date default null, p_renewal_end_date date default null,
  p_commercial_reference text default null, p_notes text default null,
  p_projects boolean default true, p_precon boolean default false, p_fieldop boolean default false,
  p_ritsuscope boolean default null, p_ritsucad boolean default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  k text;
  v boolean;
  v_ritsuscope boolean := coalesce(p_ritsuscope, p_ritsucad, false);
begin
  if not private.is_platform_owner() then raise exception 'Platform owner access required'; end if;
  if not exists(select 1 from public.organizations where id=p_organization_id) then raise exception 'Organization not found'; end if;
  if p_commercial_status not in ('trial','active','suspended','cancelled','expired') then raise exception 'Invalid commercial status'; end if;
  if p_active_project_limit < 0 then raise exception 'Active project limit cannot be negative'; end if;
  if not p_projects then raise exception 'Projects is the core RitsuFlow workspace and must remain entitled'; end if;

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

  for k,v in select * from (values ('projects',p_projects),('precon',p_precon),('fieldop',p_fieldop),('ritsuscope',v_ritsuscope)) x(workspace_key,is_entitled)
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

revoke all on function public.set_platform_commercial_entitlements(uuid,text,text,integer,date,date,text,text,boolean,boolean,boolean,boolean,boolean) from public, anon;
grant execute on function public.set_platform_commercial_entitlements(uuid,text,text,integer,date,date,text,text,boolean,boolean,boolean,boolean,boolean) to authenticated;

-- 5. License check used by the app: the platform owner always has access; anyone else needs an
--    active membership in a company whose license is trial/active and includes the workspace.
create or replace function public.has_workspace_access(p_workspace_key text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select private.is_platform_owner()
      or exists (
        select 1
          from public.organization_members om
          join public.organization_workspace_entitlements w
            on w.organization_id = om.organization_id and w.workspace_key = p_workspace_key and w.is_entitled
          left join public.organization_commercial_entitlements ce on ce.organization_id = om.organization_id
         where om.user_id = auth.uid()
           and om.status = 'active'
           and coalesce(ce.commercial_status, 'active') in ('trial','active')
      );
$function$;

revoke all on function public.has_workspace_access(text) from public, anon;
grant execute on function public.has_workspace_access(text) to authenticated;
