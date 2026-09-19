'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'

const formatSize = bytes => {
  const n = Number(bytes || 0)
  if (!n) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

const formatDate = value => value
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : '—'

const guessType = file => {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf') return 'PDF'
  if (['doc', 'docx'].includes(ext)) return 'Word'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'Spreadsheet'
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'Image'
  if (['dwg', 'dxf'].includes(ext)) return 'Drawing'
  return ext ? ext.toUpperCase() : 'Document'
}

export default function ProjectDocuments({ project }) {
  const inputRef = useRef(null)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!project?.id) return
    let active = true
    ;(async () => {
      setLoading(true)
      const { data, error: e } = await supabase
        .from('project_documents')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })
      if (!active) return
      if (e) setError(e.message)
      else setDocuments(data || [])
      setLoading(false)
    })()
    return () => { active = false }
  }, [project?.id])

  async function uploadDocument(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !project?.id || uploading) return
    if (file.size > 50 * 1024 * 1024) {
      setError('Document must be 50 MB or smaller.')
      return
    }

    setUploading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('You must be signed in to upload a document.')
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
      setError(`Unable to upload document: ${storageError.message}`)
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
      setError(`File uploaded, but the document register could not be saved: ${dbError.message}`)
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
      setError(`Unable to open document: ${e?.message || 'Signed URL could not be created.'}`)
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function deleteDocument(doc) {
    if (!window.confirm(`Delete “${doc.file_name}”?\n\nThis action cannot be undone.`)) return
    setError('')
    const { error: storageError } = await supabase.storage
      .from('project-documents')
      .remove([doc.storage_path])
    if (storageError) {
      setError(`Unable to delete file: ${storageError.message}`)
      return
    }
    const { error: dbError } = await supabase.from('project_documents').delete().eq('id', doc.id)
    if (dbError) {
      setError(`File was removed, but the register could not be deleted: ${dbError.message}`)
      return
    }
    setDocuments(current => current.filter(item => item.id !== doc.id))
  }

  return (
    <div style={wrap}>
      <div style={toolbar}>
        <div>
          <strong style={title}>Project Documents</strong>
          <div style={subtitle}>Files stored against this shared project record.</div>
        </div>
        <input ref={inputRef} type="file" onChange={uploadDocument} style={{ display: 'none' }} />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} style={{ ...uploadButton, ...(uploading ? disabled : {}) }}>
          {uploading ? 'Uploading...' : '＋ Upload Document'}
        </button>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={tableWrap}>
        <div style={{ ...grid, ...head }}>
          <span>Document</span><span>Type</span><span>Size</span><span>Uploaded by</span><span>Uploaded</span><span>Actions</span>
        </div>
        <div style={rows}>
          {loading ? <div style={empty}>Loading documents...</div> : documents.length ? documents.map(doc => (
            <div key={doc.id} style={{ ...grid, ...row }}>
              <div style={fileCell}><span style={fileIcon}>▤</span><span title={doc.file_name} style={fileName}>{doc.file_name}</span></div>
              <span>{doc.document_type || 'Document'}</span>
              <span>{formatSize(doc.file_size)}</span>
              <span title={doc.uploader_email || ''}>{doc.uploader_name || doc.uploader_email || 'RitsuFlow User'}</span>
              <span>{formatDate(doc.created_at)}</span>
              <div style={actions}>
                <button type="button" onClick={() => openDocument(doc)} style={openButton}>Open</button>
                <button type="button" onClick={() => deleteDocument(doc)} style={deleteButton}>Delete</button>
              </div>
            </div>
          )) : <div style={empty}>No documents uploaded yet. Add the first project document.</div>}
        </div>
      </div>
    </div>
  )
}

const wrap={display:'flex',flexDirection:'column',minHeight:0,flex:1,paddingTop:8},toolbar={display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flex:'0 0 auto'},title={fontSize:13,color:'#163f52'},subtitle={fontSize:10.5,color:'#718691',marginTop:2},uploadButton={border:0,borderRadius:7,background:'#069b9b',color:'#fff',padding:'9px 14px',fontWeight:800,fontSize:11.5,cursor:'pointer'},disabled={opacity:.55,cursor:'not-allowed'},errorBox={marginTop:7,padding:'7px 9px',border:'1px solid #efb0b0',background:'#fff3f3',color:'#a61b1b',borderRadius:7,fontSize:11,fontWeight:700},tableWrap={marginTop:8,border:'1px solid #dbe6eb',borderRadius:7,overflow:'hidden',display:'flex',flexDirection:'column',minHeight:0,flex:1},grid={display:'grid',gridTemplateColumns:'minmax(220px,2.2fr) .7fr .65fr 1.15fr 1fr .8fr',gap:10,alignItems:'center',padding:'0 10px'},head={minHeight:31,background:'#f3f7f9',borderBottom:'1px solid #dbe6eb',fontSize:10,color:'#6c8491',fontWeight:800,textTransform:'uppercase'},rows={overflowY:'auto',minHeight:0},row={minHeight:38,borderBottom:'1px solid #edf2f4',fontSize:10.5,color:'#365766'},fileCell={display:'flex',alignItems:'center',gap:7,minWidth:0},fileIcon={color:'#079a9a',fontSize:15},fileName={fontWeight:800,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'},actions={display:'flex',gap:5},openButton={border:'1px solid #bcd9ee',background:'#f3f9ff',color:'#1971c7',borderRadius:5,padding:'4px 8px',fontWeight:800,fontSize:10,cursor:'pointer'},deleteButton={border:'1px solid #efc2c2',background:'#fff7f7',color:'#c92a2a',borderRadius:5,padding:'4px 8px',fontWeight:800,fontSize:10,cursor:'pointer'},empty={padding:'22px 12px',color:'#718691',fontSize:11.5,textAlign:'center'}