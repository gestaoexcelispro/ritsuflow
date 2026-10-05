'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { useT } from '../../../lib/i18n/useT'
import { useLanguage } from '../../../lib/i18n/LanguageProvider'
import { Badge, Empty, Notice, ui } from '../../fieldop/ui'

const formatSize = bytes => {
  const n = Number(bytes || 0)
  if (!n) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

const guessType = file => {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf') return 'PDF'
  if (['doc', 'docx'].includes(ext)) return 'Word'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'Spreadsheet'
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'Image'
  if (['dwg', 'dxf'].includes(ext)) return 'Drawing'
  return ext ? ext.toUpperCase() : 'Document'
}

const isPdfDocument = doc =>
  doc?.mime_type === 'application/pdf' ||
  doc?.document_type === 'PDF' ||
  doc?.file_name?.toLowerCase().endsWith('.pdf')

export default function ProjectDocuments({ project }) {
  const router = useRouter()
  const t = useT('projects')
  const { language } = useLanguage()
  const formatDate = (value) => (value ? new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—')
  const inputRef = useRef(null)
  const [documents, setDocuments] = useState([])
  const [mappingByDocument, setMappingByDocument] = useState({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!project?.id) return
    let active = true
    ;(async () => {
      setLoading(true)
      setError('')

      const [{ data: documentData, error: documentError }, { data: mappingData, error: mappingError }] = await Promise.all([
        supabase
          .from('project_documents')
          .select('*')
          .eq('project_id', project.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('project_drawing_maps')
          .select('id,document_id,page_number,drawing_type,root_location_id,updated_at')
          .eq('project_id', project.id),
      ])

      if (!active) return

      if (documentError) {
        setError(documentError.message)
      } else {
        setDocuments(documentData || [])
      }

      if (!mappingError) {
        const index = {}
        ;(mappingData || []).forEach(item => {
          if (!index[item.document_id]) index[item.document_id] = []
          index[item.document_id].push(item)
        })
        setMappingByDocument(index)
      }

      setLoading(false)
    })()

    return () => { active = false }
  }, [project?.id])

  async function uploadDocument(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !project?.id || uploading) return
    if (file.size > 50 * 1024 * 1024) {
      setError(t('docs.errSize'))
      return
    }

    setUploading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError(t('docs.errSignedOut'))
      setUploading(false)
      return
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name,display_name,email')
      .eq('user_id', user.id)
      .maybeSingle()

    const uploaderName = profile?.full_name || profile?.display_name || profile?.email || user.email || 'RitsuFlow User'
    const uploaderEmail = profile?.email || user.email || null
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${project.id}/${Date.now()}-${safeName}`

    const { error: storageError } = await supabase.storage
      .from('project-documents')
      .upload(path, file, { contentType: file.type || undefined, upsert: false })

    if (storageError) {
      setError(t('docs.errUpload', { message: storageError.message }))
      setUploading(false)
      return
    }

    const { data, error: dbError } = await supabase
      .from('project_documents')
      .insert({
        project_id: project.id,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type || null,
        file_size: file.size,
        document_type: guessType(file),
        uploaded_by: user.id,
        uploader_name: uploaderName,
        uploader_email: uploaderEmail,
      })
      .select('*')
      .single()

    if (dbError) {
      await supabase.storage.from('project-documents').remove([path])
      setError(t('docs.errRegister', { message: dbError.message }))
    } else {
      setDocuments(current => [data, ...current])
    }
    setUploading(false)
  }

  async function openDocument(doc) {
    setError('')
    const { data, error: e } = await supabase.storage
      .from('project-documents')
      .createSignedUrl(doc.storage_path, 60)
    if (e || !data?.signedUrl) {
      setError(t('docs.errOpen', { message: e?.message || '—' }))
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  function mapLocations(doc) {
    if (!project?.id || !doc?.id) return
    router.push(`/ritsuscope/${project.id}`)
  }

  async function deleteDocument(doc) {
    if (!window.confirm(t('docs.confirmDelete', { name: doc.file_name }))) return
    setError('')
    const { error: storageError } = await supabase.storage
      .from('project-documents')
      .remove([doc.storage_path])
    if (storageError) {
      setError(t('docs.errDelete', { message: storageError.message }))
      return
    }
    const { error: dbError } = await supabase.from('project_documents').delete().eq('id', doc.id)
    if (dbError) {
      setError(t('docs.errDeleteRegister', { message: dbError.message }))
      return
    }
    setDocuments(current => current.filter(item => item.id !== doc.id))
  }

  const typeLabel = (doc) => { const key = `docs.type.${String(doc.document_type || 'Document').toLowerCase()}`; const text = t(key); return text === key ? doc.document_type : text }

  return <div style={{ display: 'grid', gap: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
      <p style={{ margin: 0, color: 'var(--fo-muted)', fontSize: 14, maxWidth: '64ch' }}>{t('docs.text')}</p>
      <input ref={inputRef} type="file" onChange={uploadDocument} hidden />
      <button type="button" className={ui.btnPrimary} onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? t('docs.uploading') : t('docs.upload')}</button>
    </div>
    <Notice>{error}</Notice>
    {loading ? <Empty title={t('docs.loading')} />
      : documents.length === 0 ? <Empty title={t('docs.empty')} />
        : <div className={ui.tableWrap}><table className={`${ui.table} ${ui.cards}`}>
          <thead><tr><th>{t('docs.colDocument')}</th><th>{t('docs.colType')}</th><th>{t('docs.colMapping')}</th><th>{t('docs.colUploadedBy')}</th><th>{t('docs.colUploaded')}</th><th /></tr></thead>
          <tbody>{documents.map((doc) => {
            const maps = mappingByDocument[doc.id] || []
            const pdf = isPdfDocument(doc)
            return <tr key={doc.id}>
              <td data-label=""><span><strong title={doc.file_name} style={{ wordBreak: 'break-word' }}>{doc.file_name}</strong><span className={ui.sub}>{formatSize(doc.file_size)}</span></span></td>
              <td data-label={t('docs.colType')}>{typeLabel(doc)}</td>
              <td data-label={t('docs.colMapping')}>{pdf ? <Badge tone={maps.length ? 'ok' : undefined}>{maps.length ? t('docs.mapped', { count: maps.length }) : t('docs.notMapped')}</Badge> : '—'}</td>
              <td data-label={t('docs.colUploadedBy')} title={doc.uploader_email || ''}>{doc.uploader_name || doc.uploader_email || 'RitsuFlow'}</td>
              <td data-label={t('docs.colUploaded')}>{formatDate(doc.created_at)}</td>
              <td data-label="" style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                <button type="button" className={`${ui.btn} ${ui.small}`} onClick={() => openDocument(doc)}>{t('docs.open')}</button>{' '}
                {pdf && <><button type="button" className={`${ui.btn} ${ui.small}`} onClick={() => mapLocations(doc)}>{maps.length ? t('docs.editMapping') : t('docs.mapLocations')}</button>{' '}</>}
                <button type="button" className={`${ui.btnDanger} ${ui.small}`} onClick={() => deleteDocument(doc)}>{t('docs.delete')}</button>
              </td>
            </tr>
          })}</tbody>
        </table></div>}
  </div>
}

