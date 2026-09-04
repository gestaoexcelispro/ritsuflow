'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import { createClient } from '../../../lib/supabase/client'

const PROJECT_COVER_BUCKET =
  'project-covers'

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

  return (
    <div style={{ padding: '40px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent:
            'space-between',
          alignItems: 'center',
          gap: '24px',
          marginBottom: '30px',
        }}
      >
        <div>
          <h1
            style={{
              color: '#2A4365',
              margin: '0 0 10px 0',
              borderBottom:
                '2px solid #e2e8f0',
              paddingBottom: '10px',
            }}
          >
            Projects
          </h1>

          <p
            style={{
              color: '#4a5568',
              margin: 0,
            }}
          >
            Create and manage the projects used across every RitsuFlow module.
          </p>
        </div>

        <Link
          href="/dashboard/projects/setup?mode=new"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: '44px',
            padding: '0 20px',
            borderRadius: '8px',
            backgroundColor:
              '#1d4ed8',
            color: 'white',
            fontWeight: 'bold',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          + New Project
        </Link>
      </div>

      {errorMessage && (
        <div
          role="alert"
          style={{
            marginBottom: '18px',
            padding: '12px 15px',
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

      <div
        style={{
          overflowX: 'auto',
          borderRadius: '8px',
          backgroundColor: 'white',
          boxShadow:
            '0 2px 4px rgba(0,0,0,0.05)',
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
                '2px solid #e2e8f0',
              backgroundColor:
                '#f7fafc',
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
                (project) => (
                  <tr
                    key={project.id}
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
                            '#1a365d',
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
                            '#2d3748',
                        }}
                      >
                        {project.name}
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
                            '#2b6cb0',
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
                      {statusLabels[
                        project.status
                      ] ||
                        project.status}
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
                            '#ebf8ff',
                          color:
                            '#2b6cb0',
                          fontSize:
                            '0.8rem',
                          fontWeight:
                            'bold',
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
                          border: 'none',
                          padding:
                            '7px 12px',
                          borderRadius:
                            '6px',
                          backgroundColor:
                            '#fed7d7',
                          color:
                            '#c53030',
                          cursor:
                            deletingProjectId ===
                            project.id
                              ? 'not-allowed'
                              : 'pointer',
                          fontSize:
                            '0.8rem',
                          fontWeight:
                            'bold',
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
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const headerCellStyle = {
  padding: '15px 20px',
  color: '#4a5568',
  fontWeight: 'bold',
  whiteSpace: 'nowrap',
}

const bodyCellStyle = {
  padding: '15px 20px',
  color: '#4a5568',
}

const emptyCellStyle = {
  padding: '30px 20px',
  color: '#718096',
  textAlign: 'center',
}



