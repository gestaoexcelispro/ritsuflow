import { Suspense } from 'react'
import LocationMappingPanel from './LocationMappingPanel'
import TakeoffContextPanel from './TakeoffContextPanel'
import TakeoffPersistenceBridge from './TakeoffPersistenceBridge'
import RitsuCadProjectLauncher from './RitsuCadProjectLauncher'
import ReturnToWorkspaceButton from './ReturnToWorkspaceButton'

export const metadata = {
  title: 'RitsuCAD™ | RitsuFlow',
  description:
    'RitsuFlow construction CAD, drawing markup, measurement, takeoff, and project location mapping workspace.',
}

export default function RitsuCadLayout({ children }) {
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
      {/*
        RitsuCAD Workspace UI v2
        -----------------------
        The drawing is the primary working surface. Native inspectors remain
        available, but they float over the canvas instead of permanently
        consuming drawing width. This keeps the CAD environment maximized.
      */}
      <style>{`
        /* Replace the old compact back control with an explicit workspace exit. */
        [class*="backButton"] {
          display: none !important;
        }

        [class*="headerLeft"] {
          padding-left: 170px !important;
        }

        /* Keep the application chrome compact so the drawing owns the page. */
        [class*="applicationHeader"] {
          height: 44px !important;
          min-height: 44px !important;
        }

        [class*="cadToolbar"] {
          height: 54px !important;
          min-height: 54px !important;
          padding-top: 4px !important;
          padding-bottom: 4px !important;
        }

        /*
          The inspector is now a contextual drawer. It no longer participates
          in the flex layout, so opening Properties/Layers does not shrink CAD.
        */
        [class*="cadArea"] {
          position: relative !important;
        }

        [class*="inspector"] {
          position: absolute !important;
          z-index: 64 !important;
          top: 8px !important;
          right: 60px !important;
          bottom: 8px !important;
          width: 310px !important;
          min-width: 310px !important;
          border: 1px solid #cbd7e1 !important;
          border-radius: 10px !important;
          box-shadow: -8px 8px 28px rgba(15, 23, 42, 0.16) !important;
          overflow: hidden !important;
        }

        /* The tool rail stays narrow and always available. */
        [class*="toolRail"] {
          flex: 0 0 52px !important;
          width: 52px !important;
          min-width: 52px !important;
          z-index: 66 !important;
        }

        /* Give the PDF/canvas the visual priority of a CAD application. */
        [class*="viewport"] {
          min-width: 0 !important;
          width: auto !important;
        }

        @media (max-width: 1100px) {
          [class*="headerLeft"] {
            padding-left: 150px !important;
          }

          [class*="inspector"] {
            right: 56px !important;
            width: 292px !important;
            min-width: 292px !important;
          }
        }
      `}</style>

      <Suspense fallback={null}>
        <ReturnToWorkspaceButton />
      </Suspense>

      {children}

      <Suspense fallback={null}>
        <RitsuCadProjectLauncher />
        <LocationMappingPanel />
        <TakeoffContextPanel />
        <TakeoffPersistenceBridge />
      </Suspense>
    </div>
  )
}
