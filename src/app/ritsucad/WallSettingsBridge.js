'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import WallSettingsModal from './WallSettingsModal'
import { createSmartTakeoffMetadata, getSmartTakeoffGroups } from './smartTakeoff'

export default function WallSettingsBridge() {
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [lastWall, setLastWall] = useState(null)

  const hasProjectDrawing = Boolean(
    searchParams.get('projectId') && searchParams.get('documentId')
  )

  const wallItem = useMemo(() => {
    return getSmartTakeoffGroups()
      .flatMap((group) => group.items || [])
      .find((item) => item.id === 'wall') || null
  }, [])

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

    const applyWallAppearance = () => {
      const settings = window.__RITSUCAD_ACTIVE_WALL_SETTINGS__
      if (!settings) return

      const color = settings.lineColor || '#0F766E'
      const thickness = Math.max(1, Number(settings.lineThickness) || 2)

      // Wall drawing uses the native CAD polyline path. While the wall command is
      // active, its live preview must look exactly like the configured wall rather
      // than like the generic orange measurement/takeoff polyline.
      const svg = document.querySelector('svg[class*="geometryLayer"]')
      if (!svg) return

      const polylines = Array.from(svg.querySelectorAll('polyline'))
      polylines.forEach((polyline) => {
        const stroke = String(polyline.getAttribute('stroke') || '').toLowerCase()
        const dash = polyline.getAttribute('stroke-dasharray')

        if (stroke === '#0f766e' && dash === '7 5') {
          polyline.setAttribute('stroke', color)
          polyline.setAttribute('stroke-width', String(thickness))
          polyline.removeAttribute('stroke-dasharray')
          polyline.dataset.ritsucadWallPreview = 'true'
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

    applyWallAppearance()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [hasProjectDrawing])

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

    // IMPORTANT: Wall is drawing geometry, not a generic measurement polyline.
    // Shortcut 2 activates RitsuCAD's native Draw Polyline command. Previously we
    // sent P, which activated Polyline Takeoff and produced the orange dashed line.
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
