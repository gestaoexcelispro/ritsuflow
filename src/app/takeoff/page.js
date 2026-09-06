'use client'

import Link from 'next/link'

import TakeoffWorkspace from '../dashboard/takeoff/page'


function BackIcon() {

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  )

}


function TakeoffIcon() {

  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 3h10l4 4v14H5z" />
      <path d="M15 3v5h4" />
      <path d="M8 17l3-4 2 2 4-6" />
    </svg>
  )

}


export default function StandaloneTakeoffPage() {

  return (

    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100vh',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        background: '#dfe6ec',
      }}
    >

      {/* ======================================================
          TAKEOFF APPLICATION HEADER
      ====================================================== */}

      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          height: '48px',
          minHeight: '48px',
          padding: '0 12px',
          borderBottom: '1px solid #cdd8e2',
          background: '#ffffff',
          boxSizing: 'border-box',
          zIndex: 100,
        }}
      >

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            minWidth: 0,
          }}
        >

          <Link
            href="/dashboard"
            title="Return to RitsuFlow"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              minHeight: '32px',
              padding: '0 10px',
              border: '1px solid #d1dce5',
              borderRadius: '7px',
              background: '#ffffff',
              color: '#425a70',
              fontSize: '12px',
              fontWeight: 800,
              textDecoration: 'none',
            }}
          >
            <BackIcon />

            <span>
              RitsuFlow
            </span>
          </Link>


          <div
            style={{
              width: '1px',
              height: '26px',
              background: '#dce5ed',
            }}
          />


          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: 0,
            }}
          >

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                flexShrink: 0,
                borderRadius: '7px',
                background: '#052c49',
                color: '#ffffff',
              }}
            >
              <TakeoffIcon />
            </span>


            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
              }}
            >

              <strong
                style={{
                  color: '#0f172a',
                  fontSize: '13px',
                  lineHeight: 1.1,
                  fontWeight: 900,
                }}
              >
                Takeoff
              </strong>

              <span
                style={{
                  marginTop: '2px',
                  color: '#7b8da0',
                  fontSize: '9px',
                  lineHeight: 1,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Drawing Workspace
              </span>

            </div>

          </div>

        </div>


        <span
          style={{
            color: '#64748b',
            fontSize: '11px',
            fontWeight: 800,
          }}
        >
          CAD Takeoff Prototype
        </span>


        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '28px',
            padding: '0 9px',
            border: '1px solid #99e6dc',
            borderRadius: '999px',
            background: '#effcf9',
            color: '#087f73',
            fontSize: '9px',
            fontWeight: 900,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          RitsuFlow
        </span>

      </header>


      {/* ======================================================
          EXISTING CAD WORKSPACE
          Temporary bridge during migration.
      ====================================================== */}

      <main
        style={{
          flex: '1 1 auto',
          width: '100%',
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <TakeoffWorkspace />
      </main>

    </div>

  )

}
