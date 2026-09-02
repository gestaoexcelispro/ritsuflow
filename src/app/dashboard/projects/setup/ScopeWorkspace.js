'use client'

import {
  useMemo,
  useState,
} from 'react'

import {
  createClient,
} from '../../../../lib/supabase/client'

import styles from '../../projetos/coleta/project-setup.module.css'


const unitOptions = [
  'm²',
  'm³',
  'm',
  'EA',
  'kg',
  't',
  'L',
  'HR',
  'DAY',
  'SF',
  'LF',
  'CY',
  'OTHER',
]


const emptyWorkPackageForm = {
  code: '',
  description: '',
}


const emptyScopeItemForm = {
  id: null,
  project_work_package_id: '',
  service_name: '',
  service_code: '',
  unit: 'm²',
  custom_unit: '',
  scope_quantity: '',
}


function getErrorMessage(error) {
  if (!error) {
    return 'An unexpected error occurred.'
  }

  if (error.code === '23505') {
    return 'A record with the same identifying information already exists.'
  }

  if (error.code === '23503') {
    return 'This record is connected to other project information and cannot be changed.'
  }

  if (error.code === '23514') {
    return 'One or more values do not satisfy the project scope rules.'
  }

  if (error.code === '42501') {
    return 'Your account does not have permission to perform this action.'
  }

  return (
    error.message ||
    'The requested operation could not be completed.'
  )
}


function normalizeWorkPackageCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3)
}


function normalizeServiceCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}


function createServiceCode(
  serviceName,
  scopeItems
) {
  const base =
    normalizeServiceCode(serviceName) ||
    'SCOPE_ITEM'

  const existingCodes =
    new Set(
      scopeItems.map(
        (scopeItem) =>
          String(
            scopeItem.service_code || ''
          ).toUpperCase()
      )
    )

  if (!existingCodes.has(base)) {
    return base
  }

  let suffix = 2

  while (
    existingCodes.has(
      `${base}_${suffix}`
    )
  ) {
    suffix += 1
  }

  return `${base}_${suffix}`
}


function formatQuantity(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—'
  }

  const numericValue =
    Number(value)

  if (!Number.isFinite(numericValue)) {
    return String(value)
  }

  return new Intl.NumberFormat(
    'en-US',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(numericValue)
}


