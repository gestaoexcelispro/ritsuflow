'use client'

export default function RitsuCadLegacyShellCleanup() {
  return (
    <style>{`
      /* RitsuCAD desktop shell: the legacy left toolbar/sidebar is retired.
         Keep the native toolbar in the DOM because bridge components reuse its
         actions, but never allow it to participate in desktop layout. */
      [data-ritsucad-approved-shell="true"],
      [class*="cadToolbar"] {
        display: none !important;
        width: 0 !important;
        min-width: 0 !important;
        max-width: 0 !important;
        height: 0 !important;
        min-height: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
        border: 0 !important;
        overflow: hidden !important;
      }

      /* The CAD viewport must remain a clean drafting surface when no drawing
         is loaded. Drawing creation/import commands belong in the ribbon, so
         the legacy centered empty-state card is intentionally suppressed. */
      [class*="emptyViewport"] {
        display: none !important;
      }

      /* RitsuCadRibbonBridge previously converted the application into a
         290px + canvas grid. Force the desktop workspace back to one column. */
      [class*="application"]:has([data-ritsucad-approved-shell="true"]) {
        grid-template-columns: minmax(0, 1fr) !important;
      }

      [class*="application"]:has([data-ritsucad-approved-shell="true"]) > [class*="applicationHeader"] {
        grid-column: 1 !important;
      }

      [class*="application"]:has([data-ritsucad-approved-shell="true"]) > [class*="cadArea"] {
        grid-column: 1 !important;
        width: 100% !important;
        min-width: 0 !important;
      }
    `}</style>
  )
}
