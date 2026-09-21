import { Suspense } from 'react'
import LocationMappingPanel from './LocationMappingPanel'

export const metadata = {
  title: 'RitsuCAD™ | RitsuFlow',
  description:
    'RitsuFlow construction CAD, drawing markup, measurement, takeoff, and project location mapping workspace.',
}


export default function RitsuCadLayout({
  children,
}) {

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        minWidth: 0,
        minHeight: 0,
        margin: 0,
        overflow: 'hidden',
        background: '#dfe6ec',
      }}
    >
      {children}

      <Suspense fallback={null}>
        <LocationMappingPanel />
      </Suspense>
    </div>
  )

}
