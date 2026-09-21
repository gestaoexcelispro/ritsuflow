-- RitsuFlow spatial production model foundation
-- Shared by PreCon and FieldOp; neither module owns these records.

create table public.project_drawing_maps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  document_id uuid not null references public.project_documents(id) on delete cascade,
  page_number integer not null default 1 check (page_number > 0),
  drawing_type text not null default 'floor_plan',
  classification_label text,
  root_location_id uuid references public.locations(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(document_id,page_number)
);

create table public.location_drawing_geometries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  drawing_map_id uuid not null references public.project_drawing_maps(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  geometry_type text not null default 'polygon' check (geometry_type in ('polygon','rectangle')),
  geometry jsonb not null,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(drawing_map_id,location_id)
);

create table public.location_scope_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  project_service_id uuid not null references public.project_services(id) on delete cascade,
  drawing_map_id uuid references public.project_drawing_maps(id) on delete set null,
  planned_quantity numeric check (planned_quantity is null or planned_quantity >= 0),
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,location_id,project_service_id)
);

create index project_drawing_maps_project_idx on public.project_drawing_maps(project_id);
create index location_drawing_geometries_project_idx on public.location_drawing_geometries(project_id);
create index location_drawing_geometries_location_idx on public.location_drawing_geometries(location_id);
create index location_scope_items_project_location_idx on public.location_scope_items(project_id,location_id);
create index location_scope_items_service_idx on public.location_scope_items(project_service_id);

alter table public.project_drawing_maps enable row level security;
alter table public.location_drawing_geometries enable row level security;
alter table public.location_scope_items enable row level security;

create policy project_drawing_maps_select on public.project_drawing_maps for select to authenticated using (private.can_access_project(project_id));
create policy project_drawing_maps_insert on public.project_drawing_maps for insert to authenticated with check (private.can_manage_project(project_id) and created_by=auth.uid());
create policy project_drawing_maps_update on public.project_drawing_maps for update to authenticated using (private.can_manage_project(project_id)) with check (private.can_manage_project(project_id));
create policy project_drawing_maps_delete on public.project_drawing_maps for delete to authenticated using (private.can_manage_project(project_id));
create policy location_drawing_geometries_select on public.location_drawing_geometries for select to authenticated using (private.can_access_project(project_id));
create policy location_drawing_geometries_insert on public.location_drawing_geometries for insert to authenticated with check (private.can_manage_project(project_id) and created_by=auth.uid());
create policy location_drawing_geometries_update on public.location_drawing_geometries for update to authenticated using (private.can_manage_project(project_id)) with check (private.can_manage_project(project_id));
create policy location_drawing_geometries_delete on public.location_drawing_geometries for delete to authenticated using (private.can_manage_project(project_id));
create policy location_scope_items_select on public.location_scope_items for select to authenticated using (private.can_access_project(project_id));
create policy location_scope_items_insert on public.location_scope_items for insert to authenticated with check (private.can_manage_project(project_id) and created_by=auth.uid());
create policy location_scope_items_update on public.location_scope_items for update to authenticated using (private.can_manage_project(project_id)) with check (private.can_manage_project(project_id));
create policy location_scope_items_delete on public.location_scope_items for delete to authenticated using (private.can_manage_project(project_id));

create or replace function public.audit_spatial_mapping_change() returns trigger language plpgsql security definer set search_path=public as $$
declare r record; v_project uuid; v_entity text; v_label text; v_description text;
begin
  r := case when tg_op='DELETE' then old else new end;
  v_project := r.project_id;
  v_entity := tg_table_name;
  v_label := case tg_op when 'INSERT' then 'Created' when 'UPDATE' then 'Updated' else 'Deleted' end;
  v_description := case tg_table_name
    when 'project_drawing_maps' then 'Drawing mapping '||lower(v_label)
    when 'location_drawing_geometries' then 'Location geometry '||lower(v_label)
    when 'location_scope_items' then 'Location scope mapping '||lower(v_label)
    else 'Spatial mapping '||lower(v_label) end;
  insert into public.project_history(project_id,action_type,action_label,description,entity_type,entity_id,performed_by,performed_by_name,metadata)
  values(v_project,'Spatial Mapping',v_label,v_description,v_entity,r.id::text,auth.uid(),public.project_history_actor_name(auth.uid()),jsonb_build_object('operation',tg_op,'record',to_jsonb(r)));
  return case when tg_op='DELETE' then old else new end;
end;$$;

create trigger audit_project_drawing_maps after insert or update or delete on public.project_drawing_maps for each row execute function public.audit_spatial_mapping_change();
create trigger audit_location_drawing_geometries after insert or update or delete on public.location_drawing_geometries for each row execute function public.audit_spatial_mapping_change();
create trigger audit_location_scope_items after insert or update or delete on public.location_scope_items for each row execute function public.audit_spatial_mapping_change();