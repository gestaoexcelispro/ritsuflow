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
// WORK PACKAGE DATABASE
//
// PROJECT-LEVEL MASTER DATA
//
// The user defines:
// - 3-letter Work Package code
// - description
//
// RitsuFlow defines:
// - UUID
// - unique project color
//
// Creating a Work Package here DOES NOT add it to Master Plan,
// Lookahead, or Weekly Planning.
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
    projects,
    setProjects,
  ] = useState([])

  const [
    selectedProjectId,
    setSelectedProjectId,
  ] = useState('')

  const [
    workPackages,
    setWorkPackages,
  ] = useState([])

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    loadingProjects,
    setLoadingProjects,
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
  // SELECTED PROJECT
  // ==========================================================

  const selectedProject =
    useMemo(
      () =>
        projects.find(
          (project) =>
            project.id ===
            selectedProjectId
        ) ||
        null,
      [
        projects,
        selectedProjectId,
      ]
    )


  // ==========================================================
  // LOAD PROJECTS
  // ==========================================================

  const loadProjects =
    useCallback(
      async () => {
        setLoadingProjects(
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
                'projects'
              )
              .select(`
                id,
                code,
                name,
                status,
                created_at
              `)
              .neq(
                'status',
                'archived'
              )
              .order(
                'created_at',
                {
                  ascending:
                    false,
                }
              )

          if (
            error
          ) {
            throw error
          }

          const loaded =
            data || []

          setProjects(
            loaded
          )

          const params =
            new URLSearchParams(
              window.location
                .search
            )

          const projectId =
            params.get(
              'projectId'
            )

          if (
            projectId &&
            loaded.some(
              (project) =>
                project.id ===
                projectId
            )
          ) {
            setSelectedProjectId(
              projectId
            )
          }
        } catch (error) {
          console.error(
            'Work Packages - projects:',
            error
          )

          setErrorMessage(
            error.message ||
              'Projects could not be loaded.'
          )
        } finally {
          setLoadingProjects(
            false
          )
        }
      },
      []
    )


  // ==========================================================
  // LOAD CATALOG
  // ==========================================================

  const loadWorkPackages =
    useCallback(
      async (
        projectId
      ) => {
        if (
          !projectId
        ) {
          setWorkPackages(
            []
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
              'get_project_work_package_catalog',
              {
                target_project_id:
                  projectId,
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
            'Work Packages - catalog:',
            error
          )

          setWorkPackages(
            []
          )

          setErrorMessage(
            error.message ||
              'The Work Package Database could not be loaded.'
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
      loadProjects()
    },
    [
      loadProjects,
    ]
  )


  useEffect(
    () => {
      loadWorkPackages(
        selectedProjectId
      )
    },
    [
      selectedProjectId,
      loadWorkPackages,
    ]
  )


  // ==========================================================
  // PROJECT CHANGE
  // ==========================================================

  function handleProjectChange(
    projectId
  ) {
    setSelectedProjectId(
      projectId
    )

    setErrorMessage(
      ''
    )

    setSuccessMessage(
      ''
    )

    if (
      projectId
    ) {
      window.history
        .replaceState(
          {},
          '',
          `/dashboard/projects/work-packages?projectId=${projectId}`
        )
    } else {
      window.history
        .replaceState(
          {},
          '',
          '/dashboard/projects/work-packages'
        )
    }
  }


  // ==========================================================
  // REGISTER WORK PACKAGE
  // ==========================================================

  async function registerWorkPackage(
    event
  ) {
    event.preventDefault()

    if (
      !selectedProjectId ||
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
          'register_project_work_package',
          {
            target_project_id:
              selectedProjectId,

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
        selectedProjectId
      )

      setSuccessMessage(
        created?.color
          ? `${created.code} registered successfully. RitsuFlow assigned ${created.color}.`
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
  // EDIT DESCRIPTION
  // ==========================================================

  function beginEdit(
    item
  ) {
    setEditingId(
      item.id
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

    setEditingDescription(
      ''
    )
  }


  async function saveDescription(
    item
  ) {
    const description =
      String(
        editingDescription ||
        ''
      ).trim()

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
        error,
      } =
        await supabase.rpc(
          'update_project_work_package_description',
          {
            target_work_package_id:
              item.id,

            target_description:
              description,
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

                    description,
                  }
                : workPackage
          )
      )

      cancelEdit()

      setSuccessMessage(
        `${item.code} updated successfully.`
      )
    } catch (error) {
      console.error(
        'Work Packages - update:',
        error
      )

      setErrorMessage(
        error.message ||
          'The description could not be updated.'
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
          'set_project_work_package_active',
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
          ? `${item.code} activated.`
          : `${item.code} deactivated.`
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
          PROJECT FOUNDATION
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
          Work Package Database
        </h1>

        <p
          style={{
            maxWidth:
              '760px',

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
          Register the Work Packages available
          for each project. Master Plan,
          Lookahead Planning and Weekly Planning
          will use the same catalog.
        </p>
      </section>


      <section
        style={{
          marginBottom:
            '18px',

          padding:
            '18px',

          border:
            '1px solid #d9e2ec',

          borderRadius:
            '12px',

          background:
            '#ffffff',
        }}
      >
        <label
          style={{
            display:
              'block',

            marginBottom:
              '6px',

            color:
              '#36516d',

            fontSize:
              '0.7rem',

            fontWeight:
              900,

            textTransform:
              'uppercase',
          }}
        >
          Project
        </label>

        <select
          value={
            selectedProjectId
          }

          disabled={
            loadingProjects
          }

          onChange={(
            event
          ) =>
            handleProjectChange(
              event.target.value
            )
          }

          style={{
            width:
              'min(460px, 100%)',

            height:
              '42px',

            padding:
              '0 12px',

            border:
              '1px solid #cbd5e1',

            borderRadius:
              '7px',

            background:
              '#ffffff',

            color:
              '#0f172a',
          }}
        >
          <option value="">
            -- Select a Project --
          </option>

          {projects.map(
            (
              project
            ) => (
              <option
                key={
                  project.id
                }

                value={
                  project.id
                }
              >
                {project.code
                  ? `${project.code} - `
                  : ''}

                {project.name}
              </option>
            )
          )}
        </select>
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


      {selectedProject && (
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
                {selectedProject.code}
                {' · '}
                {selectedProject.name}
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
              </p>
            </div>


            <div
              style={{
                display:
                  'flex',

                gap:
                  '8px',
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

                onClick={() => {
                  setNewCode('')
                  setNewDescription('')
                  setErrorMessage('')
                  setSuccessMessage('')
                  setShowNewModal(
                    true
                  )
                }}

                style={
                  primaryButtonStyle
                }
              >
                + New Work Package
              </button>
            </div>
          </div>


          {loading ? (
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
                    '760px',

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
                            <span
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
                                      saveDescription(
                                        item
                                      )
                                    }

                                    style={
                                      smallPrimaryButtonStyle
                                    }
                                  >
                                    Save
                                  </button>

                                  <button
                                    type="button"

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
                                    {item.is_active
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
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}


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
                  '0 0 20px',

                color:
                  '#061b2f',
              }}
            >
              Register Work Package
            </h2>

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

                maxLength={
                  3
                }

                required

                value={
                  newCode
                }

                placeholder="DRY"

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

                placeholder="Drywall"

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
                }}
              >
                RitsuFlow automatically assigns
                a color that is not already used
                by another Work Package in this
                project.
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

                  style={
                    primaryButtonStyle
                  }
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
