import { redirect } from 'next/navigation';

export default async function FieldOpDailyReportWorkspace({ params }) {
  const { reportId } = await params;

  redirect(`/dashboard/projects/daily-reports/${reportId}`);
}
