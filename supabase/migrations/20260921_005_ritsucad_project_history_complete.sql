-- Complete RitsuCAD -> Project History integration.
-- Audits persisted project-impacting RitsuCAD records at the database boundary.
-- UI-only actions (zoom, pan, tool selection, snap/grid toggles) are intentionally excluded.

create or replace function public.audit_ritsucad_project_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_project uuid;
  v_action_type text;
  v_action_label text;
  v_description text;
  v_entity text := tg_table_name;
  v_metadata jsonb;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  v_project := r.project_id;

  v_action_label := case tg_op
    when 'INSERT' then 'Created'
    when 'UPDATE' then 'Updated'
    else 'Deleted'
  end;

  v_action_type := case tg_table_name
    when 'project_drawing_maps' then 'RitsuCAD Drawing Mapping'
    when 'location_drawing_geometries' then 'RitsuCAD Location Geometry'
    when 'project_drawing_location_geometries' then 'RitsuCAD Location Geometry'
    when 'location_scope_items' then 'RitsuCAD Scope Mapping'
    when 'ritsucad_takeoffs' then 'RitsuCAD Takeoff'
    else 'RitsuCAD'
  end;

  v_description := case tg_table_name
    when 'project_drawing_maps' then 'RitsuCAD drawing mapping ' || lower(v_action_label)
    when 'location_drawing_geometries' then 'RitsuCAD location geometry ' || lower(v_action_label)
    when 'project_drawing_location_geometries' then 'RitsuCAD location geometry ' || lower(v_action_label)
    when 'location_scope_items' then 'RitsuCAD location scope mapping ' || lower(v_action_label)
    when 'ritsucad_takeoffs' then 'RitsuCAD takeoff ' || lower(v_action_label)
    else 'RitsuCAD project record ' || lower(v_action_label)
  end;

  v_metadata := jsonb_build_object(
    'module', 'RitsuCAD',
    'operation', tg_op,
    'table', tg_table_name,
    'record', to_jsonb(r)
  );

  if tg_op = 'UPDATE' then
    v_metadata := v_metadata || jsonb_build_object(
      'before', to_jsonb(old),
      'after', to_jsonb(new)
    );
  end if;

  insert into public.project_history(
    project_id,
    action_type,
    action_label,
    description,
    entity_type,
    entity_id,
    performed_by,
    performed_by_name,
    metadata
  ) values (
    v_project,
    v_action_type,
    v_action_label,
    v_description,
    v_entity,
    r.id::text,
    auth.uid(),
    public.project_history_actor_name(auth.uid()),
    v_metadata
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Replace earlier RitsuCAD/spatial audit triggers with one canonical audit function.
-- This avoids duplicate Project History entries while retaining full coverage.

drop trigger if exists audit_project_drawing_maps on public.project_drawing_maps;
create trigger audit_project_drawing_maps
after insert or update or delete on public.project_drawing_maps
for each row execute function public.audit_ritsucad_project_change();

drop trigger if exists audit_location_drawing_geometries on public.location_drawing_geometries;
create trigger audit_location_drawing_geometries
after insert or update or delete on public.location_drawing_geometries
for each row execute function public.audit_ritsucad_project_change();

drop trigger if exists audit_location_scope_items on public.location_scope_items;
create trigger audit_location_scope_items
after insert or update or delete on public.location_scope_items
for each row execute function public.audit_ritsucad_project_change();

drop trigger if exists audit_project_drawing_location_geometries on public.project_drawing_location_geometries;
create trigger audit_project_drawing_location_geometries
after insert or update or delete on public.project_drawing_location_geometries
for each row execute function public.audit_ritsucad_project_change();

drop trigger if exists audit_ritsucad_takeoffs on public.ritsucad_takeoffs;
create trigger audit_ritsucad_takeoffs
after insert or update or delete on public.ritsucad_takeoffs
for each row execute function public.audit_ritsucad_project_change();
