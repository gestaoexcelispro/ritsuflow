-- RitsuFlow FieldOp — execution integrity hardening
-- Prevent duplicate active execution records and enforce cross-table identity consistency.

create unique index if not exists field_execution_events_one_open_scope_per_session_uidx
  on public.field_execution_events(attendance_session_id, location_scope_item_id)
  where status = 'in_progress' and finished_at is null;

create or replace function public.validate_field_execution_event_context()
returns trigger
language plpgsql
as $$
declare
  v_session_project_id uuid;
  v_session_worker_id uuid;
  v_session_check_out_at timestamptz;
  v_assignment_project_id uuid;
  v_assignment_worker_id uuid;
  v_scope_location_id uuid;
  v_scope_project_service_id uuid;
begin
  select project_id, worker_id, check_out_at
    into v_session_project_id, v_session_worker_id, v_session_check_out_at
  from public.field_attendance_sessions
  where id = new.attendance_session_id;

  if not found then
    raise exception 'Attendance session % was not found.', new.attendance_session_id;
  end if;

  if v_session_project_id is distinct from new.project_id
     or v_session_worker_id is distinct from new.worker_id then
    raise exception 'Execution project/worker does not match the attendance session.';
  end if;

  if new.status = 'in_progress' and v_session_check_out_at is not null then
    raise exception 'Execution cannot be active after attendance check-out.';
  end if;

  select project_id, worker_id
    into v_assignment_project_id, v_assignment_worker_id
  from public.field_project_assignments
  where id = new.assignment_id;

  if not found then
    raise exception 'Project assignment % was not found.', new.assignment_id;
  end if;

  if v_assignment_project_id is distinct from new.project_id
     or v_assignment_worker_id is distinct from new.worker_id then
    raise exception 'Execution project/worker does not match the project assignment.';
  end if;

  select location_id, project_service_id
    into v_scope_location_id, v_scope_project_service_id
  from public.location_scope_items
  where id = new.location_scope_item_id;

  if not found then
    raise exception 'Location Scope Item % was not found.', new.location_scope_item_id;
  end if;

  if v_scope_location_id is distinct from new.location_id
     or v_scope_project_service_id is distinct from new.project_service_id then
    raise exception 'Execution location/service does not match the Location Scope Item.';
  end if;

  if new.status = 'completed' and new.finished_at is null then
    raise exception 'Completed execution requires finished_at.';
  end if;

  if new.status = 'in_progress' and new.finished_at is not null then
    raise exception 'In-progress execution cannot have finished_at.';
  end if;

  return new;
end;
$$;

drop trigger if exists field_execution_events_validate_context
  on public.field_execution_events;

create trigger field_execution_events_validate_context
before insert or update on public.field_execution_events
for each row
execute function public.validate_field_execution_event_context();

comment on function public.validate_field_execution_event_context() is
  'Enforces FieldOp execution identity consistency across attendance, assignment and location scope.';
