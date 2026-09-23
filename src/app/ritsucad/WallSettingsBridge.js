'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import WallSettingsModal from './WallSettingsModal'
import { createSmartTakeoffMetadata, getSmartTakeoffGroups } from './smartTakeoff'

function parsePoints(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(',').map(Number)
      return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
    })
    .filter(Boolean)
}

function geometryKey(points) {
  return points.map((point) => `${point.x.toFixed(4)},${point.y.toFixed(4)}`).join('|')
}

function createEntityId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `ritsucad-wall-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

// Wall thickness is a construction property, not an SVG pixel property.
// Until the semantic Wall renderer consumes the page calibration directly,
// use a bounded display width only for on-screen legibility. The persisted
// source of truth remains wallThicknessMm.
function wallDisplayThicknessPx(wall) {
  const millimeters = Number(wall?.wallThicknessMm ?? wall?.thicknessMm)
  if (Number.isFinite(millimeters) && millimeters > 0) {
    return Math.max(2, Math.min(24, millimeters / 10))
  }

  // Backward compatibility for Walls created before physical thickness.
  const legacyPx = Number(wall?.lineThickness)
  return Math.max(1, Number.isFinite(legacyPx) && legacyPx > 0 ? legacyPx : 2)
}

export default function WallSettingsBridge() {
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [lastWall, setLastWall] = useState(null)
  const baselineRef = useRef(new Set())
  const activeWallRef = useRef(null)
  const completedRef = useRef(new Set())
  const semanticWallsRef = useRef(new Map())

  const projectId = searchParams.get('projectId')
  const documentId = searchParams.get('documentId')
  const hasProjectDrawing = Boolean(projectId && documentId)

  const wallItem = useMemo(() => {
    return getSmartTakeoffGroups()
      .flatMap((group) => group.items || [])
      .find((item) => item.id === 'wall') || null
  }, [])

  const storageKey = useMemo(() => {
    if (!projectId || !documentId) return null
    return `ritsucad:semantic-walls:${projectId}:${documentId}`
  }, [projectId, documentId])

  useEffect(() => {
    if (!hasProjectDrawing) return undefined

    const interceptWall = (event) => {
      const button = event.target?.closest?.('[data-ritsucad-smart-takeoff="true"] .ritsucadSmartMenu button')
      if (!button) return

      const label = button.querySelector('strong')?.textContent?.trim().toLowerCase()
      if (label !== 'wall') return

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation?.()
      setOpen(true)
    }

    document.addEventListener('click', interceptWall, true)
    return () => document.removeEventListener('click', interceptWall, true)
  }, [hasProjectDrawing])

  useEffect(() => {
    if (!hasProjectDrawing) return undefined

    const suppressWallDoubleClickVertex = (event) => {
      if (!activeWallRef.current) return
      if (event.button !== 0) return
      if (event.detail < 2) return

      event.stopPropagation()
      event.stopImmediatePropagation?.()
    }

    document.addEventListener('pointerdown', suppressWallDoubleClickVertex, true)
    return () => document.removeEventListener('pointerdown', suppressWallDoubleClickVertex, true)
  }, [hasProjectDrawing])

  useEffect(() => {
    if (!storageKey) return

    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey) || '[]')
      const walls = Array.isArray(stored) ? stored : []

      semanticWallsRef.current = new Map(
        walls.filter((entity) => entity?.geometryKey).map((entity) => [entity.geometryKey, entity])
      )

      completedRef.current = new Set(semanticWallsRef.current.keys())
      window.__RITSUCAD_SEMANTIC_ENTITIES__ = walls
    } catch (error) {
      console.error('RitsuCAD stored wall metadata could not be restored.', error)
    }
  }, [storageKey])

  useEffect(() => {
    if (!hasProjectDrawing) return undefined

    let frame = 0
    let applying = false

    const styleSemanticWall = (polyline, entity) => {
      if (!polyline || !entity) return

      const color = entity.lineColor || entity.wall?.lineColor || '#0F766E'
      const thickness = wallDisplayThicknessPx(entity.wall || entity)

      if (polyline.getAttribute('stroke') !== color) polyline.setAttribute('stroke', color)
      if (polyline.getAttribute('stroke-width') !== String(thickness)) {
        polyline.setAttribute('stroke-width', String(thickness))
      }
      if (polyline.hasAttribute('stroke-dasharray')) polyline.removeAttribute('stroke-dasharray')

      polyline.dataset.ritsucadSemanticEntity = 'wall'
      polyline.dataset.ritsucadSemanticEntityId = entity.id || ''
      polyline.dataset.ritsucadSmartTakeoff = 'true'
      polyline.dataset.ritsucadSmartType = 'wall'
      polyline.dataset.ritsucadLayer = entity.layer || ''
      polyline.dataset.ritsucadName = entity.name || ''
      polyline.dataset.ritsucadHeight = entity.height == null ? '' : String(entity.height)
      polyline.dataset.ritsucadWallThicknessMm =
        entity.wallThicknessMm == null ? '' : String(entity.wallThicknessMm)
    }

    const persistSemanticWall = (polyline, settings, metadata) => {
      const points = parsePoints(polyline.getAttribute('points'))
      if (points.length < 2) return null

      const key = geometryKey(points)
      const existing = semanticWallsRef.current.get(key)
      if (existing) {
        styleSemanticWall(polyline, existing)
        return existing
      }

      const wallThicknessMm = Math.max(1, Number(settings.wallThicknessMm) || 100)
      const normalizedSettings = {
        ...settings,
        wallThicknessMm,
        thicknessUnit: 'mm',
      }

      const entity = {
        id: createEntityId(),
        type: 'wall',
        entityType: 'wall',
        category: 'architecture',
        projectId,
        documentId,
        pageNumber: Number(searchParams.get('page') || 1),
        points,
        layer: settings.layer || null,
        name: settings.name || 'Wall',
        height: settings.height ?? null,
        lineColor: settings.lineColor || '#0F766E',
        wallThicknessMm,
        thicknessUnit: 'mm',
        wall: normalizedSettings,
        metadata: {
          ...metadata,
          entityType: 'wall',
          wallThicknessMm,
          thicknessUnit: 'mm',
          wall: normalizedSettings,
        },
        geometryKey: key,
        createdAt: new Date().toISOString(),
      }

      semanticWallsRef.current.set(key, entity)
      completedRef.current.add(key)
      styleSemanticWall(polyline, entity)

      const walls = Array.from(semanticWallsRef.current.values())

      if (storageKey) {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(walls))
        } catch (error) {
          console.error('RitsuCAD wall semantic persistence failed.', error)
        }
      }

      window.__RITSUCAD_SEMANTIC_ENTITIES__ = walls
      window.dispatchEvent(new CustomEvent('ritsucad:semantic-entity-created', { detail: entity }))
      return entity
    }

    const applyWallAppearance = () => {
      if (applying) return
      applying = true

      try {
        const svg = document.querySelector('svg[class*="geometryLayer"]')
        if (!svg) return

        const polylines = Array.from(svg.querySelectorAll('polyline'))

        polylines.forEach((polyline) => {
          const points = parsePoints(polyline.getAttribute('points'))
          if (points.length < 2) return
          const key = geometryKey(points)
          const entity = semanticWallsRef.current.get(key)
          if (entity) styleSemanticWall(polyline, entity)
        })

        const active = activeWallRef.current
        if (!active) return

        const { settings, metadata } = active
        const color = settings.lineColor || '#0F766E'
        const thickness = wallDisplayThicknessPx(settings)

        polylines.forEach((polyline) => {
          const points = parsePoints(polyline.getAttribute('points'))
          if (points.length < 2) return

          const key = geometryKey(points)
          const stroke = String(polyline.getAttribute('stroke') || '').toLowerCase()
          const dash = polyline.getAttribute('stroke-dasharray')

          if (dash === '7 5' && !semanticWallsRef.current.has(key)) {
            polyline.setAttribute('stroke', color)
            polyline.setAttribute('stroke-width', String(thickness))
            polyline.removeAttribute('stroke-dasharray')
            polyline.dataset.ritsucadWallPreview = 'true'
            return
          }

          if (
            !baselineRef.current.has(key) &&
            !semanticWallsRef.current.has(key) &&
            !dash &&
            (stroke === '#0f172a' || stroke === '#0f766e' || stroke === color.toLowerCase())
          ) {
            persistSemanticWall(polyline, settings, metadata)
            activeWallRef.current = null
            delete window.__RITSUCAD_SEMANTIC_DRAWING_MODE__
          }
        })
      } finally {
        applying = false
      }
    }

    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(applyWallAppearance)
    })

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['points', 'stroke', 'stroke-width', 'stroke-dasharray'],
    })

    frame = requestAnimationFrame(applyWallAppearance)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [hasProjectDrawing, projectId, documentId, searchParams, storageKey])

  function cancel() {
    setOpen(false)
  }

  function saveAndDraw(settings) {
    if (!wallItem) return

    const wallThicknessMm = Math.max(1, Number(settings.wallThicknessMm) || 100)
    const normalizedSettings = {
      ...settings,
      wallThicknessMm,
      thicknessUnit: 'mm',
    }

    const baseMetadata = createSmartTakeoffMetadata('wall')
    const metadata = {
      ...baseMetadata,
      entityType: 'wall',
      layer: settings.layer,
      name: settings.name,
      height: settings.height,
      lineColor: settings.lineColor,
      wallThicknessMm,
      thicknessUnit: 'mm',
      wall: normalizedSettings,
      properties: {
        ...(baseMetadata?.properties || {}),
        entityType: 'wall',
        layer: settings.layer,
        name: settings.name,
        height: settings.height,
        lineColor: settings.lineColor,
        wallThicknessMm,
        thicknessUnit: 'mm',
      },
    }

    const svg = document.querySelector('svg[class*="geometryLayer"]')
    baselineRef.current = new Set(
      Array.from(svg?.querySelectorAll('polyline') || [])
        .map((polyline) => parsePoints(polyline.getAttribute('points')))
        .filter((points) => points.length >= 2)
        .map(geometryKey)
    )

    activeWallRef.current = { settings: normalizedSettings, metadata }

    window.__RITSUCAD_ACTIVE_SMART_TAKEOFF__ = metadata
    window.__RITSUCAD_ACTIVE_WALL_SETTINGS__ = normalizedSettings
    window.__RITSUCAD_SEMANTIC_DRAWING_MODE__ = 'wall'
    setLastWall(normalizedSettings)
    setOpen(false)

    window.dispatchEvent(
      new CustomEvent('ritsucad:smart-takeoff-selected', {
        detail: { ...wallItem, metadata, wallSettings: normalizedSettings },
      })
    )

    window.dispatchEvent(
      new CustomEvent('ritsucad:wall-settings-saved', {
        detail: { ...normalizedSettings, metadata, drawingMode: 'wall' },
      })
    )

    window.setTimeout(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: '2', code: 'Digit2', bubbles: true })
      )
    }, 0)
  }

  useEffect(() => {
    return () => {
      delete window.__RITSUCAD_ACTIVE_WALL_SETTINGS__
      delete window.__RITSUCAD_SEMANTIC_DRAWING_MODE__
    }
  }, [])

  return (
    <WallSettingsModal
      open={open}
      initialValue={lastWall || undefined}
      onCancel={cancel}
      onSave={saveAndDraw}
    />
  )
}
