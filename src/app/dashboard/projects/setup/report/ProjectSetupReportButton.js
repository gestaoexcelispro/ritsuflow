'use client'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'


const REPORT_SECTIONS = [
  {
    key: 'cover',
    label: 'Cover Page',
    group: 'Project Setup',
    defaultSelected: true,
    available: true,
  },
  {
    key: 'basicInformation',
    label: 'Project Basic Information',
    group: 'Project Setup',
    defaultSelected: true,
    available: true,
  },
  {
    key: 'scopeSummary',
    label: 'Project Scope',
    group: 'Project Setup',
    defaultSelected: true,
    available: true,
  },
  {
    key: 'locationStructure',
    label: 'Location Structure',
    group: 'Project Setup',
    defaultSelected: true,
    available: true,
  },
  {
    key: 'quantityReconciliation',
    label: 'Quantity Reconciliation',
    group: 'Project Setup',
    defaultSelected: true,
    available: true,
  },
  {
    key: 'scopeAllocationMatrix',
    label: 'Scope Allocation Matrix',
    group: 'Project Setup',
    defaultSelected: true,
    available: true,
  },
  {
    key: 'quantificationByLocation',
    label: 'Quantification by Location',
    group: 'Project Setup',
    defaultSelected: true,
    available: true,
  },
  {
    key: 'productionParameters',
    label: 'Production Parameters',
    group: 'Project Setup',
    defaultSelected: true,
    available: true,
  },
  {
    key: 'prePlanning',
    label: 'Pre-Planning',
    group: 'Planning & Control',
    defaultSelected: false,
    available: false,
  },
  {
    key: 'masterPlan',
    label: 'Master Plan',
    group: 'Planning & Control',
    defaultSelected: false,
    available: false,
  },
  {
    key: 'lookaheadPlanning',
    label: 'Lookahead Planning',
    group: 'Planning & Control',
    defaultSelected: false,
    available: false,
  },
  {
    key: 'weeklyPlanning',
    label: 'Weekly Planning',
    group: 'Planning & Control',
    defaultSelected: false,
    available: false,
  },
  {
    key: 'constraintLog',
    label: 'Constraint Log',
    group: 'Planning & Control',
    defaultSelected: false,
    available: false,
  },
]


function buildInitialSections() {
  return REPORT_SECTIONS.reduce(
    (
      current,
      section
    ) => ({
      ...current,
      [section.key]:
        section.defaultSelected === true,
    }),
    {}
  )
}


function readProjectIdFromWindow() {

  if (
    typeof window ===
    'undefined'
  ) {
    return null
  }


  const params =
    new URLSearchParams(
      window.location.search
    )


  return params.get(
    'projectId'
  )

}


