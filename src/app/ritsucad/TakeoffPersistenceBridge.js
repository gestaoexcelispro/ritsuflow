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

function parseMeasurementLabel(label) {
  const text = String(label?.textContent || '').trim()
  const match = text.match(/^([0-9]+(?:\.[0-9]+)?)\s+(.+)$/)
  if (!match) return null
  const quantity = Number(match[1])
  if (!Number.isFinite(quantity)) return null
  return { quantity, unit: match[2] }
}

function readAreaTakeoffs() {
  return Array.from(document.querySelectorAll('svg g')).map((group) => {
    const polygon = group.querySelector('polygon[stroke="#0f9f91"]')
    const label = group.querySelector('text')
    if (!polygon || !label) return null
    const points = parsePoints(polygon.getAttribute('points'))
    if (points.length < 3) return null
    const measurement = parseMeasurementLabel(label)
    if (!measurement) return null
    return { key: `area:${geometryKey(points)}`, points, ...measurement, measurementType: 'area' }
  }).filter(Boolean)
}

function readPolylineTakeoffs() {
  return Array.from(document.querySelectorAll('svg g')).map((group) => {
    const polyline = group.querySelector('polyline[stroke="#ea580c"]')
    const label = group.querySelector('text')
    if (!polyline || !label) return null
    const points = parsePoints(polyline.getAttribute('points'))
    if (points.length < 2) return null
    const measurement = parseMeasurementLabel(label)
    if (!measurement) return null
    return { key: `polyline:${geometryKey(points)}`, points, ...measurement, measurementType: 'polyline' }
  }).filter(Boolean)
}

function smartGeometry(item, smart) {
  if (!smart) return { points: item.points, source: `ritsucad-${item.measurementType}-takeoff` }
  return {
    points: item.points,
    source: 'ritsucad-smart-takeoff',
    smartTakeoff: {
      typeId: smart.typeId || smart.id || null,
      label: smart.label || null,
      discipline: smart.discipline || null,
      category: smart.category || null,
      measurementTool: smart.measurementTool || item.measurementType,
      quantityBasis: smart.quantityBasis || null,
      primaryUnit: smart.primaryUnit || item.unit,
      secondaryUnit: smart.secondaryUnit || null,
      properties: smart.properties || {},
      semanticVersion: 1,
    },
  }
}

export default function TakeoffPersistenceBridge() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')
  const documentId = searchParams.get('documentId')
  const mappingMode = searchParams.get('mode') === 'location-mapping'
  const [context, setContext] = useState(null)
  const [smartTakeoff, setSmartTakeoff] = useState(null)
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
    function onSmartTakeoff(event) {
      const metadata = event.detail?.metadata || null
      setSmartTakeoff(metadata)
    }
    window.addEventListener('ritsucad:smart-takeoff-selected', onSmartTakeoff)
    setSmartTakeoff(window.__RITSUCAD_ACTIVE_SMART_TAKEOFF__ || null)
    return () => window.removeEventListener('ritsucad:smart-takeoff-selected', onSmartTakeoff)
  }, [])

  useEffect(() => {
    if (!projectId || !documentId || mappingMode) return
    let cancelled = false

    async function reconcile() {
      if (cancelled || busyRef.current) return

      const visible = [
        ...readAreaTakeoffs(),
        ...readPolylineTakeoffs(),
      ]

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
          const isSmartMatch = smartTakeoff && (
            smartTakeoff.measurementTool === item.measurementType ||
            (smartTakeoff.measurementTool === 'polyline' && item.measurementType === 'polyline')
          )
          const semantic = isSmartMatch ? smartTakeoff : null

          const payload = {
            project_id: projectId,
            document_id: documentId,
            page_number: Number(searchParams.get('page') || 1),
            location_id: context.locationId,
            project_service_id: context.projectServiceId,
            measurement_type: semantic?.typeId ? `smart:${semantic.typeId}` : item.measurementType,
            quantity: item.quantity,
            unit: item.unit,
            geometry: smartGeometry(item, semantic),
            source_entity_id: item.key,
            created_by: user.id,
            updated_at: new Date().toISOString(),
          }

          const { error } = await supabase.from('ritsucad_takeoffs').insert(payload)
          if (!error) {
            knownRef.current.add(item.key)
            window.dispatchEvent(new CustomEvent('ritsucad:takeoff-saved', {
              detail: {
                ...payload,
                locationName: context.locationName,
                serviceName: context.serviceName,
                smartTakeoff: semantic,
              },
            }))
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
  }, [projectId, documentId, mappingMode, context, smartTakeoff, searchParams])

  return null
}
