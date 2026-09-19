export default function ScopeManagementLayout({ children }) {
  return (
    <>
      <style>{`
        /*
         * RitsuFlow canonical standalone header.
         * Keep Scope Management aligned with the Projects UI standard.
         */
        main > header {
          height: 68px !important;
          min-height: 68px !important;
          max-height: 68px !important;
          padding-left: 28px !important;
          padding-right: 28px !important;
          box-sizing: border-box !important;
        }

        main > header > a:first-child {
          width: 210px !important;
          height: 68px !important;
          box-sizing: border-box !important;
          align-items: center !important;
        }

        main > header > a:first-child img {
          width: 132px !important;
          height: auto !important;
        }

        main > header > a:not(:first-child) {
          height: 38px !important;
          min-height: 38px !important;
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          box-sizing: border-box !important;
          white-space: nowrap !important;
        }
      `}</style>
      {children}
    </>
  )
}
