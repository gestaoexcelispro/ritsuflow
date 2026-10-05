'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../../../lib/supabase/client'
import { useT } from '../../../../../lib/i18n/useT'
import { FieldOpShell, PageHeader, Panel, Notice, ui } from '../../../ui'
import styles from '../daily-reports.module.css'

const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

export default function NewFieldOpDailyReportPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const t = useT('fieldopReports')
  const [projects, setProjects] = useState([])
  const [projectId, setProjectId] = useState('')
  const [date, setDate] = useState(localDate())
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [notes, setNotes] = useState('')
  const [userId, setUserId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const preferred = new URLSearchParams(window.location.search).get('projectId') || ''
      const { data: userData } = await supabase.auth.getUser()
      setUserId(userData?.user?.id || null)
      const { data, error: projectsError } = await supabase.from('projects').select('id,code,name,organization_id,status').in('status', ['planning', 'active', 'on_hold']).order('name')
      if (projectsError) { setError(projectsError.message); return }
      setProjects(data || [])
      if (preferred && (data || []).some((p) => p.id === preferred)) setProjectId(preferred)
      else if ((data || []).length === 1) setProjectId(data[0].id)
    }
    load()
  }, [supabase])

  async function submit(event) {
    event.preventDefault()
    if (!projectId || !userId || saving) return
    setSaving(true); setError('')
    const project = projects.find((p) => p.id === projectId)
    const { data: existing, error: checkError } = await supabase.from('daily_reports').select('id').eq('project_id', projectId).eq('report_date', date).maybeSingle()
    if (checkError) { setError(checkError.message); setSaving(false); return }
    if (existing) { router.push(`/fieldop/reports/daily/${existing.id}`); return }
    // The database assigns the final report number under a lock; this value is only a fallback.
    const { data: latest } = await supabase.from('daily_reports').select('report_number').eq('project_id', projectId).order('report_number', { ascending: false }).limit(1).maybeSingle()
    const { data: created, error: createError } = await supabase.from('daily_reports').insert({
      organization_id: project.organization_id,
      project_id: projectId,
      report_number: Number(latest?.report_number || 0) + 1,
      report_date: date,
      status: 'draft',
      work_start_time: start || null,
      work_end_time: end || null,
      general_notes: notes.trim() || null,
      created_by: userId,
    }).select('id').single()
    if (createError) { setError(createError.message); setSaving(false); return }
    router.push(`/fieldop/reports/daily/${created.id}`)
  }

  return <FieldOpShell active="reports" projectId={projectId || undefined} action={false}>
    <PageHeader back={{ href: '/fieldop/reports/daily', label: t('common.reports') }} title={t('new.title')} subtitle={t('new.heroText')} />
    <div style={{ display: 'grid', gap: 14, maxWidth: 760 }}>
      <Notice>{error}</Notice>
      <Panel title={t('new.setup')}>
        <form className={styles.form} onSubmit={submit}>
          <div className={styles.formGrid}>
            <label className={styles.field}><span>{t('new.project')}</span><select required value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">{t('new.selectProject')}</option>{projects.map((p) => <option key={p.id} value={p.id}>{[p.code, p.name].filter(Boolean).join(' · ')}</option>)}</select></label>
            <label className={styles.field}><span>{t('new.date')}</span><input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label className={styles.field}><span>{t('new.start')}</span><input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></label>
            <label className={styles.field}><span>{t('new.end')}</span><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          </div>
          <label className={styles.field}><span>{t('new.notes')}</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('new.notesPlaceholder')} /></label>
          <p style={{ margin: 0, color: 'var(--fo-muted)', fontSize: 14 }}>{t('new.sameDayHint')}</p>
          <div className={styles.formActions}>
            <Link className={ui.btn} href="/fieldop/reports/daily">{t('common.cancel')}</Link>
            <button className={ui.btnPrimary} type="submit" disabled={!projectId || !date || saving}>{saving ? t('new.creating') : t('new.submit')}</button>
          </div>
        </form>
      </Panel>
    </div>
  </FieldOpShell>
}
