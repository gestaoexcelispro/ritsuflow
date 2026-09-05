'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '../../../lib/supabase/client'

const PROJECT_COVER_BUCKET =
  'project-covers'

const PROJECT_VIEW_STORAGE_KEY =
  'ritsuflow-projects-view'

const statusLabels = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  archived: 'Archived',
}

function formatLocation(project) {
  const cityAndState = [
    project.city,
    project.state_region,
  ].filter(Boolean)

  if (cityAndState.length > 0) {
    return cityAndState.join(', ')
  }

  return (
    project.country_code ||
    'Not specified'
  )
}

function formatContractValue(project) {
  if (
    project.contract_value === null ||
    project.contract_value === undefined
  ) {
    return '—'
  }

  try {
    return new Intl.NumberFormat(
      'en-US',
      {
        style: 'currency',
        currency:
          project.currency_code ||
          'USD',
      }
    ).format(
      Number(
        project.contract_value
      )
    )
  } catch {
    return String(
      project.contract_value
    )
  }
}

function getStatusStyle(status) {
  const styles = {
    planning: {
      backgroundColor: '#eff6ff',
      color: '#1d4ed8',
      borderColor: '#bfdbfe',
    },

    active: {
      backgroundColor: '#ecfdf5',
      color: '#047857',
      borderColor: '#a7f3d0',
    },

    on_hold: {
      backgroundColor: '#fffbeb',
      color: '#b45309',
      borderColor: '#fde68a',
    },

    completed: {
      backgroundColor: '#f0fdf4',
      color: '#15803d',
      borderColor: '#bbf7d0',
    },

    archived: {
      backgroundColor: '#f8fafc',
      color: '#64748b',
      borderColor: '#cbd5e1',
    },
  }

  return (
    styles[status] ||
    styles.archived
  )
}

function ListIcon() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '3px',
        width: '14px',
      }}
    >
      <span
        style={{
          display: 'block',
          height: '2px',
          borderRadius: '999px',
          backgroundColor:
            'currentColor',
        }}
      />

      <span
        style={{
          display: 'block',
          height: '2px',
          borderRadius: '999px',
          backgroundColor:
            'currentColor',
        }}
      />

      <span
        style={{
          display: 'block',
          height: '2px',
          borderRadius: '999px',
          backgroundColor:
            'currentColor',
        }}
      />
    </span>
  )
}

function CardsIcon() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'grid',
        gridTemplateColumns:
          'repeat(2, 5px)',
        gridTemplateRows:
          'repeat(2, 5px)',
        gap: '2px',
      }}
    >
      {Array.from({
        length: 4,
      }).map((_, index) => (
        <span
          key={index}
          style={{
            display: 'block',
            borderRadius: '1px',
            backgroundColor:
              'currentColor',
          }}
        />
      ))}
    </span>
  )
}

