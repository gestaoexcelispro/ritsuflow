create table if not exists public.ritsucad_takeoffs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  document_id uuid references public.project_documents(id) on delete cascade,
  page_number integer not null default 1 check (page_number > 0),
  location_id uuid not null references public.locations(id) on delete restrict,
  project_service_id uuid not null references public.project_services(id) on delete restrict,
  measurement_type text not null check (measurement_type in ('distance','linear','polyline','area','rectangle','count')),
  quantity numeric not null check (quantity >= 0),
  unit text not null,
  geometry jsonb not null default '{}'::jsonb,
  source_entity_id text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ritsucad_takeoffs_project_idx on public.ritsucad_takeoffs(project_id);
create index if not exists ritsucad_takeoffs_location_idx on public.ritsucad_takeoffs(location_id);
create index if not exists ritsucad_takeoffs_service_idx on public.ritsucad_takeoffs(project_service_id);
create index if not exists ritsucad_takeoffs_document_idx on public.ritsucad_takeoffs(document_id);

alter table public.ritsucad_takeoffs enable row level security;

drop policy if exists ritsucad_takeoffs_select on public.ritsucad_takeoffs;
create policy ritsucad_takeoffs_select on public.ritsucad_takeoffs for select to authenticated using (private.can_access_project(project_id));
drop policy if exists ritsucad_takeoffs_insert on public.ritsucad_takeoffs;
create policy ritsucad_takeoffs_insert on public.ritsucad_takeoffs for insert to authenticated with check (private.can_manage_project(project_id) and created_by=auth.uid());
drop policy if exists ritsucad_takeoffs_update on public.ritsucad_takeoffs;
create policy ritsucad_takeoffs_update on public.ritsucad_takeoffs for update to authenticated using (private.can_manage_project(project_id)) with check (private.can_manage_project(project_id));
drop policy if exists ritsucad_takeoffs_delete on public.ritsucad_takeoffs;
create policy ritsucad_takeoffs_delete on public.ritsucad_takeoffs for delete to authenticated using (private.can_manage_project(project_id));

create or replace function public.audit_ritsucad_takeoff_change() returns trigger language plpgsql security definer set search_path=public as $$
declare r record; v_label text; v_description text;
begin
  r := case when tg_op='DELETE' then old else new end;
  v_label := case tg_op when 'INSERT' then 'Created' when 'UPDATE' then 'Updated' else 'Deleted' end;
  v_description := case tg_op when 'INSERT' then 'RitsuCAD takeoff created' when 'UPDATE' then 'RitsuCAD takeoff updated' else 'RitsuCAD takeoff deleted' end;
  insert into public.project_history(project_id,action_type,action_label,description,entity_type,entity_id,performed_by,performed_by_name,metadata)
  values(r.project_id,'RitsuCAD Takeoff',v_label,v_description,'ritsucad_takeoffs',r.id::text,auth.uid(),public.project_history_actor_name(auth.uid()),jsonb_build_object('operation',tg_op,'record',to_jsonb(r)));
  return case when tg_op='DELETE' then old else new end;
end;$$;

drop trigger if exists audit_ritsucad_takeoffs on public.ritsucad_takeoffs;
create trigger audit_ritsucad_takeoffs after insert or update or delete on public.ritsucad_takeoffs for each row execute function public.audit_ritsucad_takeoff_change();