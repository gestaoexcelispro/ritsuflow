-- FieldOp Daily Reports, wave 3 shortcuts.

-- 1. A constraint can remember the Daily Report issue it came from (Issue → Constraints).
alter table public.constraints
  add column if not exists source_daily_report_issue_id uuid
  references public.daily_report_issues(id) on delete set null;

create unique index if not exists constraints_source_daily_report_issue_key
  on public.constraints (source_daily_report_issue_id)
  where source_daily_report_issue_id is not null;

-- 2. Whoever may edit a Daily Report may also delete the stored file of one of its attachments
--    (until now only project managers could, so files deleted by other users stayed in storage).
--    The file is removed before its attachment row, so the row is still there to check.
drop policy if exists "daily report editors can delete attachment files" on storage.objects;
create policy "daily report editors can delete attachment files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'daily-report-attachments'
    and exists (
      select 1
      from public.daily_report_attachments a
      where a.storage_bucket = 'daily-report-attachments'
        and a.storage_path = storage.objects.name
        and private.rbac_can_edit_daily_report(a.daily_report_id)
        and not private.daily_report_is_approved(a.daily_report_id)
    )
  );
