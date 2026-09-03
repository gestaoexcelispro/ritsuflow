'use client'

import {
  useEffect,
  useRef,
  useState,
} from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/client'
import styles from './project-setup.module.css'

const PROJECT_COVER_BUCKET =
  'project-covers'

const MAX_COVER_SIZE =
  20 * 1024 * 1024

const ALLOWED_COVER_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]

const SIGNED_URL_DURATION =
  60 * 60

function nullableValue(value) {
  const normalizedValue =
    value.trim()

  return normalizedValue === ''
    ? null
    : normalizedValue
}

function createInitialFormData(
  project,
  suggestedCode
) {
  return {
    code:
      project?.code ||
      suggestedCode,

    name:
      project?.name ||
      '',

    client_name:
      project?.client_name ||
      '',

    status:
      project?.status ||
      'planning',

    proposal_number:
      project?.proposal_number ||
      '',

    contract_number:
      project?.contract_number ||
      '',

    contract_value:
      project?.contract_value ??
      '',

    currency_code:
      project?.currency_code ||
      'USD',

    planned_start_date:
      project?.planned_start_date ||
      '',

    planned_finish_date:
      project?.planned_finish_date ||
      '',

    address_line:
      project?.address_line ||
      '',

    neighborhood:
      project?.neighborhood ||
      '',

    city:
      project?.city ||
      '',

    state_region:
      project?.state_region ||
      '',

    postal_code:
      project?.postal_code ||
      '',

    country_code:
      project?.country_code ||
      'US',

    latitude:
      project?.latitude ??
      '',

    longitude:
      project?.longitude ??
      '',

    geofence_radius_m:
      project?.geofence_radius_m ??
      '',

    max_gps_accuracy_m:
      project?.max_gps_accuracy_m ??
      '',

    geofence_enabled:
      Boolean(
        project?.geofence_enabled
      ),
  }
}

function getFileExtension(file) {
  const fileName =
    file?.name || ''

  const dotIndex =
    fileName.lastIndexOf('.')

  if (
    dotIndex >= 0 &&
    dotIndex <
      fileName.length - 1
  ) {
    return fileName
      .slice(dotIndex + 1)
      .toLowerCase()
      .replace(
        /[^a-z0-9]/g,
        ''
      )
  }

  const mimeExtensions = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
  }

  return (
    mimeExtensions[
      file?.type
    ] || 'jpg'
  )
}

