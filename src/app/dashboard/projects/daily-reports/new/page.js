'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../../../lib/supabase/client';
import styles from '../daily-reports.module.css';

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getErrorMessage(error) {
  if (!error) {
    return 'An unexpected error occurred.';
  }

  if (error.code === '23505') {
    return 'A Daily Report already exists for this project and date.';
  }

  if (error.code === '42501') {
    return 'Your account does not have permission to create this Daily Report.';
  }

  return error.message || 'The Daily Report could not be created.';
}

export default function NewDailyReportPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [userId, setUserId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [reportDate, setReportDate] = useState(getLocalDateKey());
  const [workStartTime, setWorkStartTime] = useState('');
  const [workEndTime, setWorkEndTime] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadPage() {
      setIsLoading(true);
      setErrorMessage('');

      const queryParameters = new URLSearchParams(window.location.search);
      const selectedProjectId = queryParameters.get('projectId');

      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData?.user) {
        setErrorMessage('Your authenticated session could not be verified.');
        setIsLoading(false);
        return;
      }

      setUserId(userData.user.id);

      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select(`
          id,
          code,
          name,
          client_name,
          organization_id,
          status,
          created_at
        `)
        .neq('status', 'archived')
        .order('created_at', { ascending: false });

      if (projectsError) {
        setErrorMessage(getErrorMessage(projectsError));
        setIsLoading(false);
        return;
      }

      const availableProjects = projectsData || [];
      setProjects(availableProjects);

      if (!selectedProjectId) {
        setSelectedProject(null);
        setIsLoading(false);
        return;
      }

      const activeProject = availableProjects.find(
        (project) => project.id === selectedProjectId
      );

      if (!activeProject) {
        setSelectedProject(null);
        setErrorMessage(
          'The selected project does not exist or your account cannot access it.'
        );
        setIsLoading(false);
        return;
      }

      setSelectedProject(activeProject);
      setIsLoading(false);
    }

    loadPage();
  }, [supabase]);

  function changeProject(projectId) {
    window.location.href =
      `/dashboard/projects/daily-reports/new?projectId=${projectId}`;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!selectedProject || !userId || !reportDate || isSaving) {
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    const { data: existingReport, error: existingReportError } = await supabase
      .from('daily_reports')
      .select(`
        id,
        report_number,
        report_date
      `)
      .eq('project_id', selectedProject.id)
      .eq('report_date', reportDate)
      .maybeSingle();

    if (existingReportError) {
      setErrorMessage(getErrorMessage(existingReportError));
      setIsSaving(false);
      return;
    }

    if (existingReport) {
      setErrorMessage('A Daily Report already exists for this project and date.');
      setIsSaving(false);
      return;
    }

    const { data: latestReport, error: latestReportError } = await supabase
      .from('daily_reports')
      .select('report_number')
      .eq('project_id', selectedProject.id)
      .order('report_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestReportError) {
      setErrorMessage(getErrorMessage(latestReportError));
      setIsSaving(false);
      return;
    }

    const nextReportNumber = Number(latestReport?.report_number || 0) + 1;

    const { data: createdReport, error: createError } = await supabase
      .from('daily_reports')
      .insert({
        organization_id: selectedProject.organization_id,
        project_id: selectedProject.id,
        report_number: nextReportNumber,
        report_date: reportDate,
        status: 'draft',
        work_start_time: workStartTime || null,
        work_end_time: workEndTime || null,
        general_notes: generalNotes.trim() || null,
        created_by: userId,
      })
      .select(`
        id,
        report_number,
        report_date,
        status
      `)
      .single();

    if (createError) {
      setErrorMessage(getErrorMessage(createError));
      setIsSaving(false);
      return;
    }

    router.push(`/daily-report/${createdReport.id}`);
  }

  if (isLoading) {
    return (
      <main className={styles.page}>
        <section className={styles.infoCard}>
          <p className={styles.sectionEyebrow}>DAILY REPORT</p>
          <h1 className={styles.sectionTitle}>Loading...</h1>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>FIELD MANAGEMENT</p>
          <h1 className={styles.title}>New Daily Report</h1>
          <p className={styles.description}>
            Create the project&apos;s daily field record. The report will start as a
            Draft and can be completed progressively.
          </p>
        </div>

        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => router.push('/fieldop')}
        >
          ← Back to FieldOp
        </button>
      </section>

      {errorMessage && (
        <div
          style={{
            padding: '12px 14px',
            color: '#9f2929',
            border: '1px solid #fecaca',
            borderRadius: '9px',
            background: '#fff5f5',
            fontSize: '0.76rem',
          }}
        >
          {errorMessage}
        </div>
      )}

      <section className={styles.infoCard}>
        <div className={styles.infoCardHeader}>
          <div>
            <p className={styles.sectionEyebrow}>REPORT SETUP</p>
            <h2 className={styles.sectionTitle}>General information</h2>
          </div>
          <span className={styles.statusBadge}>Draft</span>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '16px',
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <span style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 800 }}>
                Project
              </span>
              <select
                value={selectedProject?.id || ''}
                onChange={(event) => changeProject(event.target.value)}
                required
                style={{
                  minHeight: '42px',
                  padding: '0 12px',
                  color: '#061b2f',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  background: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                }}
              >
                <option value="" disabled>Select a project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.code || 'Unassigned'} · {project.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <span style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 800 }}>
                Report date
              </span>
              <input
                type="date"
                required
                value={reportDate}
                onChange={(event) => setReportDate(event.target.value)}
                style={{
                  minHeight: '42px',
                  padding: '0 12px',
                  color: '#061b2f',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  background: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <span style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 800 }}>
                Work start
              </span>
              <input
                type="time"
                value={workStartTime}
                onChange={(event) => setWorkStartTime(event.target.value)}
                style={{
                  minHeight: '42px',
                  padding: '0 12px',
                  color: '#061b2f',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  background: '#ffffff',
                  fontSize: '0.78rem',
                }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <span style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 800 }}>
                Work end
              </span>
              <input
                type="time"
                value={workEndTime}
                onChange={(event) => setWorkEndTime(event.target.value)}
                style={{
                  minHeight: '42px',
                  padding: '0 12px',
                  color: '#061b2f',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  background: '#ffffff',
                  fontSize: '0.78rem',
                }}
              />
            </label>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <span style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 800 }}>
              General notes
            </span>
            <textarea
              rows={5}
              value={generalNotes}
              onChange={(event) => setGeneralNotes(event.target.value)}
              placeholder="Optional initial notes for this Daily Report..."
              style={{
                width: '100%',
                padding: '12px',
                color: '#061b2f',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                background: '#ffffff',
                fontFamily: 'inherit',
                fontSize: '0.78rem',
                lineHeight: 1.5,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </label>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              paddingTop: '6px',
            }}
          >
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => router.push('/fieldop')}
              disabled={isSaving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className={styles.primaryButton}
              disabled={!selectedProject || !reportDate || isSaving}
            >
              {isSaving ? 'Creating...' : 'Create Daily Report'}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.infoCard}>
        <p className={styles.sectionEyebrow}>WORKFLOW</p>
        <h2 className={styles.sectionTitle}>What happens next</h2>
        <p className={styles.integrationText}>
          After the Draft is created, the Daily Report workspace will allow field
          teams to progressively add weather, workforce, production, equipment,
          materials, issues, notes and supporting evidence before submission and
          approval.
        </p>
        <div className={styles.integrationFlow}>
          <span>Draft</span>
          <span className={styles.flowArrow}>→</span>
          <span>Submitted</span>
          <span className={styles.flowArrow}>→</span>
          <span>Reviewed</span>
          <span className={styles.flowArrow}>→</span>
          <span>Approved</span>
        </div>
      </section>
    </main>
  );
}
