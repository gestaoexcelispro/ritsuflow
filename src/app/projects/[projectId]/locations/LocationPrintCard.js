'use client'

import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { locationBreadcrumb, locationQrPath } from './locationQr'
import styles from './location-print-card.module.css'

function humanLocationId(projectCode, location, locationMap) {
  const parts = []
  const visited = new Set()
  let current = location
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    parts.unshift(current.name)
    current = current.parent_id ? locationMap.get(current.parent_id) : null
  }
  const slug = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '')
  return [slug(projectCode || 'PROJECT'), ...parts.map(slug)].filter(Boolean).join('-')
}

function hexToRgba(hex, opacity) {
  const clean = String(hex || '#008F84').replace('#', '')
  const value = clean.length === 3 ? clean.split('').map((x) => x + x).join('') : clean
  const parsed = Number.parseInt(value, 16)
  if (!Number.isFinite(parsed)) return `rgba(0,143,132,${opacity})`
  return `rgba(${(parsed >> 16) & 255},${(parsed >> 8) & 255},${parsed & 255},${opacity})`
}

function validPrintView(value) {
  if (!value) return null
  const x = Number(value.x)
  const y = Number(value.y)
  const width = Number(value.width)
  const height = Number(value.height)
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null
  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    width: Math.max(0, Math.min(1 - x, width)),
    height: Math.max(0, Math.min(1 - y, height)),
  }
}

function withPrintBleed(view, ratio = .08) {
  const padX = view.width * ratio
  const padY = view.height * ratio
  const left = Math.max(0, view.x - padX)
  const top = Math.max(0, view.y - padY)
  const right = Math.min(1, view.x + view.width + padX)
  const bottom = Math.min(1, view.y + view.height + padY)
  return { x: left, y: top, width: right - left, height: bottom - top }
}

function LocationPlan({ mapData, loading, error }) {
  const canvasRef = useRef(null)
  const [renderError, setRenderError] = useState('')

  useEffect(() => {
    if (!mapData?.signedUrl || !mapData?.geometry?.points?.length) return
    let cancelled = false
    let pdf = null

    async function render() {
      setRenderError('')
      try {
        const response = await fetch(mapData.signedUrl)
        if (!response.ok) throw new Error(`Drawing download failed (${response.status}).`)
        const bytes = await response.arrayBuffer()
        const pdfjs = await import('pdfjs-dist/build/pdf.mjs')
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        pdf = await pdfjs.getDocument({ data: bytes }).promise
        const page = await pdf.getPage(Math.min(Math.max(1, Number(mapData.pageNumber) || 1), pdf.numPages))
        const base = page.getViewport({ scale: 1 })
        const targetWidth = 2400
        const viewport = page.getViewport({ scale: targetWidth / base.width })

        const source = document.createElement('canvas')
        source.width = Math.round(viewport.width)
        source.height = Math.round(viewport.height)
        const sourceCtx = source.getContext('2d')
        await page.render({ canvasContext: sourceCtx, viewport }).promise
        if (cancelled) return

        const points = mapData.geometry.points
        const color = mapData.geometry?.display?.color || '#008F84'
        const opacity = Number.isFinite(Number(mapData.geometry?.display?.fill_opacity)) ? Number(mapData.geometry.display.fill_opacity) : .35
        sourceCtx.save()
        sourceCtx.beginPath()
        points.forEach((point, index) => {
          const px = Number(point.x) * source.width
          const py = Number(point.y) * source.height
          if (index === 0) sourceCtx.moveTo(px, py)
          else sourceCtx.lineTo(px, py)
        })
        sourceCtx.closePath()
        sourceCtx.fillStyle = hexToRgba(color, Math.min(.65, Math.max(.20, opacity)))
        sourceCtx.fill()
        sourceCtx.strokeStyle = color
        sourceCtx.lineWidth = Math.max(5, source.width * .003)
        sourceCtx.stroke()
        sourceCtx.restore()

        const savedView = validPrintView(mapData.printView)
        const printView = savedView ? withPrintBleed(savedView) : { x: 0, y: 0, width: 1, height: 1 }
        const sx = Math.round(printView.x * source.width)
        const sy = Math.round(printView.y * source.height)
        const sw = Math.max(1, Math.round(printView.width * source.width))
        const sh = Math.max(1, Math.round(printView.height * source.height))

        const canvas = canvasRef.current
        if (!canvas || cancelled) return
        const outputWidth = 1800
        const outputHeight = Math.max(1, Math.round(outputWidth * sh / sw))
        canvas.width = outputWidth
        canvas.height = outputHeight
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
      } catch (e) {
        if (!cancelled) setRenderError(e?.message || 'Unable to render the location plan.')
      }
    }

    render()
    return () => { cancelled = true; pdf?.destroy?.().catch(() => {}) }
  }, [mapData])

  if (loading) return <div className={styles.planStatus}>Loading mapped location…</div>
  if (error || renderError) return <div className={styles.planStatus}>Location plan unavailable</div>
  if (!mapData) return <div className={styles.planStatus}>No Location Map assigned</div>
  return <canvas ref={canvasRef} className={styles.planCanvas} aria-label="Mapped location on project plan" />
}

export default function LocationPrintCard({ location, locationMap, projectName, projectCode, mapData, mapLoading, mapError, onClose }) {
  if (!location?.qr_token) return null

  const qrPath = locationQrPath(location.qr_token)
  const scanUrl = typeof window === 'undefined' ? qrPath : `${window.location.origin}${qrPath}`
  const breadcrumb = locationBreadcrumb(location, locationMap, '').replace(/^\s*\/\s*/, '')
  const locationId = humanLocationId(projectCode, location, locationMap)
  const environment = location.environment_type || '—'
  const locationColor = mapData?.geometry?.display?.color || '#008F84'
  const identityStyle = mapData ? {
    backgroundColor: hexToRgba(locationColor, .28),
    borderColor: locationColor,
  } : undefined

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="A4 location card preview">
      <div className={styles.toolbar}>
        <div>
          <strong>A4 Location Card</strong>
          <span>{location.name}</span>
        </div>
        <div className={styles.toolbarActions}>
          <button type="button" onClick={() => window.print()}>Print / Save PDF</button>
          <button type="button" className={styles.secondary} onClick={onClose}>Close</button>
        </div>
      </div>

      <main className={styles.sheet}>
        <img className={styles.background} src="/location-a4-picture.png" alt="" aria-hidden="true" />

        <div className={styles.projectValue}>{projectCode || 'PROJECT'} - {projectName || ''}</div>
        <div className={styles.locationName} style={identityStyle}>{location.name}</div>
        <div className={styles.environment}>{environment}</div>
        <div className={styles.hierarchy}>{breadcrumb}</div>

        <div className={styles.locationPlan}>
          <LocationPlan mapData={mapData} loading={mapLoading} error={mapError} />
        </div>

        <div className={styles.qr}>
          <QRCodeSVG value={scanUrl} size="100%" level="M" marginSize={3} bgColor="#ffffff" fgColor="#000000" />
        </div>

        <div className={styles.locationId}>{locationId}</div>
      </main>
    </div>
  )
}