export default function ProjectForm({
  organizationId,
  organizationName,
  userId,
  project,
  suggestedCode,
}) {
  const router =
    useRouter()

  const fileInputRef =
    useRef(null)

  const isEditing =
    Boolean(project?.id)

  const [formData, setFormData] =
    useState(() =>
      createInitialFormData(
        project,
        suggestedCode
      )
    )

  const [
    coverImagePath,
    setCoverImagePath,
  ] = useState(
    project?.cover_image_path ||
      ''
  )

  const [
    coverImageUrl,
    setCoverImageUrl,
  ] = useState('')

  const [
    coverImageLoading,
    setCoverImageLoading,
  ] = useState(
    Boolean(
      project?.cover_image_path
    )
  )

  const [
    isUploadingCover,
    setIsUploadingCover,
  ] = useState(false)

  const [
    isRemovingCover,
    setIsRemovingCover,
  ] = useState(false)

  const [
    coverErrorMessage,
    setCoverErrorMessage,
  ] = useState('')

  const [
    coverSuccessMessage,
    setCoverSuccessMessage,
  ] = useState('')

  const [
    isSaving,
    setIsSaving,
  ] = useState(false)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadCover() {
      if (
        !project?.id ||
        !project?.cover_image_path
      ) {
        setCoverImageLoading(
          false
        )
        return
      }

      const supabase =
        createClient()

      const {
        data,
        error,
      } =
        await supabase.storage
          .from(
            PROJECT_COVER_BUCKET
          )
          .createSignedUrl(
            project.cover_image_path,
            SIGNED_URL_DURATION
          )

      if (cancelled) {
        return
      }

      if (
        error ||
        !data?.signedUrl
      ) {
        console.error(
          'Project cover could not be loaded.',
          error
        )

        setCoverErrorMessage(
          'The current project cover could not be displayed.'
        )

        setCoverImageLoading(
          false
        )

        return
      }

      setCoverImageUrl(
        data.signedUrl
      )

      setCoverImageLoading(
        false
      )
    }

    loadCover()

    return () => {
      cancelled = true
    }
  }, [
    project?.id,
    project?.cover_image_path,
  ])

  function handleChange(event) {
    const {
      name,
      value,
      type,
      checked,
    } = event.target

    setFormData(
      (
        currentFormData
      ) => ({
        ...currentFormData,
        [name]:
          type === 'checkbox'
            ? checked
            : value,
      })
    )
  }

  async function handleCoverUpload(
    event
  ) {
    const file =
      event.target.files?.[0]

    if (!file) {
      return
    }

    if (!project?.id) {
      setCoverErrorMessage(
        'Create the project first. You can then add its cover photo from Project Setup.'
      )

      event.target.value = ''
      return
    }

    if (
      !ALLOWED_COVER_TYPES.includes(
        file.type
      )
    ) {
      setCoverErrorMessage(
        'Use a JPEG, PNG, WebP, HEIC, or HEIF image.'
      )

      event.target.value = ''
      return
    }

    if (
      file.size >
      MAX_COVER_SIZE
    ) {
      setCoverErrorMessage(
        'The project cover image cannot exceed 20 MB.'
      )

      event.target.value = ''
      return
    }

    setIsUploadingCover(
      true
    )

    setCoverErrorMessage('')
    setCoverSuccessMessage('')

    const supabase =
      createClient()

    const extension =
      getFileExtension(file)

    const newStoragePath =
      `${project.id}/cover-${Date.now()}.${extension}`

    try {
      const {
        error: uploadError,
      } =
        await supabase.storage
          .from(
            PROJECT_COVER_BUCKET
          )
          .upload(
            newStoragePath,
            file,
            {
              cacheControl:
                '3600',

              upsert:
                false,

              contentType:
                file.type,
            }
          )

      if (uploadError) {
        throw uploadError
      }

      const {
        error: updateError,
      } = await supabase
        .from('projects')
        .update({
          cover_image_path:
            newStoragePath,
        })
        .eq(
          'id',
          project.id
        )

      if (updateError) {
        await supabase.storage
          .from(
            PROJECT_COVER_BUCKET
          )
          .remove([
            newStoragePath,
          ])

        throw updateError
      }

      const {
        data: signedData,
        error: signedError,
      } =
        await supabase.storage
          .from(
            PROJECT_COVER_BUCKET
          )
          .createSignedUrl(
            newStoragePath,
            SIGNED_URL_DURATION
          )

      if (signedError) {
        console.error(
          'Project cover signed URL could not be created.',
          signedError
        )
      }

      const previousPath =
        coverImagePath

      setCoverImagePath(
        newStoragePath
      )

      setCoverImageUrl(
        signedData?.signedUrl ||
          ''
      )

      if (
        previousPath &&
        previousPath !==
          newStoragePath
      ) {
        const {
          error:
            previousDeleteError,
        } =
          await supabase.storage
            .from(
              PROJECT_COVER_BUCKET
            )
            .remove([
              previousPath,
            ])

        if (
          previousDeleteError
        ) {
          console.warn(
            'Previous project cover could not be removed.',
            previousDeleteError
          )
        }
      }

      setCoverSuccessMessage(
        'Project cover updated successfully.'
      )

      router.refresh()
    } catch (error) {
      setCoverErrorMessage(
        error?.message ||
          'The project cover could not be uploaded.'
      )
    } finally {
      setIsUploadingCover(
        false
      )

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          ''
      }
    }
  }

  async function handleRemoveCover() {
    if (
      !project?.id ||
      !coverImagePath ||
      isRemovingCover
    ) {
      return
    }

    const confirmed =
      window.confirm(
        'Remove the project cover photo?'
      )

    if (!confirmed) {
      return
    }

    setIsRemovingCover(
      true
    )

    setCoverErrorMessage('')
    setCoverSuccessMessage('')

    const supabase =
      createClient()

    try {
      const {
        error: updateError,
      } = await supabase
        .from('projects')
        .update({
          cover_image_path:
            null,
        })
        .eq(
          'id',
          project.id
        )

      if (updateError) {
        throw updateError
      }

      const {
        error: removeError,
      } =
        await supabase.storage
          .from(
            PROJECT_COVER_BUCKET
          )
          .remove([
            coverImagePath,
          ])

      if (removeError) {
        console.warn(
          'Project cover database reference was removed, but the Storage object could not be deleted.',
          removeError
        )
      }

      setCoverImagePath('')
      setCoverImageUrl('')

      setCoverSuccessMessage(
        'Project cover removed.'
      )

      router.refresh()
    } catch (error) {
      setCoverErrorMessage(
        error?.message ||
          'The project cover could not be removed.'
      )
    } finally {
      setIsRemovingCover(
        false
      )
    }
  }

  async function handleSubmit(
    event
  ) {
    event.preventDefault()

    setErrorMessage('')
    setIsSaving(true)

    const supabase =
      createClient()

    const contractValue =
      formData.contract_value ===
      ''
        ? null
        : Number(
            formData.contract_value
          )

    if (
      contractValue !== null &&
      (
        Number.isNaN(
          contractValue
        ) ||
        contractValue < 0
      )
    ) {
      setErrorMessage(
        'Contract value must be a valid non-negative number.'
      )

      setIsSaving(false)
      return
    }

    if (
      formData.planned_start_date &&
      formData.planned_finish_date &&
      formData.planned_finish_date <
        formData.planned_start_date
    ) {
      setErrorMessage(
        'Planned finish date cannot be earlier than the planned start date.'
      )

      setIsSaving(false)
      return
    }

    const latitude =
      formData.latitude === ''
        ? null
        : Number(
            formData.latitude
          )

    const longitude =
      formData.longitude === ''
        ? null
        : Number(
            formData.longitude
          )

    const geofenceRadius =
      formData.geofence_radius_m ===
      ''
        ? null
        : Number(
            formData.geofence_radius_m
          )

    const maxGpsAccuracy =
      formData.max_gps_accuracy_m ===
      ''
        ? null
        : Number(
            formData.max_gps_accuracy_m
          )

    if (
      latitude !== null &&
      (
        Number.isNaN(
          latitude
        ) ||
        latitude < -90 ||
        latitude > 90
      )
    ) {
      setErrorMessage(
        'Reference latitude must be a valid number between -90 and 90.'
      )

      setIsSaving(false)
      return
    }

    if (
      longitude !== null &&
      (
        Number.isNaN(
          longitude
        ) ||
        longitude < -180 ||
        longitude > 180
      )
    ) {
      setErrorMessage(
        'Reference longitude must be a valid number between -180 and 180.'
      )

      setIsSaving(false)
      return
    }

    if (
      geofenceRadius !== null &&
      (
        Number.isNaN(
          geofenceRadius
        ) ||
        !Number.isInteger(
          geofenceRadius
        ) ||
        geofenceRadius <= 0
      )
    ) {
      setErrorMessage(
        'Geofence radius must be a positive whole number of meters.'
      )

      setIsSaving(false)
      return
    }

    if (
      maxGpsAccuracy !== null &&
      (
        Number.isNaN(
          maxGpsAccuracy
        ) ||
        !Number.isInteger(
          maxGpsAccuracy
        ) ||
        maxGpsAccuracy <= 0
      )
    ) {
      setErrorMessage(
        'Maximum GPS accuracy must be a positive whole number of meters.'
      )

      setIsSaving(false)
      return
    }

    if (
      formData.geofence_enabled &&
      (
        latitude === null ||
        longitude === null ||
        geofenceRadius === null
      )
    ) {
      setErrorMessage(
        'Reference latitude, reference longitude, and geofence radius are required before Attendance Geofence can be enabled.'
      )

      setIsSaving(false)
      return
    }

    const projectPayload = {
      code:
        formData.code
          .trim()
          .toUpperCase(),

      name:
        formData.name.trim(),

      client_name:
        nullableValue(
          formData.client_name
        ),

      status:
        formData.status,

      proposal_number:
        nullableValue(
          formData.proposal_number
        ),

      contract_number:
        nullableValue(
          formData.contract_number
        ),

      contract_value:
        contractValue,

      currency_code:
        formData.currency_code
          .trim()
          .toUpperCase(),

      planned_start_date:
        formData.planned_start_date ||
        null,

      planned_finish_date:
        formData.planned_finish_date ||
        null,

      address_line:
        nullableValue(
          formData.address_line
        ),

      neighborhood:
        nullableValue(
          formData.neighborhood
        ),

      city:
        nullableValue(
          formData.city
        ),

      state_region:
        nullableValue(
          formData.state_region
        ),

      postal_code:
        nullableValue(
          formData.postal_code
        ),

      country_code:
        formData.country_code
          .trim()
          .toUpperCase(),

      latitude,

      longitude,

      geofence_radius_m:
        geofenceRadius,

      max_gps_accuracy_m:
        maxGpsAccuracy,

      geofence_enabled:
        formData.geofence_enabled,
    }

    try {
      if (isEditing) {
        const {
          error,
        } =
          await supabase
            .from(
              'projects'
            )
            .update(
              projectPayload
            )
            .eq(
              'id',
              project.id
            )

        if (error) {
          throw error
        }
      } else {
        const {
          data:
            createdProject,
          error:
            createError,
        } =
          await supabase
            .from(
              'projects'
            )
            .insert({
              ...projectPayload,

              organization_id:
                organizationId,

              created_by:
                userId,
            })
            .select(
              'id'
            )
            .single()

        if (
          createError
        ) {
          throw createError
        }

        const {
          error:
            membershipError,
        } =
          await supabase
            .from(
              'project_members'
            )
            .upsert(
              {
                project_id:
                  createdProject.id,

                user_id:
                  userId,

                role:
                  'manager',
              },
              {
                onConflict:
                  'project_id,user_id',
              }
            )

        if (
          membershipError
        ) {
          console.error(
            'Project membership could not be created.',
            membershipError
          )
        }
      }

      router.push(
        '/dashboard/projetos/lista'
      )

      router.refresh()
    } catch (error) {
      if (
        error?.code ===
        '23505'
      ) {
        setErrorMessage(
          'This project code is already in use. Choose another code.'
        )
      } else {
        setErrorMessage(
          error?.message ||
            'The project could not be saved.'
        )
      }

      setIsSaving(false)
    }
  }

  return (
    <>
      <div
        className={
          styles.contextBar
        }
      >
        <div
          className={
            styles.contextIdentity
          }
        >
          <span
            className={
              styles.contextIcon
            }
          >
            OR
          </span>

          <div>
            <p
              className={
                styles.contextLabel
              }
            >
              Organization
            </p>

            <p
              className={
                styles.contextValue
              }
            >
              {organizationName}
            </p>
          </div>
        </div>

        <span
          className={
            styles.contextMode
          }
        >
          {isEditing
            ? 'Editing project'
            : 'New project'}
        </span>
      </div>

      <article
        className={
          styles.formPanel
        }
      >
        <div
          className={
            styles.formHeader
          }
        >
          <h2
            className={
              styles.formTitle
            }
          >
            {isEditing
              ? 'Project information'
              : 'Create project'}
          </h2>

          <p
            className={
              styles.formDescription
            }
          >
            Define the project identity,
            presentation, commercial references,
            planned dates, and geographic
            information.
          </p>
        </div>

        <form
          className={
            styles.form
          }
          onSubmit={
            handleSubmit
          }
        >
          <section
            className={
              styles.section
            }
          >
            <div
              className={
                styles.sectionHeading
              }
            >
              <h3
                className={
                  styles.sectionTitle
                }
              >
                Project identity
              </h3>

              <p
                className={
                  styles.sectionDescription
                }
              >
                Core information used throughout
                the planning workflow.
              </p>
            </div>

            <div
              className={
                styles.grid
              }
            >
              <div
                className={`${styles.field} ${styles.span4}`}
              >
                <label
                  className={
                    styles.label
                  }
                  htmlFor="code"
                >
                  Project code

                  <span
                    className={
                      styles.required
                    }
                  >
                    *
                  </span>
                </label>

                <input
                  className={
                    styles.input
                  }
                  id="code"
                  name="code"
                  value={
                    formData.code
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="RF-0002"
                  required
                />

                <p
                  className={
                    styles.helpText
                  }
                >
                  Unique code within the
                  organization.
                </p>
              </div>

              <div
                className={`${styles.field} ${styles.span8}`}
              >
                <label
                  className={
                    styles.label
                  }
                  htmlFor="name"
                >
                  Project name

                  <span
                    className={
                      styles.required
                    }
                  >
                    *
                  </span>
                </label>

                <input
                  className={
                    styles.input
                  }
                  id="name"
                  name="name"
                  value={
                    formData.name
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Project name"
                  required
                />
              </div>

              <div
                className={`${styles.field} ${styles.span8}`}
              >
                <label
                  className={
                    styles.label
                  }
                  htmlFor="client_name"
                >
                  Client
                </label>

                <input
                  className={
                    styles.input
                  }
                  id="client_name"
                  name="client_name"
                  value={
                    formData.client_name
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Client or owner"
                />
              </div>

              <div
                className={`${styles.field} ${styles.span4}`}
              >
                <label
                  className={
                    styles.label
                  }
                  htmlFor="status"
                >
                  Project status
                </label>

                <select
                  className={
                    styles.select
                  }
                  id="status"
                  name="status"
                  value={
                    formData.status
                  }
                  onChange={
                    handleChange
                  }
                >
                  <option value="planning">
                    Planning
                  </option>

                  <option value="active">
                    Active
                  </option>

                  <option value="on_hold">
                    On hold
                  </option>

                  <option value="completed">
                    Completed
                  </option>

                  <option value="archived">
                    Archived
                  </option>
                </select>
              </div>
            </div>
          </section>

          <section
            className={
              styles.section
            }
          >
            <div
              className={
                styles.sectionHeading
              }
            >
              <h3
                className={
                  styles.sectionTitle
                }
              >
                Project cover
              </h3>

              <p
                className={
                  styles.sectionDescription
                }
              >
                Define the project image used in
                Daily Reports, project cards,
                dashboards, and project
                workspaces.
              </p>
            </div>

            <div
              className={
                styles.coverLayout
              }
            >
              <div
                className={
                  styles.coverPreview
                }
              >
                {coverImageLoading ? (
                  <div
                    className={
                      styles.coverPlaceholder
                    }
                  >
                    <span
                      className={
                        styles.coverPlaceholderIcon
                      }
                    >
                      IM
                    </span>

                    <span>
                      Loading project image...
                    </span>
                  </div>
                ) : coverImageUrl ? (
                  <img
                    src={
                      coverImageUrl
                    }
                    alt={`${formData.name || 'Project'} cover`}
                    className={
                      styles.coverImage
                    }
                  />
                ) : (
                  <div
                    className={
                      styles.coverPlaceholder
                    }
                  >
                    <span
                      className={
                        styles.coverPlaceholderIcon
                      }
                    >
                      IM
                    </span>

                    <strong>
                      No project cover
                    </strong>

                    <span>
                      Add a field or construction
                      image to visually identify
                      this project.
                    </span>
                  </div>
                )}
              </div>

              <div
                className={
                  styles.coverDetails
                }
              >
                <div>
                  <p
                    className={
                      styles.coverProjectName
                    }
                  >
                    {formData.name ||
                      'Project cover photo'}
                  </p>

                  <p
                    className={
                      styles.coverHelp
                    }
                  >
                    Recommended: landscape
                    orientation. JPEG, PNG,
                    WebP, HEIC or HEIF. Maximum
                    file size 20 MB.
                  </p>
                </div>

                {!isEditing && (
                  <div
                    className={
                      styles.coverNotice
                    }
                  >
                    Create the project first.
                    After creation, return to
                    Project Setup to add its
                    cover image.
                  </div>
                )}

                {coverErrorMessage && (
                  <div
                    className={
                      styles.coverError
                    }
                  >
                    {coverErrorMessage}
                  </div>
                )}

                {coverSuccessMessage && (
                  <div
                    className={
                      styles.coverSuccess
                    }
                  >
                    {coverSuccessMessage}
                  </div>
                )}

                <input
                  ref={
                    fileInputRef
                  }
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  onChange={
                    handleCoverUpload
                  }
                  className={
                    styles.hiddenFileInput
                  }
                />

                <div
                  className={
                    styles.coverActions
                  }
                >
                  <button
                    type="button"
                    className={
                      styles.coverPrimaryButton
                    }
                    disabled={
                      !isEditing ||
                      isUploadingCover ||
                      isRemovingCover
                    }
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                  >
                    {isUploadingCover
                      ? 'Uploading...'
                      : coverImagePath
                        ? 'Change photo'
                        : 'Upload photo'}
                  </button>

                  {coverImagePath && (
                    <button
                      type="button"
                      className={
                        styles.coverRemoveButton
                      }
                      disabled={
                        isUploadingCover ||
                        isRemovingCover
                      }
                      onClick={
                        handleRemoveCover
                      }
                    >
                      {isRemovingCover
                        ? 'Removing...'
                        : 'Remove photo'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section
            className={
              styles.section
            }
          >
            <div
              className={
                styles.sectionHeading
              }
            >
              <h3
                className={
                  styles.sectionTitle
                }
              >
                Contract and schedule
              </h3>

              <p
                className={
                  styles.sectionDescription
                }
              >
                Optional project references and
                planned boundaries.
              </p>
            </div>

            <div
              className={
                styles.grid
              }
            >
              <div
                className={`${styles.field} ${styles.span3}`}
              >
                <label
                  className={
                    styles.label
                  }
                  htmlFor="proposal_number"
                >
                  Proposal number
                </label>

                <input
                  className={
                    styles.input
                  }
                  id="proposal_number"
                  name="proposal_number"
                  value={
                    formData.proposal_number
                  }
                  onChange={
                    handleChange
                  }
                />
              </div>

              <div
                className={`${styles.field} ${styles.span3}`}
              >
                <label
                  className={
                    styles.label
                  }
                  htmlFor="contract_number"
                >
                  Contract number
                </label>

                <input
                  className={
                    styles.input
                  }
                  id="contract_number"
                  name="contract_number"
                  value={
                    formData.contract_number
                  }
                  onChange={
                    handleChange
                  }
                />
              </div>

              <div
                className={`${styles.field} ${styles.span3}`}
              >
                <label
                  className={
                    styles.label
                  }
                  htmlFor="contract_value"
                >
                  Contract value
                </label>

                <input
                  className={
                    styles.input
                  }
                  id="contract_value"
                  name="contract_value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    formData.contract_value
                  }
                  onChange={
                    handleChange
                  }
                />
              </div>

              <div
                className={`${styles.field} ${styles.span3}`}
              >
                <label
                  className={
                    styles.label
                  }
                  htmlFor="currency_code"
                >
                  Currency
                </label>

                <select
                  className={
                    styles.select
                  }
                  id="currency_code"
                  name="currency_code"
                  value={
                    formData.currency_code
                  }
                  onChange={
                    handleChange
                  }
                >
                  <option value="USD">
                    USD
                  </option>

                  <option value="BRL">
                    BRL
                  </option>

                  <option value="CAD">
                    CAD
                  </option>

                  <option value="EUR">
                    EUR
                  </option>

                  <option value="GBP">
                    GBP
                  </option>
                </select>
              </div>

              <div
                className={`${styles.field} ${styles.span6}`}
              >
                <label
                  className={
                    styles.label
                  }
                  htmlFor="planned_start_date"
                >
                  Planned start date
                </label>

                <input
                  className={
                    styles.input
                  }
                  id="planned_start_date"
                  name="planned_start_date"
                  type="date"
                  value={
                    formData.planned_start_date
                  }
                  onChange={
                    handleChange
                  }
                />
              </div>

              <div
                className={`${styles.field} ${styles.span6}`}
              >
                <label
                  className={
                    styles.label
                  }
                  htmlFor="planned_finish_date"
                >
                  Planned finish date
                </label>

                <input
                  className={
                    styles.input
                  }
                  id="planned_finish_date"
                  name="planned_finish_date"
                  type="date"
                  value={
                    formData.planned_finish_date
                  }
                  onChange={
                    handleChange
                  }
                />
              </div>
            </div>
          </section>

          <section
            className={
              styles.section
            }
          >
            <div
              className={
                styles.sectionHeading
              }
            >
              <h3
                className={
                  styles.sectionTitle
                }
              >
                Project location
              </h3>

              <p
                className={
                  styles.sectionDescription
                }
              >
                Geographic information used for
                project identification and
                reporting.
              </p>
            </div>

            <div
              className={
                styles.grid
              }
            >
              <div
                className={`${styles.field} ${styles.span12}`}
              >
                <label
                  className={
                    styles.label
                  }
                  htmlFor="address_line"
                >
                  Address
                </label>

                <input
                  className={
                    styles.input
                  }
                  id="address_line"
                  name="address_line"
                  value={
                    formData.address_line
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Street and number"
                />
              </div>

              <div
                className={`${styles.field} ${styles.span6}`}
              >
                <label
                  className={
                    styles.label
                  }
                  htmlFor="neighborhood"
                >
                  Neighborhood or district
                </label>

                <input
                  className={
                    styles.input
                  }
                  id="neighborhood"
                  name="neighborhood"
                  value={
                    formData.neighborhood
                  }
                  onChange={
                    handleChange
                  }
                />
              </div>

              <div
                className={`${styles.field} ${styles.span6}`}
              >
                <label
                  className={
                    styles.label
                  }
                  htmlFor="city"
                >
                  City
                </label>

                <input
                  className={
                    styles.input
                  }
                  id="city"
                  name="city"
                  value={
                    formData.city
                  }
                  onChange={
                    handleChange
                  }
                />
              </div>

              <div
                className={`${styles.field} ${styles.span4}`}
              >
                <label
                  className={
                    styles.label
                  }
                  htmlFor="state_region"
                >
                  State or region
                </label>

                <input
                  className={
                    styles.input
                  }
                  id="state_region"
                  name="state_region"
                  value={
                    formData.state_region
                  }
                  onChange={
                    handleChange
                  }
                />
              </div>

              <div
                className={`${styles.field} ${styles.span4}`}
              >
                <label
                  className={
                    styles.label
                  }
                  htmlFor="postal_code"
                >
                  Postal code
                </label>

                <input
                  className={
                    styles.input
                  }
                  id="postal_code"
                  name="postal_code"
                  value={
                    formData.postal_code
                  }
                  onChange={
                    handleChange
                  }
                />
              </div>

              <div
                className={`${styles.field} ${styles.span4}`}
              >
                <label
                  className={
                    styles.label
                  }
                  htmlFor="country_code"
                >
                  Country code
                </label>

                <input
                  className={
                    styles.input
                  }
                  id="country_code"
                  name="country_code"
                  maxLength="2"
                  value={
                    formData.country_code
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="US"
                  required
                />

                <p
                  className={
                    styles.helpText
                  }
                >
                  Use the two-letter ISO country
                  code.
                </p>
              </div>
            </div>
          </section>

          <section
            className={
              styles.section
            }
          >
            <div
              className={
                styles.sectionHeading
              }
            >
              <h3
                className={
                  styles.sectionTitle
                }
              >
                Attendance Geofence
              </h3>

              <p
                className={
                  styles.sectionDescription
                }
              >
                Define the jobsite reference point
                and allowed radius used to validate
                Attendance Check-In and Check-Out
                locations.
              </p>
            </div>

            <div
              className={
                styles.grid
              }
            >
              <div
                className={`${styles.field} ${styles.span4}`}
              >
                <label
                  className={
                    styles.label
                  }
                  htmlFor="latitude"
                >
                  Reference latitude
                </label>

                <input
                  className={
                    styles.input
                  }
                  id="latitude"
                  name="latitude"
                  type="number"
                  min="-90"
                  max="90"
                  step="any"
                  value={
                    formData.latitude
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="-25.000000"
                />

                <p
                  className={
                    styles.helpText
                  }
                >
                  Decimal degrees between -90 and
                  90.
                </p>
              </div>

              <div
                className={`${styles.field} ${styles.span4}`}
              >
                <label
                  className={
                    styles.label
                  }
                  htmlFor="longitude"
                >
                  Reference longitude
                </label>

                <input
                  className={
                    styles.input
                  }
                  id="longitude"
                  name="longitude"
                  type="number"
                  min="-180"
                  max="180"
                  step="any"
                  value={
                    formData.longitude
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="-50.000000"
                />

                <p
                  className={
                    styles.helpText
                  }
                >
                  Decimal degrees between -180 and
                  180.
                </p>
              </div>

              <div
                className={`${styles.field} ${styles.span4}`}
              >
                <label
                  className={
                    styles.label
                  }
                  htmlFor="geofence_radius_m"
                >
                  Geofence radius
                </label>

                <input
                  className={
                    styles.input
                  }
                  id="geofence_radius_m"
                  name="geofence_radius_m"
                  type="number"
                  min="1"
                  step="1"
                  value={
                    formData.geofence_radius_m
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="150"
                />

                <p
                  className={
                    styles.helpText
                  }
                >
                  Maximum allowed distance from the
                  reference point, in meters.
                </p>
              </div>

              <div
                className={`${styles.field} ${styles.span4}`}
              >
                <label
                  className={
                    styles.label
                  }
                  htmlFor="max_gps_accuracy_m"
                >
                  Maximum GPS accuracy
                </label>

                <input
                  className={
                    styles.input
                  }
                  id="max_gps_accuracy_m"
                  name="max_gps_accuracy_m"
                  type="number"
                  min="1"
                  step="1"
                  value={
                    formData.max_gps_accuracy_m
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="50"
                />

                <p
                  className={
                    styles.helpText
                  }
                >
                  Maximum acceptable device GPS
                  accuracy, in meters. Leave blank
                  to disable the project-specific
                  accuracy threshold.
                </p>
              </div>

              <div
                className={`${styles.field} ${styles.span12}`}
              >
                <label
                  htmlFor="geofence_enabled"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '14px 16px',
                    border: '1px solid #d9e2ec',
                    borderRadius: '12px',
                    background: formData.geofence_enabled
                      ? '#f0fdfa'
                      : '#f8fafc',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    id="geofence_enabled"
                    name="geofence_enabled"
                    type="checkbox"
                    checked={
                      formData.geofence_enabled
                    }
                    onChange={
                      handleChange
                    }
                    style={{
                      width: '18px',
                      height: '18px',
                      marginTop: '2px',
                      accentColor: '#08aa96',
                      cursor: 'pointer',
                    }}
                  />

                  <span>
                    <strong
                      style={{
                        display: 'block',
                        marginBottom: '4px',
                        color: '#0f172a',
                        fontSize: '0.86rem',
                      }}
                    >
                      Enable Attendance Geofence
                    </strong>

                    <span
                      style={{
                        display: 'block',
                        color: '#64748b',
                        fontSize: '0.78rem',
                        lineHeight: 1.5,
                      }}
                    >
                      When enabled, RitsuFlow will
                      compare worker GPS coordinates
                      with this project reference
                      point during Check-In and
                      Check-Out.
                    </span>
                  </span>
                </label>
              </div>

              <div
                className={`${styles.field} ${styles.span12}`}
              >
                <div
                  style={{
                    padding: '12px 14px',
                    border: formData.geofence_enabled
                      ? '1px solid #99f6e4'
                      : '1px solid #e2e8f0',
                    borderRadius: '10px',
                    background: formData.geofence_enabled
                      ? '#f0fdfa'
                      : '#f8fafc',
                    color: formData.geofence_enabled
                      ? '#115e59'
                      : '#64748b',
                    fontSize: '0.78rem',
                    lineHeight: 1.5,
                  }}
                >
                  {formData.geofence_enabled
                    ? 'Attendance Geofence is enabled. Check-In and Check-Out location validation will use the configured coordinates and radius.'
                    : 'Attendance Geofence is disabled. Attendance can continue without project distance validation until this setting is enabled.'}
                </div>
              </div>
            </div>
          </section>

          {errorMessage && (
            <p
              className={
                styles.errorMessage
              }
              role="alert"
            >
              {errorMessage}
            </p>
          )}

          <div
            className={
              styles.actions
            }
          >
            <Link
              href="/dashboard/projetos/lista"
              className={
                styles.secondaryButton
              }
            >
              Cancel
            </Link>

            <button
              className={
                styles.primaryButton
              }
              type="submit"
              disabled={
                isSaving
              }
            >
              {isSaving
                ? 'Saving project...'
                : isEditing
                  ? 'Save changes'
                  : 'Create project'}
            </button>
          </div>
        </form>
      </article>
    </>
  )
}
