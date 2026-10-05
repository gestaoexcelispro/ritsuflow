-- FieldOp Daily Reports: numbering, production saving, workforce from attendance, linked users.
--
-- 1) Report numbers are assigned by the database (per project, under a lock), so two people
--    creating reports at the same time can no longer get the same number.
-- 2) fieldop_save_daily_production saves a report's production in one transaction: only
--    allocations at locations enabled in FieldOp, never more than what remains allocated
--    (counting earlier reports), and a clear error if anything is wrong. Nothing is saved
--    unless every row is valid. Runs with the caller's permissions (RLS applies).
-- 3) fieldop_snapshot_daily_workforce replaces the report's workforce rows with a summary of
--    that day's attendance, by company and crew, with hours and role counts.
-- 4) A user can be linked to at most one worker (needed for QR self check-in).

create or replace function public.set_daily_report_number()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform pg_advisory_xact_lock(hashtextextended('daily_report_number:' || new.project_id::text, 0));
  select coalesce(max(report_number), 0) + 1 into new.report_number
  from public.daily_reports where project_id = new.project_id;
  return new;
end;
$function$;

drop trigger if exists set_daily_report_number on public.daily_reports;
create trigger set_daily_report_number
  before insert on public.daily_reports
  for each row execute function public.set_daily_report_number();

create or replace function public.fieldop_save_daily_production(p_daily_report_id uuid, p_items jsonb)
returns integer
language plpgsql
set search_path to 'public'
as $function$
declare
  v_report public.daily_reports%rowtype;
  v_item jsonb;
  v_allocation public.location_service_quantities%rowtype;
  v_activity public.fieldop_project_activities%rowtype;
  v_location_name text;
  v_name text;
  v_code text;
  v_unit text;
  v_quantity numeric;
  v_notes text;
  v_previous numeric;
  v_cumulative numeric;
  v_status text;
  v_existing uuid;
  v_saved integer := 0;
begin
  select * into v_report from public.daily_reports where id = p_daily_report_id;
  if v_report.id is null then raise exception 'Daily Report not found.'; end if;
  if v_report.status = 'approved' then raise exception 'An approved Daily Report cannot be changed.'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Production items must be a list.'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_allocation from public.location_service_quantities
    where id = (v_item ->> 'location_service_quantity_id')::uuid and project_id = v_report.project_id;
    if v_allocation.id is null then raise exception 'Allocation does not belong to this project.'; end if;

    if not exists (
      select 1 from public.fieldop_project_locations
      where project_id = v_report.project_id and location_id = v_allocation.location_id and is_active
    ) then
      raise exception 'Location is not enabled for FieldOp.';
    end if;

    v_quantity := coalesce(nullif(v_item ->> 'actual_quantity', '')::numeric, 0);
    if v_quantity < 0 then raise exception 'Production quantity must be zero or greater.'; end if;
    v_notes := nullif(trim(coalesce(v_item ->> 'notes', '')), '');

    select coalesce(sum(drp.actual_quantity), 0) into v_previous
    from public.daily_report_production drp
    join public.daily_reports dr on dr.id = drp.daily_report_id
    where dr.project_id = v_report.project_id and dr.report_date < v_report.report_date
      and drp.location_service_quantity_id = v_allocation.id;

    v_cumulative := v_previous + v_quantity;
    if v_allocation.quantity is not null and v_cumulative > v_allocation.quantity then
      select name into v_location_name from public.locations where id = v_allocation.location_id;
      raise exception 'Production exceeds the allocated quantity at % (remaining %).',
        coalesce(v_location_name, 'this location'), greatest(v_allocation.quantity - v_previous, 0);
    end if;

    select id into v_existing from public.daily_report_production
    where daily_report_id = v_report.id and location_service_quantity_id = v_allocation.id;

    if v_quantity = 0 and v_notes is null then
      if v_existing is not null then delete from public.daily_report_production where id = v_existing; end if;
      continue;
    end if;

    select * into v_activity from public.fieldop_project_activities where id = v_allocation.service_id;
    v_name := v_activity.activity_name; v_code := null; v_unit := v_activity.unit;
    if v_activity.source = 'scope' then
      select coalesce(scope_name, v_name), scope_code, coalesce(unit, v_unit)
        into v_name, v_code, v_unit
      from public.project_scopes where id = v_activity.scope_item_id;
    end if;
    select name into v_location_name from public.locations where id = v_allocation.location_id;

    v_status := case
      when v_allocation.quantity is not null and v_cumulative >= v_allocation.quantity then 'completed'
      when v_cumulative > 0 then 'in_progress'
      else 'not_started' end;

    if v_existing is not null then
      update public.daily_report_production set
        actual_quantity = v_quantity, cumulative_quantity = v_cumulative, planned_quantity = v_allocation.quantity,
        production_status = v_status, notes = v_notes, location_name = v_location_name,
        service_code = v_code, service_name = coalesce(v_name, 'Activity'), unit = v_unit, updated_at = now()
      where id = v_existing;
    else
      insert into public.daily_report_production (
        daily_report_id, location_id, location_service_quantity_id, fieldop_activity_id,
        location_name, service_code, service_name, unit,
        planned_quantity, actual_quantity, cumulative_quantity, production_status, notes, source, created_by
      ) values (
        v_report.id, v_allocation.location_id, v_allocation.id, v_allocation.service_id,
        v_location_name, v_code, coalesce(v_name, 'Activity'), v_unit,
        v_allocation.quantity, v_quantity, v_cumulative, v_status, v_notes, 'manual', auth.uid()
      );
    end if;
    v_saved := v_saved + 1;
  end loop;

  return v_saved;