export default function ScopeWorkspace({
  projectId,
  userId,
  initialWorkPackages = [],
  initialScopeItems = [],
}) {
  const supabase =
    useMemo(
      () => createClient(),
      []
    )

  const [
    workPackages,
    setWorkPackages,
  ] =
    useState(initialWorkPackages)

  const [
    scopeItems,
    setScopeItems,
  ] =
    useState(initialScopeItems)

  const [
    isWorkPackageModalOpen,
    setIsWorkPackageModalOpen,
  ] =
    useState(false)

  const [
    isScopeItemModalOpen,
    setIsScopeItemModalOpen,
  ] =
    useState(false)

  const [
    workPackageForm,
    setWorkPackageForm,
  ] =
    useState(emptyWorkPackageForm)

  const [
    scopeItemForm,
    setScopeItemForm,
  ] =
    useState(emptyScopeItemForm)

  const [
    serviceCodeWasEdited,
    setServiceCodeWasEdited,
  ] =
    useState(false)

  const [
    isSaving,
    setIsSaving,
  ] =
    useState(false)

  const [
    savingScopeItemId,
    setSavingScopeItemId,
  ] =
    useState(null)

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState('')

  const [
    noticeMessage,
    setNoticeMessage,
  ] =
    useState('')


  // ==========================================================
  // DERIVED DATA
  // ==========================================================

  const activeWorkPackages =
    useMemo(
      () =>
        [...workPackages]
          .filter(
            (workPackage) =>
              workPackage.is_active !== false
          )
          .sort(
            (
              firstWorkPackage,
              secondWorkPackage
            ) =>
              String(
                firstWorkPackage.code || ''
              ).localeCompare(
                String(
                  secondWorkPackage.code || ''
                )
              )
          ),
      [
        workPackages,
      ]
    )


  const activeScopeItems =
    useMemo(
      () =>
        [...scopeItems]
          .filter(
            (scopeItem) =>
              scopeItem.is_active !== false
          )
          .sort(
            (
              firstScopeItem,
              secondScopeItem
            ) => {

              const firstSequence =
                Number(
                  firstScopeItem.sequence_number
                ) || 0

              const secondSequence =
                Number(
                  secondScopeItem.sequence_number
                ) || 0

              if (
                firstSequence !==
                secondSequence
              ) {
                return (
                  firstSequence -
                  secondSequence
                )
              }

              return String(
                firstScopeItem.service_name || ''
              ).localeCompare(
                String(
                  secondScopeItem.service_name || ''
                )
              )

            }
          ),
      [
        scopeItems,
      ]
    )


  const scopeItemsByWorkPackage =
    useMemo(
      () => {

        const map =
          new Map()

        activeScopeItems.forEach(
          (
            scopeItem
          ) => {

            const key =
              scopeItem.project_work_package_id ||
              'unassigned'

            if (!map.has(key)) {
              map.set(
                key,
                []
              )
            }

            map
              .get(key)
              .push(scopeItem)

          }
        )

        return map

      },
      [
        activeScopeItems,
      ]
    )


  const assignedScopeItemCount =
    activeScopeItems.filter(
      (
        scopeItem
      ) =>
        Boolean(
          scopeItem.project_work_package_id
        )
    ).length


  const quantityDefinedCount =
    activeScopeItems.filter(
      (
        scopeItem
      ) =>
        scopeItem.scope_quantity !== null &&
        scopeItem.scope_quantity !== undefined
    ).length


  const unitDefinedCount =
    activeScopeItems.filter(
      (
        scopeItem
      ) =>
        Boolean(
          String(
            scopeItem.unit || ''
          ).trim()
        )
    ).length


  const scopeDefinitionComplete =
    activeScopeItems.length > 0 &&
    assignedScopeItemCount ===
      activeScopeItems.length &&
    quantityDefinedCount ===
      activeScopeItems.length &&
    unitDefinedCount ===
      activeScopeItems.length


  // ==========================================================
  // MODALS
  // ==========================================================

  function openWorkPackageModal() {
    setWorkPackageForm(
      emptyWorkPackageForm
    )

    setErrorMessage('')
    setIsWorkPackageModalOpen(true)
  }


  function closeWorkPackageModal() {
    if (isSaving) {
      return
    }

    setIsWorkPackageModalOpen(false)
    setWorkPackageForm(
      emptyWorkPackageForm
    )
    setErrorMessage('')
  }


  function openNewScopeItemModal(
    workPackageId = ''
  ) {
    setScopeItemForm({
      ...emptyScopeItemForm,
      project_work_package_id:
        workPackageId || '',
    })

    setServiceCodeWasEdited(false)
    setErrorMessage('')
    setIsScopeItemModalOpen(true)
  }


  function openEditScopeItemModal(
    scopeItem
  ) {
    const knownUnit =
      unitOptions.includes(
        scopeItem.unit
      )
        ? scopeItem.unit
        : 'OTHER'

    setScopeItemForm({
      id:
        scopeItem.id,

      project_work_package_id:
        scopeItem.project_work_package_id ||
        '',

      service_name:
        scopeItem.service_name ||
        '',

      service_code:
        scopeItem.service_code ||
        '',

      unit:
        knownUnit,

      custom_unit:
        knownUnit === 'OTHER'
          ? scopeItem.unit || ''
          : '',

      scope_quantity:
        scopeItem.scope_quantity ===
          null ||
        scopeItem.scope_quantity ===
          undefined
          ? ''
          : String(
              scopeItem.scope_quantity
            ),
    })

    setServiceCodeWasEdited(true)
    setErrorMessage('')
    setIsScopeItemModalOpen(true)
  }


  function closeScopeItemModal() {
    if (isSaving) {
      return
    }

    setIsScopeItemModalOpen(false)
    setScopeItemForm(
      emptyScopeItemForm
    )
    setServiceCodeWasEdited(false)
    setErrorMessage('')
  }


  // ==========================================================
  // CREATE WORK PACKAGE
  // ==========================================================

  async function saveWorkPackage(
    event
  ) {
    event.preventDefault()

    const normalizedCode =
      normalizeWorkPackageCode(
        workPackageForm.code
      )

    const normalizedDescription =
      workPackageForm.description.trim()

    if (
      normalizedCode.length !== 3
    ) {
      setErrorMessage(
        'Work Package code must contain exactly three letters.'
      )
      return
    }

    if (!normalizedDescription) {
      setErrorMessage(
        'Enter a Work Package description.'
      )
      return
    }

    const duplicateCode =
      workPackages.some(
        (
          workPackage
        ) =>
          String(
            workPackage.code || ''
          ).toUpperCase() ===
          normalizedCode
      )

    if (duplicateCode) {
      setErrorMessage(
        `Work Package ${normalizedCode} already exists in this project.`
      )
      return
    }

    setIsSaving(true)
    setErrorMessage('')


    // --------------------------------------------------------
    // Get the next project Work Package color.
    // --------------------------------------------------------

    const {
      data: colorData,
      error: colorError,
    } =
      await supabase.rpc(
        'get_next_project_work_package_color',
        {
          target_project_id:
            projectId,
        }
      )

    if (colorError) {
      setErrorMessage(
        getErrorMessage(
          colorError
        )
      )

      setIsSaving(false)
      return
    }


    const {
      data,
      error,
    } =
      await supabase
        .from(
          'project_work_packages'
        )
        .insert({
          project_id:
            projectId,

          code:
            normalizedCode,

          description:
            normalizedDescription,

          color:
            colorData || null,

          is_active:
            true,

          created_by:
            userId,
        })
        .select(`
          id,
          project_id,
          code,
          description,
          color,
          is_active,
          created_at,
          updated_at
        `)
        .single()


    if (error) {
      setErrorMessage(
        getErrorMessage(error)
      )

      setIsSaving(false)
      return
    }


    setWorkPackages(
      (
        currentWorkPackages
      ) => [
        ...currentWorkPackages,
        data,
      ]
    )

    setNoticeMessage(
      `${data.code} — ${data.description} was added to the project scope.`
    )

    setIsSaving(false)
    setIsWorkPackageModalOpen(false)
    setWorkPackageForm(
      emptyWorkPackageForm
    )
  }


  // ==========================================================
  // CREATE / UPDATE SCOPE ITEM
  // ==========================================================

  async function saveScopeItem(
    event
  ) {
    event.preventDefault()

    const normalizedName =
      scopeItemForm.service_name.trim()

    if (!normalizedName) {
      setErrorMessage(
        'Enter a Scope Item description.'
      )
      return
    }


    if (
      !scopeItemForm.project_work_package_id
    ) {
      setErrorMessage(
        'Select a Work Package.'
      )
      return
    }


    let finalUnit =
      scopeItemForm.unit

    if (
      scopeItemForm.unit ===
      'OTHER'
    ) {
      finalUnit =
        scopeItemForm.custom_unit.trim()

      if (!finalUnit) {
        setErrorMessage(
          'Enter a custom unit.'
        )
        return
      }
    }


    const quantityText =
      String(
        scopeItemForm.scope_quantity
      ).trim()

    let scopeQuantity =
      null

    if (quantityText !== '') {
      scopeQuantity =
        Number(
          quantityText.replace(
            ',',
            '.'
          )
        )

      if (
        !Number.isFinite(
          scopeQuantity
        ) ||
        scopeQuantity < 0
      ) {
        setErrorMessage(
          'Enter a valid Scope Quantity greater than or equal to zero.'
        )
        return
      }
    }


    let normalizedCode =
      normalizeServiceCode(
        scopeItemForm.service_code
      )

    if (!normalizedCode) {
      normalizedCode =
        createServiceCode(
          normalizedName,
          activeScopeItems.filter(
            (
              scopeItem
            ) =>
              scopeItem.id !==
              scopeItemForm.id
          )
        )
    }


    const duplicateName =
      activeScopeItems.some(
        (
          scopeItem
        ) =>
          scopeItem.id !==
            scopeItemForm.id &&
          String(
            scopeItem.service_name ||
              ''
          )
            .trim()
            .toLowerCase() ===
          normalizedName.toLowerCase()
      )


    if (duplicateName) {
      setErrorMessage(
        'A Scope Item with this description already exists in the project.'
      )
      return
    }


    const duplicateCode =
      activeScopeItems.some(
        (
          scopeItem
        ) =>
          scopeItem.id !==
            scopeItemForm.id &&
          String(
            scopeItem.service_code ||
              ''
          ).toUpperCase() ===
          normalizedCode
      )


    if (duplicateCode) {
      setErrorMessage(
        'A Scope Item with this code already exists in the project.'
      )
      return
    }


    setIsSaving(true)
    setErrorMessage('')


    if (scopeItemForm.id) {

      const {
        data,
        error,
      } =
        await supabase
          .from(
            'project_services'
          )
          .update({
            project_work_package_id:
              scopeItemForm.project_work_package_id,

            service_name:
              normalizedName,

            service_code:
              normalizedCode,

            unit:
              finalUnit,

            scope_quantity:
              scopeQuantity,
          })
          .eq(
            'id',
            scopeItemForm.id
          )
          .eq(
            'project_id',
            projectId
          )
          .select(`
            id,
            project_id,
            project_work_package_id,
            service_code,
            service_name,
            unit,
            scope_quantity,
            sequence_number,
            is_active,
            created_at,
            updated_at
          `)
          .single()


      if (error) {
        setErrorMessage(
          getErrorMessage(error)
        )

        setIsSaving(false)
        return
      }


      setScopeItems(
        (
          currentScopeItems
        ) =>
          currentScopeItems.map(
            (
              scopeItem
            ) =>
              scopeItem.id ===
              data.id
                ? data
                : scopeItem
          )
      )

      setNoticeMessage(
        `${data.service_name} was updated.`
      )

    } else {

      const nextSequence =
        activeScopeItems.reduce(
          (
            largestSequence,
            scopeItem
          ) =>
            Math.max(
              largestSequence,
              Number(
                scopeItem.sequence_number
              ) || 0
            ),
          -1
        ) + 1


      const {
        data,
        error,
      } =
        await supabase
          .from(
            'project_services'
          )
          .insert({
            project_id:
              projectId,

            project_work_package_id:
              scopeItemForm.project_work_package_id,

            service_name:
              normalizedName,

            service_code:
              normalizedCode,

            unit:
              finalUnit,

            scope_quantity:
              scopeQuantity,

            sequence_number:
              nextSequence,

            is_active:
              true,

            created_by:
              userId,
          })
          .select(`
            id,
            project_id,
            project_work_package_id,
            service_code,
            service_name,
            unit,
            scope_quantity,
            sequence_number,
            is_active,
            created_at,
            updated_at
          `)
          .single()


      if (error) {
        setErrorMessage(
          getErrorMessage(error)
        )

        setIsSaving(false)
        return
      }


      setScopeItems(
        (
          currentScopeItems
        ) => [
          ...currentScopeItems,
          data,
        ]
      )

      setNoticeMessage(
        `${data.service_name} was added to the project scope.`
      )

    }


    setIsSaving(false)
    setIsScopeItemModalOpen(false)
    setScopeItemForm(
      emptyScopeItemForm
    )
    setServiceCodeWasEdited(false)
  }


  // ==========================================================
  // QUICK PACKAGE ASSIGNMENT
  // ==========================================================

  async function assignWorkPackage(
    scopeItemId,
    workPackageId
  ) {
    if (
      !scopeItemId ||
      !workPackageId
    ) {
      return
    }


    setSavingScopeItemId(
      scopeItemId
    )

    setErrorMessage('')


    const {
      error,
    } =
      await supabase.rpc(
        'assign_scope_item_work_package',
        {
          target_project_service_id:
            scopeItemId,

          target_project_work_package_id:
            workPackageId,
        }
      )


    if (error) {
      setErrorMessage(
        getErrorMessage(error)
      )

      setSavingScopeItemId(
        null
      )
      return
    }


    setScopeItems(
      (
        currentScopeItems
      ) =>
        currentScopeItems.map(
          (
            scopeItem
          ) =>
            scopeItem.id ===
            scopeItemId
              ? {
                  ...scopeItem,
                  project_work_package_id:
                    workPackageId,
                }
              : scopeItem
        )
    )


    setSavingScopeItemId(
      null
    )

    setNoticeMessage(
      'Scope Item was assigned to its Work Package.'
    )
  }


  // ==========================================================
  // ARCHIVE SCOPE ITEM
  // ==========================================================

  async function archiveScopeItem(
    scopeItem
  ) {
    const confirmed =
      window.confirm(
        `Archive "${scopeItem.service_name}"? Existing planning or production records will remain connected to this Scope Item.`
      )

    if (!confirmed) {
      return
    }


    setSavingScopeItemId(
      scopeItem.id
    )

    setErrorMessage('')


    const {
      data,
      error,
    } =
      await supabase
        .from(
          'project_services'
        )
        .update({
          is_active:
            false,
        })
        .eq(
          'id',
          scopeItem.id
        )
        .eq(
          'project_id',
          projectId
        )
        .select(`
          id,
          project_id,
          project_work_package_id,
          service_code,
          service_name,
          unit,
          scope_quantity,
          sequence_number,
          is_active,
          created_at,
          updated_at
        `)
        .single()


    if (error) {
      setErrorMessage(
        getErrorMessage(error)
      )

      setSavingScopeItemId(
        null
      )
      return
    }


    setScopeItems(
      (
        currentScopeItems
      ) =>
        currentScopeItems.map(
          (
            currentScopeItem
          ) =>
            currentScopeItem.id ===
            data.id
              ? data
              : currentScopeItem
        )
    )


    setSavingScopeItemId(
      null
    )

    setNoticeMessage(
      `${scopeItem.service_name} was archived from the active project scope.`
    )
  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <>
      <section
        className={
          styles.scopeWorkspaceSummary
        }
      >
        <article
          className={
            styles.metricCard
          }
        >
          <span
            className={
              styles.metricLabel
            }
          >
            Work Packages
          </span>

          <strong
            className={
              styles.metricValue
            }
          >
            {
              activeWorkPackages.length
            }
          </strong>

          <span
            className={
              styles.metricDetail
            }
          >
            Active scope groups
          </span>
        </article>


        <article
          className={
            styles.metricCard
          }
        >
          <span
            className={
              styles.metricLabel
            }
          >
            Scope Items
          </span>

          <strong
            className={
              styles.metricValue
            }
          >
            {
              activeScopeItems.length
            }
          </strong>

          <span
            className={
              styles.metricDetail
            }
          >
            Project deliverables
          </span>
        </article>


        <article
          className={
            styles.metricCard
          }
        >
          <span
            className={
              styles.metricLabel
            }
          >
            Package Assignment
          </span>

          <strong
            className={
              styles.metricValue
            }
          >
            {
              assignedScopeItemCount
            }
            /
            {
              activeScopeItems.length
            }
          </strong>

          <span
            className={
              styles.metricDetail
            }
          >
            Scope Items classified
          </span>
        </article>


        <article
          className={
            styles.metricCard
          }
        >
          <span
            className={
              styles.metricLabel
            }
          >
            Quantities Defined
          </span>

          <strong
            className={
              styles.metricValue
            }
          >
            {
              quantityDefinedCount
            }
            /
            {
              activeScopeItems.length
            }
          </strong>

          <span
            className={
              styles.metricDetail
            }
          >
            Authoritative quantities
          </span>
        </article>
      </section>


      <section
        className={
          styles.scopeWorkspaceStatus
        }
      >
        <div>
          <span
            className={
              styles.scopeWorkspaceStatusLabel
            }
          >
            Scope Definition
          </span>

          <strong>
            {
              scopeDefinitionComplete
                ? 'Complete'
                : 'Incomplete'
            }
          </strong>
        </div>

        <span
          className={
            scopeDefinitionComplete
              ? styles.scopeWorkspaceComplete
              : styles.scopeWorkspaceIncomplete
          }
        >
          {
            scopeDefinitionComplete
              ? 'READY'
              : 'ACTION REQUIRED'
          }
        </span>
      </section>


      <section
        className={
          styles.formPanel
        }
      >
        <div
          className={
            styles.scopeWorkspaceHeader
          }
        >
          <div>
            <h2
              className={
                styles.formTitle
              }
            >
              Project Scope
            </h2>

            <p
              className={
                styles.formDescription
              }
            >
              Define Work Packages and the Scope Items
              contained within each package. Scope Item
              quantities are authoritative and are not
              automatically summed at Work Package level.
            </p>
          </div>


          <div
            className={
              styles.scopeWorkspaceActions
            }
          >
            <button
              type="button"
              className={
                styles.secondaryButton
              }
              onClick={
                openWorkPackageModal
              }
            >
              + Work Package
            </button>

            <button
              type="button"
              className={
                styles.primaryButton
              }
              onClick={() =>
                openNewScopeItemModal()
              }
              disabled={
                activeWorkPackages.length ===
                0
              }
            >
              + Scope Item
            </button>
          </div>
        </div>


        {errorMessage && (
          <div
            className={
              styles.scopeWorkspaceError
            }
            role="alert"
          >
            {errorMessage}
          </div>
        )}


        {activeWorkPackages.length ===
          0 &&
        activeScopeItems.length ===
          0 ? (
          <div
            className={
              styles.workspaceEmpty
            }
          >
            <span
              className={
                styles.workspaceEmptyIcon
              }
            >
              SBS
            </span>

            <h3>
              Start the Scope Breakdown Structure.
            </h3>

            <p>
              Create the first Work Package,
              then add the Scope Items that
              define what the project must
              deliver.
            </p>

            <button
              type="button"
              className={
                styles.primaryButton
              }
              onClick={
                openWorkPackageModal
              }
            >
              + Create first Work Package
            </button>
          </div>
        ) : (
          <div
            className={
              styles.scopeStructure
            }
          >
            {activeWorkPackages.map(
              (
                workPackage,
                packageIndex
              ) => {

                const packageItems =
                  scopeItemsByWorkPackage.get(
                    workPackage.id
                  ) || []


                return (
                  <article
                    className={
                      styles.scopePackage
                    }
                    key={
                      workPackage.id
                    }
                  >
                    <div
                      className={
                        styles.scopePackageHeader
                      }
                    >
                      <div
                        className={
                          styles.scopePackageIdentity
                        }
                      >
                        <span
                          className={
                            styles.scopePackageNumber
                          }
                        >
                          {
                            String(
                              packageIndex + 1
                            ).padStart(
                              2,
                              '0'
                            )
                          }
                        </span>


                        <span
                          className={
                            styles.scopePackageColor
                          }
                          style={{
                            backgroundColor:
                              workPackage.color ||
                              '#00a99d',
                          }}
                        />


                        <div>
                          <div
                            className={
                              styles.scopePackageCode
                            }
                          >
                            {
                              workPackage.code
                            }
                          </div>

                          <h3
                            className={
                              styles.scopePackageName
                            }
                          >
                            {
                              workPackage.description
                            }
                          </h3>
                        </div>
                      </div>


                      <div
                        className={
                          styles.scopePackageHeaderActions
                        }
                      >
                        <span
                          className={
                            styles.scopePackageCount
                          }
                        >
                          {
                            packageItems.length
                          }{' '}
                          {
                            packageItems.length ===
                            1
                              ? 'Scope Item'
                              : 'Scope Items'
                          }
                        </span>

                        <button
                          type="button"
                          className={
                            styles.scopePackageAddButton
                          }
                          onClick={() =>
                            openNewScopeItemModal(
                              workPackage.id
                            )
                          }
                        >
                          + Add Scope Item
                        </button>
                      </div>
                    </div>


                    {packageItems.length ===
                    0 ? (
                      <div
                        className={
                          styles.scopePackageEmpty
                        }
                      >
                        No Scope Items have been
                        assigned to this Work
                        Package.
                      </div>
                    ) : (
                      <div
                        className={
                          styles.scopeItemTable
                        }
                      >
                        <div
                          className={
                            styles.scopeItemTableHeader
                          }
                        >
                          <span>ID</span>
                          <span>
                            Scope Item
                          </span>
                          <span>
                            Unit
                          </span>
                          <span>
                            Scope Quantity
                          </span>
                          <span>
                            Status
                          </span>
                          <span>
                            Actions
                          </span>
                        </div>


                        {packageItems.map(
                          (
                            scopeItem,
                            itemIndex
                          ) => {

                            const isComplete =
                              Boolean(
                                scopeItem.project_work_package_id
                              ) &&
                              Boolean(
                                String(
                                  scopeItem.unit ||
                                  ''
                                ).trim()
                              ) &&
                              scopeItem.scope_quantity !==
                                null &&
                              scopeItem.scope_quantity !==
                                undefined


                            return (
                              <div
                                className={
                                  styles.scopeItemRow
                                }
                                key={
                                  scopeItem.id
                                }
                              >
                                <span
                                  className={
                                    styles.scopeItemNumber
                                  }
                                >
                                  {
                                    packageIndex +
                                    1
                                  }.
                                  {
                                    itemIndex +
                                    1
                                  }
                                </span>


                                <div
                                  className={
                                    styles.scopeItemIdentity
                                  }
                                >
                                  <strong>
                                    {
                                      scopeItem.service_name
                                    }
                                  </strong>

                                  <span>
                                    {
                                      scopeItem.service_code ||
                                      'No code'
                                    }
                                  </span>
                                </div>


                                <span
                                  className={
                                    styles.scopeItemUnit
                                  }
                                >
                                  {
                                    scopeItem.unit ||
                                    '—'
                                  }
                                </span>


                                <span
                                  className={
                                    scopeItem.scope_quantity ===
                                      null ||
                                    scopeItem.scope_quantity ===
                                      undefined
                                      ? styles.scopeItemQuantityMissing
                                      : styles.scopeItemQuantity
                                  }
                                >
                                  {
                                    formatQuantity(
                                      scopeItem.scope_quantity
                                    )
                                  }
                                </span>


                                <span
                                  className={
                                    isComplete
                                      ? styles.scopeRowComplete
                                      : styles.scopeRowIncomplete
                                  }
                                >
                                  {
                                    isComplete
                                      ? 'Complete'
                                      : 'Incomplete'
                                  }
                                </span>


                                <div
                                  className={
                                    styles.scopeRowActions
                                  }
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEditScopeItemModal(
                                        scopeItem
                                      )
                                    }
                                    disabled={
                                      savingScopeItemId ===
                                      scopeItem.id
                                    }
                                  >
                                    Edit
                                  </button>

                                  <button
                                    type="button"
                                    className={
                                      styles.scopeArchiveButton
                                    }
                                    onClick={() =>
                                      archiveScopeItem(
                                        scopeItem
                                      )
                                    }
                                    disabled={
                                      savingScopeItemId ===
                                      scopeItem.id
                                    }
                                  >
                                    Archive
                                  </button>
                                </div>
                              </div>
                            )
                          }
                        )}
                      </div>
                    )}
                  </article>
                )
              }
            )}


            {scopeItemsByWorkPackage.has(
              'unassigned'
            ) && (
              <article
                className={`${styles.scopePackage} ${styles.scopePackageUnassigned}`}
              >
                <div
                  className={
                    styles.scopePackageHeader
                  }
                >
                  <div
                    className={
                      styles.scopePackageIdentity
                    }
                  >
                    <span
                      className={
                        styles.scopePackageNumber
                      }
                    >
                      !
                    </span>

                    <div>
                      <div
                        className={
                          styles.scopePackageCode
                        }
                      >
                        UNASSIGNED
                      </div>

                      <h3
                        className={
                          styles.scopePackageName
                        }
                      >
                        Scope Items requiring
                        classification
                      </h3>
                    </div>
                  </div>

                  <span
                    className={
                      styles.scopePackageCount
                    }
                  >
                    {
                      scopeItemsByWorkPackage.get(
                        'unassigned'
                      ).length
                    }{' '}
                    items
                  </span>
                </div>


                <div
                  className={
                    styles.scopeItemTable
                  }
                >
                  <div
                    className={
                      styles.scopeItemTableHeader
                    }
                  >
                    <span>ID</span>
                    <span>Scope Item</span>
                    <span>Unit</span>
                    <span>
                      Scope Quantity
                    </span>
                    <span>
                      Work Package
                    </span>
                    <span>Actions</span>
                  </div>


                  {scopeItemsByWorkPackage
                    .get(
                      'unassigned'
                    )
                    .map(
                      (
                        scopeItem,
                        itemIndex
                      ) => (
                        <div
                          className={
                            styles.scopeItemRow
                          }
                          key={
                            scopeItem.id
                          }
                        >
                          <span
                            className={
                              styles.scopeItemNumber
                            }
                          >
                            U.
                            {
                              itemIndex +
                              1
                            }
                          </span>


                          <div
                            className={
                              styles.scopeItemIdentity
                            }
                          >
                            <strong>
                              {
                                scopeItem.service_name
                              }
                            </strong>

                            <span>
                              {
                                scopeItem.service_code ||
                                'No code'
                              }
                            </span>
                          </div>


                          <span
                            className={
                              styles.scopeItemUnit
                            }
                          >
                            {
                              scopeItem.unit ||
                              '—'
                            }
                          </span>


                          <span
                            className={
                              scopeItem.scope_quantity ===
                                null ||
                              scopeItem.scope_quantity ===
                                undefined
                                ? styles.scopeItemQuantityMissing
                                : styles.scopeItemQuantity
                            }
                          >
                            {
                              formatQuantity(
                                scopeItem.scope_quantity
                              )
                            }
                          </span>


                          <select
                            className={
                              styles.scopePackageSelect
                            }
                            value=""
                            disabled={
                              savingScopeItemId ===
                              scopeItem.id
                            }
                            onChange={
                              (
                                event
                              ) =>
                                assignWorkPackage(
                                  scopeItem.id,
                                  event.target.value
                                )
                            }
                          >
                            <option value="">
                              Assign...
                            </option>

                            {activeWorkPackages.map(
                              (
                                workPackage
                              ) => (
                                <option
                                  value={
                                    workPackage.id
                                  }
                                  key={
                                    workPackage.id
                                  }
                                >
                                  {
                                    workPackage.code
                                  }{' '}
                                  —{' '}
                                  {
                                    workPackage.description
                                  }
                                </option>
                              )
                            )}
                          </select>


                          <div
                            className={
                              styles.scopeRowActions
                            }
                          >
                            <button
                              type="button"
                              onClick={() =>
                                openEditScopeItemModal(
                                  scopeItem
                                )
                              }
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      )
                    )}
                </div>
              </article>
            )}
          </div>
        )}
      </section>


      {noticeMessage && (
        <div
          className={
            styles.scopeWorkspaceNotice
          }
          role="status"
        >
          <span>✓</span>

          <span>
            {noticeMessage}
          </span>

          <button
            type="button"
            onClick={() =>
              setNoticeMessage('')
            }
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      )}


      {/* ======================================================
          WORK PACKAGE MODAL
          ====================================================== */}

      {isWorkPackageModalOpen && (
        <div
          className={
            styles.scopeModalBackdrop
          }
          onMouseDown={
            (
              event
            ) => {

              if (
                event.target ===
                event.currentTarget
              ) {
                closeWorkPackageModal()
              }

            }
          }
        >
          <form
            className={
              styles.scopeModal
            }
            onSubmit={
              saveWorkPackage
            }
          >
            <div
              className={
                styles.scopeModalHeader
              }
            >
              <div>
                <p>
                  Scope Breakdown Structure
                </p>

                <h2>
                  Add Work Package
                </h2>
              </div>

              <button
                type="button"
                onClick={
                  closeWorkPackageModal
                }
                aria-label="Close modal"
              >
                ×
              </button>
            </div>


            <p
              className={
                styles.scopeModalDescription
              }
            >
              Work Packages are the first
              organizational level of the
              project Scope Breakdown Structure.
            </p>


            <div
              className={
                styles.scopeModalGrid
              }
            >
              <label
                className={
                  styles.scopeModalField
                }
              >
                <span>
                  Work Package code
                </span>

                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={3}
                  value={
                    workPackageForm.code
                  }
                  onChange={
                    (
                      event
                    ) =>
                      setWorkPackageForm(
                        (
                          currentForm
                        ) => ({
                          ...currentForm,

                          code:
                            normalizeWorkPackageCode(
                              event.target.value
                            ),
                        })
                      )
                  }
                  placeholder="VEX"
                />

                <small>
                  Exactly three letters.
                </small>
              </label>


              <label
                className={`${styles.scopeModalField} ${styles.scopeModalFieldFull}`}
              >
                <span>
                  Description
                </span>

                <input
                  type="text"
                  required
                  value={
                    workPackageForm.description
                  }
                  onChange={
                    (
                      event
                    ) =>
                      setWorkPackageForm(
                        (
                          currentForm
                        ) => ({
                          ...currentForm,

                          description:
                            event.target.value,
                        })
                      )
                  }
                  placeholder="Exterior Walls"
                />
              </label>
            </div>


            {errorMessage && (
              <div
                className={
                  styles.scopeModalError
                }
                role="alert"
              >
                {errorMessage}
              </div>
            )}


            <div
              className={
                styles.scopeModalActions
              }
            >
              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={
                  closeWorkPackageModal
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
                {
                  isSaving
                    ? 'Saving...'
                    : 'Add Work Package'
                }
              </button>
            </div>
          </form>
        </div>
      )}


      {/* ======================================================
          SCOPE ITEM MODAL
          ====================================================== */}

      {isScopeItemModalOpen && (
        <div
          className={
            styles.scopeModalBackdrop
          }
          onMouseDown={
            (
              event
            ) => {

              if (
                event.target ===
                event.currentTarget
              ) {
                closeScopeItemModal()
              }

            }
          }
        >
          <form
            className={
              styles.scopeModal
            }
            onSubmit={
              saveScopeItem
            }
          >
            <div
              className={
                styles.scopeModalHeader
              }
            >
              <div>
                <p>
                  Scope Breakdown Structure
                </p>

                <h2>
                  {
                    scopeItemForm.id
                      ? 'Edit Scope Item'
                      : 'Add Scope Item'
                  }
                </h2>
              </div>

              <button
                type="button"
                onClick={
                  closeScopeItemModal
                }
                aria-label="Close modal"
              >
                ×
              </button>
            </div>


            <p
              className={
                styles.scopeModalDescription
              }
            >
              A Scope Item is a measurable
              project deliverable or production
              operation belonging to a Work
              Package.
            </p>


            <div
              className={
                styles.scopeModalGrid
              }
            >
              <label
                className={`${styles.scopeModalField} ${styles.scopeModalFieldFull}`}
              >
                <span>
                  Work Package
                </span>

                <select
                  required
                  value={
                    scopeItemForm.project_work_package_id
                  }
                  onChange={
                    (
                      event
                    ) =>
                      setScopeItemForm(
                        (
                          currentForm
                        ) => ({
                          ...currentForm,

                          project_work_package_id:
                            event.target.value,
                        })
                      )
                  }
                >
                  <option value="">
                    Select Work Package
                  </option>

                  {activeWorkPackages.map(
                    (
                      workPackage
                    ) => (
                      <option
                        value={
                          workPackage.id
                        }
                        key={
                          workPackage.id
                        }
                      >
                        {
                          workPackage.code
                        }{' '}
                        —{' '}
                        {
                          workPackage.description
                        }
                      </option>
                    )
                  )}
                </select>
              </label>


              <label
                className={`${styles.scopeModalField} ${styles.scopeModalFieldFull}`}
              >
                <span>
                  Scope Item description
                </span>

                <input
                  type="text"
                  required
                  autoFocus
                  value={
                    scopeItemForm.service_name
                  }
                  onChange={
                    (
                      event
                    ) => {

                      const nextName =
                        event.target.value

                      setScopeItemForm(
                        (
                          currentForm
                        ) => ({
                          ...currentForm,

                          service_name:
                            nextName,

                          service_code:
                            serviceCodeWasEdited
                              ? currentForm.service_code
                              : createServiceCode(
                                  nextName,
                                  activeScopeItems
                                ),
                        })
                      )

                    }
                  }
                  placeholder="Install the Glasroc board"
                />
              </label>


              <label
                className={
                  styles.scopeModalField
                }
              >
                <span>
                  Scope Item code
                </span>

                <input
                  type="text"
                  value={
                    scopeItemForm.service_code
                  }
                  onChange={
                    (
                      event
                    ) => {

                      setServiceCodeWasEdited(
                        true
                      )

                      setScopeItemForm(
                        (
                          currentForm
                        ) => ({
                          ...currentForm,

                          service_code:
                            normalizeServiceCode(
                              event.target.value
                            ),
                        })
                      )

                    }
                  }
                  placeholder="GLASROC_BOARD"
                />
              </label>


              <label
                className={
                  styles.scopeModalField
                }
              >
                <span>
                  Unit
                </span>

                <select
                  value={
                    scopeItemForm.unit
                  }
                  onChange={
                    (
                      event
                    ) =>
                      setScopeItemForm(
                        (
                          currentForm
                        ) => ({
                          ...currentForm,

                          unit:
                            event.target.value,

                          custom_unit:
                            event.target.value ===
                            'OTHER'
                              ? currentForm.custom_unit
                              : '',
                        })
                      )
                  }
                >
                  {unitOptions.map(
                    (
                      unit
                    ) => (
                      <option
                        value={
                          unit
                        }
                        key={
                          unit
                        }
                      >
                        {
                          unit ===
                          'OTHER'
                            ? 'Other...'
                            : unit
                        }
                      </option>
                    )
                  )}
                </select>
              </label>


              {scopeItemForm.unit ===
                'OTHER' && (
                <label
                  className={
                    styles.scopeModalField
                  }
                >
                  <span>
                    Custom unit
                  </span>

                  <input
                    type="text"
                    required
                    maxLength={20}
                    value={
                      scopeItemForm.custom_unit
                    }
                    onChange={
                      (
                        event
                      ) =>
                        setScopeItemForm(
                          (
                            currentForm
                          ) => ({
                            ...currentForm,

                            custom_unit:
                              event.target.value,
                          })
                        )
                    }
                    placeholder="Example: box"
                  />
                </label>
              )}


              <label
                className={
                  styles.scopeModalField
                }
              >
                <span>
                  Scope Quantity
                </span>

                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={
                    scopeItemForm.scope_quantity
                  }
                  onChange={
                    (
                      event
                    ) =>
                      setScopeItemForm(
                        (
                          currentForm
                        ) => ({
                          ...currentForm,

                          scope_quantity:
                            event.target.value,
                        })
                      )
                  }
                  placeholder="1500"
                />

                <small>
                  Authoritative project
                  quantity for this Scope Item.
                </small>
              </label>
            </div>


            {errorMessage && (
              <div
                className={
                  styles.scopeModalError
                }
                role="alert"
              >
                {errorMessage}
              </div>
            )}


            <div
              className={
                styles.scopeModalActions
              }
            >
              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={
                  closeScopeItemModal
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
                {
                  isSaving
                    ? 'Saving...'
                    : scopeItemForm.id
                      ? 'Save Scope Item'
                      : 'Add Scope Item'
                }
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
