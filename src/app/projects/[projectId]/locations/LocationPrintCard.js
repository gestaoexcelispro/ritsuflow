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
        const targetWidth = 1800
        const viewport = page.getViewport({ scale: targetWidth / base.width })
        const canvas = canvasRef.current
        if (!canvas || cancelled) return
        canvas.width = Math.round(viewport.width)
        canvas.height = Math.round(viewport.height)
        const ctx = canvas.getContext('2d')
        await page.render({ canvasContext: ctx, viewport }).promise
        if (cancelled) return

        const points = mapData.geometry.points
        const color = mapData.geometry?.display?.color || '#008F84'
        const opacity = Number.isFinite(Number(mapData.geometry?.display?.fill_opacity)) ? Number(mapData.geometry.display.fill_opacity) : .35
        ctx.save()
        ctx.beginPath()
        points.forEach((point, index) => {
          const x = Number(point.x) * canvas.width
          const y = Number(point.y) * canvas.height
          if (index === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.closePath()
        ctx.fillStyle = hexToRgba(color, Math.min(.65, Math.max(.20, opacity)))
        ctx.fill()
        ctx.strokeStyle = color
        ctx.lineWidth = Math.max(5, canvas.width * .003)
        ctx.stroke()
        ctx.restore()
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
        <div className={styles.locationName}>{location.name}</div>
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
