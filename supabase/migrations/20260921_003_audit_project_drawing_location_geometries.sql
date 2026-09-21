-- Audit the active RitsuCAD location geometry table in Project History.
-- The generic audit_spatial_mapping_change() function already handles spatial records.

drop trigger if exists audit_project_drawing_location_geometries
  on public.project_drawing_location_geometries;

create trigger audit_project_drawing_location_geometries
after insert or update or delete on public.project_drawing_location_geometries
for each row execute function public.audit_spatial_mapping_change();
