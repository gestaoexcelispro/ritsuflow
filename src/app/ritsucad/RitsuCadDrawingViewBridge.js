'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import {
  RITSUCAD_STATE_EVENTS,
  applyRitsuCadDrawingState,
  requestRitsuCadDrawingState,
} from './RitsuCadNativeStateBridge'

function createRequestId() {
  return `view-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function RitsuCadDrawingViewBridge() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')
  const documentId = searchParams.get('documentId')
  const viewId = searchParams.get('viewId')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const currentViewRef = useRef(null)
  const pendingRequestRef = useRef(null)

  useEffect(() => {
    if (!projectId || !documentId) return undefined

    async function persistState(state) {
      let name = currentViewRef.current?.name || ''
      let purpose = currentViewRef.current?.purpose || 'general'

      if (!viewId) {
        name = window.prompt('Drawing view name', 'LBS - Zones')?.trim() || ''
        if (!name) {
          setSaving(false)
          return
        }
        purpose = window.prompt(
          'Purpose (zones, areas, takeoff, markup, general)',
          'zones'
        )?.trim() || 'general'
      }

      try {
        if (viewId) {
          const { data, error } = await supabase
            .from('ritsucad_drawing_views')
            .update({
              name,
              purpose,
              cad_entities: state.cadEntities || [],
              calibrations_by_page: state.calibrationsByPage || {},
              updated_at: new Date().toISOString(),
            })
            .eq('id', viewId)
            .eq('project_id', projectId)
            .eq('document_id', documentId)
            .select('id,name,purpose')
            .single()
          if (error) throw error
          currentViewRef.current = data
          setStatus(`Saved: ${data.name}`)
        } else {
          const { data, error } = await supabase
            .from('ritsucad_drawing_views')
            .insert({
              project_id: projectId,
              document_id: documentId,
              name,
              purpose,
              cad_entities: state.cadEntities || [],
              calibrations_by_page: state.calibrationsByPage || {},
            })
            .select('id,name,purpose')
            .single()
          if (error) throw error
          currentViewRef.current = data
          const params = new URLSearchParams(searchParams.toString())
          params.set('viewId', data.id)
          router.replace(`/ritsucad/project-document?${params.toString()}`, {
            scroll: false,
          })
          setStatus(`Saved: ${data.name}`)
        }
      } catch (error) {
        console.error('RitsuCAD drawing view save failed.', error)
        setStatus(error?.message || 'Drawing view could not be saved.')
      } finally {
        setSaving(false)
      }
    }

    function saveCurrentView() {
      if (saving || pendingRequestRef.current) return
      const requestId = createRequestId()
      pendingRequestRef.current = requestId
      setSaving(true)
      setStatus('Reading drawing state…')
      requestRitsuCadDrawingState(requestId)
    }

    function receiveDrawingState(event) {
      const detail = event.detail || {}
      if (!pendingRequestRef.current || detail.requestId !== pendingRequestRef.current) {
        return
      }
      pendingRequestRef.current = null
      setStatus('Saving drawing view…')
      persistState(detail.state || {})
    }

    function openViews() {
      window.dispatchEvent(new Event('ritsucad:open-drawing-views'))
    }

    function newView() {
      currentViewRef.current = null
      applyRitsuCadDrawingState({
        cadEntities: [],
        calibrationsByPage: {},
      })
      setStatus('New clean view. Save when ready.')
    }

    window.addEventListener('ritsucad:save-drawing-view', saveCurrentView)
    window.addEventListener('ritsucad:open-drawing-views-command', openViews)
    window.addEventListener('ritsucad:new-drawing-view', newView)
    window.addEventListener(RITSUCAD_STATE_EVENTS.response, receiveDrawingState)

    return () => {
      window.removeEventListener('ritsucad:save-drawing-view', saveCurrentView)
      window.removeEventListener('ritsucad:open-drawing-views-command', openViews)
      window.removeEventListener('ritsucad:new-drawing-view', newView)
      window.removeEventListener(RITSUCAD_STATE_EVENTS.response, receiveDrawingState)
    }
  }, [projectId, documentId, viewId, router, searchParams, saving])

  useEffect(() => {
    if (!projectId || !documentId || !viewId) {
      currentViewRef.current = null
      return
    }

    let cancelled = false
    ;(async () => {
      setStatus('Opening drawing view…')
      const { data, error } = await supabase
        .from('ritsucad_drawing_views')
        .select('id,name,purpose,cad_entities,calibrations_by_page')
        .eq('id', viewId)
        .eq('project_id', projectId)
        .eq('document_id', documentId)
        .single()

      if (cancelled) return
      if (error || !data) {
        setStatus(error?.message || 'Drawing view was not found.')
        return
      }

      currentViewRef.current = data
      applyRitsuCadDrawingState({
        cadEntities: Array.isArray(data.cad_entities) ? data.cad_entities : [],
        calibrationsByPage: data.calibrations_by_page || {},
      })
      setStatus(`View: ${data.name}`)
    })()

    return () => {
      cancelled = true
    }
  }, [projectId, documentId, viewId])

  if (!status) return null

  return (
    <div
      style={{
        position: 'fixed',
        right: 12,
        bottom: 30,
        zIndex: 9998,
        padding: '7px 10px',
        border: '1px solid #9ed8d8',
        borderRadius: 6,
        background: 'rgba(239,250,250,.96)',
        color: '#087f7f',
        fontSize: 10,
        fontWeight: 800,
        pointerEvents: 'none',
      }}
    >
      {status}
    </div>
  )
}
