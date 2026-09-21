'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import RitsuCadPage from '../page'
import { supabase } from '../../../lib/supabase'

function ProjectDocumentLoader() {
  const searchParams = useSearchParams()
  const attemptedRef = useRef(false)
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('Loading project drawing...')

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
      try {
        const { data: documentRecord, error: documentError } = await supabase
          .from('project_documents')
          .select('id, project_id, file_name, storage_path, mime_type')
          .eq('id', documentId)
          .eq('project_id', projectId)
          .single()

        if (documentError || !documentRecord) {
          throw new Error(documentError?.message || 'Project document was not found.')
        }

        const isPdf =
          documentRecord.mime_type === 'application/pdf' ||
          documentRecord.file_name?.toLowerCase().endsWith('.pdf')

        if (!isPdf) {
          throw new Error('Location mapping currently supports PDF project documents only.')
        }

        const { data: signedData, error: signedError } = await supabase.storage
          .from('project-documents')
          .createSignedUrl(documentRecord.storage_path, 120)

        if (signedError || !signedData?.signedUrl) {
          throw new Error(signedError?.message || 'Unable to access the project PDF.')
        }

        const response = await fetch(signedData.signedUrl)
        if (!response.ok) {
          throw new Error(`Unable to download the project PDF (${response.status}).`)
        }

        const blob = await response.blob()
        const file = new File(
          [blob],
          documentRecord.file_name || 'project-drawing.pdf',
          { type: 'application/pdf' }
        )

        // RitsuCAD already has a mature PDF import pipeline. For this first
        // controlled integration step we feed the project document into that
        // same pipeline rather than duplicating PDF loading/rendering logic.
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

          const transfer = new DataTransfer()
          transfer.items.add(file)
          input.files = transfer.files
          input.dispatchEvent(new Event('change', { bubbles: true }))

          setStatus('ready')
          setMessage(documentRecord.file_name || 'Project drawing loaded')
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
