'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import WallSettingsModal from './WallSettingsModal'
import { createSmartTakeoffMetadata, getSmartTakeoffGroups } from './smartTakeoff'

function parsePoints(value) {
  return String(value || '').trim().split(/\s+/).map((pair) => {
    const [x, y] = pair.split(',').map(Number)
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
  }).filter(Boolean)
}

function geometryKey(points) {
  return points.map((point) => `${point.x.toFixed(4)},${point.y.toFixed(4)}`).join('|')
}

function createEntityId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `ritsucad-wall-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function wallDisplayThicknessPx(wall) {
  const millimeters = Number(wall?.wallThicknessMm ?? wall?.thicknessMm)
  if (Number.isFinite(millimeters) && millimeters > 0) return Math.max(2, Math.min(24, millimeters / 10))
  const legacyPx = Number(wall?.lineThickness)
  return Math.max(1, Number.isFinite(legacyPx) && legacyPx > 0 ? legacyPx : 2)
}

function svgUnitsPerScreenPixel(svg) {
  if (!svg) return 1
  try {
    const ctm = svg.getScreenCTM?.()
    if (!ctm) return 1
    const scaleX = Math.hypot(ctm.a, ctm.b)
    const scaleY = Math.hypot(ctm.c, ctm.d)
    const scale = (scaleX + scaleY) / 2
    return scale > 0 ? 1 / scale : 1
  } catch {
    return 1
  }
}

function buildWallSegmentPolygons(points, thickness) {
  if (!Array.isArray(points) || points.length < 2 || !Number.isFinite(thickness) || thickness <= 0) return []
  const half = thickness / 2
  const polygons = []
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]
    const end = points[index]
    const dx = end.x - start.x
    const dy = end.y - start.y
    const length = Math.hypot(dx, dy)
    if (length <= 0.0001) continue
    const nx = (-dy / length) * half
    const ny = (dx / length) * half
    polygons.push([
      { x: start.x + nx, y: start.y + ny },
      { x: end.x + nx, y: end.y + ny },
      { x: end.x - nx, y: end.y - ny },
      { x: start.x - nx, y: start.y - ny },
    ])
  }
  return polygons
}

function removeWallBody(svg, entityId) {
  if (!svg || !entityId) return
  svg.querySelectorAll(`[data-ritsucad-wall-body-for="${entityId}"]`).forEach((node) => node.remove())
}

function renderWallBody(svg, polyline, entity) {
  if (!svg || !polyline || !entity) return
  const points = parsePoints(polyline.getAttribute('points'))
  if (points.length < 2) return
  const color = entity.lineColor || entity.wall?.lineColor || '#0F766E'
  const thickness = wallDisplayThicknessPx(entity.wall || entity) * svgUnitsPerScreenPixel(svg)
  const polygons = buildWallSegmentPolygons(points, thickness)
  removeWallBody(svg, entity.id)

  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  group.dataset.ritsucadWallBodyFor = entity.id || ''
  group.dataset.ritsucadSemanticEntity = 'wall'
  group.dataset.ritsucadLayer = entity.layer || ''
  group.dataset.ritsucadName = entity.name || ''
  group.dataset.ritsucadWallThicknessMm = entity.wallThicknessMm == null ? '' : String(entity.wallThicknessMm)
  group.style.pointerEvents = 'none'

  polygons.forEach((polygonPoints) => {
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
    polygon.setAttribute('points', polygonPoints.map((point) => `${point.x},${point.y}`).join(' '))
    polygon.setAttribute('fill', color)
    polygon.setAttribute('stroke', color)
    polygon.setAttribute('stroke-width', '0')
    polygon.setAttribute('stroke-linejoin', 'miter')
    group.appendChild(polygon)
  })

  polyline.parentNode?.insertBefore(group, polyline.nextSibling)
  polyline.setAttribute('stroke', 'transparent')
  polyline.setAttribute('stroke-width', '1')
  polyline.removeAttribute('stroke-dasharray')
  polyline.dataset.ritsucadSemanticEntity = 'wall'
  polyline.dataset.ritsucadSemanticEntityId = entity.id || ''
  polyline.dataset.ritsucadSmartTakeoff = 'true'
  polyline.dataset.ritsucadSmartType = 'wall'
  polyline.dataset.ritsucadLayer = entity.layer || ''
  polyline.dataset.ritsucadName = entity.name || ''
  polyline.dataset.ritsucadHeight = entity.height == null ? '' : String(entity.height)
  polyline.dataset.ritsucadWallThicknessMm = entity.wallThicknessMm == null ? '' : String(entity.wallThicknessMm)
}

export default function WallSettingsBridge() {
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [lastWall, setLastWall] = useState(null)
  const baselineRef = useRef(new Set())
  const activeWallRef = useRef(null)
  const semanticWallsRef = useRef(new Map())

  const projectId = searchParams.get('projectId')
  const documentId = searchParams.get('documentId')
  const hasProjectDrawing = Boolean(projectId && documentId)

  const wallItem = useMemo(() => getSmartTakeoffGroups().flatMap((group) => group.items || []).find((item) => item.id === 'wall') || null, [])
  const storageKey = useMemo(() => projectId && documentId ? `ritsucad:semantic-walls:${projectId}:${documentId}` : null, [projectId, documentId])

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
      if (!activeWallRef.current || event.button !== 0 || event.detail < 2) return
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
      semanticWallsRef.current = new Map(walls.filter((entity) => entity?.geometryKey).map((entity) => [entity.geometryKey, entity]))
      window.__RITSUCAD_SEMANTIC_ENTITIES__ = walls
    } catch (error) {
      console.error('RitsuCAD stored wall metadata could not be restored.', error)
    }
  }, [storageKey])

  useEffect(() => {
    if (!hasProjectDrawing) return undefined
    let frame = 0
    let applying = false

    const persistSemanticWall = (svg, polyline, settings, metadata) => {
      const points = parsePoints(polyline.getAttribute('points'))
      if (points.length < 2) return null
      const key = geometryKey(points)
      const existing = semanticWallsRef.current.get(key)
      if (existing) {
        renderWallBody(svg, polyline, existing)
        return existing
      }

      const wallThicknessMm = Math.max(1, Number(settings.wallThicknessMm) || 100)
      const normalizedSettings = { ...settings, wallThicknessMm, thicknessUnit: 'mm' }
      const entity = {
        id: createEntityId(), type: 'wall', entityType: 'wall', category: 'architecture',
        projectId, documentId, pageNumber: Number(searchParams.get('page') || 1), points,
        layer: settings.layer || null, name: settings.name || 'Wall', height: settings.height ?? null,
        lineColor: settings.lineColor || '#0F766E', wallThicknessMm, thicknessUnit: 'mm',
        wall: normalizedSettings,
        metadata: { ...metadata, entityType: 'wall', wallThicknessMm, thicknessUnit: 'mm', wall: normalizedSettings },
        geometryKey: key, createdAt: new Date().toISOString(),
      }
      semanticWallsRef.current.set(key, entity)
      renderWallBody(svg, polyline, entity)
      const walls = Array.from(semanticWallsRef.current.values())
      if (storageKey) {
        try { window.localStorage.setItem(storageKey, JSON.stringify(walls)) }
        catch (error) { console.error('RitsuCAD wall semantic persistence failed.', error) }
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
          .filter((polyline) => !polyline.closest('[data-ritsucad-wall-body-for]'))

        // Restore already-completed semantic walls.
        polylines.forEach((polyline) => {
          if (polyline.dataset.ritsucadWallPreview === 'true') return
          const points = parsePoints(polyline.getAttribute('points'))
          if (points.length < 2) return
          const entity = semanticWallsRef.current.get(geometryKey(points))
          if (entity) renderWallBody(svg, polyline, entity)
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
          const dash = polyline.getAttribute('stroke-dasharray')

          // IMPORTANT: a dashed polyline is React's live drawing preview. Style it,
          // but keep it dashed and marked as preview. Never persist it as a Wall.
          if (dash === '7 5' && !semanticWallsRef.current.has(key)) {
            polyline.setAttribute('stroke', color)
            polyline.setAttribute('stroke-width', String(thickness))
            polyline.setAttribute('stroke-linecap', 'butt')
            polyline.setAttribute('stroke-linejoin', 'miter')
            polyline.dataset.ritsucadWallPreview = 'true'
            return
          }

          // Only React's completed native cad-polyline is eligible for persistence.
          // Preview nodes are explicitly excluded, preventing the first click/mouse
          // movement from prematurely completing the semantic Wall command.
          if (polyline.dataset.ritsucadWallPreview === 'true') return
          const stroke = String(polyline.getAttribute('stroke') || '').toLowerCase()
          if (
            !baselineRef.current.has(key) &&
            !semanticWallsRef.current.has(key) &&
            !dash &&
            (stroke === '#0f172a' || stroke === '#0f766e')
          ) {
            persistSemanticWall(svg, polyline, settings, metadata)
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
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['points', 'stroke', 'stroke-width', 'stroke-dasharray'] })
    frame = requestAnimationFrame(applyWallAppearance)
    const redraw = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(applyWallAppearance) }
    window.addEventListener('resize', redraw)
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', redraw) }
  }, [hasProjectDrawing, projectId, documentId, searchParams, storageKey])

  function cancel() { setOpen(false) }

  function saveAndDraw(settings) {
    if (!wallItem) return
    const wallThicknessMm = Math.max(1, Number(settings.wallThicknessMm) || 100)
    const normalizedSettings = { ...settings, wallThicknessMm, thicknessUnit: 'mm' }
    const baseMetadata = createSmartTakeoffMetadata('wall')
    const metadata = {
      ...baseMetadata, entityType: 'wall', layer: settings.layer, name: settings.name,
      height: settings.height, lineColor: settings.lineColor, wallThicknessMm, thicknessUnit: 'mm',
      wall: normalizedSettings,
      properties: { ...(baseMetadata?.properties || {}), entityType: 'wall', layer: settings.layer, name: settings.name, height: settings.height, lineColor: settings.lineColor, wallThicknessMm, thicknessUnit: 'mm' },
    }

    const svg = document.querySelector('svg[class*="geometryLayer"]')
    baselineRef.current = new Set(Array.from(svg?.querySelectorAll('polyline') || [])
      .filter((polyline) => polyline.dataset.ritsucadWallPreview !== 'true')
      .map((polyline) => parsePoints(polyline.getAttribute('points')))
      .filter((points) => points.length >= 2).map(geometryKey))

    activeWallRef.current = { settings: normalizedSettings, metadata }
    window.__RITSUCAD_ACTIVE_SMART_TAKEOFF__ = metadata
    window.__RITSUCAD_ACTIVE_WALL_SETTINGS__ = normalizedSettings
    window.__RITSUCAD_SEMANTIC_DRAWING_MODE__ = 'wall'
    setLastWall(normalizedSettings)
    setOpen(false)

    window.dispatchEvent(new CustomEvent('ritsucad:smart-takeoff-selected', { detail: { ...wallItem, metadata, wallSettings: normalizedSettings } }))
    window.dispatchEvent(new CustomEvent('ritsucad:wall-settings-saved', { detail: { ...normalizedSettings, metadata, drawingMode: 'wall' } }))
    window.setTimeout(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '2', code: 'Digit2', bubbles: true }))
    }, 0)
  }

  useEffect(() => () => {
    delete window.__RITSUCAD_ACTIVE_WALL_SETTINGS__
    delete window.__RITSUCAD_SEMANTIC_DRAWING_MODE__
  }, [])

  return <WallSettingsModal open={open} initialValue={lastWall || undefined} onCancel={cancel} onSave={saveAndDraw} />
}
