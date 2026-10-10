'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styles from '../daily-reports.module.css'

const BUCKET = 'daily-report-attachments'
const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,application/pdf,.doc,.docx,.xls,.xlsx'
const MAX_BYTES = 500 * 1024 * 1024
const RESIZE_ABOVE = 1.5 * 1024 * 1024
const MAX_SIDE = 2048

function kindOf(mime = '') {
  if (mime.startsWith('image/')) return 'photo'
  if (mime.startsWith('video/')) return 'video'
  if (mime === 'application/pdf' || mime.includes('word') || mime.includes('excel') || mime.includes('spreadsheet')) return 'document'
  return 'other'
}

// Phone photos are often 4–8 MB. Large JPEG/PNG/WebP photos are scaled to 2048 px before upload.
async function shrink(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size <= RESIZE_ABOVE) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.(png|webp|jpe?g)$/i, '') + '.jpg', { type: 'image/jpeg', lastModified: file.lastModified })
  } catch { return file }
}

const extOf = (name) => (name.includes('.') ? name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin')

export default function AttachmentsSection({ report, supabase, t, language, locked }) {
  const [items, setItems] = useState([])
  const [urls, setUrls] = useState({})
  const [locations, setLocations] = useState([])
  const [issues, setIssues] = useState([])
  const [meta, setMeta] = useState({ title: '', location_id: '', issue_id: '' })
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState('')
  const [busyId, setBusyId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const fileInput = useRef(null)
  const cameraInput = useRef(null)
  const projectId = report.projects?.id

  const load = useCallback(async () => {
    const [res, loc, iss] = await Promise.all([
      supabase.from('daily_report_attachments').select('id,attachment_type,file_name,storage_path,mime_type,file_size_bytes,title,location_name,issue_id,captured_at,created_at').eq('daily_report_id', report.id).order('created_at', { ascending: false }),
      projectId ? supabase.from('fieldop_project_locations').select('locations(id,name)').eq('project_id', projectId).eq('is_active', true) : Promise.resolve({ data: [] }),
      supabase.from('daily_report_issues').select('id,title').eq('daily_report_id', report.id).order('created_at'),
    ])
    if (res.error) setError(t('common.error', { message: res.error.message }))
    const list = res.data || []
    setItems(list)
    setLocations((loc.data || []).map((l) => l.locations).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)))
    setIssues(iss.data || [])
    if (list.length) {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(list.map((i) => i.storage_path), 3600)
      setUrls(Object.fromEntries((signed || []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl])))
    }
    setLoading(false)
  }, [report.id, projectId, supabase, t])

  useEffect(() => { load() }, [load])

  async function upload(fileList) {
    const files = [...(fileList || [])]
    if (!files.length || !projectId) return
    setError(''); setMessage('')
    const { data: auth } = await supabase.auth.getUser()
    const location = locations.find((l) => l.id === meta.location_id)
    let done = 0
    const failed = []
    for (const original of files) {
      setProgress(t('attachments.uploading', { current: done + 1, total: files.length }))
      if (original.size > MAX_BYTES) { failed.push(original.name); continue }
      const file = await shrink(original)
      const path = `${projectId}/${report.id}/${crypto.randomUUID()}.${extOf(file.name)}`
      const { error: upError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false })
      if (upError) { failed.push(original.name); continue }
      const { error: rowError } = await supabase.from('daily_report_attachments').insert({
        daily_report_id: report.id,
        attachment_type: kindOf(file.type),
        file_name: original.name,
        storage_bucket: BUCKET,
        storage_path: path,
        mime_type: file.type || null,
        file_size_bytes: file.size,
        title: meta.title.trim() || null,
        captured_at: original.lastModified ? new Date(original.lastModified).toISOString() : null,
        location_id: location?.id || null,
        location_name: location?.name || null,
        issue_id: meta.issue_id || null,
        uploaded_by: auth?.user?.id || null,
      })
      if (rowError) { failed.push(original.name); await supabase.storage.from(BUCKET).remove([path]); continue }
      done += 1
    }
    setProgress('')
    if (fileInput.current) fileInput.current.value = ''
    if (cameraInput.current) cameraInput.current.value = ''
    if (done) { setMessage(t('attachments.uploaded', { count: done })); setMeta((m) => ({ ...m, title: '' })) }
    if (failed.length) setError(t('attachments.failed', { files: failed.join(', ') }))
    await load()
  }

  async function remove(item) {
    if (!window.confirm(t('attachments.confirmDelete'))) return
    setBusyId(item.id); setError(''); setMessage('')
    // The stored file goes first: the storage rule checks the attachment row before allowing it.
    await supabase.storage.from(BUCKET).remove([item.storage_path])
    const { error: delError } = await supabase.from('daily_report_attachments').delete().eq('id', item.id)
    if (delError) setError(t('common.error', { message: delError.message }))
    else { setMessage(t('attachments.deleted')); await load() }
    setBusyId('')
  }

  const dateTime = useMemo(() => new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }), [language])
  const size = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round((b || 0) / 1024))} KB`)
  const issueTitle = useMemo(() => new Map(issues.map((i) => [i.id, i.title])), [issues])
  const photos = items.filter((i) => i.attachment_type === 'photo')
  const others = items.filter((i) => i.attachment_type !== 'photo')
  const showPhotos = filter === 'all' || filter === 'photo'
  const showFiles = filter === 'all' || filter === 'files'
  const field = { display: 'grid', gap: 6 }
  const caption = (i) => [i.location_name && `📍 ${i.location_name}`, i.issue_id && issueTitle.get(i.issue_id) && `⚠ ${issueTitle.get(i.issue_id)}`].filter(Boolean).join(' · ')

  return <section className={styles.panel}>
    <div className={styles.panelHead}><div><h3>{t('tab.attachments')}</h3><p>{t('attachments.text')}</p></div><span className={styles.badge}>{t('attachments.count', { photos: photos.length, files: others.length })}</span></div>

    {!locked && <div style={{ display: 'grid', gap: 12, padding: 18, borderBottom: '1px solid var(--fo-line-soft)', background: 'var(--fo-sunken)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
        <label style={field}><b>{t('attachments.caption')}</b><input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} placeholder={t('attachments.captionPlaceholder')} /></label>
        <label style={field}><b>{t('attachments.location')}</b><select value={meta.location_id} onChange={(e) => setMeta({ ...meta, location_id: e.target.value })}><option value="">{t('list.noLocation')}</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <label style={field}><b>{t('attachments.issue')}</b><select value={meta.issue_id} onChange={(e) => setMeta({ ...meta, issue_id: e.target.value })}><option value="">{t('attachments.noIssue')}</option>{issues.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}</select></label>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => upload(e.target.files)} />
        <input ref={fileInput} type="file" accept={ACCEPT} multiple hidden onChange={(e) => upload(e.target.files)} />
        <button type="button" className={styles.primaryButton} disabled={Boolean(progress)} onClick={() => cameraInput.current?.click()}>📷 {t('attachments.takePhoto')}</button>
        <button type="button" className={styles.secondaryButton} disabled={Boolean(progress)} onClick={() => fileInput.current?.click()}>{t('attachments.chooseFiles')}</button>
        <small style={{ color: 'var(--fo-muted)' }}>{progress || t('attachments.hint')}</small>
      </div>
    </div>}

    {message && <div className={styles.successMessage} style={{ padding: '10px 18px' }}>{message}</div>}
    {error && <div className={styles.error} style={{ margin: 18 }}>{error}</div>}

    <div style={{ display: 'flex', gap: 6, padding: '12px 18px' }}>
      {['all', 'photo', 'files'].map((f) => <button key={f} type="button" onClick={() => setFilter(f)} className={filter === f ? styles.primaryButton : styles.secondaryButton} style={{ minHeight: 30 }}>{t(`attachments.filter.${f}`)}</button>)}
    </div>

    {loading ? <div className={styles.empty}>{t('common.loading')}</div>
      : items.length === 0 ? <div className={styles.empty}>{t('attachments.empty')}</div>
        : <div style={{ display: 'grid', gap: 18, padding: '0 18px 18px' }}>
          {showPhotos && photos.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
            {photos.map((p) => <figure key={p.id} style={{ margin: 0, border: '1px solid var(--fo-line)', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
              <a href={urls[p.storage_path]} target="_blank" rel="noreferrer" style={{ display: 'block', aspectRatio: '4 / 3', background: '#edf2f4' }}>
                {urls[p.storage_path] && <img src={urls[p.storage_path]} alt={p.title || p.file_name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
              </a>
              <figcaption style={{ padding: 10, display: 'grid', gap: 3, fontSize: 13 }}>
                <strong>{p.title || p.file_name}</strong>
                {caption(p) && <span style={{ color: 'var(--fo-muted)' }}>{caption(p)}</span>}
                <span style={{ color: 'var(--fo-faint)' }}>{dateTime.format(new Date(p.captured_at || p.created_at))}</span>
                {!locked && <button type="button" className={styles.secondaryButton} style={{ minHeight: 28, marginTop: 4 }} disabled={busyId === p.id} onClick={() => remove(p)}>{t('list.delete')}</button>}
              </figcaption>
            </figure>)}
          </div>}
          {showFiles && others.length > 0 && <table className={styles.table}><tbody>{others.map((f) => <tr key={f.id}>
            <td style={{ width: 90 }}><span className={styles.badge}>{t(`attachments.kind.${f.attachment_type}`)}</span></td>
            <td><a className={styles.reportLink} href={urls[f.storage_path]} target="_blank" rel="noreferrer">{f.title || f.file_name}</a>{caption(f) && <small style={{ display: 'block', color: 'var(--fo-muted)' }}>{caption(f)}</small>}</td>
            <td style={{ color: 'var(--fo-muted)', whiteSpace: 'nowrap' }}>{size(f.file_size_bytes)} · {dateTime.format(new Date(f.created_at))}</td>
            <td style={{ textAlign: 'right' }}>{!locked && <button type="button" className={styles.secondaryButton} style={{ minHeight: 30 }} disabled={busyId === f.id} onClick={() => remove(f)}>{t('list.delete')}</button>}</td>
          </tr>)}</tbody></table>}
        </div>}
  </section>
}
