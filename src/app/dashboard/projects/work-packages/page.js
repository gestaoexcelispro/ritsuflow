'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  supabase,
} from '../../../../lib/supabase'


// ============================================================
// RitsuFlow™
// WORK PACKAGE LIBRARY
//
// ORGANIZATION-LEVEL MASTER DATA
//
// The company defines:
// - 3-letter Work Package code
// - description
//
// RitsuFlow defines:
// - UUID
// - organization-wide unique color
//
// A Work Package registered here becomes available to every
// project belonging to the same organization.
//
// Registering a Work Package here DOES NOT automatically assign
// it to every project. Project assignment is handled separately.
//
// The UUID is the permanent identity. Code and description are
// editable without breaking project references.
// ============================================================


function normalizeCode(
  value
) {
  return String(
    value || ''
  )
    .toUpperCase()
    .replace(
      /[^A-Z]/g,
      ''
    )
    .slice(
      0,
      3
    )
}


function getTextColor(
  hexColor
) {
  const hex =
    String(
      hexColor || ''
    )
      .replace(
        '#',
        ''
      )
      .trim()

  if (
    hex.length !== 6
  ) {
    return '#ffffff'
  }

  const r =
    parseInt(
      hex.slice(
        0,
        2
      ),
      16
    )

  const g =
    parseInt(
      hex.slice(
        2,
        4
      ),
      16
    )

  const b =
    parseInt(
      hex.slice(
        4,
        6
      ),
      16
    )

  const yiq =
    (
      r * 299 +
      g * 587 +
      b * 114
    ) /
    1000

  return yiq >= 150
    ? '#0f172a'
    : '#ffffff'
}


