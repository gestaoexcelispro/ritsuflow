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
    if (!rowsRef.current.length) return true

    const group = document.createElementNS(NS, 'g')
    group.setAttribute('id', GROUP_ID)
    group.setAttribute('data-ritsucad-saved-locations', 'true')
    group.style.pointerEvents = 'none'

    rowsRef.current.forEach((row) => {
      const points = pointsFromGeometry(row.geometry).filter(
        (point) =>
          Number.isFinite(Number(point?.x)) &&
          Number.isFinite(Number(point?.y))
      )
      if (points.length < 3) return

      const active = selectedRef.current === row.location_id
      const polygon = document.createElementNS(NS, 'polygon')
      polygon.setAttribute(
        'points',
        points.map((point) => `${point.x},${point.y}`).join(' ')
      )
      polygon.setAttribute(
        'fill',
        active ? 'rgba(14,165,164,.22)' : 'rgba(14,165,164,.10)'
      )
      polygon.setAttribute('stroke', active ? '#067c86' : '#0ea5a4')
      polygon.setAttribute('stroke-width', active ? '4' : '2')
      polygon.setAttribute('vector-effect', 'non-scaling-stroke')
      polygon.setAttribute('stroke-linejoin', 'round')
      polygon.setAttribute('data-location-id', row.location_id || '')
      group.appendChild(polygon)

      const center = centroid(points)
      const label = document.createElementNS(NS, 'text')
      label.setAttribute('x', center.x)
      label.setAttribute('y', center.y)
      label.setAttribute('text-anchor', 'middle')
      label.setAttribute('dominant-baseline', 'middle')
      label.setAttribute('fill', '#075f78')
      label.setAttribute('font-size', active ? '13' : '11')
      label.setAttribute('font-weight', '900')
      label.setAttribute('stroke', '#ffffff')
      label.setAttribute('stroke-width', '3')
      label.setAttribute('paint-order', 'stroke')
      label.setAttribute('vector-effect', 'non-scaling-stroke')
      label.textContent = row.locations?.name || 'Mapped location'
      group.appendChild(label)
    })

    svg.appendChild(group)
    return true
  }, [])

  const load = useCallback(async () => {
    if (!projectId || !documentId) {
      rowsRef.current = []
      render()
      return
    }

    const { data: drawingMaps, error: mapError } = await supabase
      .from('project_drawing_maps')
      .select('id')
      .eq('project_id', projectId)
      .eq('document_id', documentId)

    if (mapError || !drawingMaps?.length) return

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
      if (rowsRef.current.length && !document.getElementById(GROUP_ID)) {
        render()
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })

    const saved = () => load()
    const selectLocation = (event) => {
      selectedRef.current = event?.detail?.locationId || ''
      render()
    }

    window.addEventListener('ritsucad:location-boundary-saved', saved)
    window.addEventListener('ritsucad:location-find', selectLocation)
    window.addEventListener('ritsucad:location-selected', selectLocation)

    return () => {
      observer.disconnect()
      window.removeEventListener('ritsucad:location-boundary-saved', saved)
      window.removeEventListener('ritsucad:location-find', selectLocation)
      window.removeEventListener('ritsucad:location-selected', selectLocation)
      document.getElementById(GROUP_ID)?.remove()
    }
  }, [load, render])

  return null
}
