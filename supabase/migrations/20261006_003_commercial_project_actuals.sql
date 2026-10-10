-- Commercial → Estimate vs. actual: FieldOp totals for one project, for anyone who can open the
-- project and whose company has Commercial. Only totals leave the function (hours, quantity per
-- RitsuScope item, materials received), never report details, so daily-report permissions keep
-- protecting the reports themselves. Read-only; no table changes.
create or replace function public.commercial_project_actuals(p_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_access_project(p_project_id) then raise exception 'Not allowed to open this project'; end if;
  if not private.project_has_commercial(p_project_id) then raise exception 'Commercial license required'; end if;

  return jsonb_build_object(
    'attendance_hours', (
      select coalesce(sum(s.worked_minutes), 0) / 60.0
        from public.field_attendance_sessions s
       where s.project_id = p_project_id),
    'report_count', (
      select count(*) from public.daily_reports r where r.project_id = p_project_id),
    -- Quantity produced per RitsuScope item, through the FieldOp activity it feeds (Scope Allocation).
    'produced', coalesce((
      select jsonb_agg(jsonb_build_object('layer_id', x.layer_id, 'qty', x.qty))
        from (
          select l.id as layer_id, sum(coalesce(p.actual_quantity, 0)) as qty
            from public.takeoff_layers l
            join public.daily_report_production p on p.fieldop_activity_id = l.scope_activity_id
            join public.daily_reports r on r.id = p.daily_report_id and r.project_id = p_project_id
           where l.project_id = p_project_id
           group by l.id
        ) x), '[]'::jsonb),
    'received', coalesce((
      select jsonb_agg(jsonb_build_object('name', x.name, 'unit', x.unit, 'qty', x.qty))
        from (
          select min(trim(m.material_name)) as name, coalesce(m.unit, '') as unit, sum(coalesce(m.quantity, 0)) as qty
            from public.daily_report_materials m
            join public.daily_reports r on r.id = m.daily_report_id and r.project_id = p_project_id
           where coalesce(m.movement_type, 'received') = 'received' and coalesce(trim(m.material_name), '') <> ''
           group by lower(trim(m.material_name)), coalesce(m.unit, '')
        ) x), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.commercial_project_actuals(uuid) from public, anon;
grant execute on function public.commercial_project_actuals(uuid) to authenticated;
