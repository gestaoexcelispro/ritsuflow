/**
 * Submits a Daily Report for review. The workforce summary is recorded first, so the
 * submitted report carries the attendance of that day as it was at submission.
 */
export async function submitReport(supabase, reportId, comments = null) {
  const snapshot = await supabase.rpc('fieldop_snapshot_daily_workforce', { p_daily_report_id: reportId })
  if (snapshot.error) return { error: snapshot.error }
  return supabase.rpc('transition_daily_report_status', { p_daily_report_id: reportId, p_action: 'submitted', p_comments: comments })
}
