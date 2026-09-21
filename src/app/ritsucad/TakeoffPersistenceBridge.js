'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'

function parsePoints(value) {
  return String(value || '').trim().split(/\s+/).map((pair) => {
    const [x, y] = pair.split(',').map(Number)
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
  }).filter(Boolean)
}

function geometryKey(points) {
  return points.map((point) => `${point.x.toFixed(4)},${point.y.toFixed(4)}`).join('|')
}

function readAreaTakeoffs() {
  return Array.from(document.querySelectorAll('svg g')).map((group) => {
    const polygon = group.querySelector('polygon[stroke="#0f9f91"]')
    const label = group.querySelector('text')
    if (!polygon || !label) return null
    const points = parsePoints(polygon.getAttribute('points'))
    if (points.length < 3) return null
    const text = String(label.textContent || '').trim()
    const match = text.match(/^([0-9]+(?:\.[0-9]+)?)\s+(.+)$/)
    if (!match) return null
    const quantity = Number(match[1])
    if (!Number.isFinite(quantity)) return null
    return { key: `area:${geometryKey(points)}`, points, quantity, unit: match[2] }
  }).filter(Boolean)
}

export default function TakeoffPersistenceBridge() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')
  const documentId = searchParams.get('documentId')
  const mappingMode = searchParams.get('mode') === 'location-mapping'
  const [context, setContext] = useState(null)
  const knownRef = useRef(new Set())
  const initializedRef = useRef(false)
  const busyRef = useRef(false)

  useEffect(() => {
    function onContext(event) { setContext(event.detail || null) }
    window.addEventListener('ritsucad:takeoff-context', onContext)
    setContext(window.__RITSUCAD_TAKEOFF_CONTEXT__ || null)
    return () => window.removeEventListener('ritsucad:takeoff-context', onContext)
  }, [])

  useEffect(() => {
    if (!projectId || !documentId || mappingMode) return
    let cancelled = false

    async function reconcile() {
      if (cancelled || busyRef.current) return
      const visible = readAreaTakeoffs()
      const visibleKeys = new Set(visible.map((item) => item.key))

      if (!initializedRef.current) {
        const { data } = await supabase
          .from('ritsucad_takeoffs')
          .select('source_entity_id')
          .eq('project_id', projectId)
          .eq('document_id', documentId)
        if (cancelled) return
        knownRef.current = new Set((data || []).map((row) => row.source_entity_id).filter(Boolean))
        initializedRef.current = true
      }

      if (!context?.ready || !context.locationId || !context.projectServiceId) return
      const fresh = visible.filter((item) => !knownRef.current.has(item.key))
      if (!fresh.length) return

      busyRef.current = true
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return
        for (const item of fresh) {
          const payload = {
            project_id: projectId,
            document_id: documentId,
            page_number: 1,
            location_id: context.locationId,
            project_service_id: context.projectServiceId,
            measurement_type: 'area',
            quantity: item.quantity,
            unit: item.unit,
            geometry: { points: item.points, source: 'ritsucad-area-takeoff' },
            source_entity_id: item.key,
            created_by: user.id,
            updated_at: new Date().toISOString(),
          }
          const { error } = await supabase.from('ritsucad_takeoffs').insert(payload)
          if (!error) {
            knownRef.current.add(item.key)
            window.dispatchEvent(new CustomEvent('ritsucad:takeoff-saved', { detail: { ...payload, locationName: context.locationName, serviceName: context.serviceName } }))
          } else {
            console.error('RitsuCAD takeoff persistence failed.', error)
          }
        }
      } finally {
        busyRef.current = false
      }
    }

    const observer = new MutationObserver(() => { window.setTimeout(reconcile, 0) })
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
    reconcile()
    return () => { cancelled = true; observer.disconnect() }
  }, [projectId, documentId, mappingMode, context])

  return null
}
