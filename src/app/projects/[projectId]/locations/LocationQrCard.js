'use client'

import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { createClient } from '../../../lib/supabase/client'
import { locationBreadcrumb, locationQrPath } from './locationQr'
import LocationPrintCard from './LocationPrintCard'
import styles from './location-qr-card.module.css'

export default function LocationQrCard({ location, locationMap, projectName, projectCode }) {
  const supabase = useMemo(() => createClient(), [])
  const [showPrintCard, setShowPrintCard] = useState(false)
  const [printMap, setPrintMap] = useState(null)
  const [printMapLoading, setPrintMapLoading] = useState(false)
  const [printMapError, setPrintMapError] = useState('')

  useEffect(() => {
    if (!showPrintCard || !location?.id) return
    let cancelled = false

    async function loadPrintMap() {
      setPrintMapLoading(true)
      setPrintMapError('')
      setPrintMap(null)
      try {
        const { data: geometryRow, error: geometryError } = await supabase
          .from('project_drawing_location_geometries')
          .select('id,geometry,page_number,document_id,drawing_map_id')
          .eq('location_id', location.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (geometryError) throw geometryError
        if (!geometryRow) return

        const { data: drawingMap, error: drawingMapError } = await supabase
          .from('project_drawing_maps')
          .select('id,print_view,scale_calibration')
          .eq('id', geometryRow.drawing_map_id)
          .maybeSingle()
        if (drawingMapError) throw drawingMapError

        const { data: documentRow, error: documentError } = await supabase
          .from('project_documents')
          .select('id,file_name,storage_path,mime_type,document_type')
          .eq('id', geometryRow.document_id)
          .maybeSingle()
        if (documentError) throw documentError
        if (!documentRow?.storage_path) return

        const { data: signed, error: signedError } = await supabase.storage
          .from('project-documents')
          .createSignedUrl(documentRow.storage_path, 300)
        if (signedError || !signed?.signedUrl) throw signedError || new Error('Unable to access the mapped drawing.')

        if (!cancelled) setPrintMap({
          geometry: geometryRow.geometry,
          printView: drawingMap?.print_view || null,
          scaleCalibration: drawingMap?.scale_calibration || null,
          pageNumber: geometryRow.page_number || 1,
          document: documentRow,
          signedUrl: signed.signedUrl,
        })
      } catch (error) {
        if (!cancelled) setPrintMapError(error?.message || 'Unable to load the mapped location drawing.')
      } finally {
        if (!cancelled) setPrintMapLoading(false)
      }
    }

    loadPrintMap()
    return () => { cancelled = true }
  }, [showPrintCard, location?.id, supabase])

  if (!location?.qr_token) return null

  const path = locationQrPath(location.qr_token)
  const scanUrl = typeof window === 'undefined' ? path : `${window.location.origin}${path}`
  const breadcrumb = locationBreadcrumb(location, locationMap, projectName)

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
    <>
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
          <button type="button" onClick={() => setShowPrintCard(true)}>Print Location Card</button>
          <button type="button" onClick={downloadQr}>Download SVG</button>
        </div>
      </section>

      {showPrintCard && (
        <LocationPrintCard
          location={location}
          locationMap={locationMap}
          projectName={projectName}
          projectCode={projectCode}
          mapData={printMap}
          mapLoading={printMapLoading}
          mapError={printMapError}
          onClose={() => setShowPrintCard(false)}
        />
      )}
    </>
  )
}
