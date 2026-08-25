'use client'

import {
  useMemo,
  useState,
} from 'react'

import {
  useRouter,
} from 'next/navigation'


const moduleOptions = [
  {
    key: 'project_setup',
    label: 'Project Setup',
    description:
      'Project creation, setup and location structure.',
  },
  {
    key: 'planning',
    label: 'Planning',
    description:
      'Master Plan, Lookahead and Weekly Planning.',
  },
  {
    key: 'daily_reports',
    label: 'Daily Reports',
    description:
      'Field reporting and productivity tracking.',
  },
  {
    key: 'workforce',
    label: 'Workforce',
    description:
      'Attendance, check-in/out and workforce control.',
  },
  {
    key: 'production_control',
    label: 'Production Control',
    description:
      'Production Map, Status Matrix and control tools.',
  },
]


function createSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /[^a-z0-9]+/g,
      '-'
    )
    .replace(
      /^-+|-+$/g,
      ''
    )
}


function todayValue() {
  const now =
    new Date()

  const year =
    now.getFullYear()

  const month =
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      '0'
    )

  const day =
    String(
      now.getDate()
    ).padStart(
      2,
      '0'
    )

  return `${year}-${month}-${day}`
}


function getInitialForm() {
  return {
    organizationName: '',
    organizationSlug: '',

    planCode: 'standard',
    seatLimit: 10,
    licenseStatus: 'active',

    startsAt:
      todayValue(),

    expiresAt: '',

    moduleKeys: [
      'project_setup',
      'planning',
      'daily_reports',
      'workforce',
      'production_control',
    ],

    primaryAdminName: '',
    primaryAdminEmail: '',
  }
}


