'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import RitsuCadPage from '../page'
import { supabase } from '../../../lib/supabase'

function ProjectDocumentLoader() {
  const searchParams = useSearchParams()
  const attemptedRef = useRef(false)
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('Preparing project drawing...')
  const [timings, setTimings] = useState(null)

  useEffect(() => {
    if (attemptedRef.current) return
    attemptedRef.current = true

    const projectId = searchParams.get('projectId')
    const documentId = searchParams.get('documentId')

    if (!projectId || !documentId) {
      setStatus('error')
      setMessage('Project or document context is missing.')
      return
    }

    let cancelled = false

    async function loadProjectDocument() {
      const startedAt = performance.now()
      const marks = {}
      const elapsed = () => Math.round(performance.now() - startedAt)
      const mark = (name) => {
        marks[name] = elapsed()
        console.info(`[RitsuCAD PDF] ${name}: ${marks[name]} ms`)
      }

      try {
        setMessage('Reading project drawing record...')
        const { data: documentRecord, error: documentError } = await supabase
          .from('project_documents')
          .select('id, project_id, file_name, storage_path, mime_type')
          .eq('id', documentId)
          .eq('project_id', projectId)
          .single()
        mark('documentRecordReady')

        if (documentError || !documentRecord) {
          throw new Error(documentError?.message || 'Project document was not found.')
        }

        const isPdf =
          documentRecord.mime_type === 'application/pdf' ||
          documentRecord.file_name?.toLowerCase().endsWith('.pdf')

        if (!isPdf) {
          throw new Error('RitsuCAD currently supports PDF project documents only.')
        }

        setMessage('Securing project PDF...')
        const { data: signedData, error: signedError } = await supabase.storage
          .from('project-documents')
          .createSignedUrl(documentRecord.storage_path, 120)
        mark('signedUrlReady')

        if (signedError || !signedData?.signedUrl) {
          throw new Error(signedError?.message || 'Unable to access the project PDF.')
        }

        setMessage('Downloading project PDF...')
        const downloadStartedAt = performance.now()
        const response = await fetch(signedData.signedUrl)
        if (!response.ok) {
          throw new Error(`Unable to download the project PDF (${response.status}).`)
        }

        const blob = await response.blob()
        marks.downloadDuration = Math.round(performance.now() - downloadStartedAt)
        marks.fileSizeBytes = blob.size
        mark('pdfDownloaded')

        const file = new File(
          [blob],
          documentRecord.file_name || 'project-drawing.pdf',
          { type: 'application/pdf' }
        )
        mark('filePrepared')

        setMessage('Starting RitsuCAD PDF engine...')
        const importerWaitStartedAt = performance.now()
        let attempts = 0

        const attachToExistingImporter = () => {
          if (cancelled) return

          const input = document.querySelector('input[type="file"]')
          if (!input) {
            attempts += 1
            if (attempts < 80) {
              window.setTimeout(attachToExistingImporter, 50)
              return
            }
            setStatus('error')
            setMessage('RitsuCAD PDF importer could not be initialized.')
            return
          }

          marks.importerWaitDuration = Math.round(performance.now() - importerWaitStartedAt)
          mark('importerReady')

          const transfer = new DataTransfer()
          transfer.items.add(file)
          input.files = transfer.files

          setMessage('Rendering and indexing PDF...')
          input.dispatchEvent(new Event('change', { bubbles: true }))
          mark('importDispatched')

          const result = {
            ...marks,
            fileName: documentRecord.file_name,
            fileSizeMB: Number((blob.size / 1024 / 1024).toFixed(2)),
          }
          setTimings(result)
          window.__RITSUCAD_PROJECT_PDF_TIMINGS__ = result
          window.dispatchEvent(new CustomEvent('ritsucad:project-pdf-timings', { detail: result }))

          // The existing importer owns PDF parsing/rendering after this point.
          // Keep the progress indicator briefly so users do not see the old
          // empty-state card immediately after selecting a project drawing.
          window.setTimeout(() => {
            if (cancelled) return
            setStatus('ready')
            setMessage(documentRecord.file_name || 'Project drawing loaded')
          }, 1200)
        }

        attachToExistingImporter()
      } catch (error) {
        if (cancelled) return
        console.error('Project document loading failed.', error)
        setStatus('error')
        setMessage(error?.message || 'The project drawing could not be loaded.')
      }
    }

    loadProjectDocument()

    return () => {
      cancelled = true
    }
  }, [searchParams])

  return (
    <>
      <RitsuCadPage />
      {status !== 'ready' && (
        <div
          role={status === 'error' ? 'alert' : 'status'}
          style={{
            position: 'fixed',
            left: '50%',
            top: 18,
            transform: 'translateX(-50%)',
            zIndex: 9999,
            minWidth: 220,
            textAlign: 'center',
            padding: '9px 14px',
            borderRadius: 8,
            border: status === 'error' ? '1px solid #efb0b0' : '1px solid #9ed8d8',
            background: status === 'error' ? '#fff3f3' : '#effafa',
            color: status === 'error' ? '#a61b1b' : '#087f7f',
            fontSize: 12,
            fontWeight: 800,
            boxShadow: '0 8px 24px rgba(0,0,0,.12)',
          }}
        >
          {message}
        </div>
      )}
      {process.env.NODE_ENV !== 'production' && timings && (
        <pre style={{ position: 'fixed', left: 8, bottom: 28, zIndex: 9999, maxWidth: 420, padding: 8, margin: 0, background: 'rgba(5,45,65,.92)', color: '#fff', borderRadius: 6, fontSize: 10, pointerEvents: 'none' }}>
          {JSON.stringify(timings, null, 2)}
        </pre>
      )}
    </>
  )
}

export default function ProjectDocumentRitsuCadPage() {
  return (
    <Suspense fallback={null}>
      <ProjectDocumentLoader />
    </Suspense>
  )
}
