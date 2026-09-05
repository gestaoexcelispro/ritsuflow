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

const SIGNED_URL_DURATION =
  60 * 60

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

function AnimatedWorkspaceBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <style>
        {`
          @keyframes ritsuflowFloatOne {
            0% {
              transform: translate3d(0, 0, 0) rotate(0deg);
            }

            50% {
              transform: translate3d(18px, -16px, 0) rotate(7deg);
            }

            100% {
              transform: translate3d(0, 0, 0) rotate(0deg);
            }
          }

          @keyframes ritsuflowFloatTwo {
            0% {
              transform: translate3d(0, 0, 0) rotate(0deg);
            }

            50% {
              transform: translate3d(-20px, 14px, 0) rotate(-8deg);
            }

            100% {
              transform: translate3d(0, 0, 0) rotate(0deg);
            }
          }

          @keyframes ritsuflowArcDrift {
            0% {
              transform: translate3d(0, 0, 0) scale(1);
            }

            50% {
              transform: translate3d(24px, -12px, 0) scale(1.03);
            }

            100% {
              transform: translate3d(0, 0, 0) scale(1);
            }
          }

          @keyframes ritsuflowPulse {
            0% {
              opacity: 0.35;
              transform: scale(0.95);
            }

            50% {
              opacity: 0.75;
              transform: scale(1.08);
            }

            100% {
              opacity: 0.35;
              transform: scale(0.95);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .ritsuflow-motion {
              animation: none !important;
            }
          }
        `}
      </style>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(135deg, #f8fbff 0%, #f6fbfd 45%, #f8fcfa 100%)',
        }}
      />

      <div
        className="ritsuflow-motion"
        style={{
          position: 'absolute',
          top: '-270px',
          left: '-220px',
          width: '720px',
          height: '720px',
          borderRadius: '50%',
          border:
            '58px solid rgba(37, 99, 235, 0.045)',
          animation:
            'ritsuflowArcDrift 18s ease-in-out infinite',
        }}
      />

      <div
        className="ritsuflow-motion"
        style={{
          position: 'absolute',
          right: '-360px',
          bottom: '-390px',
          width: '860px',
          height: '860px',
          borderRadius: '50%',
          border:
            '64px solid rgba(20, 184, 166, 0.045)',
          animation:
            'ritsuflowArcDrift 22s ease-in-out infinite reverse',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: '8%',
          right: '21%',
          width: '180px',
          height: '110px',
          opacity: 0.42,
          backgroundImage:
            'radial-gradient(circle, rgba(100,116,139,0.26) 1.2px, transparent 1.2px)',
          backgroundSize:
            '16px 16px',
        }}
      />

      <div
        style={{
          position: 'absolute',
          right: '8%',
          bottom: '12%',
          width: '170px',
          height: '110px',
          opacity: 0.32,
          backgroundImage:
            'radial-gradient(circle, rgba(100,116,139,0.24) 1.2px, transparent 1.2px)',
          backgroundSize:
            '16px 16px',
        }}
      />

      <div
        className="ritsuflow-motion"
        style={{
          position: 'absolute',
          top: '18%',
          right: '8%',
          width: '42px',
          height: '42px',
          border:
            '2px solid rgba(37, 99, 235, 0.30)',
          borderRadius: '11px',
          animation:
            'ritsuflowFloatOne 11s ease-in-out infinite',
        }}
      />

      <div
        className="ritsuflow-motion"
        style={{
          position: 'absolute',
          top: '34%',
          right: '33%',
          width: '28px',
          height: '28px',
          borderRadius: '8px',
          background:
            'rgba(45, 212, 191, 0.18)',
          animation:
            'ritsuflowFloatTwo 9s ease-in-out infinite',
        }}
      />

      <div
        className="ritsuflow-motion"
        style={{
          position: 'absolute',
          bottom: '16%',
          left: '6%',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          background:
            'rgba(45, 212, 191, 0.45)',
          animation:
            'ritsuflowPulse 6s ease-in-out infinite',
        }}
      />

      <div
        className="ritsuflow-motion"
        style={{
          position: 'absolute',
          bottom: '22%',
          right: '28%',
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          background:
            'rgba(59, 130, 246, 0.34)',
          animation:
            'ritsuflowPulse 7s ease-in-out infinite 1s',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: '-160px',
          bottom: '-110px',
          width: '470px',
          height: '280px',
          borderRadius:
            '50% 50% 0 0',
          background:
            'linear-gradient(135deg, rgba(191,219,254,0.26), rgba(204,251,241,0.17))',
          filter: 'blur(2px)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: '-120px',
          right: '-20px',
          width: '520px',
          height: '300px',
          borderRadius:
            '0 0 0 80%',
          background:
            'linear-gradient(225deg, rgba(204,251,241,0.24), rgba(219,234,254,0.10))',
        }}
      />
    </div>
  )
}

