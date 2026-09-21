begin;

-- RitsuFlow universal project event / audit foundation.
-- Every persistent project action can append an immutable event here.
-- Business/event time is intentionally distinct from created_at (system-recorded time).

create table if not exists public.project_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  module text not null,
  action text not null,
  action_label text not null,
  description text,
  entity_type text,
  entity_id text,
  performed_by uuid references auth.users(id) on delete set null,
  performed_by_name text,
  event_at timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

-- Additive compatibility for an existing project_history table.
alter table public.project_history add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.project_history add column if not exists module text;
alter table public.project_history add column if not exists action text;
alter table public.project_history add column if not exists action_label text;
alter table public.project_history add column if not exists description text;
alter table public.project_history add column if not exists entity_type text;
alter table public.project_history add column if not exists entity_id text;
alter table public.project_history add column if not exists performed_by uuid references auth.users(id) on delete set null;
alter table public.project_history add column if not exists performed_by_name text;
alter table public.project_history add column if not exists event_at timestamp with time zone;
alter table public.project_history add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.project_history add column if not exists created_at timestamp with time zone not null default now();

create index if not exists project_history_project_created_index
  on public.project_history(project_id, created_at desc);
create index if not exists project_history_organization_index
  on public.project_history(organization_id, created_at desc);
create index if not exists project_history_entity_index
  on public.project_history(entity_type, entity_id);
create index if not exists project_history_module_index
  on public.project_history(project_id, module, created_at desc);
create index if not exists project_history_actor_index
  on public.project_history(performed_by, created_at desc);

alter table public.project_history enable row level security;
revoke all on public.project_history from anon;
grant select, insert on public.project_history to authenticated;

-- History is append-only for normal authenticated application users.
revoke update, delete on public.project_history from authenticated;

-- Centralized writer. SECURITY INVOKER intentionally preserves RLS and tenant/project access.
create or replace function public.record_project_event(
  p_project_id uuid,
  p_module text,
  p_action text,
  p_action_label text,
  p_description text default null,
  p_entity_type text default null,
  p_entity_id text default null,
  p_event_at timestamp with time zone default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_event_id uuid;
  v_organization_id uuid;
  v_actor_name text;
begin
  select p.organization_id
    into v_organization_id
  from public.projects p
  where p.id = p_project_id;

  if v_organization_id is null then
    raise exception 'Project not found or unavailable';
  end if;

  select coalesce(nullif(pr.full_name, ''), nullif(pr.email, ''), 'RitsuFlow User')
    into v_actor_name
  from public.profiles pr
  where pr.id = auth.uid();

  insert into public.project_history (
    organization_id,
    project_id,
    module,
    action,
    action_label,
    description,
    entity_type,
    entity_id,
    performed_by,
    performed_by_name,
    event_at,
    metadata
  ) values (
    v_organization_id,
    p_project_id,
    p_module,
    p_action,
    p_action_label,
    p_description,
    p_entity_type,
    p_entity_id,
    auth.uid(),
    coalesce(v_actor_name, 'RitsuFlow User'),
    p_event_at,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

grant execute on function public.record_project_event(uuid,text,text,text,text,text,text,timestamp with time zone,jsonb) to authenticated;

commit;
