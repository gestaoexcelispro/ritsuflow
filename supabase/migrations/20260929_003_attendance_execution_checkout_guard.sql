-- RitsuFlow FieldOp — attendance / execution lifecycle hardening
-- UI already blocks check-out while execution is active. This database trigger makes
-- the invariant true for every caller, including RPCs and future integrations.

create or replace function public.prevent_attendance_checkout_with_active_execution()
returns trigger
language plpgsql
as $$
begin
  -- Only evaluate the transition from open attendance to checked out.
  if old.check_out_at is null and new.check_out_at is not null then
    if exists (
      select 1
      from public.field_execution_events fee
      where fee.attendance_session_id = new.id
        and fee.status = 'in_progress'
        and fee.finished_at is null
    ) then
      raise exception 'Attendance cannot be checked out while a FieldOp execution is still active.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists field_attendance_sessions_execution_checkout_guard
  on public.field_attendance_sessions;

create trigger field_attendance_sessions_execution_checkout_guard
before update of check_out_at on public.field_attendance_sessions
for each row
execute function public.prevent_attendance_checkout_with_active_execution();

comment on function public.prevent_attendance_checkout_with_active_execution() is
  'Prevents attendance check-out while an in-progress FieldOp execution exists for the session.';
