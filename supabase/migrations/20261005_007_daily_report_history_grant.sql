-- FieldOp Daily Reports: allow the workflow to write its audit history.
-- transition_daily_report_status runs as the calling user and calls
-- private.insert_daily_report_approval_history, which only postgres could execute.
-- The function itself still checks auth.uid(), actor match and report access.

revoke all on function private.insert_daily_report_approval_history(uuid, text, text, text, text, uuid, timestamptz) from public, anon;

grant execute on function private.insert_daily_report_approval_history(uuid, text, text, text, text, uuid, timestamptz) to authenticated;
