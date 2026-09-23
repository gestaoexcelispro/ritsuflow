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
  return points
    .map((point) => `${point.x.toFixed(4)},${point.y.toFixed(4)}`)
    .join('|')
}

function createEntityId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `ritsucad-wall-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function WallSettingsBridge() {
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [lastWall, setLastWall] = useState(null)
  const baselineRef = useRef(new Set())
  const activeWallRef = useRef(null)
  const completedRef = useRef(new Set())

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

    let frame = 0

    const persistSemanticWall = (polyline, settings, metadata) => {
      const points = parsePoints(polyline.getAttribute('points'))
      if (points.length < 2) return

      const key = geometryKey(points)
      if (completedRef.current.has(key)) return

      completedRef.current.add(key)

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
        lineThickness: Math.max(1, Number(settings.lineThickness) || 2),
        wall: { ...settings },
        metadata: {
          ...metadata,
          entityType: 'wall',
          wall: { ...settings },
        },
        geometryKey: key,
        createdAt: new Date().toISOString(),
      }

      polyline.dataset.ritsucadSemanticEntity = 'wall'
      polyline.dataset.ritsucadSemanticEntityId = entity.id
      polyline.dataset.ritsucadLayer = entity.layer || ''
      polyline.dataset.ritsucadName = entity.name || ''
      polyline.dataset.ritsucadHeight = entity.height == null ? '' : String(entity.height)

      if (storageKey) {
        try {
          const previous = JSON.parse(window.localStorage.getItem(storageKey) || '[]')
          const next = Array.isArray(previous)
            ? [...previous.filter((item) => item?.geometryKey !== key), entity]
            : [entity]
          window.localStorage.setItem(storageKey, JSON.stringify(next))
        } catch (error) {
          console.error('RitsuCAD wall semantic persistence failed.', error)
        }
      }

      window.__RITSUCAD_SEMANTIC_ENTITIES__ = [
        ...(Array.isArray(window.__RITSUCAD_SEMANTIC_ENTITIES__)
          ? window.__RITSUCAD_SEMANTIC_ENTITIES__.filter(
              (item) => item?.geometryKey !== key
            )
          : []),
        entity,
      ]

      window.dispatchEvent(
        new CustomEvent('ritsucad:semantic-entity-created', {
          detail: entity,
        })
      )
    }

    const applyWallAppearance = () => {
      const active = activeWallRef.current
      if (!active) return

      const { settings, metadata } = active
      const color = settings.lineColor || '#0F766E'
      const thickness = Math.max(1, Number(settings.lineThickness) || 2)
      const svg = document.querySelector('svg[class*="geometryLayer"]')
      if (!svg) return

      const polylines = Array.from(svg.querySelectorAll('polyline'))

      polylines.forEach((polyline) => {
        const points = parsePoints(polyline.getAttribute('points'))
        if (points.length < 2) return

        const key = geometryKey(points)
        const stroke = String(polyline.getAttribute('stroke') || '').toLowerCase()
        const dash = polyline.getAttribute('stroke-dasharray')

        // Live native-polyline preview for the active Wall command.
        if (stroke === '#0f766e' && dash === '7 5') {
          polyline.setAttribute('stroke', color)
          polyline.setAttribute('stroke-width', String(thickness))
          polyline.removeAttribute('stroke-dasharray')
          polyline.dataset.ritsucadWallPreview = 'true'
          return
        }

        // A newly committed native CAD polyline is the completed Wall. Capture it
        // once, attach the semantic identity, and keep its configured appearance.
        if (
          !baselineRef.current.has(key) &&
          !completedRef.current.has(key) &&
          stroke === '#0f172a' &&
          !dash
        ) {
          polyline.setAttribute('stroke', color)
          polyline.setAttribute('stroke-width', String(thickness))
          polyline.dataset.ritsucadSmartTakeoff = 'true'
          polyline.dataset.ritsucadSmartType = 'wall'
          persistSemanticWall(polyline, settings, metadata)
          activeWallRef.current = null
          delete window.__RITSUCAD_SEMANTIC_DRAWING_MODE__
        }
      })
    }

    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(applyWallAppearance)
    })

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
    })

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [hasProjectDrawing, projectId, documentId, searchParams, storageKey])

  useEffect(() => {
    if (!storageKey) return

    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey) || '[]')
      if (Array.isArray(stored)) {
        window.__RITSUCAD_SEMANTIC_ENTITIES__ = stored
        stored.forEach((entity) => {
          if (entity?.geometryKey) completedRef.current.add(entity.geometryKey)
        })
      }
    } catch (error) {
      console.error('RitsuCAD stored wall metadata could not be restored.', error)
    }
  }, [storageKey])

  function cancel() {
    setOpen(false)
  }

  function saveAndDraw(settings) {
    if (!wallItem) return

    const baseMetadata = createSmartTakeoffMetadata('wall')
    const metadata = {
      ...baseMetadata,
      entityType: 'wall',
      layer: settings.layer,
      name: settings.name,
      height: settings.height,
      lineColor: settings.lineColor,
      lineThickness: settings.lineThickness,
      wall: { ...settings },
      properties: {
        ...(baseMetadata?.properties || {}),
        entityType: 'wall',
        layer: settings.layer,
        name: settings.name,
        height: settings.height,
        lineColor: settings.lineColor,
        lineThickness: settings.lineThickness,
      },
    }

    const svg = document.querySelector('svg[class*="geometryLayer"]')
    baselineRef.current = new Set(
      Array.from(svg?.querySelectorAll('polyline') || [])
        .map((polyline) => parsePoints(polyline.getAttribute('points')))
        .filter((points) => points.length >= 2)
        .map(geometryKey)
    )

    activeWallRef.current = {
      settings: { ...settings },
      metadata,
    }

    window.__RITSUCAD_ACTIVE_SMART_TAKEOFF__ = metadata
    window.__RITSUCAD_ACTIVE_WALL_SETTINGS__ = { ...settings }
    window.__RITSUCAD_SEMANTIC_DRAWING_MODE__ = 'wall'
    setLastWall(settings)
    setOpen(false)

    window.dispatchEvent(
      new CustomEvent('ritsucad:smart-takeoff-selected', {
        detail: { ...wallItem, metadata, wallSettings: settings },
      })
    )

    window.dispatchEvent(
      new CustomEvent('ritsucad:wall-settings-saved', {
        detail: { ...settings, metadata, drawingMode: 'wall' },
      })
    )

    window.setTimeout(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: '2',
          code: 'Digit2',
          bubbles: true,
        })
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
