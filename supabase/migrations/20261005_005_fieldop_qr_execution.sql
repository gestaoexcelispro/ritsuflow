-- FieldOp QR location hub: worker self check-in/out and field execution (Start work / Finish).
--
-- 1) The field_execution_events context trigger still referenced columns that no longer exist
--    (location_scope_item_id, project_service_id), so every insert failed. It now validates
--    against location_service_quantities (location_service_quantity_id, fieldop_activity_id).
-- 2) field_worker_check_in / field_worker_check_out required company-manager permission, so a
--    worker could not register their own attendance. They now also accept the worker themself
--    when the method is self-service ('qr_code' or 'worker_self_service'). Every geofence, GPS
--    and exception rule in those functions is unchanged.
-- 3) New entry points used by the QR hub, all SECURITY DEFINER and tied to auth.uid():
--      fieldop_self_check_in(project, lat, lng, accuracy, location)
--      fieldop_self_check_out(project, lat, lng, accuracy)
--      fieldop_start_execution(location_service_quantity)
--      fieldop_finish_execution(execution, quantity)

-- 1) Execution context trigger -------------------------------------------------------------

create or replace function public.validate_field_execution_event_context()
returns trigger
language plpgsql
as $function$
declare
  v_session_project_id uuid;
  v_session_worker_id uuid;
  v_session_check_out_at timestamptz;
  v_assignment_project_id uuid;
  v_assignment_worker_id uuid;
  v_allocation_project_id uuid;
  v_allocation_location_id uuid;
  v_allocation_activity_id uuid;
begin
  select project_id, worker_id, check_out_at
    into v_session_project_id, v_session_worker_id, v_session_check_out_at
  from public.field_attendance_sessions where id = new.attendance_session_id;
  if not found then raise exception 'Attendance session % was not found.', new.attendance_session_id; end if;
  if v_session_project_id is distinct from new.project_id or v_session_worker_id is distinct from new.worker_id then
    raise exception 'Execution project/worker does not match the attendance session.';
  end if;
  if new.status = 'in_progress' and v_session_check_out_at is not null then
    raise exception 'Execution cannot be active after attendance check-out.';
  end if;

  select project_id, worker_id into v_assignment_project_id, v_assignment_worker_id
  from public.field_project_assignments where id = new.assignment_id;
  if not found then raise exception 'Project assignment % was not found.', new.assignment_id; end if;
  if v_assignment_project_id is distinct from new.project_id or v_assignment_worker_id is distinct from new.worker_id then
    raise exception 'Execution project/worker does not match the project assignment.';
  end if;

  select project_id, location_id, service_id
    into v_allocation_project_id, v_allocation_location_id, v_allocation_activity_id
  from public.location_service_quantities where id = new.location_service_quantity_id;
  if not found then raise exception 'Location allocation % was not found.', new.location_service_quantity_id; end if;
  if v_allocation_project_id is distinct from new.project_id
     or v_allocation_location_id is distinct from new.location_id
     or v_allocation_activity_id is distinct from new.fieldop_activity_id then
    raise exception 'Execution location/activity does not match the location allocation.';
  end if;

  if new.status = 'completed' and new.finished_at is null then raise exception 'Completed execution requires finished_at.'; end if;
  if new.status = 'in_progress' and new.finished_at is not null then raise exception 'In-progress execution cannot have finished_at.'; end if;
  return new;
end;
$function$;

-- 2) Self-service attendance ---------------------------------------------------------------

