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

  function cancel() {
    setOpen(false)
  }

  function saveAndDraw(settings) {
    if (!wallItem) return

    const baseMetadata = createSmartTakeoffMetadata('wall')
    const metadata = {
      ...baseMetadata,
      layer: settings.layer,
      name: settings.name,
      height: settings.height,
      lineColor: settings.lineColor,
      lineThickness: settings.lineThickness,
      wall: { ...settings },
      properties: {
        ...(baseMetadata?.properties || {}),
        layer: settings.layer,
        name: settings.name,
        height: settings.height,
        lineColor: settings.lineColor,
        lineThickness: settings.lineThickness,
      },
    }

    window.__RITSUCAD_ACTIVE_SMART_TAKEOFF__ = metadata
    window.__RITSUCAD_ACTIVE_WALL_SETTINGS__ = { ...settings }
    setLastWall(settings)
    setOpen(false)

    window.dispatchEvent(
      new CustomEvent('ritsucad:smart-takeoff-selected', {
        detail: { ...wallItem, metadata, wallSettings: settings },
      })
    )

    window.dispatchEvent(
      new CustomEvent('ritsucad:wall-settings-saved', {
        detail: { ...settings, metadata },
      })
    )

    window.setTimeout(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'p',
          code: 'KeyP',
          bubbles: true,
        })
      )
    }, 0)
  }

  useEffect(() => {
    return () => {
      delete window.__RITSUCAD_ACTIVE_WALL_SETTINGS__
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