export default function ProjectsPage() {
  const [projects, setProjects] =
    useState([])

  const [isLoading, setIsLoading] =
    useState(true)

  const [
    deletingProjectId,
    setDeletingProjectId,
  ] = useState(null)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [viewMode, setViewMode] =
    useState('list')

  const [
    topbarTarget,
    setTopbarTarget,
  ] = useState(null)

  const fetchProjects =
    useCallback(async () => {
      setIsLoading(true)
      setErrorMessage('')

      const supabase =
        createClient()

      const {
        data,
        error,
      } = await supabase
        .from('projects')
        .select(`
          id,
          code,
          name,
          client_name,
          contract_value,
          currency_code,
          city,
          state_region,
          country_code,
          status,
          cover_image_path,
          created_at
        `)
        .order('created_at', {
          ascending: false,
        })

      if (error) {
        console.error(
          'Projects could not be loaded.',
          error
        )

        setErrorMessage(
          `Unable to load projects: ${error.message}`
        )
      } else {
        setProjects(data || [])
      }

      setIsLoading(false)
    }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  useEffect(() => {
    const target =
      document.getElementById(
        'dashboard-topbar-actions'
      )

    setTopbarTarget(target)
  }, [])

  useEffect(() => {
    const savedView =
      window.localStorage.getItem(
        PROJECT_VIEW_STORAGE_KEY
      )

    if (
      savedView === 'list' ||
      savedView === 'cards'
    ) {
      setViewMode(savedView)
    }
  }, [])

  function changeViewMode(
    nextViewMode
  ) {
    setViewMode(nextViewMode)

    window.localStorage.setItem(
      PROJECT_VIEW_STORAGE_KEY,
      nextViewMode
    )
  }

  async function handleDelete(
    project
  ) {
    const confirmed =
      window.confirm(
        `Delete project "${project.name}"? This will permanently remove the project and all related data from every RitsuFlow module.`
      )

    if (!confirmed) {
      return
    }

    setDeletingProjectId(
      project.id
    )

    setErrorMessage('')

    const supabase =
      createClient()

    const { error } =
      await supabase.rpc(
        'delete_project_everywhere',
        {
          target_project_id:
            project.id,
        }
      )

    if (error) {
      console.error(
        'Project could not be deleted.',
        error
      )

      setErrorMessage(
        `Unable to delete the project: ${error.message}`
      )

      setDeletingProjectId(null)
      return
    }

    if (project.cover_image_path) {
      const {
        error: storageError,
      } = await supabase.storage
        .from(
          PROJECT_COVER_BUCKET
        )
        .remove([
          project.cover_image_path,
        ])

      if (storageError) {
        console.warn(
          'The project was deleted, but its cover image could not be removed from Storage.',
          storageError
        )
      }
    }

    setProjects(
      (currentProjects) =>
        currentProjects.filter(
          (currentProject) =>
            currentProject.id !==
            project.id
        )
    )

    setDeletingProjectId(null)
  }

  const topbarActions =
    topbarTarget
      ? createPortal(
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent:
                'flex-end',
              gap: '12px',
              minWidth: 0,
            }}
          >
            <div
              role="group"
              aria-label="Project view"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px',
                border:
                  '1px solid #e2e8f0',
                borderRadius: '8px',
                backgroundColor:
                  '#f8fafc',
              }}
            >
              <button
                type="button"
                onClick={() =>
                  changeViewMode(
                    'list'
                  )
                }
                aria-pressed={
                  viewMode === 'list'
                }
                style={{
                  display:
                    'inline-flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'center',
                  gap: '7px',
                  minHeight: '36px',
                  padding:
                    '0 12px',
                  border: 'none',
                  borderRadius:
                    '6px',
                  backgroundColor:
                    viewMode ===
                    'list'
                      ? '#ffffff'
                      : 'transparent',
                  color:
                    viewMode ===
                    'list'
                      ? '#0f172a'
                      : '#64748b',
                  boxShadow:
                    viewMode ===
                    'list'
                      ? '0 1px 2px rgba(15, 23, 42, 0.08)'
                      : 'none',
                  cursor:
                    'pointer',
                  fontSize:
                    '0.82rem',
                  fontWeight: 800,
                }}
              >
                <ListIcon />
                List
              </button>

              <button
                type="button"
                onClick={() =>
                  changeViewMode(
                    'cards'
                  )
                }
                aria-pressed={
                  viewMode ===
                  'cards'
                }
                style={{
                  display:
                    'inline-flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'center',
                  gap: '7px',
                  minHeight: '36px',
                  padding:
                    '0 12px',
                  border: 'none',
                  borderRadius:
                    '6px',
                  backgroundColor:
                    viewMode ===
                    'cards'
                      ? '#ffffff'
                      : 'transparent',
                  color:
                    viewMode ===
                    'cards'
                      ? '#0f172a'
                      : '#64748b',
                  boxShadow:
                    viewMode ===
                    'cards'
                      ? '0 1px 2px rgba(15, 23, 42, 0.08)'
                      : 'none',
                  cursor:
                    'pointer',
                  fontSize:
                    '0.82rem',
                  fontWeight: 800,
                }}
              >
                <CardsIcon />
                Cards
              </button>
            </div>

            <Link
              href="/dashboard/projects/setup?mode=new"
              style={{
                display:
                  'inline-flex',
                alignItems: 'center',
                justifyContent:
                  'center',
                minHeight: '42px',
                padding: '0 18px',
                borderRadius: '8px',
                backgroundColor:
                  '#1d4ed8',
                color: '#ffffff',
                fontSize: '0.86rem',
                fontWeight: 800,
                textDecoration:
                  'none',
                whiteSpace: 'nowrap',
                boxShadow:
                  '0 1px 2px rgba(15, 23, 42, 0.08)',
              }}
            >
              + New Project
            </Link>
          </div>,
          topbarTarget
        )
      : null

  return (
    <>
      {topbarActions}

      <div
        style={{
          padding: '32px 40px 40px',
        }}
      >
        {errorMessage && (
          <div
            role="alert"
            style={{
              marginBottom: '18px',
              padding:
                '12px 15px',
              border:
                '1px solid #feb2b2',
              borderRadius: '8px',
              backgroundColor:
                '#fff5f5',
              color: '#c53030',
            }}
          >
            {errorMessage}
          </div>
        )}

        {viewMode === 'list' ? (
          <div
            style={{
              overflowX: 'auto',
              borderRadius: '10px',
              backgroundColor:
                '#ffffff',
              border:
                '1px solid #e2e8f0',
              boxShadow:
                '0 1px 3px rgba(15, 23, 42, 0.04)',
            }}
          >
            <table
              style={{
                width: '100%',
                minWidth: '920px',
                borderCollapse:
                  'collapse',
                textAlign: 'left',
              }}
            >
              <thead
                style={{
                  borderBottom:
                    '1px solid #e2e8f0',
                  backgroundColor:
                    '#f8fafc',
                }}
              >
                <tr>
                  <th
                    style={
                      headerCellStyle
                    }
                  >
                    Code
                  </th>

                  <th
                    style={
                      headerCellStyle
                    }
                  >
                    Project
                  </th>

                  <th
                    style={
                      headerCellStyle
                    }
                  >
                    Client
                  </th>

                  <th
                    style={
                      headerCellStyle
                    }
                  >
                    Contract Value
                  </th>

                  <th
                    style={
                      headerCellStyle
                    }
                  >
                    Location
                  </th>

                  <th
                    style={
                      headerCellStyle
                    }
                  >
                    Status
                  </th>

                  <th
                    style={
                      headerCellStyle
                    }
                  >
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan="7"
                      style={
                        emptyCellStyle
                      }
                    >
                      Loading projects...
                    </td>
                  </tr>
                ) : projects.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      style={
                        emptyCellStyle
                      }
                    >
                      No projects configured yet.
                    </td>
                  </tr>
                ) : (
                  projects.map(
                    (
                      project
                    ) => {
                      const statusStyle =
                        getStatusStyle(
                          project.status
                        )

                      return (
                        <tr
                          key={
                            project.id
                          }
                          style={{
                            borderBottom:
                              '1px solid #e2e8f0',
                          }}
                        >
                          <td
                            style={
                              bodyCellStyle
                            }
                          >
                            <strong
                              style={{
                                color:
                                  '#1e3a5f',
                              }}
                            >
                              {project.code ||
                                '—'}
                            </strong>
                          </td>

                          <td
                            style={
                              bodyCellStyle
                            }
                          >
                            <strong
                              style={{
                                color:
                                  '#0f172a',
                              }}
                            >
                              {
                                project.name
                              }
                            </strong>
                          </td>

                          <td
                            style={
                              bodyCellStyle
                            }
                          >
                            {project.client_name ||
                              '—'}
                          </td>

                          <td
                            style={
                              bodyCellStyle
                            }
                          >
                            <strong
                              style={{
                                color:
                                  '#1d4ed8',
                              }}
                            >
                              {formatContractValue(
                                project
                              )}
                            </strong>
                          </td>

                          <td
                            style={
                              bodyCellStyle
                            }
                          >
                            {formatLocation(
                              project
                            )}
                          </td>

                          <td
                            style={
                              bodyCellStyle
                            }
                          >
                            <span
                              style={{
                                display:
                                  'inline-flex',
                                alignItems:
                                  'center',
                                minHeight:
                                  '28px',
                                padding:
                                  '0 10px',
                                border:
                                  `1px solid ${statusStyle.borderColor}`,
                                borderRadius:
                                  '999px',
                                backgroundColor:
                                  statusStyle.backgroundColor,
                                color:
                                  statusStyle.color,
                                fontSize:
                                  '0.76rem',
                                fontWeight:
                                  800,
                                whiteSpace:
                                  'nowrap',
                              }}
                            >
                              {statusLabels[
                                project
                                  .status
                              ] ||
                                project.status}
                            </span>
                          </td>

                          <td
                            style={{
                              ...bodyCellStyle,
                              whiteSpace:
                                'nowrap',
                            }}
                          >
                            <Link
                              href={`/dashboard/projects/setup?projectId=${project.id}`}
                              style={{
                                display:
                                  'inline-flex',
                                marginRight:
                                  '8px',
                                padding:
                                  '7px 12px',
                                borderRadius:
                                  '6px',
                                backgroundColor:
                                  '#eff6ff',
                                color:
                                  '#1d4ed8',
                                fontSize:
                                  '0.8rem',
                                fontWeight:
                                  800,
                                textDecoration:
                                  'none',
                              }}
                            >
                              Setup
                            </Link>

                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(
                                  project
                                )
                              }
                              disabled={
                                deletingProjectId ===
                                project.id
                              }
                              style={{
                                border:
                                  'none',
                                padding:
                                  '7px 12px',
                                borderRadius:
                                  '6px',
                                backgroundColor:
                                  '#fef2f2',
                                color:
                                  '#dc2626',
                                cursor:
                                  deletingProjectId ===
                                  project.id
                                    ? 'not-allowed'
                                    : 'pointer',
                                fontSize:
                                  '0.8rem',
                                fontWeight:
                                  800,
                                opacity:
                                  deletingProjectId ===
                                  project.id
                                    ? 0.6
                                    : 1,
                              }}
                            >
                              {deletingProjectId ===
                              project.id
                                ? 'Deleting...'
                                : 'Delete'}
                            </button>
                          </td>
                        </tr>
                      )
                    }
                  )
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div>
            {isLoading ? (
              <div
                style={
                  cardEmptyStateStyle
                }
              >
                Loading projects...
              </div>
            ) : projects.length ===
              0 ? (
              <div
                style={
                  cardEmptyStateStyle
                }
              >
                No projects configured yet.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: '18px',
                }}
              >
                {projects.map(
                  (
                    project
                  ) => {
                    const statusStyle =
                      getStatusStyle(
                        project.status
                      )

                    return (
                      <article
                        key={
                          project.id
                        }
                        style={{
                          display:
                            'flex',
                          flexDirection:
                            'column',
                          minHeight:
                            '260px',
                          padding:
                            '22px',
                          border:
                            '1px solid #e2e8f0',
                          borderRadius:
                            '12px',
                          backgroundColor:
                            '#ffffff',
                          boxShadow:
                            '0 1px 3px rgba(15, 23, 42, 0.04)',
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
                            gap: '12px',
                            marginBottom:
                              '16px',
                          }}
                        >
                          <span
                            style={{
                              color:
                                '#64748b',
                              fontSize:
                                '0.76rem',
                              fontWeight:
                                900,
                              letterSpacing:
                                '0.06em',
                              textTransform:
                                'uppercase',
                            }}
                          >
                            {project.code ||
                              '—'}
                          </span>

                          <span
                            style={{
                              display:
                                'inline-flex',
                              alignItems:
                                'center',
                              minHeight:
                                '28px',
                              padding:
                                '0 10px',
                              border:
                                `1px solid ${statusStyle.borderColor}`,
                              borderRadius:
                                '999px',
                              backgroundColor:
                                statusStyle.backgroundColor,
                              color:
                                statusStyle.color,
                              fontSize:
                                '0.74rem',
                              fontWeight:
                                800,
                              whiteSpace:
                                'nowrap',
                            }}
                          >
                            {statusLabels[
                              project
                                .status
                            ] ||
                              project.status}
                          </span>
                        </div>

                        <h2
                          style={{
                            margin:
                              '0 0 8px',
                            color:
                              '#0f172a',
                            fontSize:
                              '1.06rem',
                            lineHeight:
                              1.35,
                            fontWeight:
                              900,
                          }}
                        >
                          {project.name}
                        </h2>

                        <p
                          style={{
                            margin:
                              '0 0 4px',
                            color:
                              '#475569',
                            fontSize:
                              '0.9rem',
                            lineHeight:
                              1.5,
                          }}
                        >
                          {project.client_name ||
                            'Client not specified'}
                        </p>

                        <p
                          style={{
                            margin:
                              '0 0 18px',
                            color:
                              '#64748b',
                            fontSize:
                              '0.86rem',
                            lineHeight:
                              1.5,
                          }}
                        >
                          {formatLocation(
                            project
                          )}
                        </p>

                        <div
                          style={{
                            marginTop:
                              'auto',
                            paddingTop:
                              '16px',
                            borderTop:
                              '1px solid #e2e8f0',
                          }}
                        >
                          <div
                            style={{
                              marginBottom:
                                '16px',
                            }}
                          >
                            <div
                              style={{
                                marginBottom:
                                  '4px',
                                color:
                                  '#64748b',
                                fontSize:
                                  '0.72rem',
                                fontWeight:
                                  800,
                                letterSpacing:
                                  '0.04em',
                                textTransform:
                                  'uppercase',
                              }}
                            >
                              Contract Value
                            </div>

                            <strong
                              style={{
                                color:
                                  '#1d4ed8',
                                fontSize:
                                  '1rem',
                              }}
                            >
                              {formatContractValue(
                                project
                              )}
                            </strong>
                          </div>

                          <div
                            style={{
                              display:
                                'flex',
                              alignItems:
                                'center',
                              gap: '8px',
                            }}
                          >
                            <Link
                              href={`/dashboard/projects/setup?projectId=${project.id}`}
                              style={{
                                display:
                                  'inline-flex',
                                alignItems:
                                  'center',
                                justifyContent:
                                  'center',
                                minHeight:
                                  '36px',
                                padding:
                                  '0 14px',
                                borderRadius:
                                  '7px',
                                backgroundColor:
                                  '#eff6ff',
                                color:
                                  '#1d4ed8',
                                fontSize:
                                  '0.8rem',
                                fontWeight:
                                  800,
                                textDecoration:
                                  'none',
                              }}
                            >
                              Setup
                            </Link>

                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(
                                  project
                                )
                              }
                              disabled={
                                deletingProjectId ===
                                project.id
                              }
                              style={{
                                minHeight:
                                  '36px',
                                border:
                                  'none',
                                padding:
                                  '0 14px',
                                borderRadius:
                                  '7px',
                                backgroundColor:
                                  '#fef2f2',
                                color:
                                  '#dc2626',
                                cursor:
                                  deletingProjectId ===
                                  project.id
                                    ? 'not-allowed'
                                    : 'pointer',
                                fontSize:
                                  '0.8rem',
                                fontWeight:
                                  800,
                                opacity:
                                  deletingProjectId ===
                                  project.id
                                    ? 0.6
                                    : 1,
                              }}
                            >
                              {deletingProjectId ===
                              project.id
                                ? 'Deleting...'
                                : 'Delete'}
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  }
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

const headerCellStyle = {
  padding: '15px 20px',
  color: '#64748b',
  fontSize: '0.76rem',
  fontWeight: 900,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
}

const bodyCellStyle = {
  padding: '15px 20px',
  color: '#475569',
  fontSize: '0.88rem',
  verticalAlign: 'middle',
}

const emptyCellStyle = {
  padding: '40px 20px',
  color: '#64748b',
  textAlign: 'center',
}

const cardEmptyStateStyle = {
  padding: '50px 24px',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  backgroundColor: '#ffffff',
  color: '#64748b',
  textAlign: 'center',
}
