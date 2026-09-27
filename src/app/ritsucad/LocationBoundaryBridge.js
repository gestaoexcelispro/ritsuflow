'use client'

import { useEffect, useRef } from 'react'

function getNativeDrawingState() {
  const getter = window.__RITSUCAD_GET_DRAWING_STATE__

  if (typeof getter !== 'function') {
    return null
  }

  try {
    return getter() || null
  } catch (error) {
    console.error('Location mapping could not read RitsuCAD drawing state.', error)
    return null
  }
}

function nativePolygons(state) {
  return Array.isArray(state?.cadEntities)
    ? state.cadEntities.filter(
        (entity) =>
          entity?.type === 'cad-polygon' &&
          Array.isArray(entity.points) &&
          entity.points.length >= 3
      )
    : []
}

export default function LocationBoundaryBridge() {
  const pendingRef = useRef(null)

  useEffect(() => {
    function handleStart(event) {
      const detail = event?.detail || {}
      if (!detail.locationId) return

      const state = getNativeDrawingState()
      const polygons = nativePolygons(state)

      pendingRef.current = {
        ...detail,
        existingPolygonIds: new Set(polygons.map((entity) => entity.id)),
      }
    }

    function publishCompletedPolygon() {
      const pending = pendingRef.current
      if (!pending) return false

      const state = getNativeDrawingState()
      const polygons = nativePolygons(state)

      const completed = [...polygons]
        .reverse()
        .find((entity) => !pending.existingPolygonIds.has(entity.id))

      if (!completed) return false

      window.dispatchEvent(
        new CustomEvent('ritsucad:location-boundary-ready', {
          detail: {
            locationId: pending.locationId,
            name: pending.name,
            projectId: pending.projectId,
            documentId: pending.documentId,
            pageNumber: completed.pageNumber || 1,
            entityId: completed.id,
            points: completed.points.map((point) => ({
              x: Number(point.x),
              y: Number(point.y),
            })),
          },
        })
      )

      pendingRef.current = null
      return true
    }

    function handleDoubleClick() {
      if (!pendingRef.current) return

      // RitsuCAD commits the native cad-polygon during the same double-click
      // lifecycle. Read native state on the next frame instead of inspecting
      // rendered SVG/DOM geometry.
      window.requestAnimationFrame(() => {
        if (publishCompletedPolygon()) return

        // React may finish the state commit one frame later on a busy drawing.
        window.requestAnimationFrame(() => {
          publishCompletedPolygon()
        })
      })
    }

    function handleKeyDown(event) {
      if (!pendingRef.current || event.key !== 'Enter') return

      window.requestAnimationFrame(() => {
        if (publishCompletedPolygon()) return
        window.requestAnimationFrame(() => publishCompletedPolygon())
      })
    }

    window.addEventListener('ritsucad:location-map-start', handleStart)
    document.addEventListener('dblclick', handleDoubleClick)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('ritsucad:location-map-start', handleStart)
      document.removeEventListener('dblclick', handleDoubleClick)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return null
}
