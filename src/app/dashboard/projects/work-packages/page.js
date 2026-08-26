'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase'


// ============================================================
// RitsuFlow™
// PROJECT WORK PACKAGE DATABASE
//
// PURPOSE
// ------------------------------------------------------------
// Central project-level Work Package catalog.
//
// Work Packages are independent from:
// - Master Plan
// - Lookahead Planning
// - Weekly Planning
//
// Registering a Work Package DOES NOT schedule it.
//
// USER PROVIDES:
// - exactly 3 letters
// - description
//
// RITSUFLOW PROVIDES:
// - persistent UUID
// - automatic unique project color
// - active / inactive status
// ============================================================


function normalizeCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3)
}


function getTextColor(hexColor) {
  const hex = String(hexColor || '')
    .replace('#', '')
    .trim()

  if (hex.length !== 6) {
    return '#ffffff'
  }

  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)

  const yiq =
    (r * 299 +
      g * 587 +
      b * 114) /
    1000

  return yiq >= 150
    ? '#0f172a'
    : '#ffffff'
}


function formatDate(value) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return new Intl.DateTimeFormat(
    'en-US',
    {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }
  ).format(date)
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
    catalog,
    setCatalog,
  ] = useState([])

  const [
    loadingProjects,
    setLoadingProjects,
  ] = useState(true)

  const [
    loadingCatalog,
    setLoadingCatalog,
  ] = useState(false)

  const [
    showInactive,
    setShowInactive,
  ] = useState(false)

  const [
    showCreateModal,
    setShowCreateModal,
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
    savingDescriptionId,
    setSavingDescriptionId,
  ] = useState('')

  const [
    changingStatusId,
    setChangingStatusId,
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
        ) || null,
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
        setLoadingProjects(true)
        setErrorMessage('')

        try {
          const {
            data,
            error,
          } =
            await supabase
              .from('projects')
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
                  ascending: false,
                }
              )

          if (error) {
            throw error
          }

          const loadedProjects =
            data || []

          setProjects(
            loadedProjects
          )

          const params =
            new URLSearchParams(
              window.location.search
            )

          const projectIdFromUrl =
            params.get(
              'projectId'
            )

          if (
            projectIdFromUrl &&
            loadedProjects.some(
              (project) =>
                project.id ===
                projectIdFromUrl
            )
          ) {
            setSelectedProjectId(
              projectIdFromUrl
            )

            return
          }

          if (
            loadedProjects.length ===
            1
          ) {
            setSelectedProjectId(
              loadedProjects[0].id
            )
          }
        } catch (error) {
          console.error(
            'Work Package Database - projects:',
            error
          )

          setErrorMessage(
            error.message ||
              'Projects could not be loaded.'
          )
        } finally {
          setLoadingProjects(false)
        }
      },
      []
    )


  // ==========================================================
  // LOAD WORK PACKAGE CATALOG
  // ==========================================================

  const loadCatalog =
    useCallback(
      async (
        projectId
      ) => {
        if (!projectId) {
          setCatalog([])
          return
        }

        setLoadingCatalog(true)
        setErrorMessage('')

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

          if (error) {
            throw error
          }

          setCatalog(
            data || []
          )
        } catch (error) {
          console.error(
            'Work Package Database - catalog:',
            error
          )

          setCatalog([])

          setErrorMessage(
            error.message ||
              'The Work Package catalog could not be loaded.'
          )
        } finally {
          setLoadingCatalog(false)
        }
      },
      []
    )


  // ==========================================================
  // EFFECTS
  // ==========================================================

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
      loadCatalog(
        selectedProjectId
      )
    },
    [
      selectedProjectId,
      loadCatalog,
    ]
  )


  // ==========================================================
  // PROJECT CHANGE
  // ==========================================================

  const handleProjectChange =
    (
      projectId
    ) => {
      setSelectedProjectId(
        projectId
      )

      setSuccessMessage('')
      setErrorMessage('')

      if (projectId) {
        window.history.replaceState(
          {},
          '',
          `/dashboard/projects/work-packages?projectId=${projectId}`
        )
      } else {
        window.history.replaceState(
          {},
          '',
          '/dashboard/projects/work-packages'
        )
      }
    }


  // ==========================================================
  // CREATE WORK PACKAGE
  // ==========================================================

  const handleCreateWorkPackage =
    async (
      event
    ) => {
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
          'Work Package code must contain exactly 3 letters.'
        )

        return
      }

      if (!description) {
        setErrorMessage(
          'Work Package description is required.'
        )

        return
      }

      setCreating(true)
      setErrorMessage('')
      setSuccessMessage('')

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

        if (error) {
          throw error
        }

        const created =
          Array.isArray(data)
            ? data[0]
            : data

        setNewCode('')
        setNewDescription('')
        setShowCreateModal(
          false
        )

        await loadCatalog(
          selectedProjectId
        )

        setSuccessMessage(
          created?.color
            ? `${code} was registered. RitsuFlow assigned ${created.color} as its project color.`
            : `${code} was registered successfully.`
        )
      } catch (error) {
        console.error(
          'Work Package Database - create:',
          error
        )

        setErrorMessage(
          error.message ||
            'The Work Package could not be registered.'
        )
      } finally {
        setCreating(false)
      }
    }


  // ==========================================================
  // START DESCRIPTION EDIT
  // ==========================================================

  const beginDescriptionEdit =
    (
      item
    ) => {
      setEditingId(
        item.id
      )

      setEditingDescription(
        item.description || ''
      )

      setErrorMessage('')
      setSuccessMessage('')
    }


  // ==========================================================
  // CANCEL DESCRIPTION EDIT
  // ==========================================================

  const cancelDescriptionEdit =
    () => {
      setEditingId('')
      setEditingDescription('')
    }


  // ==========================================================
  // SAVE DESCRIPTION
  // ==========================================================

  const saveDescription =
    async (
      item
    ) => {
      const description =
        String(
          editingDescription ||
          ''
        ).trim()

      if (!description) {
        setErrorMessage(
          'Work Package description is required.'
        )

        return
      }

      if (
        description ===
        String(
          item.description ||
          ''
        ).trim()
      ) {
        cancelDescriptionEdit()
        return
      }

      setSavingDescriptionId(
        item.id
      )

      setErrorMessage('')
      setSuccessMessage('')

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

        if (error) {
          throw error
        }

        setCatalog(
          (
            current
          ) =>
            current.map(
              (
                currentItem
              ) =>
                currentItem.id ===
                item.id
                  ? {
                      ...currentItem,
                      description,
                    }
                  : currentItem
            )
        )

        cancelDescriptionEdit()

        setSuccessMessage(
          `${item.code} description updated.`
        )
      } catch (error) {
        console.error(
          'Work Package Database - description:',
          error
        )

        setErrorMessage(
          error.message ||
            'The Work Package description could not be updated.'
        )
      } finally {
        setSavingDescriptionId(
          ''
        )
      }
    }


  // ==========================================================
  // ACTIVE / INACTIVE
  // ==========================================================

  const setPackageActive =
    async (
      item,
      nextStatus
    ) => {
      if (
        !item?.id ||
        changingStatusId
      ) {
        return
      }

      setChangingStatusId(
        item.id
      )

      setErrorMessage('')
      setSuccessMessage('')

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

        if (error) {
          throw error
        }

        setCatalog(
          (
            current
          ) =>
            current.map(
              (
                currentItem
              ) =>
                currentItem.id ===
                item.id
                  ? {
                      ...currentItem,

                      is_active:
                        nextStatus,
                    }
                  : currentItem
            )
        )

        setSuccessMessage(
          nextStatus
            ? `${item.code} is active again.`
            : `${item.code} was deactivated. Historical planning remains preserved.`
        )
      } catch (error) {
        console.error(
          'Work Package Database - status:',
          error
        )

        setErrorMessage(
          error.message ||
            'The Work Package status could not be changed.'
        )
      } finally {
        setChangingStatusId(
          ''
        )
      }
    }


  // ==========================================================
  // FILTERED CATALOG
  // ==========================================================

  const visibleCatalog =
    useMemo(
      () =>
        catalog.filter(
          (item) =>
            showInactive ||
            item.is_active
        ),
      [
        catalog,
        showInactive,
      ]
    )


  const activeCount =
    useMemo(
      () =>
        catalog.filter(
          (item) =>
            item.is_active
        ).length,
      [
        catalog,
      ]
    )


  const inactiveCount =
    catalog.length -
    activeCount


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
          'radial-gradient(circle at top right, rgba(8, 170, 150, 0.06), transparent 28%), #f8fafc',

        fontFamily:
          'sans-serif',
      }}
    >

      {/* ====================================================
          HEADER
      ===================================================== */}

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
          to this project. The same catalog will
          be shared by Master Plan, Lookahead
          Planning, Weekly Planning and future
          production-control modules.
        </p>

      </section>


      {/* ====================================================
          PROJECT SELECTOR
      ===================================================== */}

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

        <div
          style={{
            display:
              'flex',

            alignItems:
              'flex-end',

            justifyContent:
              'space-between',

            gap:
              '18px',

            flexWrap:
              'wrap',
          }}
        >

          <div
            style={{
              width:
                'min(460px, 100%)',
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

                letterSpacing:
                  '0.06em',
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
                  '100%',

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

                fontSize:
                  '0.86rem',

                outline:
                  'none',
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

          </div>


          {selectedProject && (
            <div
              style={{
                display:
                  'flex',

                alignItems:
                  'center',

                gap:
                  '12px',

                flexWrap:
                  'wrap',
              }}
            >

              <div
                style={{
                  padding:
                    '7px 11px',

                  borderRadius:
                    '999px',

                  background:
                    '#e8faf6',

                  color:
                    '#087f73',

                  fontSize:
                    '0.7rem',

                  fontWeight:
                    900,
                }}
              >
                {activeCount} Active
              </div>

              {inactiveCount >
                0 && (
                <div
                  style={{
                    padding:
                      '7px 11px',

                    borderRadius:
                      '999px',

                    background:
                      '#f1f5f9',

                    color:
                      '#64748b',

                    fontSize:
                      '0.7rem',

                    fontWeight:
                      900,
                  }}
                >
                  {inactiveCount} Inactive
                </div>
              )}

            </div>
          )}

        </div>

      </section>


      {/* ====================================================
          MESSAGES
      ===================================================== */}

      {errorMessage && (
        <div
          style={{
            marginBottom:
              '16px',

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
              '16px',

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


      {/* ====================================================
          NO PROJECT
      ===================================================== */}

      {!selectedProjectId && (
        <section
          style={{
            padding:
              '60px 20px',

            border:
              '1px dashed #cbd5e1',

            borderRadius:
              '12px',

            background:
              '#ffffff',

            textAlign:
              'center',
          }}
        >

          <h2
            style={{
              margin:
                '0 0 8px',

              color:
                '#0f172a',

              fontSize:
                '1rem',

              fontWeight:
                900,
            }}
          >
            Select a project
          </h2>

          <p
            style={{
              margin:
                0,

              color:
                '#64748b',

              fontSize:
                '0.8rem',
            }}
          >
            The Work Package catalog belongs
            to a specific project.
          </p>

        </section>
      )}


      {/* ====================================================
          DATABASE
      ===================================================== */}

      {selectedProjectId && (
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

            boxShadow:
              '0 10px 28px rgba(15,23,42,0.04)',
          }}
        >

          {/* HEADER */}

          <div
            style={{
              display:
                'flex',

              alignItems:
                'center',

              justifyContent:
                'space-between',

              gap:
                '16px',

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
                {selectedProject?.code
                  ? `${selectedProject.code} · `
                  : ''}

                {selectedProject?.name}
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
                Work Package codes are permanent
                project identifiers. Colors are
                assigned automatically by
                RitsuFlow.
              </p>

            </div>


            <div
              style={{
                display:
                  'flex',

                gap:
                  '8px',

                alignItems:
                  'center',
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
                    : 'Show Inactive'}
                </button>
              )}


              <button
                type="button"

                onClick={() => {
                  setNewCode('')
                  setNewDescription('')
                  setErrorMessage('')
                  setSuccessMessage('')
                  setShowCreateModal(
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


          {/* TABLE */}

          {loadingCatalog ? (
            <div
              style={{
                padding:
                  '50px 20px',

                textAlign:
                  'center',

                color:
                  '#64748b',

                fontSize:
                  '0.8rem',
              }}
            >
              Loading Work Packages...
            </div>
          ) : visibleCatalog.length ===
            0 ? (
            <div
              style={{
                padding:
                  '55px 20px',

                textAlign:
                  'center',
              }}
            >

              <h3
                style={{
                  margin:
                    '0 0 7px',

                  color:
                    '#0f172a',

                  fontSize:
                    '0.95rem',
                }}
              >
                No Work Packages registered.
              </h3>

              <p
                style={{
                  margin:
                    0,

                  color:
                    '#64748b',

                  fontSize:
                    '0.76rem',
                }}
              >
                Register the first Work Package
                for this project.
              </p>

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

                  fontSize:
                    '0.76rem',
                }}
              >

                <thead>
                  <tr>

                    <th
                      style={{
                        ...tableHeaderStyle,

                        width:
                          '80px',
                      }}
                    >
                      COLOR
                    </th>

                    <th
                      style={{
                        ...tableHeaderStyle,

                        width:
                          '120px',
                      }}
                    >
                      CODE
                    </th>

                    <th
                      style={{
                        ...tableHeaderStyle,

                        textAlign:
                          'left',
                      }}
                    >
                      DESCRIPTION
                    </th>

                    <th
                      style={{
                        ...tableHeaderStyle,

                        width:
                          '120px',
                      }}
                    >
                      STATUS
                    </th>

                    <th
                      style={{
                        ...tableHeaderStyle,

                        width:
                          '125px',
                      }}
                    >
                      CREATED
                    </th>

                    <th
                      style={{
                        ...tableHeaderStyle,

                        width:
                          '200px',
                      }}
                    >
                      ACTIONS
                    </th>

                  </tr>
                </thead>


                <tbody>

                  {visibleCatalog.map(
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
                                : 0.58,
                          }}
                        >

                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            <div
                              title={
                                item.color ||
                                ''
                              }

                              style={{
                                width:
                                  '28px',

                                height:
                                  '28px',

                                margin:
                                  '0 auto',

                                borderRadius:
                                  '6px',

                                background:
                                  item.color ||
                                  '#cbd5e1',

                                border:
                                  '1px solid rgba(15,23,42,0.12)',

                                boxShadow:
                                  'inset 0 0 0 1px rgba(255,255,255,0.15)',
                              }}
                            />
                          </td>


                          <td
                            style={
                              tableCellStyle
                            }
                          >

                            <span
                              style={{
                                display:
                                  'inline-flex',

                                alignItems:
                                  'center',

                                justifyContent:
                                  'center',

                                minWidth:
                                  '54px',

                                padding:
                                  '6px 9px',

                                borderRadius:
                                  '5px',

                                background:
                                  item.color ||
                                  '#64748b',

                                color:
                                  textColor,

                                fontWeight:
                                  900,

                                letterSpacing:
                                  '0.06em',
                              }}
                            >
                              {item.code}
                            </span>

                          </td>


                          <td
                            style={{
                              ...tableCellStyle,

                              textAlign:
                                'left',

                              padding:
                                '8px 14px',
                            }}
                          >

                            {isEditing ? (
                              <input
                                type="text"

                                value={
                                  editingDescription
                                }

                                autoFocus

                                onChange={(
                                  event
                                ) =>
                                  setEditingDescription(
                                    event.target.value
                                  )
                                }

                                onKeyDown={(
                                  event
                                ) => {
                                  if (
                                    event.key ===
                                    'Enter'
                                  ) {
                                    saveDescription(
                                      item
                                    )
                                  }

                                  if (
                                    event.key ===
                                    'Escape'
                                  ) {
                                    cancelDescriptionEdit()
                                  }
                                }}

                                style={{
                                  width:
                                    '100%',

                                  height:
                                    '34px',

                                  padding:
                                    '0 9px',

                                  border:
                                    '1px solid #94a3b8',

                                  borderRadius:
                                    '5px',

                                  outline:
                                    'none',

                                  fontSize:
                                    '0.76rem',
                                }}
                              />
                            ) : (
                              <span
                                style={{
                                  color:
                                    '#1e293b',

                                  fontWeight:
                                    700,
                                }}
                              >
                                {item.description}
                              </span>
                            )}

                          </td>


                          <td
                            style={
                              tableCellStyle
                            }
                          >

                            <span
                              style={{
                                display:
                                  'inline-block',

                                padding:
                                  '5px 9px',

                                borderRadius:
                                  '999px',

                                background:
                                  item.is_active
                                    ? '#dcfce7'
                                    : '#f1f5f9',

                                color:
                                  item.is_active
                                    ? '#166534'
                                    : '#64748b',

                                fontSize:
                                  '0.66rem',

                                fontWeight:
                                  900,
                              }}
                            >
                              {item.is_active
                                ? 'Active'
                                : 'Inactive'}
                            </span>

                          </td>


                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            {formatDate(
                              item.created_at
                            )}
                          </td>


                          <td
                            style={
                              tableCellStyle
                            }
                          >

                            <div
                              style={{
                                display:
                                  'flex',

                                alignItems:
                                  'center',

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
                                      savingDescriptionId ===
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
                                      cancelDescriptionEdit
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
                                      beginDescriptionEdit(
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
                                      changingStatusId ===
                                      item.id
                                    }

                                    onClick={() =>
                                      setPackageActive(
                                        item,
                                        !item.is_active
                                      )
                                    }

                                    style={
                                      item.is_active
                                        ? smallDeactivateButtonStyle
                                        : smallActivateButtonStyle
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


      {/* ====================================================
          CREATE WORK PACKAGE MODAL
      ===================================================== */}

      {showCreateModal && (
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

            padding:
              '20px',

            background:
              'rgba(6, 27, 47, 0.55)',
          }}
        >

          <div
            style={{
              width:
                'min(460px, 96vw)',

              overflow:
                'hidden',

              borderRadius:
                '12px',

              background:
                '#ffffff',

              boxShadow:
                '0 28px 80px rgba(15,23,42,0.28)',
            }}
          >

            <div
              style={{
                padding:
                  '20px 22px',

                borderBottom:
                  '1px solid #e2e8f0',
              }}
            >

              <p
                style={{
                  margin:
                    '0 0 5px',

                  color:
                    '#009f8e',

                  fontSize:
                    '0.66rem',

                  fontWeight:
                    900,

                  letterSpacing:
                    '0.1em',

                  textTransform:
                    'uppercase',
                }}
              >
                WORK PACKAGE DATABASE
              </p>

              <h2
                style={{
                  margin:
                    0,

                  color:
                    '#061b2f',

                  fontSize:
                    '1.2rem',

                  fontWeight:
                    900,
                }}
              >
                Register Work Package
              </h2>

            </div>


            <form
              onSubmit={
                handleCreateWorkPackage
              }

              style={{
                padding:
                  '22px',
              }}
            >

              <div
                style={{
                  marginBottom:
                    '17px',
                }}
              >

                <label
                  style={
                    modalLabelStyle
                  }
                >
                  Work Package Code
                </label>

                <input
                  type="text"

                  value={
                    newCode
                  }

                  maxLength={
                    3
                  }

                  autoFocus

                  required

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
                    ...modalInputStyle,

                    maxWidth:
                      '120px',

                    fontWeight:
                      900,

                    textTransform:
                      'uppercase',

                    letterSpacing:
                      '0.08em',
                  }}
                />

                <p
                  style={{
                    margin:
                      '6px 0 0',

                    color:
                      '#7890a8',

                    fontSize:
                      '0.68rem',
                  }}
                >
                  Exactly 3 letters. The code
                  becomes the permanent project
                  identifier.
                </p>

              </div>


              <div
                style={{
                  marginBottom:
                    '18px',
                }}
              >

                <label
                  style={
                    modalLabelStyle
                  }
                >
                  Description
                </label>

                <input
                  type="text"

                  value={
                    newDescription
                  }

                  required

                  placeholder="Drywall"

                  onChange={(
                    event
                  ) =>
                    setNewDescription(
                      event.target.value
                    )
                  }

                  style={
                    modalInputStyle
                  }
                />

              </div>


              <div
                style={{
                  display:
                    'flex',

                  alignItems:
                    'center',

                  gap:
                    '10px',

                  marginBottom:
                    '20px',

                  padding:
                    '11px 12px',

                  border:
                    '1px solid #dbeafe',

                  borderRadius:
                    '7px',

                  background:
                    '#eff6ff',

                  color:
                    '#1e40af',

                  fontSize:
                    '0.7rem',

                  lineHeight:
                    1.45,
                }}
              >
                <span
                  style={{
                    fontSize:
                      '1rem',
                  }}
                >
                  🎨
                </span>

                <span>
                  RitsuFlow will automatically
                  assign an unused color to this
                  Work Package.
                </span>
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
                    setShowCreateModal(
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
                    creating ||
                    newCode.length !==
                      3 ||
                    !newDescription.trim()
                      ? disabledPrimaryButtonStyle
                      : primaryButtonStyle
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


// ============================================================
// STYLES
// ============================================================

const primaryButtonStyle = {
  minHeight:
    '38px',

  padding:
    '0 13px',

  border:
    '1px solid #008f80',

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


const disabledPrimaryButtonStyle = {
  ...primaryButtonStyle,

  opacity:
    0.45,

  cursor:
    'not-allowed',
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


const smallButtonStyle = {
  minHeight:
    '29px',

  padding:
    '0 9px',

  border:
    '1px solid #cbd5e1',

  borderRadius:
    '5px',

  background:
    '#ffffff',

  color:
    '#334155',

  fontSize:
    '0.65rem',

  fontWeight:
    800,

  cursor:
    'pointer',
}


const smallPrimaryButtonStyle = {
  ...smallButtonStyle,

  border:
    '1px solid #0d9488',

  background:
    '#0d9488',

  color:
    '#ffffff',
}


const smallDeactivateButtonStyle = {
  ...smallButtonStyle,

  border:
    '1px solid #fecaca',

  background:
    '#fff1f2',

  color:
    '#be123c',
}


const smallActivateButtonStyle = {
  ...smallButtonStyle,

  border:
    '1px solid #99f6e4',

  background:
    '#f0fdfa',

  color:
    '#0f766e',
}


const tableHeaderStyle = {
  padding:
    '10px 9px',

  borderBottom:
    '1px solid #cbd5e1',

  background:
    '#f8fafc',

  color:
    '#536a86',

  textAlign:
    'center',

  fontSize:
    '0.65rem',

  fontWeight:
    900,

  letterSpacing:
    '0.05em',

  textTransform:
    'uppercase',
}


const tableCellStyle = {
  padding:
    '8px 9px',

  borderBottom:
    '1px solid #e6edf3',

  color:
    '#536a86',

  textAlign:
    'center',

  verticalAlign:
    'middle',
}


const modalLabelStyle = {
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


const modalInputStyle = {
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

  background:
    '#ffffff',

  color:
    '#0f172a',

  fontSize:
    '0.8rem',

  outline:
    'none',
}