export default function WorkPackagesPage() {
  const [
    organization,
    setOrganization,
  ] = useState(null)

  const [
    workPackages,
    setWorkPackages,
  ] = useState([])

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    loadingOrganization,
    setLoadingOrganization,
  ] = useState(true)

  const [
    showInactive,
    setShowInactive,
  ] = useState(false)

  const [
    showNewModal,
    setShowNewModal,
  ] = useState(false)

  const [
    newCode,
    setNewCode,
  ] = useState('')

  const [
    newDescription,
    setNewDescription,
  ] = useState('')

  const [
    creating,
    setCreating,
  ] = useState(false)

  const [
    editingId,
    setEditingId,
  ] = useState('')

  const [
    editingCode,
    setEditingCode,
  ] = useState('')

  const [
    editingDescription,
    setEditingDescription,
  ] = useState('')

  const [
    savingId,
    setSavingId,
  ] = useState('')

  const [
    statusChangingId,
    setStatusChangingId,
  ] = useState('')

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('')


  // ==========================================================
  // LOAD CURRENT ORGANIZATION
  //
  // The page is intentionally NOT project-scoped.
  //
  // RLS / tenant membership must expose only the organization
  // the current company user is allowed to operate.
  //
  // If more than one organization is visible, this page refuses
  // to guess which company catalog should be edited.
  // ==========================================================

  const loadOrganization =
    useCallback(
      async () => {
        setLoadingOrganization(
          true
        )

        setErrorMessage(
          ''
        )

        try {
          const {
            data,
            error,
          } =
            await supabase
              .from(
                'organizations'
              )
              .select(`
                id,
                name
              `)
              .order(
                'name',
                {
                  ascending:
                    true,
                }
              )
              .limit(
                2
              )

          if (
            error
          ) {
            throw error
          }

          const visibleOrganizations =
            data || []

          if (
            visibleOrganizations.length ===
            0
          ) {
            throw new Error(
              'No organization is available for this account.'
            )
          }

          if (
            visibleOrganizations.length >
            1
          ) {
            throw new Error(
              'More than one organization is visible to this account. RitsuFlow will not guess which company Work Package Library should be edited.'
            )
          }

          setOrganization(
            visibleOrganizations[0]
          )

          return visibleOrganizations[0]
        } catch (error) {
          console.error(
            'Work Packages - organization:',
            error
          )

          setOrganization(
            null
          )

          setWorkPackages(
            []
          )

          setErrorMessage(
            error.message ||
              'The organization could not be loaded.'
          )

          return null
        } finally {
          setLoadingOrganization(
            false
          )
        }
      },
      []
    )


  // ==========================================================
  // LOAD ORGANIZATION CATALOG
  // ==========================================================

  const loadWorkPackages =
    useCallback(
      async (
        organizationId
      ) => {
        if (
          !organizationId
        ) {
          setWorkPackages(
            []
          )

          setLoading(
            false
          )

          return
        }

        setLoading(
          true
        )

        setErrorMessage(
          ''
        )

        try {
          const {
            data,
            error,
          } =
            await supabase.rpc(
              'get_organization_work_package_catalog',
              {
                target_organization_id:
                  organizationId,
              }
            )

          if (
            error
          ) {
            throw error
          }

          setWorkPackages(
            data || []
          )
        } catch (error) {
          console.error(
            'Work Packages - organization catalog:',
            error
          )

          setWorkPackages(
            []
          )

          setErrorMessage(
            error.message ||
              'The company Work Package Library could not be loaded.'
          )
        } finally {
          setLoading(
            false
          )
        }
      },
      []
    )


  useEffect(
    () => {
      let active =
        true

      async function initialize() {
        const loadedOrganization =
          await loadOrganization()

        if (
          !active
        ) {
          return
        }

        if (
          loadedOrganization?.id
        ) {
          await loadWorkPackages(
            loadedOrganization.id
          )
        } else {
          setLoading(
            false
          )
        }
      }

      initialize()

      return () => {
        active =
          false
      }
    },
    [
      loadOrganization,
      loadWorkPackages,
    ]
  )


  // ==========================================================
  // REGISTER ORGANIZATION WORK PACKAGE
  // ==========================================================

  async function registerWorkPackage(
    event
  ) {
    event.preventDefault()

    if (
      !organization?.id ||
      creating
    ) {
      return
    }

    const code =
      normalizeCode(
        newCode
      )

    const description =
      String(
        newDescription ||
        ''
      ).trim()

    if (
      code.length !== 3
    ) {
      setErrorMessage(
        'The Work Package code must contain exactly 3 letters.'
      )

      return
    }

    if (
      !description
    ) {
      setErrorMessage(
        'The Work Package description is required.'
      )

      return
    }

    setCreating(
      true
    )

    setErrorMessage(
      ''
    )

    setSuccessMessage(
      ''
    )

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          'register_organization_work_package',
          {
            target_organization_id:
              organization.id,

            target_code:
              code,

            target_description:
              description,
          }
        )

      if (
        error
      ) {
        throw error
      }

      const created =
        Array.isArray(
          data
        )
          ? data[0]
          : data

      setNewCode(
        ''
      )

      setNewDescription(
        ''
      )

      setShowNewModal(
        false
      )

      await loadWorkPackages(
        organization.id
      )

      setSuccessMessage(
        created?.color
          ? `${created.code} registered successfully. RitsuFlow assigned ${created.color} to the company library.`
          : `${code} registered successfully.`
      )
    } catch (error) {
      console.error(
        'Work Packages - register:',
        error
      )

      setErrorMessage(
        error.message ||
          'The Work Package could not be registered.'
      )
    } finally {
      setCreating(
        false
      )
    }
  }


  // ==========================================================
  // EDIT CODE + DESCRIPTION
  //
  // UUID remains unchanged.
  // Example:
  // PIS -> FLR
  // ==========================================================

  function beginEdit(
    item
  ) {
    setEditingId(
      item.id
    )

    setEditingCode(
      item.code ||
        ''
    )

    setEditingDescription(
      item.description ||
        ''
    )

    setErrorMessage(
      ''
    )

    setSuccessMessage(
      ''
    )
  }


  function cancelEdit() {
    setEditingId(
      ''
    )

    setEditingCode(
      ''
    )

    setEditingDescription(
      ''
    )
  }


  async function saveWorkPackage(
    item
  ) {
    const code =
      normalizeCode(
        editingCode
      )

    const description =
      String(
        editingDescription ||
        ''
      ).trim()

    if (
      code.length !== 3
    ) {
      setErrorMessage(
        'The Work Package code must contain exactly 3 letters.'
      )

      return
    }

    if (
      !description
    ) {
      setErrorMessage(
        'The Work Package description is required.'
      )

      return
    }

    setSavingId(
      item.id
    )

    setErrorMessage(
      ''
    )

    setSuccessMessage(
      ''
    )

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          'update_organization_work_package',
          {
            target_work_package_id:
              item.id,

            target_code:
              code,

            target_description:
              description,
          }
        )

      if (
        error
      ) {
        throw error
      }

      const updated =
        Array.isArray(
          data
        )
          ? data[0]
          : data

      setWorkPackages(
        (
          current
        ) =>
          current.map(
            (
              workPackage
            ) =>
              workPackage.id ===
              item.id
                ? {
                    ...workPackage,

                    code:
                      updated?.code ||
                      code,

                    description:
                      updated?.description ||
                      description,

                    color:
                      updated?.color ||
                      workPackage.color,
                  }
                : workPackage
          )
      )

      cancelEdit()

      setSuccessMessage(
        item.code !==
          code
          ? `${item.code} changed to ${code} successfully. Existing project references remain linked to the same Work Package.`
          : `${code} updated successfully.`
      )
    } catch (error) {
      console.error(
        'Work Packages - update:',
        error
      )

      setErrorMessage(
        error.message ||
          'The Work Package could not be updated.'
      )
    } finally {
      setSavingId(
        ''
      )
    }
  }


  // ==========================================================
  // ACTIVE / INACTIVE
  // ==========================================================

  async function changeStatus(
    item
  ) {
    if (
      statusChangingId
    ) {
      return
    }

    const nextStatus =
      !item.is_active

    setStatusChangingId(
      item.id
    )

    setErrorMessage(
      ''
    )

    setSuccessMessage(
      ''
    )

    try {
      const {
        error,
      } =
        await supabase.rpc(
          'set_organization_work_package_active',
          {
            target_work_package_id:
              item.id,

            target_is_active:
              nextStatus,
          }
        )

      if (
        error
      ) {
        throw error
      }

      setWorkPackages(
        (
          current
        ) =>
          current.map(
            (
              workPackage
            ) =>
              workPackage.id ===
              item.id
                ? {
                    ...workPackage,

                    is_active:
                      nextStatus,
                  }
                : workPackage
          )
      )

      setSuccessMessage(
        nextStatus
          ? `${item.code} activated for the company library.`
          : `${item.code} deactivated for the company library.`
      )
    } catch (error) {
      console.error(
        'Work Packages - status:',
        error
      )

      setErrorMessage(
        error.message ||
          'The Work Package status could not be changed.'
      )
    } finally {
      setStatusChangingId(
        ''
      )
    }
  }


  // ==========================================================
  // FILTERS
  // ==========================================================

  const activeCount =
    useMemo(
      () =>
        workPackages.filter(
          (
            item
          ) =>
            item.is_active
        ).length,
      [
        workPackages,
      ]
    )


  const inactiveCount =
    workPackages.length -
    activeCount


  const visibleWorkPackages =
    useMemo(
      () =>
        workPackages.filter(
          (
            item
          ) =>
            showInactive ||
            item.is_active
        ),
      [
        workPackages,
        showInactive,
      ]
    )


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <main
      style={{
        minHeight:
          'calc(100vh - 80px)',

        padding:
          '24px 22px 50px',

        background:
          '#f8fafc',
      }}
    >

      <section
        style={{
          marginBottom:
            '26px',
        }}
      >
        <p
          style={{
            margin:
              '0 0 8px',

            color:
              '#009f8e',

            fontSize:
              '0.72rem',

            fontWeight:
              900,

            letterSpacing:
              '0.13em',

            textTransform:
              'uppercase',
          }}
        >
          WORKSPACE
        </p>

        <h1
          style={{
            margin:
              0,

            color:
              '#061b2f',

            fontSize:
              '2.4rem',

            fontWeight:
              900,

            letterSpacing:
              '-0.035em',
          }}
        >
          Work Package Library
        </h1>

        <p
          style={{
            maxWidth:
              '820px',

            margin:
              '12px 0 0',

            color:
              '#536a86',

            fontSize:
              '0.9rem',

            lineHeight:
              1.6,
          }}
        >
          Manage the company&apos;s shared Work Package
          definitions. Packages registered here become available
          for selection across every project in the organization,
          while each project decides which packages it uses.
        </p>
      </section>


      {errorMessage && (
        <div
          style={{
            marginBottom:
              '14px',

            padding:
              '11px 14px',

            border:
              '1px solid #fecaca',

            borderRadius:
              '7px',

            background:
              '#fef2f2',

            color:
              '#b91c1c',

            fontSize:
              '0.78rem',

            fontWeight:
              600,
          }}
        >
          {errorMessage}
        </div>
      )}


      {successMessage && (
        <div
          style={{
            marginBottom:
              '14px',

            padding:
              '11px 14px',

            border:
              '1px solid #99f6e4',

            borderRadius:
              '7px',

            background:
              '#f0fdfa',

            color:
              '#0f766e',

            fontSize:
              '0.78rem',

            fontWeight:
              600,
          }}
        >
          {successMessage}
        </div>
      )}


      <section
        style={{
          overflow:
            'hidden',

          border:
            '1px solid #d9e2ec',

          borderRadius:
            '12px',

          background:
            '#ffffff',
        }}
      >
        <div
          style={{
            display:
              'flex',

            alignItems:
              'center',

            justifyContent:
              'space-between',

            gap:
              '15px',

            flexWrap:
              'wrap',

            padding:
              '17px 18px',

            borderBottom:
              '1px solid #e6edf3',
          }}
        >
          <div>
            <h2
              style={{
                margin:
                  0,

                color:
                  '#061b2f',

                fontSize:
                  '1rem',

                fontWeight:
                  900,
              }}
            >
              {loadingOrganization
                ? 'Loading organization...'
                : organization?.name ||
                  'Company Work Package Library'}
            </h2>

            <p
              style={{
                margin:
                  '5px 0 0',

                color:
                  '#7890a8',

                fontSize:
                  '0.72rem',
              }}
            >
              {activeCount} active Work Packages
              {' · '}
              Shared across the organization
            </p>
          </div>


          <div
            style={{
              display:
                'flex',

              gap:
                '8px',

              flexWrap:
                'wrap',
            }}
          >
            {inactiveCount >
              0 && (
              <button
                type="button"

                onClick={() =>
                  setShowInactive(
                    (
                      current
                    ) =>
                      !current
                  )
                }

                style={
                  secondaryButtonStyle
                }
              >
                {showInactive
                  ? 'Hide Inactive'
                  : `Show Inactive (${inactiveCount})`}
              </button>
            )}

            <button
              type="button"

              disabled={
                !organization?.id ||
                loadingOrganization
              }

              onClick={() => {
                setNewCode('')
                setNewDescription('')
                setErrorMessage('')
                setSuccessMessage('')
                setShowNewModal(
                  true
                )
              }}

              style={{
                ...primaryButtonStyle,

                opacity:
                  !organization?.id ||
                  loadingOrganization
                    ? 0.55
                    : 1,

                cursor:
                  !organization?.id ||
                  loadingOrganization
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              + New Work Package
            </button>
          </div>
        </div>


        {loading ||
        loadingOrganization ? (
          <div
            style={{
              padding:
                '50px',

              textAlign:
                'center',

              color:
                '#64748b',
            }}
          >
            Loading Work Packages...
          </div>
        ) : (
          <div
            style={{
              overflowX:
                'auto',
            }}
          >
            <table
              style={{
                width:
                  '100%',

                minWidth:
                  '820px',

                borderCollapse:
                  'collapse',
              }}
            >
              <thead>
                <tr>
                  <th style={headerStyle}>
                    COLOR
                  </th>

                  <th style={headerStyle}>
                    CODE
                  </th>

                  <th
                    style={{
                      ...headerStyle,

                      textAlign:
                        'left',
                    }}
                  >
                    DESCRIPTION
                  </th>

                  <th style={headerStyle}>
                    STATUS
                  </th>

                  <th style={headerStyle}>
                    ACTIONS
                  </th>
                </tr>
              </thead>

              <tbody>
                {visibleWorkPackages.map(
                  (
                    item
                  ) => {
                    const textColor =
                      getTextColor(
                        item.color
                      )

                    const isEditing =
                      editingId ===
                      item.id

                    return (
                      <tr
                        key={
                          item.id
                        }

                        style={{
                          opacity:
                            item.is_active
                              ? 1
                              : 0.55,
                        }}
                      >
                        <td style={cellStyle}>
                          <div
                            style={{
                              width:
                                '28px',

                              height:
                                '28px',

                              margin:
                                '0 auto',

                              borderRadius:
                                '5px',

                              background:
                                item.color ||
                                '#64748b',

                              border:
                                '1px solid #cbd5e1',
                            }}
                          />
                        </td>

                        <td style={cellStyle}>
                          {isEditing ? (
                            <input
                              type="text"

                              translate="no"

                              className="notranslate"

                              maxLength={
                                3
                              }

                              value={
                                editingCode
                              }

                              onChange={(
                                event
                              ) =>
                                setEditingCode(
                                  normalizeCode(
                                    event.target.value
                                  )
                                )
                              }

                              style={{
                                width:
                                  '82px',

                                height:
                                  '34px',

                                padding:
                                  '0 8px',

                                border:
                                  '1px solid #94a3b8',

                                borderRadius:
                                  '5px',

                                textAlign:
                                  'center',

                                fontWeight:
                                  900,

                                textTransform:
                                  'uppercase',
                              }}
                            />
                          ) : (
                            <span
                              translate="no"

                              className="notranslate"

                              style={{
                                display:
                                  'inline-flex',

                                alignItems:
                                  'center',

                                justifyContent:
                                  'center',

                                minWidth:
                                  '55px',

                                padding:
                                  '6px 8px',

                                borderRadius:
                                  '5px',

                                background:
                                  item.color ||
                                  '#64748b',

                                color:
                                  textColor,

                                fontWeight:
                                  900,
                              }}
                            >
                              {item.code}
                            </span>
                          )}
                        </td>

                        <td
                          style={{
                            ...cellStyle,

                            textAlign:
                              'left',
                          }}
                        >
                          {isEditing ? (
                            <input
                              type="text"

                              value={
                                editingDescription
                              }

                              onChange={(
                                event
                              ) =>
                                setEditingDescription(
                                  event.target.value
                                )
                              }

                              style={{
                                width:
                                  '100%',

                                height:
                                  '34px',

                                padding:
                                  '0 8px',

                                border:
                                  '1px solid #94a3b8',

                                borderRadius:
                                  '5px',
                              }}
                            />
                          ) : (
                            <strong>
                              {item.description}
                            </strong>
                          )}
                        </td>

                        <td style={cellStyle}>
                          {item.is_active
                            ? 'Active'
                            : 'Inactive'}
                        </td>

                        <td style={cellStyle}>
                          <div
                            style={{
                              display:
                                'flex',

                              justifyContent:
                                'center',

                              gap:
                                '6px',
                            }}
                          >
                            {isEditing ? (
                              <>
                                <button
                                  type="button"

                                  disabled={
                                    savingId ===
                                    item.id
                                  }

                                  onClick={() =>
                                    saveWorkPackage(
                                      item
                                    )
                                  }

                                  style={
                                    smallPrimaryButtonStyle
                                  }
                                >
                                  {savingId ===
                                  item.id
                                    ? 'Saving...'
                                    : 'Save'}
                                </button>

                                <button
                                  type="button"

                                  disabled={
                                    savingId ===
                                    item.id
                                  }

                                  onClick={
                                    cancelEdit
                                  }

                                  style={
                                    smallButtonStyle
                                  }
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"

                                  onClick={() =>
                                    beginEdit(
                                      item
                                    )
                                  }

                                  style={
                                    smallButtonStyle
                                  }
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"

                                  disabled={
                                    statusChangingId ===
                                    item.id
                                  }

                                  onClick={() =>
                                    changeStatus(
                                      item
                                    )
                                  }

                                  style={
                                    smallButtonStyle
                                  }
                                >
                                  {statusChangingId ===
                                  item.id
                                    ? 'Saving...'
                                    : item.is_active
                                      ? 'Deactivate'
                                      : 'Activate'}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  }
                )}

                {visibleWorkPackages.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        5
                      }

                      style={{
                        padding:
                          '48px 20px',

                        textAlign:
                          'center',

                        color:
                          '#7890a8',

                        fontSize:
                          '0.8rem',
                      }}
                    >
                      No Work Packages are registered in this
                      company library yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>


      {showNewModal && (
        <div
          style={{
            position:
              'fixed',

            inset:
              0,

            zIndex:
              5000,

            display:
              'flex',

            alignItems:
              'center',

            justifyContent:
              'center',

            background:
              'rgba(6,27,47,0.55)',
          }}
        >
          <div
            style={{
              width:
                'min(450px, 94vw)',

              padding:
                '24px',

              borderRadius:
                '12px',

              background:
                '#ffffff',
            }}
          >
            <h2
              style={{
                margin:
                  '0 0 8px',

                color:
                  '#061b2f',
              }}
            >
              Register Work Package
            </h2>

            <p
              style={{
                margin:
                  '0 0 20px',

                color:
                  '#64748b',

                fontSize:
                  '0.76rem',

                lineHeight:
                  1.5,
              }}
            >
              This Work Package will become available to all
              projects in {organization?.name || 'this organization'}.
            </p>

            <form
              onSubmit={
                registerWorkPackage
              }
            >
              <label style={labelStyle}>
                Code
              </label>

              <input
                type="text"

                translate="no"

                className="notranslate"

                maxLength={
                  3
                }

                required

                value={
                  newCode
                }

                placeholder="FLR"

                onChange={(
                  event
                ) =>
                  setNewCode(
                    normalizeCode(
                      event.target.value
                    )
                  )
                }

                style={{
                  ...inputStyle,

                  width:
                    '120px',

                  marginBottom:
                    '16px',

                  fontWeight:
                    900,

                  textTransform:
                    'uppercase',
                }}
              />


              <label style={labelStyle}>
                Description
              </label>

              <input
                type="text"

                required

                value={
                  newDescription
                }

                placeholder="Flooring"

                onChange={(
                  event
                ) =>
                  setNewDescription(
                    event.target.value
                  )
                }

                style={{
                  ...inputStyle,

                  marginBottom:
                    '16px',
                }}
              />


              <div
                style={{
                  marginBottom:
                    '20px',

                  padding:
                    '11px',

                  borderRadius:
                    '6px',

                  background:
                    '#eff6ff',

                  color:
                    '#1e40af',

                  fontSize:
                    '0.72rem',

                  lineHeight:
                    1.5,
                }}
              >
                RitsuFlow automatically assigns a color that is
                not already used by another Work Package in this
                organization. The same Work Package keeps the
                same color across projects.
              </div>


              <div
                style={{
                  display:
                    'flex',

                  justifyContent:
                    'flex-end',

                  gap:
                    '8px',
                }}
              >
                <button
                  type="button"

                  disabled={
                    creating
                  }

                  onClick={() =>
                    setShowNewModal(
                      false
                    )
                  }

                  style={
                    secondaryButtonStyle
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"

                  disabled={
                    creating ||
                    newCode.length !==
                      3 ||
                    !newDescription.trim()
                  }

                  style={{
                    ...primaryButtonStyle,

                    opacity:
                      creating ||
                      newCode.length !==
                        3 ||
                      !newDescription.trim()
                        ? 0.55
                        : 1,

                    cursor:
                      creating ||
                      newCode.length !==
                        3 ||
                      !newDescription.trim()
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                >
                  {creating
                    ? 'Registering...'
                    : 'Register Work Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  )
}


const primaryButtonStyle = {
  minHeight:
    '38px',

  padding:
    '0 13px',

  border:
    'none',

  borderRadius:
    '6px',

  background:
    '#009f8e',

  color:
    '#ffffff',

  fontSize:
    '0.72rem',

  fontWeight:
    900,

  cursor:
    'pointer',
}


const secondaryButtonStyle = {
  minHeight:
    '38px',

  padding:
    '0 13px',

  border:
    '1px solid #cbd5e1',

  borderRadius:
    '6px',

  background:
    '#ffffff',

  color:
    '#334155',

  fontSize:
    '0.72rem',

  fontWeight:
    800,

  cursor:
    'pointer',
}


const headerStyle = {
  padding:
    '10px',

  borderBottom:
    '1px solid #cbd5e1',

  background:
    '#f8fafc',

  color:
    '#536a86',

  fontSize:
    '0.65rem',

  fontWeight:
    900,

  textAlign:
    'center',
}


const cellStyle = {
  padding:
    '10px',

  borderBottom:
    '1px solid #e6edf3',

  color:
    '#334155',

  fontSize:
    '0.76rem',

  textAlign:
    'center',
}


const smallButtonStyle = {
  minHeight:
    '28px',

  padding:
    '0 8px',

  border:
    '1px solid #cbd5e1',

  borderRadius:
    '5px',

  background:
    '#ffffff',

  color:
    '#334155',

  fontSize:
    '0.66rem',

  fontWeight:
    800,

  cursor:
    'pointer',
}


const smallPrimaryButtonStyle = {
  ...smallButtonStyle,

  border:
    '1px solid #009f8e',

  background:
    '#009f8e',

  color:
    '#ffffff',
}


const labelStyle = {
  display:
    'block',

  marginBottom:
    '6px',

  color:
    '#36516d',

  fontSize:
    '0.72rem',

  fontWeight:
    900,
}


const inputStyle = {
  width:
    '100%',

  height:
    '40px',

  padding:
    '0 10px',

  border:
    '1px solid #cbd5e1',

  borderRadius:
    '6px',

  outline:
    'none',
}