create or replace function private.fieldop_is_self_service(p_worker_id uuid, p_method text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(p_method, '') in ('qr_code', 'worker_self_service')
     and exists (
       select 1 from public.field_workers fw
       where fw.id = p_worker_id and fw.user_id = auth.uid() and fw.status = 'active'
     );
$function$;

-- Patch only the authorization checks of the two attendance functions; fail loudly if their
-- text changed, so the rest of each function is never altered by accident.
do $migration$
declare
  v_def text;
  v_new text;
begin
  -- Check-in
  v_def := pg_get_functiondef('public.field_worker_check_in(uuid,timestamptz,text,double precision,double precision,double precision,double precision,text,text,text)'::regprocedure);
  v_new := regexp_replace(v_def,
    'if\s+not\s+private\.can_manage_organization\(\s*v_assignment\.organization_id\s*\)\s*then',
    'if not private.can_manage_organization(v_assignment.organization_id) and not private.fieldop_is_self_service(v_assignment.worker_id, p_method) then');
  v_new := regexp_replace(v_new,
    'if\s+not\s+private\.can_access_project\(\s*v_assignment\.project_id\s*\)\s*then',
    'if not private.can_access_project(v_assignment.project_id) and not private.fieldop_is_self_service(v_assignment.worker_id, p_method) then');
  if v_new = v_def or position('fieldop_is_self_service(v_assignment.worker_id, p_method) then' in v_new) = 0
     or (length(v_new) - length(replace(v_new, 'fieldop_is_self_service', ''))) / length('fieldop_is_self_service') <> 2 then
    raise exception 'field_worker_check_in authorization block not found; migration stopped.';
  end if;
  execute v_new;

  -- Check-out
  v_def := pg_get_functiondef('public.field_worker_check_out(uuid,timestamptz,text,double precision,double precision,double precision,double precision,text,text,text)'::regprocedure);
  v_new := regexp_replace(v_def,
    'if\s+not\s+private\.can_manage_organization\(\s*v_session\.organization_id\s*\)\s*then',
    'if not private.can_manage_organization(v_session.organization_id) and not private.fieldop_is_self_service(v_session.worker_id, p_method) then');
  v_new := regexp_replace(v_new,
    'if\s+not\s+private\.can_access_project\(\s*v_session\.project_id\s*\)\s*then',
    'if not private.can_access_project(v_session.project_id) and not private.fieldop_is_self_service(v_session.worker_id, p_method) then');
  if v_new = v_def
     or (length(v_new) - length(replace(v_new, 'fieldop_is_self_service', ''))) / length('fieldop_is_self_service') <> 2 then
    raise exception 'field_worker_check_out authorization block not found; migration stopped.';
  end if;
  execute v_new;
end;
$migration$;

-- The worker linked to the signed-in user.
create or replace function private.fieldop_current_worker()
returns public.field_workers
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_worker public.field_workers%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into v_worker from public.field_workers
  where user_id = auth.uid() and status = 'active'
  order by created_at limit 1;
  if v_worker.id is null then raise exception 'No active FieldOp worker is linked to this user.'; end if;
  return v_worker;
end;
$function$;

create or replace function public.fieldop_self_check_in(
  p_project_id uuid,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_gps_accuracy_m double precision default null,
  p_location_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare
  v_worker public.field_workers%rowtype := private.fieldop_current_worker();
  v_assignment public.field_project_assignments%rowtype;
begin
  select * into v_assignment from public.field_project_assignments
  where worker_id = v_worker.id and project_id = p_project_id and organization_id = v_worker.organization_id
    and status = 'active' and start_date <= current_date and (end_date is null or end_date >= current_date)
  order by start_date desc, created_at desc limit 1;
  if v_assignment.id is null then raise exception 'No active project assignment exists for this worker.'; end if;

  perform public.field_worker_check_in(
    v_assignment.id, now(), 'qr_code', p_latitude, p_longitude, p_gps_accuracy_m, null, null, null,
    case when p_location_id is null then null else 'QR location ' || p_location_id::text end
  );
end;
$function$;

create or replace function public.fieldop_self_check_out(
  p_project_id uuid,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_gps_accuracy_m double precision default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare
  v_worker public.field_workers%rowtype := private.fieldop_current_worker();
  v_session_id uuid;
begin
  select id into v_session_id from public.field_attendance_sessions
  where worker_id = v_worker.id and project_id = p_project_id and status = 'open'
  order by check_in_at desc limit 1;
  if v_session_id is null then raise exception 'No open attendance session for this project.'; end if;

  perform public.field_worker_check_out(v_session_id, now(), 'qr_code', p_latitude, p_longitude, p_gps_accuracy_m);
end;
$function$;

-- 3) Field execution -----------------------------------------------------------------------

create or replace function public.fieldop_start_execution(p_location_service_quantity_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare
  v_worker public.field_workers%rowtype := private.fieldop_current_worker();
  v_allocation public.location_service_quantities%rowtype;
  v_activity public.fieldop_project_activities%rowtype;
  v_session public.field_attendance_sessions%rowtype;
  v_unit text;
  v_id uuid;
begin
  select * into v_allocation from public.location_service_quantities where id = p_location_service_quantity_id;
  if v_allocation.id is null then raise exception 'Location allocation not found.'; end if;

  select * into v_activity from public.fieldop_project_activities where id = v_allocation.service_id;
  if v_activity.id is null or not v_activity.is_active then raise exception 'This activity is not active in FieldOp.'; end if;

  if not exists (
    select 1 from public.fieldop_project_locations
    where project_id = v_allocation.project_id and location_id = v_allocation.location_id and is_active
  ) then
    raise exception 'This location is not enabled for FieldOp.';
  end if;

  select * into v_session from public.field_attendance_sessions
  where worker_id = v_worker.id and project_id = v_allocation.project_id and status = 'open'
  order by check_in_at desc limit 1;
  if v_session.id is null then raise exception 'Check in to the project before starting work.'; end if;

  if exists (select 1 from public.field_execution_events where worker_id = v_worker.id and status = 'in_progress') then
    raise exception 'Worker already has work in progress.';
  end if;

  if v_activity.source = 'scope' then
    select unit into v_unit from public.project_scopes where id = v_activity.scope_item_id;
  end if;
  v_unit := coalesce(v_unit, v_activity.unit);

  insert into public.field_execution_events (
    project_id, attendance_session_id, assignment_id, worker_id, location_id,
    status, actual_quantity, unit, started_at, created_by,
    fieldop_activity_id, location_service_quantity_id
  ) values (
    v_allocation.project_id, v_session.id, v_session.assignment_id, v_worker.id, v_allocation.location_id,
    'in_progress', 0, v_unit, now(), auth.uid(),
    v_activity.id, v_allocation.id
  ) returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.fieldop_finish_execution(p_execution_id uuid, p_quantity numeric)
returns void
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare
  v_worker public.field_workers%rowtype := private.fieldop_current_worker();
  v_execution public.field_execution_events%rowtype;
  v_allocated numeric;
  v_done numeric;
begin
  if p_quantity is null or p_quantity < 0 then raise exception 'Quantity must be zero or greater.'; end if;

  select * into v_execution from public.field_execution_events where id = p_execution_id for update;
  if v_execution.id is null or v_execution.worker_id <> v_worker.id then raise exception 'Work record not found.'; end if;
  if v_execution.status <> 'in_progress' then raise exception 'This work is already finished.'; end if;

  select quantity into v_allocated from public.location_service_quantities where id = v_execution.location_service_quantity_id;
  select coalesce(sum(actual_quantity), 0) into v_done from public.field_execution_events
  where location_service_quantity_id = v_execution.location_service_quantity_id and status = 'completed';
  if v_allocated is not null and v_done + p_quantity > v_allocated then
    raise exception 'Quantity exceeds the remaining allocated quantity (%).', greatest(v_allocated - v_done, 0);
  end if;

  update public.field_execution_events
  set status = 'completed', actual_quantity = p_quantity, finished_at = now(), updated_at = now()
  where id = v_execution.id;
end;
$function$;

-- Only signed-in users may call the new entry points.
revoke all on function public.fieldop_self_check_in(uuid, double precision, double precision, double precision, uuid) from public, anon;
revoke all on function public.fieldop_self_check_out(uuid, double precision, double precision, double precision) from public, anon;
revoke all on function public.fieldop_start_execution(uuid) from public, anon;
revoke all on function public.fieldop_finish_execution(uuid, numeric) from public, anon;
grant execute on function public.fieldop_self_check_in(uuid, double precision, double precision, double precision, uuid) to authenticated;
grant execute on function public.fieldop_self_check_out(uuid, double precision, double precision, double precision) to authenticated;
grant execute on function public.fieldop_start_execution(uuid) to authenticated;
grant execute on function public.fieldop_finish_execution(uuid, numeric) to authenticated;
revoke all on function private.fieldop_current_worker() from public, anon;
revoke all on function private.fieldop_is_self_service(uuid, text) from public, anon;
grant execute on function private.fieldop_current_worker() to authenticated;
grant execute on function private.fieldop_is_self_service(uuid, text) to authenticated;
