'use client'

import {
  useMemo,
  useState,
} from 'react'

import {
  useRouter,
} from 'next/navigation'

import {
  createClient,
} from '../../../../lib/supabase/client'

import styles from './users-access.module.css'


const roleLabels = {
  admin: 'Admin',
  manager: 'Manager',
  user: 'User',
}

const accessLabels = {
  all_projects: 'All Projects',
  selected_projects: 'Selected Projects',
}

const statusLabels = {
  active: 'Active',
  disabled: 'Inactive',
}


function normalizeProjectIds(value) {
  return Array.isArray(value)
    ? value.filter(Boolean)
    : []
}


function getInitialForm(user) {
  const role =
    user?.role || 'user'

  let projectAccessMode =
    user?.project_access_mode ||
    'selected_projects'

  if (role === 'admin') {
    projectAccessMode =
      'all_projects'
  }

  if (role === 'user') {
    projectAccessMode =
      'selected_projects'
  }

  return {
    userId:
      user?.user_id || null,

    fullName:
      user?.full_name || '',

    email:
      user?.email || '',

    role,

    projectAccessMode,

    status:
      user?.membership_status ||
      'active',

    projectIds:
      normalizeProjectIds(
        user?.project_ids
      ),
  }
}


export default function UsersAccessClient({
  organization,
  currentUserId,
  initialUsers,
  projects,
}) {
  const router =
    useRouter()

  const supabase =
    useMemo(
      () =>
        createClient(),
      []
    )

  const [
    users,
    setUsers,
  ] =
    useState(
      initialUsers || []
    )

  const [
    search,
    setSearch,
  ] =
    useState('')

  const [
    modalMode,
    setModalMode,
  ] =
    useState(null)

  const [
    form,
    setForm,
  ] =
    useState(
      getInitialForm(null)
    )

  const [
    isSaving,
    setIsSaving,
  ] =
    useState(false)

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


  const filteredUsers =
    useMemo(() => {
      const normalized =
        search
          .trim()
          .toLowerCase()

      if (!normalized) {
        return users
      }

      return users.filter(
        (user) => {
          const searchable =
            [
              user.full_name,
              user.email,
              user.role,
              user.membership_status,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()

          return searchable.includes(
            normalized
          )
        }
      )
    }, [
      users,
      search,
    ])


  function openAddUser() {
    setErrorMessage('')
    setSuccessMessage('')

    setForm(
      getInitialForm(null)
    )

    setModalMode('add')
  }


  function openEditUser(user) {
    setErrorMessage('')
    setSuccessMessage('')

    setForm(
      getInitialForm(user)
    )

    setModalMode('edit')
  }


  function closeModal() {
    if (isSaving) {
      return
    }

    setModalMode(null)
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

        if (field === 'role') {
          if (value === 'admin') {
            next.projectAccessMode =
              'all_projects'

            next.projectIds = []
          }

          if (value === 'user') {
            next.projectAccessMode =
              'selected_projects'
          }
        }

        if (
          field ===
            'projectAccessMode' &&
          value === 'all_projects'
        ) {
          next.projectIds = []
        }

        return next
      }
    )
  }


  function toggleProject(projectId) {
    setForm(
      (current) => {
        const selected =
          new Set(
            current.projectIds
          )

        if (
          selected.has(
            projectId
          )
        ) {
          selected.delete(
            projectId
          )
        } else {
          selected.add(
            projectId
          )
        }

        return {
          ...current,

          projectIds:
            Array.from(
              selected
            ),
        }
      }
    )
  }


  async function refreshUsers() {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'get_administration_users',
        {
          target_organization_id:
            organization.id,
        }
      )

    if (error) {
      throw error
    }

    setUsers(
      data || []
    )
  }


  function validateForm() {
    if (
      modalMode === 'add' &&
      !form.fullName.trim()
    ) {
      return 'Name is required.'
    }

    if (
      modalMode === 'add' &&
      !form.email.trim()
    ) {
      return 'Email is required.'
    }

    if (
      form.projectAccessMode ===
        'selected_projects' &&
      form.projectIds.length === 0
    ) {
      return (
        'Select at least one project.'
      )
    }

    return null
  }


  async function saveExistingUser() {
    const {
      error,
    } =
      await supabase.rpc(
        'set_organization_member_access',
        {
          target_organization_id:
            organization.id,

          target_user_id:
            form.userId,

          target_role:
            form.role,

          target_project_access_mode:
            form.projectAccessMode,

          target_status:
            form.status,

          target_project_ids:
            form.projectIds,
        }
      )

    if (error) {
      throw error
    }
  }


  async function inviteUser() {
    const response =
      await fetch(
        '/api/administration/users/invite',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify({
              organizationId:
                organization.id,

              fullName:
                form.fullName.trim(),

              email:
                form.email
                  .trim()
                  .toLowerCase(),

              role:
                form.role,

              projectAccessMode:
                form.projectAccessMode,

              status:
                form.status,

              projectIds:
                form.projectIds,
            }),
        }
      )

    const payload =
      await response.json()

    if (!response.ok) {
      throw new Error(
        payload?.error ||
          'User invitation failed.'
      )
    }
  }


  async function handleSubmit(
    event
  ) {
    event.preventDefault()

    setErrorMessage('')
    setSuccessMessage('')

    const validationError =
      validateForm()

    if (validationError) {
      setErrorMessage(
        validationError
      )

      return
    }

    setIsSaving(true)

    try {
      if (
        modalMode === 'add'
      ) {
        await inviteUser()
      } else {
        await saveExistingUser()
      }

      await refreshUsers()

      setSuccessMessage(
        modalMode === 'add'
          ? 'Invitation sent successfully.'
          : 'User access updated successfully.'
      )

      setModalMode(null)

      router.refresh()
    } catch (error) {
      console.error(
        'Users & Access operation failed.',
        error
      )

      setErrorMessage(
        error?.message ||
          'The operation could not be completed.'
      )
    } finally {
      setIsSaving(false)
    }
  }


  const isAdminRole =
    form.role === 'admin'

  const isUserRole =
    form.role === 'user'

  const canChooseAccessMode =
    form.role === 'manager'


  return (
    <main
      className={
        styles.page
      }
    >
      <section
        className={
          styles.hero
        }
      >
        <div>
          <p
            className={
              styles.eyebrow
            }
          >
            ADMINISTRATION
          </p>

          <h2
            className={
              styles.title
            }
          >
            Users &amp; Access
          </h2>

          <p
            className={
              styles.subtitle
            }
          >
            Manage organization
            roles, project access,
            and membership status
            from one place.
          </p>
        </div>

        <button
          type="button"
          className={
            styles.primaryButton
          }
          onClick={
            openAddUser
          }
        >
          + Add User
        </button>
      </section>


      <section
        className={
          styles.summaryGrid
        }
      >
        <div
          className={
            styles.summaryCard
          }
        >
          <span>
            Total Users
          </span>

          <strong>
            {users.length}
          </strong>
        </div>

        <div
          className={
            styles.summaryCard
          }
        >
          <span>
            Active
          </span>

          <strong>
            {
              users.filter(
                (user) =>
                  user.membership_status ===
                  'active'
              ).length
            }
          </strong>
        </div>

        <div
          className={
            styles.summaryCard
          }
        >
          <span>
            Admins
          </span>

          <strong>
            {
              users.filter(
                (user) =>
                  user.role ===
                  'admin'
              ).length
            }
          </strong>
        </div>

        <div
          className={
            styles.summaryCard
          }
        >
          <span>
            Projects
          </span>

          <strong>
            {projects.length}
          </strong>
        </div>
      </section>


      <section
        className={
          styles.panel
        }
      >
        <div
          className={
            styles.toolbar
          }
        >
          <div
            className={
              styles.searchField
            }
          >
            <span
              aria-hidden="true"
            >
              ⌕
            </span>

            <input
              type="search"
              value={search}
              onChange={
                (event) =>
                  setSearch(
                    event.target.value
                  )
              }
              placeholder="Search users..."
            />
          </div>

          <div
            className={
              styles.resultCount
            }
          >
            {
              filteredUsers.length
            }{' '}
            user
            {
              filteredUsers.length ===
              1
                ? ''
                : 's'
            }
          </div>
        </div>


        {successMessage && (
          <div
            className={
              styles.successBanner
            }
          >
            {successMessage}
          </div>
        )}


        <div
          className={
            styles.tableWrapper
          }
        >
          <table
            className={
              styles.table
            }
          >
            <thead>
              <tr>
                <th>
                  User
                </th>

                <th>
                  Role
                </th>

                <th>
                  Project Access
                </th>

                <th>
                  Status
                </th>

                <th
                  aria-label="Actions"
                />
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map(
                (user) => {
                  const isCurrentUser =
                    user.user_id ===
                    currentUserId

                  return (
                    <tr
                      key={
                        user.user_id
                      }
                    >
                      <td>
                        <div
                          className={
                            styles.userCell
                          }
                        >
                          <div
                            className={
                              styles.avatar
                            }
                          >
                            {(
                              user.full_name ||
                              user.email ||
                              '?'
                            )
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <div
                              className={
                                styles.userName
                              }
                            >
                              {
                                user.full_name ||
                                'Unnamed user'
                              }

                              {isCurrentUser && (
                                <span
                                  className={
                                    styles.youBadge
                                  }
                                >
                                  You
                                </span>
                              )}
                            </div>

                            <div
                              className={
                                styles.userEmail
                              }
                            >
                              {
                                user.email ||
                                'No email'
                              }
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`${styles.roleBadge} ${
                            styles[
                              `role_${user.role}`
                            ] || ''
                          }`}
                        >
                          {
                            roleLabels[
                              user.role
                            ] ||
                            user.role
                          }
                        </span>
                      </td>

                      <td>
                        <div
                          className={
                            styles.accessCell
                          }
                        >
                          <strong>
                            {
                              accessLabels[
                                user.project_access_mode
                              ] ||
                              user.project_access_mode
                            }
                          </strong>

                          {user.project_access_mode ===
                            'selected_projects' && (
                            <span>
                              {
                                user.project_count
                              }{' '}
                              project
                              {
                                Number(
                                  user.project_count
                                ) === 1
                                  ? ''
                                  : 's'
                              }
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <span
                          className={`${styles.statusBadge} ${
                            user.membership_status ===
                            'active'
                              ? styles.statusActive
                              : styles.statusInactive
                          }`}
                        >
                          {
                            statusLabels[
                              user.membership_status
                            ] ||
                            user.membership_status
                          }
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className={
                            styles.editButton
                          }
                          onClick={() =>
                            openEditUser(
                              user
                            )
                          }
                        >
                          Edit Access
                        </button>
                      </td>
                    </tr>
                  )
                }
              )}


              {filteredUsers.length ===
                0 && (
                <tr>
                  <td
                    colSpan="5"
                  >
                    <div
                      className={
                        styles.emptyState
                      }
                    >
                      No users match
                      your search.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>


      {modalMode && (
        <div
          className={
            styles.modalBackdrop
          }
          onMouseDown={
            (event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeModal()
              }
            }
          }
        >
          <form
            className={
              styles.modal
            }
            onSubmit={
              handleSubmit
            }
          >
            <div
              className={
                styles.modalHeader
              }
            >
              <div>
                <p
                  className={
                    styles.modalEyebrow
                  }
                >
                  USER ACCESS
                </p>

                <h3>
                  {modalMode ===
                  'add'
                    ? 'Add User'
                    : 'Edit User Access'}
                </h3>
              </div>

              <button
                type="button"
                className={
                  styles.closeButton
                }
                onClick={
                  closeModal
                }
                disabled={
                  isSaving
                }
                aria-label="Close"
              >
                ×
              </button>
            </div>


            <div
              className={
                styles.formGrid
              }
            >
              <label
                className={
                  styles.field
                }
              >
                <span>
                  Name
                </span>

                <input
                  value={
                    form.fullName
                  }
                  onChange={
                    (event) =>
                      updateForm(
                        'fullName',
                        event.target.value
                      )
                  }
                  disabled={
                    modalMode ===
                    'edit'
                  }
                  placeholder="John Smith"
                />
              </label>

              <label
                className={
                  styles.field
                }
              >
                <span>
                  Email
                </span>

                <input
                  type="email"
                  value={
                    form.email
                  }
                  onChange={
                    (event) =>
                      updateForm(
                        'email',
                        event.target.value
                      )
                  }
                  disabled={
                    modalMode ===
                    'edit'
                  }
                  placeholder="john@company.com"
                />
              </label>
            </div>


            <div
              className={
                styles.section
              }
            >
              <div
                className={
                  styles.sectionHeader
                }
              >
                <div>
                  <h4>
                    Role
                  </h4>

                  <p>
                    Determines what
                    this user can do.
                  </p>
                </div>
              </div>

              <div
                className={
                  styles.roleOptions
                }
              >
                {[
                  {
                    value:
                      'admin',
                    title:
                      'Admin',
                    description:
                      'Organization administration and all projects.',
                  },
                  {
                    value:
                      'manager',
                    title:
                      'Manager',
                    description:
                      'Operational management with configurable project access.',
                  },
                  {
                    value:
                      'user',
                    title:
                      'User',
                    description:
                      'Operational contributor on assigned projects.',
                  },
                ].map(
                  (option) => (
                    <button
                      type="button"
                      key={
                        option.value
                      }
                      className={`${styles.optionCard} ${
                        form.role ===
                        option.value
                          ? styles.optionCardSelected
                          : ''
                      }`}
                      onClick={() =>
                        updateForm(
                          'role',
                          option.value
                        )
                      }
                    >
                      <strong>
                        {
                          option.title
                        }
                      </strong>

                      <span>
                        {
                          option.description
                        }
                      </span>
                    </button>
                  )
                )}
              </div>
            </div>


            <div
              className={
                styles.section
              }
            >
              <div
                className={
                  styles.sectionHeader
                }
              >
                <div>
                  <h4>
                    Project Access
                  </h4>

                  <p>
                    Determines where
                    this user can
                    operate.
                  </p>
                </div>
              </div>

              <div
                className={
                  styles.accessOptions
                }
              >
                <label>
                  <input
                    type="radio"
                    name="projectAccessMode"
                    value="all_projects"
                    checked={
                      form.projectAccessMode ===
                      'all_projects'
                    }
                    disabled={
                      !canChooseAccessMode &&
                      !isAdminRole
                    }
                    onChange={() =>
                      updateForm(
                        'projectAccessMode',
                        'all_projects'
                      )
                    }
                  />

                  <span>
                    <strong>
                      All Projects
                    </strong>

                    <small>
                      Access every
                      project in the
                      organization.
                    </small>
                  </span>
                </label>

                <label>
                  <input
                    type="radio"
                    name="projectAccessMode"
                    value="selected_projects"
                    checked={
                      form.projectAccessMode ===
                      'selected_projects'
                    }
                    disabled={
                      !canChooseAccessMode &&
                      !isUserRole
                    }
                    onChange={() =>
                      updateForm(
                        'projectAccessMode',
                        'selected_projects'
                      )
                    }
                  />

                  <span>
                    <strong>
                      Selected Projects
                    </strong>

                    <small>
                      Access only
                      explicitly
                      assigned
                      projects.
                    </small>
                  </span>
                </label>
              </div>


              {form.projectAccessMode ===
                'selected_projects' && (
                <div
                  className={
                    styles.projectSelector
                  }
                >
                  {projects.map(
                    (project) => (
                      <label
                        key={
                          project.id
                        }
                        className={
                          styles.projectOption
                        }
                      >
                        <input
                          type="checkbox"
                          checked={
                            form.projectIds.includes(
                              project.id
                            )
                          }
                          onChange={() =>
                            toggleProject(
                              project.id
                            )
                          }
                        />

                        <span>
                          <strong>
                            {
                              project.code
                            }
                          </strong>

                          <small>
                            {
                              project.name
                            }
                          </small>
                        </span>
                      </label>
                    )
                  )}
                </div>
              )}
            </div>


            <div
              className={
                styles.section
              }
            >
              <div
                className={
                  styles.sectionHeader
                }
              >
                <div>
                  <h4>
                    Status
                  </h4>

                  <p>
                    Inactive users
                    retain their
                    membership record
                    but cannot operate
                    within the
                    organization.
                  </p>
                </div>
              </div>

              <select
                className={
                  styles.statusSelect
                }
                value={
                  form.status
                }
                onChange={
                  (event) =>
                    updateForm(
                      'status',
                      event.target.value
                    )
                }
              >
                <option
                  value="active"
                >
                  Active
                </option>

                <option
                  value="disabled"
                >
                  Inactive
                </option>
              </select>
            </div>


            {errorMessage && (
              <div
                className={
                  styles.errorBanner
                }
                role="alert"
              >
                {errorMessage}
              </div>
            )}


            <div
              className={
                styles.modalActions
              }
            >
              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={
                  closeModal
                }
                disabled={
                  isSaving
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className={
                  styles.primaryButton
                }
                disabled={
                  isSaving
                }
              >
                {isSaving
                  ? 'Saving...'
                  : modalMode ===
                      'add'
                    ? 'Send Invitation'
                    : 'Save Access'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