export default function ProjectsPage() {
  const [projects, setProjects] =
    useState([])

  const [
    projectCoverUrls,
    setProjectCoverUrls,
  ] = useState({})

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

        setProjects([])
        setIsLoading(false)
        return
      }

      const loadedProjects =
        data || []

      setProjects(
        loadedProjects
      )

      const coverProjects =
        loadedProjects.filter(
          (project) =>
            project.cover_image_path
        )

      if (
        coverProjects.length ===
        0
      ) {
        setProjectCoverUrls({})
        setIsLoading(false)
        return
      }

      const coverEntries =
        await Promise.all(
          coverProjects.map(
            async (project) => {
              const {
                data:
                  signedUrlData,
                error:
                  signedUrlError,
              } =
                await supabase.storage
                  .from(
                    PROJECT_COVER_BUCKET
                  )
                  .createSignedUrl(
                    project.cover_image_path,
                    SIGNED_URL_DURATION
                  )

              if (
                signedUrlError ||
                !signedUrlData?.signedUrl
              ) {
                console.error(
                  `Project cover could not be loaded for ${project.code || project.id}.`,
                  signedUrlError
                )

                return [
                  project.id,
                  null,
                ]
              }

              return [
                project.id,
                signedUrlData.signedUrl,
              ]
            }
          )
        )

      const nextCoverUrls = {}

      coverEntries.forEach(
        ([
          projectId,
          signedUrl,
        ]) => {
          if (signedUrl) {
            nextCoverUrls[
              projectId
            ] = signedUrl
          }
        }
      )

      setProjectCoverUrls(
        nextCoverUrls
      )

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

    setProjectCoverUrls(
      (currentUrls) => {
        const nextUrls = {
          ...currentUrls,
        }

        delete nextUrls[
          project.id
        ]

        return nextUrls
      }
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
          position: 'relative',
          minHeight:
            'calc(100vh - 88px)',
          overflow: 'hidden',
        }}
      >
        <AnimatedWorkspaceBackground />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            padding:
              '72px 40px 48px',
          }}
        >
          {errorMessage && (
            <div
              role="alert"
              style={{
                marginBottom:
                  '18px',
                padding:
                  '12px 15px',
                border:
                  '1px solid #feb2b2',
                borderRadius:
                  '8px',
                backgroundColor:
                  '#fff5f5',
                color: '#c53030',
              }}
            >
              {errorMessage}
            </div>
          )}

          {viewMode ===
          'list' ? (
            <div
              style={{
                overflowX:
                  'auto',
                borderRadius:
                  '12px',
                backgroundColor:
                  'rgba(255,255,255,0.94)',
                border:
                  '1px solid rgba(226,232,240,0.92)',
                boxShadow:
                  '0 12px 34px rgba(15, 23, 42, 0.07)',
                backdropFilter:
                  'blur(10px)',
              }}
            >
              <table
                style={{
                  width:
                    '100%',
                  minWidth:
                    '920px',
                  borderCollapse:
                    'collapse',
                  textAlign:
                    'left',
                }}
              >
                <thead
                  style={{
                    borderBottom:
                      '1px solid #e2e8f0',
                    backgroundColor:
                      'rgba(248,250,252,0.96)',
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
                      'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '20px',
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

                      const coverUrl =
                        projectCoverUrls[
                          project.id
                        ]

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
                            overflow:
                              'hidden',
                            border:
                              '1px solid rgba(226,232,240,0.92)',
                            borderRadius:
                              '14px',
                            backgroundColor:
                              'rgba(255,255,255,0.95)',
                            boxShadow:
                              '0 14px 36px rgba(15, 23, 42, 0.09)',
                            backdropFilter:
                              'blur(10px)',
                          }}
                        >
                          <div
                            style={{
                              position:
                                'relative',
                              width:
                                '100%',
                              aspectRatio:
                                '16 / 9',
                              overflow:
                                'hidden',
                              background:
                                'linear-gradient(135deg, #e2e8f0 0%, #f8fafc 100%)',
                            }}
                          >
                            {coverUrl ? (
                              <img
                                src={
                                  coverUrl
                                }
                                alt={`${project.name} cover`}
                                style={{
                                  display:
                                    'block',
                                  width:
                                    '100%',
                                  height:
                                    '100%',
                                  objectFit:
                                    'cover',
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  display:
                                    'flex',
                                  alignItems:
                                    'center',
                                  justifyContent:
                                    'center',
                                  width:
                                    '100%',
                                  height:
                                    '100%',
                                  color:
                                    '#94a3b8',
                                  fontSize:
                                    '0.78rem',
                                  fontWeight:
                                    800,
                                  letterSpacing:
                                    '0.04em',
                                  textTransform:
                                    'uppercase',
                                }}
                              >
                                No cover image
                              </div>
                            )}
                          </div>

                          <div
                            style={{
                              display:
                                'flex',
                              flexDirection:
                                'column',
                              flex: 1,
                              padding:
                                '20px 22px 22px',
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
  border:
    '1px solid rgba(226,232,240,0.92)',
  borderRadius: '12px',
  backgroundColor:
    'rgba(255,255,255,0.94)',
  color: '#64748b',
  textAlign: 'center',
  boxShadow:
    '0 12px 30px rgba(15, 23, 42, 0.06)',
  backdropFilter:
    'blur(10px)',
}
