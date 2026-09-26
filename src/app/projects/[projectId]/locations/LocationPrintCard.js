'use client'

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

export default function LocationPrintCard({ location, locationMap, projectName, projectCode, onClose }) {
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

        <div className={styles.qr}>
          <QRCodeSVG value={scanUrl} size="100%" level="M" marginSize={3} bgColor="#ffffff" fgColor="#000000" />
        </div>

        <div className={styles.locationId}>{locationId}</div>
      </main>
    </div>
  )
}
