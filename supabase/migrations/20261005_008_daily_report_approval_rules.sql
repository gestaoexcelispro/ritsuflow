-- FieldOp Daily Reports: approval polish.
-- 1. Per-project setting: the approver must be a different person from the submitter and the reviewer.
-- 2. Database rule that enforces it on every path that approves a report.
-- 3. Read-only function that tells the screen which workflow actions the current user may take.

alter table public.fieldop_daily_report_settings
  add column if not exists require_separate_approver boolean not null default false;

create or replace function private.enforce_separate_daily_report_approver()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_required boolean;
  v_actor uuid := coalesce(auth.uid(), new.approved_by);
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    select s.require_separate_approver into v_required
    from public.fieldop_daily_report_settings s
    where s.project_id = new.project_id;

    if coalesce(v_required, false)
       and v_actor is not null
       and (v_actor = old.submitted_by or v_actor = old.reviewed_by) then
      raise exception 'SEPARATE_APPROVER_REQUIRED'
        using errcode = '42501',
              detail = 'This project requires the approver to be different from the submitter and the reviewer.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_separate_daily_report_approver() from public, anon, authenticated;

drop trigger if exists enforce_separate_daily_report_approver on public.daily_reports;
create trigger enforce_separate_daily_report_approver
  before update of status on public.daily_reports
  for each row execute function private.enforce_separate_daily_report_approver();

create or replace function public.fieldop_daily_report_permissions(p_daily_report_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path to ''
as $$
  select jsonb_build_object(
    'submit',  private.rbac_can_daily_report_action(dr.id, 'daily_reports.submit'),
    'review',  private.rbac_can_daily_report_action(dr.id, 'daily_reports.review'),
    'approve', private.rbac_can_daily_report_action(dr.id, 'daily_reports.approve'),
    'reopen',  private.rbac_can_daily_report_action(dr.id, 'daily_reports.reopen'),
    'separate_approver_required', coalesce(s.require_separate_approver, false),
    'approve_blocked_by_separation',
      coalesce(s.require_separate_approver, false)
      and auth.uid() is not null
      and (auth.uid() = dr.submitted_by or auth.uid() = dr.reviewed_by)
  )
  from public.daily_reports dr
  left join public.fieldop_daily_report_settings s on s.project_id = dr.project_id
  where dr.id = p_daily_report_id;
$$;

revoke all on function public.fieldop_daily_report_permissions(uuid) from public, anon;
grant execute on function public.fieldop_daily_report_permissions(uuid) to authenticated;
