'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { useT } from '../../../lib/i18n/useT'
import { useLanguage } from '../../../lib/i18n/LanguageProvider'
import { AppShell, PageHeader, Panel, Badge, Empty, Notice, Segments, ui } from '../../fieldop/ui'
import ProjectDocuments from './ProjectDocuments'
import ProjectTeam from './ProjectTeam'
import DeleteProjectModal from './DeleteProjectModal'
import ProjectReportButton from './ProjectReportButton'
import styles from './project.module.css'

const STATUSES = ['planning', 'active', 'on_hold', 'completed', 'archived']
const TONE = { active: 'ok', planning: 'info', on_hold: 'warn' }
const hasCoordinates = (p) => p && Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)) && Math.abs(Number(p.latitude)) <= 90 && Math.abs(Number(p.longitude)) <= 180 && p.latitude !== null && p.longitude !== null && p.latitude !== '' && p.longitude !== ''
const osmUrl = (p) => { const lat = Number(p.latitude), lon = Number(p.longitude), dy = 0.006, dx = 0.009; return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(`${lon - dx},${lat - dy},${lon + dx},${lat + dy}`)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lon}`)}` }
const googleUrl = (p) => { const q = hasCoordinates(p) ? `${p.latitude},${p.longitude}` : [p.address_line, p.address_number, p.neighborhood, p.city, p.state_region, p.postal_code, p.country_code].filter(Boolean).join(', '); return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` }

export default function ProjectDetailPage() {
  const params = useParams(), router = useRouter(), projectId = params?.projectId
  const t = useT('projects')
  const { language } = useLanguage()
  const fileInputRef = useRef(null)
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [tab, setTab] = useState('notes')
  const [notes, setNotes] = useState([])
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [notesLoading, setNotesLoading] = useState(false)

  useEffect(() => {
    if (!projectId) return undefined
    let active = true
    ;(async () => {
      setLoading(true); setError('')
      const { data, error: e } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle()
      if (!active) return
      if (e) setError(e.message || t('detail.errLoad'))
      else if (!data) setError(t('detail.notFound'))
      else setProject(data)
      setLoading(false)
    })()
    return () => { active = false }
  }, [projectId, t])

  useEffect(() => {
    if (!projectId) return undefined
    let active = true
    ;(async () => {
      setNotesLoading(true)
      const { data, error: e } = await supabase.from('project_notes').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
      if (active) { if (e) setError(t('notes.errLoad', { message: e.message })); else setNotes(data || []); setNotesLoading(false) }
    })()
    return () => { active = false }
  }, [projectId, t])

  useEffect(() => {
    if (!deleteOpen) return undefined
    const close = (e) => { if (e.key === 'Escape' && !deleting) setDeleteOpen(false) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [deleteOpen, deleting])

  const dateFormat = useMemo(() => new Intl.DateTimeFormat(language, { dateStyle: 'medium' }), [language])
  const dateTime = useMemo(() => new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }), [language])
  const date = (v) => { if (!v) return '—'; const d = new Date(`${String(v).slice(0, 10)}T12:00:00`); return Number.isNaN(d.getTime()) ? '—' : dateFormat.format(d) }
  const money = (v, c) => { if (v === null || v === undefined || v === '') return '—'; try { return new Intl.NumberFormat(language, { style: 'currency', currency: c || 'BRL' }).format(Number(v) || 0) } catch { return String(v) } }

  async function addNote() {
    const text = noteText.trim()
    if (!text || savingNote || !project) return
    setSavingNote(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError(t('notes.errSignedOut')); setSavingNote(false); return }
    const { data: profile } = await supabase.from('user_profiles').select('full_name,display_name,email').eq('user_id', user.id).maybeSingle()
    const authorName = profile?.full_name || profile?.display_name || profile?.email || user.email || 'RitsuFlow'
    const { data, error: e } = await supabase.from('project_notes').insert({ project_id: project.id, note: text, created_by: user.id, author_name: authorName, author_email: profile?.email || user.email || null }).select('*').single()
    if (e) setError(t('notes.errAdd', { message: e.message }))
    else { setNotes((current) => [data, ...current]); setNoteText('') }
    setSavingNote(false)
  }

  async function deleteNote(note) {
    if (!window.confirm(t('notes.confirmDelete'))) return
    setError('')
    const { error: e } = await supabase.from('project_notes').delete().eq('id', note.id)
    if (e) setError(t('notes.errDelete', { message: e.message }))
    else setNotes((current) => current.filter((item) => item.id !== note.id))
  }

  async function deleteProject() {
    if (!project || deleting) return
    setDeleting(true); setError('')
    const { error: e } = await supabase.from('projects').delete().eq('id', project.id)
    if (e) { setError(t('detail.errDelete', { message: e.message })); setDeleting(false); setDeleteOpen(false); return }
    router.replace('/projects'); router.refresh()
  }

  async function uploadProjectImage(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !project || uploadingImage) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError(t('image.errType')); return }
    if (file.size > 10 * 1024 * 1024) { setError(t('image.errSize')); return }
    setUploadingImage(true); setError('')
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${project.id}/project-${Date.now()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('project-images').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
    if (uploadError) { setError(t('image.errUpload', { message: uploadError.message })); setUploadingImage(false); return }
    const oldPath = project.project_image_path
    const { data: updated, error: updateError } = await supabase.from('projects').update({ project_image_path: path }).eq('id', project.id).select('*').single()
    if (updateError) {
      await supabase.storage.from('project-images').remove([path])
      setError(t('image.errSave', { message: updateError.message })); setUploadingImage(false); return
    }
    if (oldPath && oldPath !== path) await supabase.storage.from('project-images').remove([oldPath])
    setProject(updated); setUploadingImage(false)
  }

  const imageUrl = project?.project_image_path ? supabase.storage.from('project-images').getPublicUrl(project.project_image_path).data.publicUrl : ''
  const status = STATUSES.includes(project?.status) ? project.status : 'planning'
  const currency = project?.currency_code || 'BRL'

  if (loading) return <AppShell module="projects" active="overview" projectId={projectId} action={false}><Empty title={t('detail.loading')} /></AppShell>
  if (!project) return <AppShell module="projects" active="overview" projectId={projectId} action={false}><Empty title={t('detail.unavailable')} text={error} action={<Link className={ui.btn} href="/projects">{t('detail.backToList')}</Link>} /></AppShell>

  const Row = ({ label, value }) => <div className={styles.row}><span>{label}</span><strong>{value === null || value === undefined || value === '' ? '—' : value}</strong></div>

  return <AppShell module="projects" active="overview" projectId={projectId}
    action={<Link className={ui.btnPrimary} href={`/projects/${projectId}/edit`}>{t('detail.edit')}</Link>}>
    <PageHeader
      back={{ href: '/projects', label: t('nav.allProjects') }}
      title={project.name || t('list.untitled')}
      meta={<>
        <span>{[project.project_id, project.client_name, [project.city, project.state_region].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || '—'}</span>
        <Badge tone={TONE[status]}>{t(`status.${status}`)}</Badge>
      </>}
      actions={<>
        <ProjectReportButton project={project} />
        <button type="button" className={ui.btnDanger} onClick={() => setDeleteOpen(true)} disabled={deleting}>{t('detail.delete')}</button>
      </>}
    />
    <Notice>{error}</Notice>

    <div className={styles.layout}>
      <div className={styles.main}>
        <div className={styles.cards}>
          <Panel title={t('detail.infoTitle')}>
            <Row label={t('field.projectId')} value={project.project_id} />
            <Row label={t('field.contractNumber')} value={project.contract_number} />
            <Row label={t('field.client')} value={project.client_name} />
            <Row label={t('field.code')} value={project.code} />
          </Panel>
          <Panel title={t('detail.addressTitle')}>
            <Row label={t('field.address')} value={[project.address_line, project.address_number].filter(Boolean).join(', ')} />
            <Row label={t('field.neighborhood')} value={project.neighborhood} />
            <Row label={t('field.cityState')} value={[project.city, project.state_region].filter(Boolean).join(', ')} />
            <Row label={t('field.zipCountry')} value={[project.postal_code, project.country_code].filter(Boolean).join(' · ')} />
          </Panel>
          <Panel title={t('detail.contractTitle')}>
            <Row label={t('field.contractValue')} value={money(project.contract_value, currency)} />
            <Row label={t('field.materialValue')} value={project.material_included ? money(project.material_value, currency) : t('detail.notIncluded')} />
            <Row label={t('field.retainage')} value={project.has_retainage ? `${project.retainage_percent ?? '—'}% · ${money(project.retainage_value, currency)}` : t('detail.no')} />
            <Row label={t('field.retainagePayment')} value={project.has_retainage ? `${t('detail.days', { count: project.retainage_payment_days ?? '—' })} · ${date(project.probable_retainage_payment_date)}` : '—'} />
          </Panel>
          <Panel title={t('detail.scheduleTitle')}>
            <Row label={t('field.plannedStart')} value={date(project.planned_start_date)} />
            <Row label={t('field.plannedFinish')} value={date(project.planned_finish_date)} />
            <Row label={t('field.term')} value={project.contractual_term_days ? t('detail.days', { count: project.contractual_term_days }) : '—'} />
            <Row label={t('field.status')} value={<Badge tone={TONE[status]}>{t(`status.${status}`)}</Badge>} />
          </Panel>
        </div>

        <Panel title={t('detail.successTitle')} actions={<Link className={`${ui.btnGhost} ${ui.small}`} href={`/projects/${projectId}/edit`}>{t('detail.edit')}</Link>}>
          <p className={styles.pre}>{project.success_criteria || <span className={styles.muted}>{t('detail.successEmpty')}</span>}</p>
        </Panel>

        <Panel body={false}>
          <div className={styles.tabBar}><Segments value={tab} onChange={setTab} items={['notes', 'documents', 'team'].map((key) => ({ value: key, label: t(`tab.${key}`) }))} /></div>
          {tab === 'notes' && <div className={styles.notes}>
            <div className={styles.composer}>
              <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') addNote() }} placeholder={t('notes.placeholder')} rows={3} />
              <button type="button" className={ui.btnPrimary} onClick={addNote} disabled={savingNote || !noteText.trim()}>{savingNote ? t('notes.saving') : t('notes.add')}</button>
            </div>
            {notesLoading ? <Empty title={t('notes.loading')} />
              : notes.length === 0 ? <Empty title={t('notes.empty')} />
                : <ul className={styles.noteList}>{notes.map((n) => <li key={n.id}>
                  <div><div className={styles.noteMeta}><strong>{n.author_name || n.author_email || 'RitsuFlow'}</strong> · {n.created_at ? dateTime.format(new Date(n.created_at)) : '—'}</div><p className={styles.pre}>{n.note}</p></div>
                  <button type="button" className={`${ui.btnGhost} ${ui.small}`} onClick={() => deleteNote(n)} aria-label={t('notes.delete')}>{t('notes.delete')}</button>
                </li>)}</ul>}
          </div>}
          {tab === 'documents' && <div className={styles.legacy}><ProjectDocuments project={project} /></div>}
          {tab === 'team' && <div className={styles.legacy}><ProjectTeam project={project} /></div>}
        </Panel>
      </div>

      <aside className={styles.side}>
        <Panel title={t('image.title')}>
          {imageUrl ? <img src={imageUrl} alt={project.name || ''} className={styles.image} /> : <div className={styles.placeholder}>{t('image.none')}</div>}
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadProjectImage} hidden />
          <button type="button" className={ui.btn} style={{ width: '100%', marginTop: 12 }} onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}>{uploadingImage ? t('image.uploading') : imageUrl ? t('image.change') : t('image.add')}</button>
        </Panel>
        <Panel title={t('map.title')}>
          {hasCoordinates(project)
            ? <iframe title={t('map.title')} src={osmUrl(project)} className={styles.map} loading="lazy" referrerPolicy="no-referrer" />
            : <div className={styles.placeholder}><strong>{project.city || t('map.title')}</strong><span>{t('map.noCoordinates')}</span></div>}
          <a href={googleUrl(project)} target="_blank" rel="noreferrer" className={ui.btnGhost} style={{ marginTop: 8 }}>{t('map.google')}</a>
        </Panel>
      </aside>
    </div>

    <DeleteProjectModal project={project} open={deleteOpen} deleting={deleting} onCancel={() => setDeleteOpen(false)} onConfirm={deleteProject} />
  </AppShell>
}
