import { NextResponse } from 'next/server';

import { createClient } from '../../../../../../lib/supabase/server';
import { syncWorkflowProductionToDailyReport } from '../../../../../../lib/workflow/fieldop-daily-report-data';

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json(
        { error: 'Authentication is required.' },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const reportId = resolvedParams?.reportId;

    if (!reportId) {
      return NextResponse.json(
        { error: 'Daily Report id is required.' },
        { status: 400 }
      );
    }

    const { data: report, error: reportError } = await supabase
      .from('daily_reports')
      .select('id, project_id, report_date, status')
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      return NextResponse.json(
        { error: reportError?.message || 'Daily Report was not found.' },
        { status: 404 }
      );
    }

    if (report.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft Daily Reports can receive FieldOp production.' },
        { status: 409 }
      );
    }

    const result = await syncWorkflowProductionToDailyReport(supabase, {
      reportId: report.id,
      projectId: report.project_id,
      reportDate: report.report_date,
      createdBy: userData.user.id,
    });

    return NextResponse.json({
      ok: true,
      reportId: report.id,
      reportDate: report.report_date,
      ...result,
    });
  } catch (error) {
    console.error('FieldOp Daily Report synchronization failed:', error);

    return NextResponse.json(
      { error: error?.message || 'FieldOp production could not be synchronized.' },
      { status: 500 }
    );
  }
}