export default function ProjectSetupReportButton() {

  const [
    projectId,
    setProjectId,
  ] =
    useState(null)


  const [
    isOpen,
    setIsOpen,
  ] =
    useState(false)


  const [
    reportTitle,
    setReportTitle,
  ] =
    useState(
      'Project Setup Report'
    )


  const [
    sections,
    setSections,
  ] =
    useState(
      buildInitialSections
    )


  const [
    isGenerating,
    setIsGenerating,
  ] =
    useState(false)


  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState('')


  useEffect(
    () => {

      function syncProjectId() {

        setProjectId(
          readProjectIdFromWindow()
        )

      }


      syncProjectId()


      window.addEventListener(
        'popstate',
        syncProjectId
      )


      return () => {

        window.removeEventListener(
          'popstate',
          syncProjectId
        )

      }

    },
    []
  )


  const selectedCount =
    useMemo(
      () =>
        Object.values(
          sections
        ).filter(
          Boolean
        ).length,
      [
        sections,
      ]
    )


  const availableSections =
    useMemo(
      () =>
        REPORT_SECTIONS.filter(
          (
            section
          ) =>
            section.available !==
            false
        ),
      []
    )


  const allSelected =
    availableSections.every(
      (
        section
      ) =>
        sections[
          section.key
        ] === true
    )


  if (
    !projectId
  ) {
    return null
  }


  function openModal() {

    setErrorMessage(
      ''
    )


    setIsOpen(
      true
    )

  }


  function closeModal() {

    if (
      isGenerating
    ) {
      return
    }


    setErrorMessage(
      ''
    )


    setIsOpen(
      false
    )

  }


  function toggleSection(
    key
  ) {

    const section =
      REPORT_SECTIONS.find(
        (
          item
        ) =>
          item.key ===
          key
      )


    if (
      !section ||
      section.available ===
        false
    ) {
      return
    }


    setSections(
      (
        current
      ) => ({
        ...current,
        [key]:
          !current[
            key
          ],
      })
    )

  }


  function selectAll() {

    setSections(
      REPORT_SECTIONS.reduce(
        (
          current,
          section
        ) => ({
          ...current,
          [section.key]:
            section.available !==
            false,
        }),
        {}
      )
    )

  }


  function clearAll() {

    setSections(
      REPORT_SECTIONS.reduce(
        (
          current,
          section
        ) => ({
          ...current,
          [section.key]:
            false,
        }),
        {}
      )
    )

  }


  async function generateReport() {

    if (
      selectedCount ===
      0
    ) {

      setErrorMessage(
        'Select at least one report section.'
      )


      return

    }


    setIsGenerating(
      true
    )


    setErrorMessage(
      ''
    )


    try {

      const response =
        await fetch(
          `/api/projects/${projectId}/setup-report`,
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify(
                {
                  reportTitle:
                    reportTitle
                      .trim() ||
                    'Project Setup Report',

                  sections,
                }
              ),
          }
        )


      if (
        !response.ok
      ) {

        let message =
          'The Project Setup report could not be generated.'


        try {

          const payload =
            await response.json()


          if (
            payload?.error
          ) {
            message =
              payload.error
          }

        } catch {

          // Keep the default message.

        }


        throw new Error(
          message
        )

      }


      const blob =
        await response.blob()


      const objectUrl =
        window.URL.createObjectURL(
          blob
        )


      let fileName =
        'RitsuFlow-Project-Setup-Report.pdf'


      const contentDisposition =
        response.headers.get(
          'content-disposition'
        )


      if (
        contentDisposition
      ) {

        const fileNameMatch =
          contentDisposition.match(
            /filename="?([^"]+)"?/i
          )


        if (
          fileNameMatch?.[1]
        ) {
          fileName =
            fileNameMatch[1]
        }

      }


      const link =
        document.createElement(
          'a'
        )


      link.href =
        objectUrl


      link.download =
        fileName


      document.body.appendChild(
        link
      )


      link.click()


      link.remove()


      window.URL.revokeObjectURL(
        objectUrl
      )


      setIsOpen(
        false
      )

    } catch (error) {

      console.error(
        'Project Setup report generation failed.',
        error
      )


      setErrorMessage(
        error?.message ||
        'The Project Setup report could not be generated.'
      )

    } finally {

      setIsGenerating(
        false
      )

    }

  }


  return (

    <>

      <button
        type="button"
        onClick={
          openModal
        }
        style={{

          display:
            'inline-flex',

          alignItems:
            'center',

          justifyContent:
            'center',

          minHeight:
            '38px',

          boxSizing:
            'border-box',

          padding:
            '0 12px',

          border:
            '1px solid #99e6dc',

          borderRadius:
            '8px',

          background:
            '#effcf9',

          color:
            '#087f73',

          font:
            'inherit',

          fontSize:
            '12px',

          lineHeight:
            1,

          fontWeight:
            800,

          cursor:
            'pointer',

          whiteSpace:
            'nowrap',

          flexShrink:
            0,

        }}
      >

        Generate Report

      </button>


      {isOpen && (

        <div
          role="presentation"
          onMouseDown={
            (
              event
            ) => {

              if (
                event.target ===
                event.currentTarget
              ) {
                closeModal()
              }

            }
          }
          style={{

            position:
              'fixed',

            inset:
              0,

            zIndex:
              10000,

            display:
              'flex',

            alignItems:
              'center',

            justifyContent:
              'center',

            padding:
              '24px',

            background:
              'rgba(15, 23, 42, 0.48)',

          }}
        >

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-setup-report-title"
            style={{

              width:
                'min(620px, 100%)',

              maxHeight:
                'calc(100vh - 48px)',

              overflowY:
                'auto',

              border:
                '1px solid #dce5ed',

              borderRadius:
                '14px',

              background:
                '#ffffff',

              boxShadow:
                '0 24px 70px rgba(15, 23, 42, 0.24)',

            }}
          >

            <div
              style={{

                display:
                  'flex',

                alignItems:
                  'flex-start',

                justifyContent:
                  'space-between',

                gap:
                  '20px',

                padding:
                  '22px 24px 18px',

                borderBottom:
                  '1px solid #e6edf2',

              }}
            >

              <div>

                <h2
                  id="project-setup-report-title"
                  style={{

                    margin:
                      0,

                    color:
                      '#0f172a',

                    fontSize:
                      '20px',

                    lineHeight:
                      1.2,

                    fontWeight:
                      900,

                  }}
                >

                  Generate Project Setup Report

                </h2>


                <p
                  style={{

                    margin:
                      '7px 0 0',

                    color:
                      '#64748b',

                    fontSize:
                      '13px',

                    lineHeight:
                      1.45,

                  }}
                >

                  Choose the sections to include in the PDF.

                </p>

              </div>


              <button
                type="button"
                onClick={
                  closeModal
                }
                disabled={
                  isGenerating
                }
                aria-label="Close report dialog"
                style={{

                  display:
                    'inline-flex',

                  alignItems:
                    'center',

                  justifyContent:
                    'center',

                  width:
                    '34px',

                  height:
                    '34px',

                  border:
                    '1px solid #dce5ed',

                  borderRadius:
                    '8px',

                  background:
                    '#ffffff',

                  color:
                    '#52677d',

                  font:
                    'inherit',

                  fontSize:
                    '18px',

                  lineHeight:
                    1,

                  cursor:
                    isGenerating
                      ? 'not-allowed'
                      : 'pointer',

                  flexShrink:
                    0,

                }}
              >

                ×

              </button>

            </div>


            <div
              style={{
                padding:
                  '20px 24px 22px',
              }}
            >

              <label
                htmlFor="project-setup-report-name"
                style={{

                  display:
                    'block',

                  marginBottom:
                    '7px',

                  color:
                    '#334155',

                  fontSize:
                    '12px',

                  fontWeight:
                    800,

                }}
              >

                Report title

              </label>


              <input
                id="project-setup-report-name"
                type="text"
                value={
                  reportTitle
                }
                onChange={
                  (
                    event
                  ) =>
                    setReportTitle(
                      event.target.value
                    )
                }
                maxLength={
                  120
                }
                disabled={
                  isGenerating
                }
                style={{

                  width:
                    '100%',

                  minHeight:
                    '42px',

                  boxSizing:
                    'border-box',

                  padding:
                    '0 12px',

                  border:
                    '1px solid #cfdbe5',

                  borderRadius:
                    '8px',

                  outline:
                    'none',

                  background:
                    '#ffffff',

                  color:
                    '#0f172a',

                  font:
                    'inherit',

                  fontSize:
                    '13px',

                }}
              />


              <div
                style={{

                  display:
                    'flex',

                  alignItems:
                    'center',

                  justifyContent:
                    'space-between',

                  gap:
                    '12px',

                  marginTop:
                    '22px',

                  marginBottom:
                    '10px',

                }}
              >

                <div
                  style={{

                    color:
                      '#334155',

                    fontSize:
                      '12px',

                    fontWeight:
                      800,

                  }}
                >

                  Report sections

                </div>


                <div
                  style={{

                    display:
                      'flex',

                    alignItems:
                      'center',

                    gap:
                      '8px',

                  }}
                >

                  <button
                    type="button"
                    onClick={
                      selectAll
                    }
                    disabled={
                      isGenerating ||
                      allSelected
                    }
                    style={{

                      border:
                        0,

                      background:
                        'transparent',

                      color:
                        '#087f73',

                      font:
                        'inherit',

                      fontSize:
                        '12px',

                      fontWeight:
                        800,

                      cursor:
                        isGenerating ||
                        allSelected
                          ? 'default'
                          : 'pointer',

                      opacity:
                        allSelected
                          ? 0.55
                          : 1,

                    }}
                  >

                    Select All

                  </button>


                  <span
                    aria-hidden="true"
                    style={{
                      color:
                        '#c5d0d9',
                    }}
                  >
                    |
                  </span>


                  <button
                    type="button"
                    onClick={
                      clearAll
                    }
                    disabled={
                      isGenerating ||
                      selectedCount ===
                        0
                    }
                    style={{

                      border:
                        0,

                      background:
                        'transparent',

                      color:
                        '#64748b',

                      font:
                        'inherit',

                      fontSize:
                        '12px',

                      fontWeight:
                        800,

                      cursor:
                        isGenerating ||
                        selectedCount ===
                          0
                          ? 'default'
                          : 'pointer',

                      opacity:
                        selectedCount ===
                          0
                          ? 0.55
                          : 1,

                    }}
                  >

                    Clear All

                  </button>

                </div>

              </div>


              {[
                'Project Setup',
                'Planning & Control',
              ].map(
                (
                  groupName
                ) => {

                  const groupSections =
                    REPORT_SECTIONS.filter(
                      (
                        section
                      ) =>
                        section.group ===
                        groupName
                    )


                  return (

                    <div
                      key={
                        groupName
                      }
                      style={{
                        marginTop:
                          groupName ===
                          'Project Setup'
                            ? 0
                            : '18px',
                      }}
                    >

                      <div
                        style={{
                          marginBottom:
                            '8px',

                          color:
                            '#64748b',

                          fontSize:
                            '11px',

                          fontWeight:
                            900,

                          letterSpacing:
                            '0.06em',

                          textTransform:
                            'uppercase',
                        }}
                      >
                        {
                          groupName
                        }
                      </div>


                      <div
                        style={{

                          display:
                            'grid',

                          gridTemplateColumns:
                            'repeat(2, minmax(0, 1fr))',

                          gap:
                            '8px',

                        }}
                      >

                        {groupSections.map(
                          (
                            section
                          ) => {

                            const available =
                              section.available !==
                              false


                            return (

                              <label
                                key={
                                  section.key
                                }
                                style={{

                                  display:
                                    'flex',

                                  alignItems:
                                    'center',

                                  gap:
                                    '10px',

                                  minHeight:
                                    '44px',

                                  padding:
                                    '0 12px',

                                  border:
                                    sections[
                                      section.key
                                    ] &&
                                    available
                                      ? '1px solid #99e6dc'
                                      : '1px solid #dce5ed',

                                  borderRadius:
                                    '8px',

                                  background:
                                    sections[
                                      section.key
                                    ] &&
                                    available
                                      ? '#f3fcfa'
                                      : available
                                        ? '#ffffff'
                                        : '#f8fafc',

                                  color:
                                    available
                                      ? '#334155'
                                      : '#94a3b8',

                                  fontSize:
                                    '12px',

                                  fontWeight:
                                    700,

                                  cursor:
                                    isGenerating ||
                                    !available
                                      ? 'default'
                                      : 'pointer',

                                  opacity:
                                    available
                                      ? 1
                                      : 0.78,

                                }}
                              >

                                <input
                                  type="checkbox"
                                  checked={
                                    sections[
                                      section.key
                                    ] === true
                                  }
                                  disabled={
                                    isGenerating ||
                                    !available
                                  }
                                  onChange={() =>
                                    toggleSection(
                                      section.key
                                    )
                                  }
                                  style={{
                                    width:
                                      '16px',

                                    height:
                                      '16px',

                                    accentColor:
                                      '#00998b',

                                    flexShrink:
                                      0,
                                  }}
                                />


                                <span
                                  style={{
                                    display:
                                      'flex',

                                    alignItems:
                                      'center',

                                    justifyContent:
                                      'space-between',

                                    gap:
                                      '8px',

                                    width:
                                      '100%',
                                  }}
                                >
                                  <span>
                                    {
                                      section.label
                                    }
                                  </span>


                                  {!available && (

                                    <span
                                      style={{
                                        padding:
                                          '2px 6px',

                                        borderRadius:
                                          '999px',

                                        background:
                                          '#eef2f6',

                                        color:
                                          '#64748b',

                                        fontSize:
                                          '9px',

                                        fontWeight:
                                          900,

                                        whiteSpace:
                                          'nowrap',
                                      }}
                                    >
                                      NEXT
                                    </span>

                                  )}

                                </span>

                              </label>

                            )

                          }
                        )}

                      </div>

                    </div>

                  )

                }
              )}


              {errorMessage && (

                <div
                  role="alert"
                  style={{

                    marginTop:
                      '14px',

                    padding:
                      '10px 12px',

                    border:
                      '1px solid #fecaca',

                    borderRadius:
                      '8px',

                    background:
                      '#fef2f2',

                    color:
                      '#b42318',

                    fontSize:
                      '12px',

                    lineHeight:
                      1.4,

                    fontWeight:
                      700,

                  }}
                >

                  {
                    errorMessage
                  }

                </div>

              )}


              <div
                style={{

                  display:
                    'flex',

                  alignItems:
                    'center',

                  justifyContent:
                    'space-between',

                  gap:
                    '12px',

                  marginTop:
                    '22px',

                  paddingTop:
                    '18px',

                  borderTop:
                    '1px solid #e6edf2',

                }}
              >

                <div
                  style={{

                    color:
                      '#64748b',

                    fontSize:
                      '12px',

                  }}
                >

                  {selectedCount} of {availableSections.length} available sections selected

                </div>


                <div
                  style={{

                    display:
                      'flex',

                    alignItems:
                      'center',

                    gap:
                      '8px',

                  }}
                >

                  <button
                    type="button"
                    onClick={
                      closeModal
                    }
                    disabled={
                      isGenerating
                    }
                    style={{

                      minHeight:
                        '38px',

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

                      font:
                        'inherit',

                      fontSize:
                        '12px',

                      fontWeight:
                        800,

                      cursor:
                        isGenerating
                          ? 'not-allowed'
                          : 'pointer',

                    }}
                  >

                    Cancel

                  </button>


                  <button
                    type="button"
                    onClick={
                      generateReport
                    }
                    disabled={
                      isGenerating ||
                      selectedCount ===
                        0
                    }
                    style={{

                      minHeight:
                        '38px',

                      padding:
                        '0 15px',

                      border:
                        '1px solid #052c49',

                      borderRadius:
                        '8px',

                      background:
                        isGenerating ||
                        selectedCount ===
                          0
                          ? '#94a3b8'
                          : '#052c49',

                      color:
                        '#ffffff',

                      font:
                        'inherit',

                      fontSize:
                        '12px',

                      fontWeight:
                        800,

                      cursor:
                        isGenerating ||
                        selectedCount ===
                          0
                          ? 'not-allowed'
                          : 'pointer',

                      whiteSpace:
                        'nowrap',

                    }}
                  >

                    {isGenerating
                      ? 'Generating...'
                      : 'Generate PDF'}

                  </button>

                </div>

              </div>

            </div>

          </div>

        </div>

      )}

    </>

  )

}
