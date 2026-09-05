'use client'

import Link from 'next/link'

const stateSymbols = {
  complete: '✓',
  incomplete: '!',
  pending: '○',
}

export default function ProjectSetupToolbar({
  projectId,
  activeSection,
  sections,
  sectionStates,
  showSave = false,
  formId = null,
}) {
  return (
    <div
      style={{
        position: 'sticky',
        top: '81px',
        zIndex: 900,

        width: '100%',
        boxSizing: 'border-box',

        margin: '0 0 28px',

        border: '1px solid #dce5ed',
        borderRadius: '0',

        background:
          'rgba(255, 255, 255, 0.98)',

        boxShadow:
          '0 8px 24px rgba(15, 23, 42, 0.06)',

        backdropFilter:
          'blur(14px)',

        WebkitBackdropFilter:
          'blur(14px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent:
            'space-between',

          gap: '18px',

          width: '100%',
          minHeight: '72px',

          boxSizing: 'border-box',

          padding:
            '12px 20px',
        }}
      >
        <nav
          aria-label="Project setup sections"
          style={{
            display: 'flex',
            alignItems: 'center',

            flex: '1 1 auto',
            minWidth: 0,

            gap: '4px',

            overflowX: 'auto',
            overflowY: 'hidden',

            scrollbarWidth: 'none',

            msOverflowStyle:
              'none',
          }}
        >
          {sections.map(
            (section) => {
              const isActive =
                activeSection ===
                section.id

              const state =
                sectionStates[
                  section.id
                ] || 'pending'

              return (
                <Link
                  key={
                    section.id
                  }
                  href={`/dashboard/projects/setup?projectId=${projectId}&section=${section.id}`}
                  aria-current={
                    isActive
                      ? 'page'
                      : undefined
                  }
                  style={{
                    position:
                      'relative',

                    display:
                      'inline-flex',

                    alignItems:
                      'center',

                    flexShrink: 0,

                    minHeight:
                      '40px',

                    gap: '8px',

                    padding:
                      '0 13px',

                    borderRadius:
                      '8px',

                    background:
                      isActive
                        ? '#edfbf8'
                        : 'transparent',

                    color:
                      isActive
                        ? '#075f57'
                        : '#52677d',

                    fontSize:
                      '0.78rem',

                    fontWeight:
                      800,

                    textDecoration:
                      'none',

                    whiteSpace:
                      'nowrap',

                    transition:
                      'background 150ms ease, color 150ms ease',
                  }}
                >
                  <span
                    style={{
                      display:
                        'inline-flex',

                      width:
                        '22px',

                      height:
                        '22px',

                      flexShrink:
                        0,

                      alignItems:
                        'center',

                      justifyContent:
                        'center',

                      borderRadius:
                        '6px',

                      background:
                        isActive
                          ? '#0aa99b'
                          : '#f0f4f7',

                      color:
                        isActive
                          ? '#ffffff'
                          : '#607086',

                      fontSize:
                        '0.64rem',

                      fontWeight:
                        900,
                    }}
                  >
                    {
                      section.number
                    }
                  </span>

                  <span>
                    {
                      section.label
                    }
                  </span>

                  <span
                    style={{
                      display:
                        'inline-flex',

                      width:
                        '19px',

                      height:
                        '19px',

                      flexShrink:
                        0,

                      alignItems:
                        'center',

                      justifyContent:
                        'center',

                      border:
                        state ===
                        'complete'
                          ? '1px solid #b7eee6'
                          : state ===
                              'incomplete'
                            ? '1px solid #f5d99c'
                            : '1px solid #d7e0e8',

                      borderRadius:
                        '999px',

                      background:
                        state ===
                        'complete'
                          ? '#effcf9'
                          : state ===
                              'incomplete'
                            ? '#fff9e8'
                            : '#ffffff',

                      color:
                        state ===
                        'complete'
                          ? '#087f73'
                          : state ===
                              'incomplete'
                            ? '#946200'
                            : '#9aa7b6',

                      fontSize:
                        '0.62rem',

                      fontWeight:
                        900,
                    }}
                  >
                    {
                      stateSymbols[
                        state
                      ]
                    }
                  </span>

                  {isActive && (
                    <span
                      aria-hidden="true"
                      style={{
                        position:
                          'absolute',

                        right:
                          '8px',

                        bottom:
                          '-16px',

                        left:
                          '8px',

                        height:
                          '3px',

                        borderRadius:
                          '999px 999px 0 0',

                        background:
                          '#0aa99b',
                      }}
                    />
                  )}
                </Link>
              )
            }
          )}
        </nav>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,

            gap: '8px',
          }}
        >
          <Link
            href="/dashboard/projects/setup"
            style={{
              display:
                'inline-flex',

              minHeight:
                '40px',

              alignItems:
                'center',

              justifyContent:
                'center',

              padding:
                '0 14px',

              border:
                '1px solid #d1dce5',

              borderRadius:
                '8px',

              background:
                '#ffffff',

              color:
                '#425a70',

              fontSize:
                '0.78rem',

              fontWeight:
                800,

              textDecoration:
                'none',

              whiteSpace:
                'nowrap',

              transition:
                'border-color 150ms ease, background 150ms ease',
            }}
          >
            Change Project
          </Link>

          {showSave &&
            formId && (
              <button
                type="submit"
                form={
                  formId
                }
                style={{
                  display:
                    'inline-flex',

                  minHeight:
                    '40px',

                  alignItems:
                    'center',

                  justifyContent:
                    'center',

                  padding:
                    '0 16px',

                  border:
                    '1px solid #052c49',

                  borderRadius:
                    '8px',

                  background:
                    '#052c49',

                  color:
                    '#ffffff',

                  font:
                    'inherit',

                  fontSize:
                    '0.78rem',

                  fontWeight:
                    800,

                  cursor:
                    'pointer',

                  whiteSpace:
                    'nowrap',

                  transition:
                    'background 150ms ease, border-color 150ms ease',
                }}
              >
                Save Changes
              </button>
            )}
        </div>
      </div>
    </div>
  )
}
