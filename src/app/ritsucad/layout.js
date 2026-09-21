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
      <style>{`
        /* =====================================================
           RITSUCAD WORKSPACE UI v5
           Clean canvas. Commands live in the ribbon.
        ===================================================== */

        [class*="backButton"] { display: none !important; }

        [class*="headerLeft"] {
          padding-left: 218px !important;
        }

        [class*="applicationHeader"] {
          height: 48px !important;
          min-height: 48px !important;
        }

        /* =====================================================
           COMPACT FEATURE RIBBON
        ===================================================== */

        [class*="cadToolbar"] {
          height: 62px !important;
          min-height: 62px !important;
          padding: 3px 8px 2px !important;
          align-items: stretch !important;
          background: #fbfcfd !important;
          border-bottom: 1px solid #cfdbe4 !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          scrollbar-width: thin;
        }

        [class*="toolbarSection"] {
          position: relative !important;
          flex: 0 0 auto !important;
          align-items: flex-end !important;
          padding: 13px 4px 1px !important;
          gap: 1px !important;
        }

        [class*="toolbarSection"]::before {
          position: absolute;
          top: 1px;
          left: 6px;
          color: #5c7488;
          font-size: 8px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: .06em;
          white-space: nowrap;
        }

        [class*="toolbarSection"]:nth-of-type(1)::before { content: 'FILE'; }
        [class*="toolbarSection"]:nth-of-type(2)::before { content: 'VIEW'; }
        [class*="toolbarSection"]:nth-of-type(3)::before { content: 'DRAW'; }
        [class*="toolbarSection"]:nth-of-type(4)::before { content: 'MEASURE · TAKEOFF'; }
        [class*="toolbarSection"]:nth-of-type(5)::before { content: 'EDIT · SETUP'; }

        [class*="toolbarDivider"] {
          height: 39px !important;
          margin: 14px 5px 1px !important;
          background: #d5e0e8 !important;
        }

        [class*="toolbarButton"],
        [class*="toolbarButtonWide"],
        [class*="toolbarIconButton"],
        [class*="importButton"] {
          height: 40px !important;
          min-height: 40px !important;
        }

        [class*="toolbarButton"],
        [class*="toolbarIconButton"] {
          min-width: 48px !important;
          padding-left: 6px !important;
          padding-right: 6px !important;
        }

        [class*="toolbarButtonWide"],
        [class*="importButton"] {
          padding-left: 10px !important;
          padding-right: 10px !important;
        }

        [class*="cadToolbar"] button:disabled {
          opacity: .32 !important;
          filter: saturate(.45) !important;
        }

        /* =====================================================
           CANVAS-FIRST WORKSPACE
        ===================================================== */

        [class*="cadArea"] {
          position: relative !important;
          min-width: 0 !important;
        }

        [class*="viewport"] {
          min-width: 0 !important;
          width: auto !important;
        }

        [class*="_inspector__"] {
          position: absolute !important;
          z-index: 64 !important;
          top: 8px !important;
          right: 8px !important;
          bottom: auto !important;
          width: 292px !important;
          min-width: 292px !important;
          max-width: 292px !important;
          max-height: calc(100% - 16px) !important;
          border: 1px solid #cbd7e1 !important;
          border-radius: 9px !important;
          background: #ffffff !important;
          box-shadow: -5px 7px 22px rgba(15, 23, 42, 0.14) !important;
          overflow: hidden !important;
        }

        [class*="_inspectorBody__"] {
          max-height: calc(100vh - 190px) !important;
          overflow-y: auto !important;
        }

        /* Move the existing right-rail controls into the ribbon. */
        [class*="_toolRail__"] {
          position: absolute !important;
          z-index: 75 !important;
          top: -62px !important;
          right: 8px !important;
          height: 62px !important;
          width: auto !important;
          min-width: 0 !important;
          display: flex !important;
          flex-direction: row !important;
          align-items: flex-end !important;
          gap: 2px !important;
          padding: 14px 0 2px !important;
          border: 0 !important;
          background: transparent !important;
          overflow: visible !important;
        }

        [class*="_toolRail__"]::before {
          content: 'PANELS · AIDS';
          position: absolute;
          top: 2px;
          left: 4px;
          color: #5c7488;
          font-size: 8px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: .06em;
          white-space: nowrap;
        }

        [class*="_toolRail__"]::after {
          content: '';
          position: absolute;
          left: -7px;
          top: 15px;
          width: 1px;
          height: 39px;
          background: #d5e0e8;
        }

        [class*="_railButton__"],
        [class*="_railButtonActive__"] {
          width: 48px !important;
          min-width: 48px !important;
          height: 40px !important;
          min-height: 40px !important;
          padding: 3px 4px !important;
          border-radius: 6px !important;
          flex: 0 0 48px !important;
        }

        [class*="_railButton__"] span,
        [class*="_railButtonActive__"] span {
          max-width: 44px !important;
          font-size: 7px !important;
        }

        /* Empty RitsuCAD means an empty canvas. New Drawing, Import PDF,
           and Drawings in the ribbon are the only entry points. */
        [class*="emptyViewport"] {
          display: none !important;
        }

        @media (max-width: 1250px) {
          [class*="headerLeft"] { padding-left: 205px !important; }
        }

        @media (max-width: 1100px) {
          [class*="headerLeft"] { padding-left: 195px !important; }

          [class*="_inspector__"] {
            right: 8px !important;
            width: 276px !important;
            min-width: 276px !important;
            max-width: 276px !important;
          }
        }
      `}</style>

      <Suspense fallback={null}>
        <ReturnToWorkspaceButton />
      </Suspense>

      {children}

      {/* page.js currently initializes Properties as open. Close that
          default panel once after hydration; the normal ribbon button
          remains responsible for every subsequent open/close action. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (() => {
              let attempts = 0;
              const closeInitialProperties = () => {
                attempts += 1;
                const buttons = Array.from(document.querySelectorAll('button'));
                const properties = buttons.find((button) =>
                  button.textContent && button.textContent.trim() === 'Properties'
                );
                if (properties && properties.className && String(properties.className).includes('railButtonActive')) {
                  properties.click();
                  return;
                }
                if (attempts < 40) window.setTimeout(closeInitialProperties, 50);
              };
              window.setTimeout(closeInitialProperties, 0);
            })();
          `,
        }}
      />

      <Suspense fallback={null}>
        <RitsuCadProjectLauncher />
        <LocationMappingPanel />
        <TakeoffContextPanel />
        <TakeoffPersistenceBridge />
      </Suspense>
    </div>
  )
}
