'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const NS = 'http://www.w3.org/2000/svg'
const GROUP_ID = 'ritsucad-saved-location-boundaries'

function pointsFromGeometry(geometry) {
  if (!geometry) return []
  if (Array.isArray(geometry.points)) return geometry.points
  if (Array.isArray(geometry.coordinates?.[0])) {
    return geometry.coordinates[0].map((point) =>
      Array.isArray(point)
        ? { x: Number(point[0]), y: Number(point[1]) }
        : point
    )
  }
  return []
}

function centroid(points) {
  if (!points.length) return { x: 0, y: 0 }
  const sum = points.reduce(
    (total, point) => ({
      x: total.x + Number(point.x || 0),
      y: total.y + Number(point.y || 0),
    }),
    { x: 0, y: 0 }
  )
  return { x: sum.x / points.length, y: sum.y / points.length }
}

function findDrawingSvg() {
  const svgs = [...document.querySelectorAll('svg')]
  return (
    svgs.find((svg) => {
      const viewBox = svg.getAttribute('viewBox')
      const rect = svg.getBoundingClientRect()
      return viewBox && rect.width > 300 && rect.height > 250
    }) || null
  )
}

export default function SavedLocationGeometryBridge() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')
  const documentId = searchParams.get('documentId')
  const rowsRef = useRef([])
  const selectedRef = useRef('')

  const render = useCallback(() => {
    const svg = findDrawingSvg()
    if (!svg) return false

    svg.querySelector(`#${GROUP_ID}`)?.remove()

    const selectedLocationId = selectedRef.current
    if (!selectedLocationId || !rowsRef.current.length) return true

    const selectedRow = rowsRef.current.find(
      (row) => String(row.location_id) === String(selectedLocationId)
    )
    if (!selectedRow) return true

    const points = pointsFromGeometry(selectedRow.geometry).filter(
      (point) =>
        Number.isFinite(Number(point?.x)) &&
        Number.isFinite(Number(point?.y))
    )
    if (points.length < 3) return true

    const group = document.createElementNS(NS, 'g')
    group.setAttribute('id', GROUP_ID)
    group.setAttribute('data-ritsucad-saved-locations', 'true')
    group.setAttribute('data-location-id', selectedRow.location_id || '')
    group.style.pointerEvents = 'none'

    const polygon = document.createElementNS(NS, 'polygon')
    polygon.setAttribute(
      'points',
      points.map((point) => `${point.x},${point.y}`).join(' ')
    )
    polygon.setAttribute('fill', 'rgba(14,165,164,.22)')
    polygon.setAttribute('stroke', '#067c86')
    polygon.setAttribute('stroke-width', '4')
    polygon.setAttribute('vector-effect', 'non-scaling-stroke')
    polygon.setAttribute('stroke-linejoin', 'round')
    polygon.setAttribute('data-location-id', selectedRow.location_id || '')
    group.appendChild(polygon)

    const center = centroid(points)
    const label = document.createElementNS(NS, 'text')
    label.setAttribute('x', center.x)
    label.setAttribute('y', center.y)
    label.setAttribute('text-anchor', 'middle')
    label.setAttribute('dominant-baseline', 'middle')
    label.setAttribute('fill', '#075f78')
    label.setAttribute('font-size', '13')
    label.setAttribute('font-weight', '900')
    label.setAttribute('stroke', '#ffffff')
    label.setAttribute('stroke-width', '3')
    label.setAttribute('paint-order', 'stroke')
    label.setAttribute('vector-effect', 'non-scaling-stroke')
    label.textContent = selectedRow.locations?.name || 'Mapped location'
    group.appendChild(label)

    svg.appendChild(group)
    return true
  }, [])

  const load = useCallback(async () => {
    if (!projectId || !documentId) {
      rowsRef.current = []
      selectedRef.current = ''
      render()
      return
    }

    const { data: drawingMaps, error: mapError } = await supabase
      .from('project_drawing_maps')
      .select('id')
      .eq('project_id', projectId)
      .eq('document_id', documentId)

    if (mapError || !drawingMaps?.length) {
      rowsRef.current = []
      render()
      return
    }

    const ids = drawingMaps.map((item) => item.id)
    const { data, error } = await supabase
      .from('project_drawing_location_geometries')
      .select('id,location_id,page_number,geometry,locations(name)')
      .in('drawing_map_id', ids)

    if (error) return
    rowsRef.current = data || []

    let attempts = 0
    const tryRender = () => {
      attempts += 1
      if (!render() && attempts < 30) window.setTimeout(tryRender, 250)
    }
    tryRender()
  }, [projectId, documentId, render])

  useEffect(() => {
    load()

    const observer = new MutationObserver(() => {
      if (selectedRef.current && !document.getElementById(GROUP_ID)) {
        render()
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })

    const saved = () => load()
    const selectLocation = (event) => {
      selectedRef.current = event?.detail?.locationId || ''
      render()
    }
    const clearSelection = () => {
      selectedRef.current = ''
      render()
    }

    window.addEventListener('ritsucad:location-boundary-saved', saved)
    window.addEventListener('ritsucad:location-find', selectLocation)
    window.addEventListener('ritsucad:location-selected', selectLocation)
    window.addEventListener('ritsucad:location-clear-selection', clearSelection)

    return () => {
      observer.disconnect()
      window.removeEventListener('ritsucad:location-boundary-saved', saved)
      window.removeEventListener('ritsucad:location-find', selectLocation)
      window.removeEventListener('ritsucad:location-selected', selectLocation)
      window.removeEventListener('ritsucad:location-clear-selection', clearSelection)
      document.getElementById(GROUP_ID)?.remove()
    }
  }, [load, render])

  return null
}
