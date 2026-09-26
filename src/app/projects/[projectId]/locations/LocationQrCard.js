'use client'

import { QRCodeSVG } from 'qrcode.react'
import { locationBreadcrumb, locationQrPath } from './locationQr'
import styles from './location-qr-card.module.css'

export default function LocationQrCard({ location, locationMap, projectName, projectCode }) {
  if (!location?.qr_token) return null

  const path = locationQrPath(location.qr_token)
  const scanUrl = typeof window === 'undefined' ? path : `${window.location.origin}${path}`
  const breadcrumb = locationBreadcrumb(location, locationMap, projectName)

  function printQr() {
    window.print()
  }

  function downloadQr() {
    const svg = document.getElementById(`location-qr-${location.id}`)
    if (!svg) return
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${projectCode || 'project'}-${location.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-location-qr.svg'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <section className={styles.card}>
      <div className={styles.heading}>
        <div>
          <span>FIELDOP LOCATION QR</span>
          <strong>Physical location identity</strong>
        </div>
        <span className={styles.status}>Active</span>
      </div>

      <div className={styles.content}>
        <div className={styles.qrWrap}>
          <QRCodeSVG id={`location-qr-${location.id}`} value={scanUrl} size={176} level="M" marginSize={2} />
        </div>
        <div className={styles.identity}>
          <small>{projectCode || 'PROJECT'}</small>
          <h3>{location.name}</h3>
          <p>{breadcrumb}</p>
          <span>Scan to open FieldOp at this location.</span>
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" onClick={printQr}>Print QR</button>
        <button type="button" onClick={downloadQr}>Download SVG</button>
      </div>
    </section>
  )
}
