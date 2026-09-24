'use client'

import { useEffect, useRef } from 'react'

function parsePolygonPoints(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(',').map(Number)
      return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
    })
    .filter(Boolean)
}

export default function LocationBoundaryBridge() {
  const pendingRef = useRef(null)

  useEffect(() => {
    function handleStart(event) {
      const detail = event?.detail || {}
      if (!detail.locationId) return

      pendingRef.current = {
        ...detail,
        polygonCount: document.querySelectorAll('svg polygon').length,
      }
    }

    function handleDoubleClick() {
      const pending = pendingRef.current
      if (!pending) return

      window.setTimeout(() => {
        const polygons = [...document.querySelectorAll('svg polygon')]
        if (polygons.length <= pending.polygonCount) return

        const polygon = polygons.at(-1)
        const points = parsePolygonPoints(polygon?.getAttribute('points'))
        if (points.length < 3) return

        window.dispatchEvent(new CustomEvent('ritsucad:location-boundary-ready', {
          detail: {
            locationId: pending.locationId,
            name: pending.name,
            projectId: pending.projectId,
            documentId: pending.documentId,
            pageNumber: 1,
            points,
          },
        }))

        pendingRef.current = null
      }, 80)
    }

    window.addEventListener('ritsucad:location-map-start', handleStart)
    document.addEventListener('dblclick', handleDoubleClick)

    return () => {
      window.removeEventListener('ritsucad:location-map-start', handleStart)
      document.removeEventListener('dblclick', handleDoubleClick)
    }
  }, [])

  return null
}