export default function AddOrganizationClient() {
  const router =
    useRouter()

  const [
    isOpen,
    setIsOpen,
  ] =
    useState(false)

  const [
    isSaving,
    setIsSaving,
  ] =
    useState(false)

  const [
    form,
    setForm,
  ] =
    useState(
      getInitialForm()
    )

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState('')

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState('')


  const selectedModuleCount =
    useMemo(
      () =>
        form.moduleKeys.length,
      [
        form.moduleKeys,
      ]
    )


  function openModal() {
    setErrorMessage('')
    setSuccessMessage('')

    setForm(
      getInitialForm()
    )

    setIsOpen(true)
  }


  function closeModal() {
    if (
      isSaving
    ) {
      return
    }

    setIsOpen(false)
    setErrorMessage('')
  }


  function updateForm(
    field,
    value
  ) {
    setForm(
      (current) => {
        const next = {
          ...current,
          [field]: value,
        }

        if (
          field ===
          'organizationName'
        ) {
          next.organizationSlug =
            createSlug(
              value
            )
        }

        return next
      }
    )
  }


  function toggleModule(
    moduleKey
  ) {
    setForm(
      (current) => {
        const selected =
          new Set(
            current.moduleKeys
          )

        if (
          selected.has(
            moduleKey
          )
        ) {
          selected.delete(
            moduleKey
          )
        } else {
          selected.add(
            moduleKey
          )
        }

        return {
          ...current,

          moduleKeys:
            Array.from(
              selected
            ),
        }
      }
    )
  }


  function validateForm() {
    if (
      !form.organizationName
        .trim()
    ) {
      return (
        'Company name is required.'
      )
    }

    if (
      !form.organizationSlug
        .trim()
    ) {
      return (
        'Organization slug is required.'
      )
    }

    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
        form.organizationSlug
      )
    ) {
      return (
        'Organization slug is invalid.'
      )
    }

    const seatLimit =
      Number(
        form.seatLimit
      )

    if (
      !Number.isInteger(
        seatLimit
      ) ||
      seatLimit < 1
    ) {
      return (
        'Seat limit must be at least 1.'
      )
    }

    if (
      !form.startsAt
    ) {
      return (
        'License start date is required.'
      )
    }

    if (
      form.expiresAt &&
      form.expiresAt <
        form.startsAt
    ) {
      return (
        'Expiration date cannot be before the start date.'
      )
    }

    if (
      !form.primaryAdminName
        .trim()
    ) {
      return (
        'Primary Admin name is required.'
      )
    }

    if (
      !form.primaryAdminEmail
        .trim()
    ) {
      return (
        'Primary Admin email is required.'
      )
    }

    if (
      !form.primaryAdminEmail
        .includes('@')
    ) {
      return (
        'Enter a valid Primary Admin email.'
      )
    }

    return null
  }


  async function handleSubmit(
    event
  ) {
    event.preventDefault()

    setErrorMessage('')
    setSuccessMessage('')

    const validationError =
      validateForm()

    if (
      validationError
    ) {
      setErrorMessage(
        validationError
      )

      return
    }

    setIsSaving(true)

    try {
      const response =
        await fetch(
          '/api/platform/organizations/create',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                organizationName:
                  form.organizationName
                    .trim(),

                organizationSlug:
                  form.organizationSlug
                    .trim(),

                planCode:
                  form.planCode,

                seatLimit:
                  Number(
                    form.seatLimit
                  ),

                licenseStatus:
                  form.licenseStatus,

                startsAt:
                  form.startsAt,

                expiresAt:
                  form.expiresAt ||
                  null,

                moduleKeys:
                  form.moduleKeys,

                primaryAdminName:
                  form.primaryAdminName
                    .trim(),

                primaryAdminEmail:
                  form.primaryAdminEmail
                    .trim()
                    .toLowerCase(),
              }),
          }
        )

      const payload =
        await response.json()

      if (
        !response.ok
      ) {
        throw new Error(
          payload?.error ||
          'Organization could not be created.'
        )
      }

      setSuccessMessage(
        `${payload.organization?.name || 'Organization'} created successfully.`
      )

      setIsOpen(false)

      router.refresh()

    } catch (error) {
      console.error(
        'Organization provisioning failed.',
        error
      )

      setErrorMessage(
        error?.message ||
        'Organization could not be created.'
      )

    } finally {
      setIsSaving(false)
    }
  }


  return (
    <>
      <div
        style={{
          display:
            'flex',
          flexDirection:
            'column',
          alignItems:
            'flex-end',
          gap:
            '8px',
        }}
      >
        <button
          type="button"
          onClick={
            openModal
          }
          style={{
            padding:
              '12px 18px',
            border: 0,
            borderRadius:
              '8px',
            background:
              '#062b54',
            color:
              '#ffffff',
            fontSize:
              '0.95rem',
            fontWeight:
              700,
            cursor:
              'pointer',
          }}
        >
          + Add Organization
        </button>

        {successMessage && (
          <span
            style={{
              color:
                '#166534',
              fontSize:
                '0.82rem',
              fontWeight:
                700,
            }}
          >
            {successMessage}
          </span>
        )}
      </div>


      {isOpen && (
        <div
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
            inset: 0,
            zIndex: 2000,
            display:
              'grid',
            placeItems:
              'center',
            padding:
              '24px',
            background:
              'rgba(2, 15, 31, 0.58)',
            backdropFilter:
              'blur(3px)',
          }}
        >
          <form
            onSubmit={
              handleSubmit
            }
            style={{
              width:
                'min(820px, 100%)',
              maxHeight:
                'calc(100vh - 48px)',
              overflowY:
                'auto',
              padding:
                '24px',
              border:
                '1px solid #e2e8f0',
              borderRadius:
                '14px',
              background:
                '#ffffff',
              boxShadow:
                '0 24px 60px rgba(15, 23, 42, 0.24)',
            }}
          >
            {/* ============================================
                HEADER
            ============================================ */}

            <div
              style={{
                display:
                  'flex',
                justifyContent:
                  'space-between',
                alignItems:
                  'flex-start',
                gap:
                  '20px',
                paddingBottom:
                  '18px',
                borderBottom:
                  '1px solid #e2e8f0',
              }}
            >
              <div>
                <p
                  style={{
                    margin:
                      '0 0 6px',
                    color:
                      '#64748b',
                    fontSize:
                      '0.72rem',
                    fontWeight:
                      800,
                    letterSpacing:
                      '0.1em',
                  }}
                >
                  PLATFORM PROVISIONING
                </p>

                <h2
                  style={{
                    margin: 0,
                    color:
                      '#071b33',
                    fontSize:
                      '1.35rem',
                  }}
                >
                  Add Organization
                </h2>

                <p
                  style={{
                    margin:
                      '8px 0 0',
                    color:
                      '#64748b',
                    fontSize:
                      '0.86rem',
                    lineHeight:
                      1.5,
                  }}
                >
                  Create a new
                  RitsuFlow customer
                  tenant, license and
                  Primary Admin.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeModal
                }
                disabled={
                  isSaving
                }
                aria-label="Close"
                style={{
                  display:
                    'grid',
                  width:
                    '34px',
                  height:
                    '34px',
                  flex:
                    '0 0 34px',
                  placeItems:
                    'center',
                  border:
                    '1px solid #e2e8f0',
                  borderRadius:
                    '8px',
                  background:
                    '#ffffff',
                  color:
                    '#64748b',
                  fontSize:
                    '1.2rem',
                  cursor:
                    isSaving
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                ×
              </button>
            </div>


            {/* ============================================
                COMPANY
            ============================================ */}

            <section
              style={{
                padding:
                  '20px 0',
              }}
            >
              <h3
                style={{
                  margin:
                    '0 0 4px',
                  color:
                    '#0f172a',
                  fontSize:
                    '0.95rem',
                }}
              >
                Company
              </h3>

              <p
                style={{
                  margin:
                    '0 0 14px',
                  color:
                    '#64748b',
                  fontSize:
                    '0.76rem',
                }}
              >
                Customer organization
                identity.
              </p>

              <div
                style={{
                  display:
                    'grid',
                  gridTemplateColumns:
                    'repeat(2, minmax(0, 1fr))',
                  gap:
                    '14px',
                }}
              >
                <label
                  style={{
                    display:
                      'flex',
                    flexDirection:
                      'column',
                    gap:
                      '7px',
                    color:
                      '#334155',
                    fontSize:
                      '0.75rem',
                    fontWeight:
                      800,
                  }}
                >
                  Company Name

                  <input
                    value={
                      form.organizationName
                    }
                    onChange={
                      (
                        event
                      ) =>
                        updateForm(
                          'organizationName',
                          event.target
                            .value
                        )
                    }
                    placeholder="ABC Construction"
                    disabled={
                      isSaving
                    }
                    style={{
                      minHeight:
                        '42px',
                      padding:
                        '0 11px',
                      border:
                        '1px solid #cbd5e1',
                      borderRadius:
                        '8px',
                      fontSize:
                        '0.84rem',
                    }}
                  />
                </label>


                <label
                  style={{
                    display:
                      'flex',
                    flexDirection:
                      'column',
                    gap:
                      '7px',
                    color:
                      '#334155',
                    fontSize:
                      '0.75rem',
                    fontWeight:
                      800,
                  }}
                >
                  Organization Slug

                  <input
                    value={
                      form.organizationSlug
                    }
                    onChange={
                      (
                        event
                      ) =>
                        updateForm(
                          'organizationSlug',
                          createSlug(
                            event.target
                              .value
                          )
                        )
                    }
                    placeholder="abc-construction"
                    disabled={
                      isSaving
                    }
                    style={{
                      minHeight:
                        '42px',
                      padding:
                        '0 11px',
                      border:
                        '1px solid #cbd5e1',
                      borderRadius:
                        '8px',
                      fontSize:
                        '0.84rem',
                    }}
                  />
                </label>
              </div>
            </section>


            {/* ============================================
                LICENSE
            ============================================ */}

            <section
              style={{
                padding:
                  '20px 0',
                borderTop:
                  '1px solid #eef2f7',
              }}
            >
              <h3
                style={{
                  margin:
                    '0 0 4px',
                  color:
                    '#0f172a',
                  fontSize:
                    '0.95rem',
                }}
              >
                License
              </h3>

              <p
                style={{
                  margin:
                    '0 0 14px',
                  color:
                    '#64748b',
                  fontSize:
                    '0.76rem',
                }}
              >
                Commercial access,
                seat limit and
                license period.
              </p>

              <div
                style={{
                  display:
                    'grid',
                  gridTemplateColumns:
                    'repeat(2, minmax(0, 1fr))',
                  gap:
                    '14px',
                }}
              >
                <label
                  style={{
                    display:
                      'flex',
                    flexDirection:
                      'column',
                    gap:
                      '7px',
                    color:
                      '#334155',
                    fontSize:
                      '0.75rem',
                    fontWeight:
                      800,
                  }}
                >
                  Plan

                  <select
                    value={
                      form.planCode
                    }
                    onChange={
                      (
                        event
                      ) =>
                        updateForm(
                          'planCode',
                          event.target
                            .value
                        )
                    }
                    disabled={
                      isSaving
                    }
                    style={{
                      minHeight:
                        '42px',
                      padding:
                        '0 11px',
                      border:
                        '1px solid #cbd5e1',
                      borderRadius:
                        '8px',
                      background:
                        '#ffffff',
                      fontSize:
                        '0.84rem',
                    }}
                  >
                    <option
                      value="pilot"
                    >
                      Pilot
                    </option>

                    <option
                      value="standard"
                    >
                      Standard
                    </option>

                    <option
                      value="academic"
                    >
                      Academic
                    </option>

                    <option
                      value="custom"
                    >
                      Custom
                    </option>
                  </select>
                </label>


                <label
                  style={{
                    display:
                      'flex',
                    flexDirection:
                      'column',
                    gap:
                      '7px',
                    color:
                      '#334155',
                    fontSize:
                      '0.75rem',
                    fontWeight:
                      800,
                  }}
                >
                  Seat Limit

                  <input
                    type="number"
                    min="1"
                    value={
                      form.seatLimit
                    }
                    onChange={
                      (
                        event
                      ) =>
                        updateForm(
                          'seatLimit',
                          event.target
                            .value
                        )
                    }
                    disabled={
                      isSaving
                    }
                    style={{
                      minHeight:
                        '42px',
                      padding:
                        '0 11px',
                      border:
                        '1px solid #cbd5e1',
                      borderRadius:
                        '8px',
                      fontSize:
                        '0.84rem',
                    }}
                  />
                </label>


                <label
                  style={{
                    display:
                      'flex',
                    flexDirection:
                      'column',
                    gap:
                      '7px',
                    color:
                      '#334155',
                    fontSize:
                      '0.75rem',
                    fontWeight:
                      800,
                  }}
                >
                  License Status

                  <select
                    value={
                      form.licenseStatus
                    }
                    onChange={
                      (
                        event
                      ) =>
                        updateForm(
                          'licenseStatus',
                          event.target
                            .value
                        )
                    }
                    disabled={
                      isSaving
                    }
                    style={{
                      minHeight:
                        '42px',
                      padding:
                        '0 11px',
                      border:
                        '1px solid #cbd5e1',
                      borderRadius:
                        '8px',
                      background:
                        '#ffffff',
                      fontSize:
                        '0.84rem',
                    }}
                  >
                    <option
                      value="trial"
                    >
                      Trial
                    </option>

                    <option
                      value="active"
                    >
                      Active
                    </option>

                    <option
                      value="suspended"
                    >
                      Suspended
                    </option>

                    <option
                      value="expired"
                    >
                      Expired
                    </option>

                    <option
                      value="cancelled"
                    >
                      Cancelled
                    </option>
                  </select>
                </label>


                <div />


                <label
                  style={{
                    display:
                      'flex',
                    flexDirection:
                      'column',
                    gap:
                      '7px',
                    color:
                      '#334155',
                    fontSize:
                      '0.75rem',
                    fontWeight:
                      800,
                  }}
                >
                  Start Date

                  <input
                    type="date"
                    value={
                      form.startsAt
                    }
                    onChange={
                      (
                        event
                      ) =>
                        updateForm(
                          'startsAt',
                          event.target
                            .value
                        )
                    }
                    disabled={
                      isSaving
                    }
                    style={{
                      minHeight:
                        '42px',
                      padding:
                        '0 11px',
                      border:
                        '1px solid #cbd5e1',
                      borderRadius:
                        '8px',
                      fontSize:
                        '0.84rem',
                    }}
                  />
                </label>


                <label
                  style={{
                    display:
                      'flex',
                    flexDirection:
                      'column',
                    gap:
                      '7px',
                    color:
                      '#334155',
                    fontSize:
                      '0.75rem',
                    fontWeight:
                      800,
                  }}
                >
                  Expiration Date

                  <input
                    type="date"
                    value={
                      form.expiresAt
                    }
                    onChange={
                      (
                        event
                      ) =>
                        updateForm(
                          'expiresAt',
                          event.target
                            .value
                        )
                    }
                    disabled={
                      isSaving
                    }
                    style={{
                      minHeight:
                        '42px',
                      padding:
                        '0 11px',
                      border:
                        '1px solid #cbd5e1',
                      borderRadius:
                        '8px',
                      fontSize:
                        '0.84rem',
                    }}
                  />
                </label>
              </div>
            </section>


            {/* ============================================
                MODULES
            ============================================ */}

            <section
              style={{
                padding:
                  '20px 0',
                borderTop:
                  '1px solid #eef2f7',
              }}
            >
              <div
                style={{
                  display:
                    'flex',
                  justifyContent:
                    'space-between',
                  alignItems:
                    'flex-start',
                  gap:
                    '16px',
                  marginBottom:
                    '14px',
                }}
              >
                <div>
                  <h3
                    style={{
                      margin:
                        '0 0 4px',
                      color:
                        '#0f172a',
                      fontSize:
                        '0.95rem',
                    }}
                  >
                    Modules
                  </h3>

                  <p
                    style={{
                      margin: 0,
                      color:
                        '#64748b',
                      fontSize:
                        '0.76rem',
                    }}
                  >
                    Choose the
                    capabilities included
                    in this license.
                  </p>
                </div>

                <span
                  style={{
                    color:
                      '#64748b',
                    fontSize:
                      '0.75rem',
                    fontWeight:
                      700,
                  }}
                >
                  {
                    selectedModuleCount
                  }{' '}
                  selected
                </span>
              </div>


              <div
                style={{
                  display:
                    'grid',
                  gridTemplateColumns:
                    'repeat(2, minmax(0, 1fr))',
                  gap:
                    '10px',
                }}
              >
                {moduleOptions.map(
                  (
                    module
                  ) => {
                    const selected =
                      form.moduleKeys.includes(
                        module.key
                      )

                    return (
                      <label
                        key={
                          module.key
                        }
                        style={{
                          display:
                            'flex',
                          alignItems:
                            'flex-start',
                          gap:
                            '10px',
                          padding:
                            '12px',
                          border:
                            selected
                              ? '1px solid #0b6fda'
                              : '1px solid #e2e8f0',
                          borderRadius:
                            '9px',
                          background:
                            selected
                              ? '#f5f9ff'
                              : '#ffffff',
                          cursor:
                            isSaving
                              ? 'not-allowed'
                              : 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={
                            selected
                          }
                          onChange={() =>
                            toggleModule(
                              module.key
                            )
                          }
                          disabled={
                            isSaving
                          }
                        />

                        <span
                          style={{
                            display:
                              'flex',
                            flexDirection:
                              'column',
                            gap:
                              '3px',
                          }}
                        >
                          <strong
                            style={{
                              color:
                                '#334155',
                              fontSize:
                                '0.76rem',
                            }}
                          >
                            {
                              module.label
                            }
                          </strong>

                          <small
                            style={{
                              color:
                                '#64748b',
                              fontSize:
                                '0.67rem',
                              lineHeight:
                                1.4,
                            }}
                          >
                            {
                              module.description
                            }
                          </small>
                        </span>
                      </label>
                    )
                  }
                )}
              </div>
            </section>


            {/* ============================================
                PRIMARY ADMIN
            ============================================ */}

            <section
              style={{
                padding:
                  '20px 0',
                borderTop:
                  '1px solid #eef2f7',
              }}
            >
              <h3
                style={{
                  margin:
                    '0 0 4px',
                  color:
                    '#0f172a',
                  fontSize:
                    '0.95rem',
                }}
              >
                Primary Admin
              </h3>

              <p
                style={{
                  margin:
                    '0 0 14px',
                  color:
                    '#64748b',
                  fontSize:
                    '0.76rem',
                }}
              >
                This person becomes
                the first Admin of
                the customer
                organization.
              </p>


              <div
                style={{
                  display:
                    'grid',
                  gridTemplateColumns:
                    'repeat(2, minmax(0, 1fr))',
                  gap:
                    '14px',
                }}
              >
                <label
                  style={{
                    display:
                      'flex',
                    flexDirection:
                      'column',
                    gap:
                      '7px',
                    color:
                      '#334155',
                    fontSize:
                      '0.75rem',
                    fontWeight:
                      800,
                  }}
                >
                  Name

                  <input
                    value={
                      form.primaryAdminName
                    }
                    onChange={
                      (
                        event
                      ) =>
                        updateForm(
                          'primaryAdminName',
                          event.target
                            .value
                        )
                    }
                    placeholder="John Smith"
                    disabled={
                      isSaving
                    }
                    style={{
                      minHeight:
                        '42px',
                      padding:
                        '0 11px',
                      border:
                        '1px solid #cbd5e1',
                      borderRadius:
                        '8px',
                      fontSize:
                        '0.84rem',
                    }}
                  />
                </label>


                <label
                  style={{
                    display:
                      'flex',
                    flexDirection:
                      'column',
                    gap:
                      '7px',
                    color:
                      '#334155',
                    fontSize:
                      '0.75rem',
                    fontWeight:
                      800,
                  }}
                >
                  Email

                  <input
                    type="email"
                    value={
                      form.primaryAdminEmail
                    }
                    onChange={
                      (
                        event
                      ) =>
                        updateForm(
                          'primaryAdminEmail',
                          event.target
                            .value
                        )
                    }
                    placeholder="john@company.com"
                    disabled={
                      isSaving
                    }
                    style={{
                      minHeight:
                        '42px',
                      padding:
                        '0 11px',
                      border:
                        '1px solid #cbd5e1',
                      borderRadius:
                        '8px',
                      fontSize:
                        '0.84rem',
                    }}
                  />
                </label>
              </div>
            </section>


            {/* ============================================
                ERROR
            ============================================ */}

            {errorMessage && (
              <div
                role="alert"
                style={{
                  marginBottom:
                    '18px',
                  padding:
                    '12px 14px',
                  border:
                    '1px solid #fecaca',
                  borderRadius:
                    '8px',
                  background:
                    '#fff1f2',
                  color:
                    '#b42318',
                  fontSize:
                    '0.78rem',
                  fontWeight:
                    650,
                }}
              >
                {errorMessage}
              </div>
            )}


            {/* ============================================
                ACTIONS
            ============================================ */}

            <div
              style={{
                display:
                  'flex',
                justifyContent:
                  'flex-end',
                gap:
                  '10px',
                paddingTop:
                  '18px',
                borderTop:
                  '1px solid #e2e8f0',
              }}
            >
              <button
                type="button"
                onClick={
                  closeModal
                }
                disabled={
                  isSaving
                }
                style={{
                  minHeight:
                    '42px',
                  padding:
                    '0 16px',
                  border:
                    '1px solid #cbd5e1',
                  borderRadius:
                    '8px',
                  background:
                    '#ffffff',
                  color:
                    '#334155',
                  fontWeight:
                    750,
                  cursor:
                    isSaving
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                Cancel
              </button>


              <button
                type="submit"
                disabled={
                  isSaving
                }
                style={{
                  minHeight:
                    '42px',
                  padding:
                    '0 18px',
                  border:
                    '1px solid #0b6fda',
                  borderRadius:
                    '8px',
                  background:
                    isSaving
                      ? '#94a3b8'
                      : '#0b6fda',
                  color:
                    '#ffffff',
                  fontWeight:
                    800,
                  cursor:
                    isSaving
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                {isSaving
                  ? 'Creating...'
                  : 'Create Organization'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