end;
$function$;

create or replace function public.fieldop_snapshot_daily_workforce(p_daily_report_id uuid)
returns integer
language plpgsql
set search_path to 'public'
as $function$
declare
  v_report public.daily_reports%rowtype;
  v_group record;
  v_role record;
  v_workforce_id uuid;
  v_groups integer := 0;
begin
  select * into v_report from public.daily_reports where id = p_daily_report_id;
  if v_report.id is null then raise exception 'Daily Report not found.'; end if;
  if v_report.status = 'approved' then raise exception 'An approved Daily Report cannot be changed.'; end if;

  delete from public.daily_report_workforce where daily_report_id = v_report.id;

  for v_group in
    select coalesce(c.name, '—') as company_name, cr.name as crew_name,
           count(distinct s.worker_id) as workers,
           round(sum(coalesce(s.regular_minutes, s.worked_minutes,
             floor(extract(epoch from (coalesce(s.check_out_at, now()) - s.check_in_at)) / 60)::integer, 0)) / 60.0, 2) as regular_hours,
           round(sum(coalesce(s.overtime_minutes, 0)) / 60.0, 2) as overtime_hours,
           a.company_id, a.crew_id
    from public.field_attendance_sessions s
    join public.field_project_assignments a on a.id = s.assignment_id
    left join public.field_companies c on c.id = a.company_id
    left join public.field_crews cr on cr.id = a.crew_id
    where s.project_id = v_report.project_id and s.work_date = v_report.report_date and s.status <> 'cancelled'
    group by c.name, cr.name, a.company_id, a.crew_id
  loop
    insert into public.daily_report_workforce (daily_report_id, company_name, crew_name, regular_hours, overtime_hours, notes)
    values (v_report.id, v_group.company_name, v_group.crew_name, v_group.regular_hours, v_group.overtime_hours,
            'From attendance: ' || v_group.workers || ' worker(s).')
    returning id into v_workforce_id;

    for v_role in
      select coalesce(r.name, '—') as role_name, count(distinct s.worker_id) as worker_count
      from public.field_attendance_sessions s
      join public.field_project_assignments a on a.id = s.assignment_id
      left join public.field_roles r on r.id = a.role_id
      where s.project_id = v_report.project_id and s.work_date = v_report.report_date and s.status <> 'cancelled'
        and a.company_id is not distinct from v_group.company_id and a.crew_id is not distinct from v_group.crew_id
      group by r.name
    loop
      insert into public.daily_report_workforce_roles (workforce_id, role_name, worker_count)
      values (v_workforce_id, v_role.role_name, v_role.worker_count);
    end loop;

    v_groups := v_groups + 1;
  end loop;

  return v_groups;
end;
$function$;

revoke all on function public.fieldop_save_daily_production(uuid, jsonb) from public, anon;
revoke all on function public.fieldop_snapshot_daily_workforce(uuid) from public, anon;
grant execute on function public.fieldop_save_daily_production(uuid, jsonb) to authenticated;
grant execute on function public.fieldop_snapshot_daily_workforce(uuid) to authenticated;

create unique index if not exists field_workers_user_id_key
  on public.field_workers (user_id) where user_id is not null;
