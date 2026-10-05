-- FieldOp Daily Reports: the Safety section was the only one without the approved-report lock.
drop trigger if exists protect_approved_daily_report_safety on public.daily_report_safety;
create trigger protect_approved_daily_report_safety
  before insert or update or delete on public.daily_report_safety
  for each row execute function private.prevent_approved_daily_report_change();
