'use client'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { useRouter } from 'next/navigation'

import { createClient } from '../../../../lib/supabase/client'

import styles from './project-setup.module.css'


function getErrorMessage(error) {
  if (!error) {
    return 'An unexpected error occurred.'
  }

  if (error.code === '23505') {
    return 'Production Parameters already exist for this Scope Item.'
  }

  if (error.code === '23503') {
    return 'This production parameter is connected to invalid project information.'
  }

  if (error.code === '23514') {
    return 'The production parameter does not satisfy the project rules.'
  }

  if (error.code === '42501') {
    return 'Your account does not have permission to perform this action.'
  }

  return (
    error.message ||
    'The requested operation could not be completed.'
  )
}


function formatNumber(value) {
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


function normalizeNumericText(value) {
  return String(value ?? '')
    .trim()
    .replace(',', '.')
}


export default function ProductionParametersWorkspace({
  projectId,
  projectCode = '',
  userId,
  workPackages = [],
  scopeItems = [],
  initialParameters = [],
}) {
  const router =
    useRouter()

  const supabase =
    useMemo(
      () => createClient(),
      []
    )

  const [parameters, setParameters] =
    useState(initialParameters)

  const [drafts, setDrafts] =
    useState({})

  const [searchTerm, setSearchTerm] =
    useState('')

  const [savingKey, setSavingKey] =
    useState(null)

  const [errorMessage, setErrorMessage] =
    useState('')

  const [noticeMessage, setNoticeMessage] =
    useState('')


  useEffect(() => {
    setParameters(initialParameters)
  }, [initialParameters])


  const parameterMap =
    useMemo(
      () =>
        new Map(
          parameters.map(
            (parameter) => [
              parameter.service_id,
              parameter,
            ]
          )
        ),
      [parameters]
    )


  const workPackageMap =
    useMemo(
      () =>
        new Map(
          workPackages.map(
            (workPackage) => [
              workPackage.id,
              workPackage,
            ]
          )
        ),
      [workPackages]
    )


  useEffect(() => {
    const nextDrafts = {}

    scopeItems.forEach(
      (scopeItem) => {
        const parameter =
          parameterMap.get(scopeItem.id)

        nextDrafts[scopeItem.id] = {
          productivity_rate:
            parameter?.productivity_rate === null ||
            parameter?.productivity_rate === undefined
              ? ''
              : String(parameter.productivity_rate),

          productivity_basis:
            parameter?.productivity_basis ||
            'worker_day',

          effective_workforce:
            parameter?.effective_workforce === null ||
            parameter?.effective_workforce === undefined
              ? ''
              : String(parameter.effective_workforce),
        }
      }
    )

    setDrafts(nextDrafts)
  }, [parameterMap, scopeItems])


  const activeScopeItems =
    useMemo(
      () =>
        [...scopeItems]
          .filter(
            (scopeItem) =>
              scopeItem.is_active !== false
          )
          .sort(
            (firstItem, secondItem) => {
              const firstSequence =
                Number(firstItem.sequence_number) || 0

              const secondSequence =
                Number(secondItem.sequence_number) || 0

              if (firstSequence !== secondSequence) {
                return firstSequence - secondSequence
              }

              return String(
                firstItem.service_name || ''
              ).localeCompare(
                String(secondItem.service_name || '')
              )
            }
          ),
      [scopeItems]
    )


  const filteredScopeItems =
    useMemo(
      () => {
        const normalizedSearch =
          searchTerm
            .trim()
            .toLowerCase()

        if (!normalizedSearch) {
          return activeScopeItems
        }

        return activeScopeItems.filter(
          (scopeItem) => {
            const workPackage =
              workPackageMap.get(
                scopeItem.project_work_package_id
              )

            const searchableText =
              [
                workPackage?.code,
                workPackage?.description,
                scopeItem.service_code,
                scopeItem.service_name,
                scopeItem.unit,
              ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()

            return searchableText.includes(
              normalizedSearch
            )
          }
        )
      },
      [
        activeScopeItems,
        searchTerm,
        workPackageMap,
      ]
    )


  const configuredCount =
    useMemo(
      () =>
        activeScopeItems.filter(
          (scopeItem) => {
            const parameter =
              parameterMap.get(scopeItem.id)

            return (
              Number(parameter?.productivity_rate) > 0 &&
              Number(parameter?.effective_workforce) > 0
            )
          }
        ).length,
      [activeScopeItems, parameterMap]
    )


  async function saveParameter(scopeItem) {
    if (!projectId || !userId || !scopeItem?.id) {
      return
    }

    const draft =
      drafts[scopeItem.id] || {}

    const productivityText =
      normalizeNumericText(
        draft.productivity_rate
      )

    const workforceText =
      normalizeNumericText(
        draft.effective_workforce
      )

    const basis =
      String(
        draft.productivity_basis ||
        'worker_day'
      ).trim()

    const existing =
      parameterMap.get(scopeItem.id)

    const isCompletelyBlank =
      productivityText === '' &&
      workforceText === ''

    setErrorMessage('')
    setNoticeMessage('')

    if (isCompletelyBlank) {
      if (!existing) {
        return
      }

      setSavingKey(scopeItem.id)

      const { error } =
        await supabase
          .from(
            'project_service_production_parameters'
          )
          .delete()
          .eq('id', existing.id)
          .eq('project_id', projectId)

      if (error) {
        setErrorMessage(
          getErrorMessage(error)
        )
        setSavingKey(null)
        return
      }

      setParameters(
        (currentParameters) =>
          currentParameters.filter(
            (parameter) =>
              parameter.id !== existing.id
          )
      )

      setSavingKey(null)
      setNoticeMessage(
        `${scopeItem.service_name} production parameters were cleared.`
      )
      router.refresh()
      return
    }

    const productivityRate =
      productivityText === ''
        ? null
        : Number(productivityText)

    const effectiveWorkforce =
      workforceText === ''
        ? null
        : Number(workforceText)

    if (
      productivityRate !== null &&
      (
        !Number.isFinite(productivityRate) ||
        productivityRate <= 0
      )
    ) {
      setErrorMessage(
        `Enter a Productivity greater than zero for ${scopeItem.service_name}.`
      )
      return
    }

    if (
      effectiveWorkforce !== null &&
      (
        !Number.isFinite(effectiveWorkforce) ||
        effectiveWorkforce <= 0
      )
    ) {
      setErrorMessage(
        `Enter an Effective Workforce greater than zero for ${scopeItem.service_name}.`
      )
      return
    }

    const unchanged =
      existing &&
      (existing.productivity_rate === null
        ? null
        : Number(existing.productivity_rate)) ===
        productivityRate &&
      (existing.effective_workforce === null
        ? null
        : Number(existing.effective_workforce)) ===
        effectiveWorkforce &&
      (existing.productivity_basis || 'worker_day') ===
        basis &&
      (existing.quantity_unit || scopeItem.unit || null) ===
        (scopeItem.unit || null)

    if (unchanged) {
      return
    }

    setSavingKey(scopeItem.id)

    const { data, error } =
      await supabase
        .from(
          'project_service_production_parameters'
        )
        .upsert(
          {
            project_id: projectId,
            service_id: scopeItem.id,
            productivity_rate: productivityRate,
            quantity_unit:
              scopeItem.unit || null,
            productivity_basis: basis,
            effective_workforce:
              effectiveWorkforce,
            created_by: userId,
          },
          {
            onConflict: 'project_id,service_id',
          }
        )
        .select(`
          id,
          project_id,
          service_id,
          productivity_rate,
          quantity_unit,
          productivity_basis,
          effective_workforce,
          created_at,
          updated_at
        `)
        .single()

    if (error) {
      setErrorMessage(
        getErrorMessage(error)
      )
      setSavingKey(null)
      return
    }

    setParameters(
      (currentParameters) => {
        const exists =
          currentParameters.some(
            (parameter) =>
              parameter.id === data.id
          )

        return exists
          ? currentParameters.map(
              (parameter) =>
                parameter.id === data.id
                  ? data
                  : parameter
            )
          : [
              ...currentParameters,
              data,
            ]
      }
    )

    setSavingKey(null)
    setNoticeMessage(
      `${scopeItem.service_name} production parameters were saved.`
    )
    router.refresh()
  }


  function updateDraft(
    scopeItemId,
    field,
    value
  ) {
    setDrafts(
      (currentDrafts) => ({
        ...currentDrafts,
        [scopeItemId]: {
          ...(currentDrafts[scopeItemId] || {}),
          [field]: value,
        },
      })
    )
  }


  return (
    <>
      <section className={styles.metricGrid}>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Scope Items</span>
          <strong className={styles.metricValue}>
            {activeScopeItems.length}
          </strong>
          <span className={styles.metricDetail}>
            Active project scope
          </span>
        </article>

        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Configured</span>
          <strong className={styles.metricValue}>
            {configuredCount}
          </strong>
          <span className={styles.metricDetail}>
            Productivity + workforce defined
          </span>
        </article>

        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Pending</span>
          <strong className={styles.metricValue}>
            {Math.max(
              activeScopeItems.length - configuredCount,
              0
            )}
          </strong>
          <span className={styles.metricDetail}>
            Parameters still to define
          </span>
        </article>
      </section>

      <section className={styles.formPanel}>
        <div className={styles.formHeader}>
          <div>
            <h2 className={styles.formTitle}>
              Production Parameters
            </h2>

            <p className={styles.formDescription}>
              Define one project-wide production parameter set for each Scope Item.
              These values form the calculation database used later to derive raw
              activity durations from allocated quantities. Takt standardization is
              intentionally handled in the planning stage, not here.
            </p>
          </div>
        </div>

        <div
          style={{
            padding: '16px 18px',
            borderBottom: '1px solid #e4ebf1',
            background: '#fbfcfd',
          }}
        >
          <input
            type="search"
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(event.target.value)
            }
            placeholder="Search Work Packages or Scope Items..."
            aria-label="Search Production Parameters"
            style={{
              width: '100%',
              minHeight: '42px',
              border: '1px solid #d7e0e8',
              borderRadius: '8px',
              padding: '0 12px',
              background: '#ffffff',
            }}
          />
        </div>

        {errorMessage && (
          <div className={styles.scopeWorkspaceError}>
            {errorMessage}
          </div>
        )}

        {noticeMessage && (
          <div className={styles.scopeWorkspaceNotice}>
            {noticeMessage}
          </div>
        )}

        {activeScopeItems.length === 0 ? (
          <div className={styles.workspaceEmpty}>
            <span className={styles.workspaceEmptyIcon}>PP</span>
            <h3>No Scope Items available.</h3>
            <p>
              Define the project Scope before establishing Production Parameters.
            </p>
          </div>
        ) : (
          <div
            style={{
              overflowX: 'auto',
              width: '100%',
            }}
          >
            <div
              style={{
                minWidth: '1160px',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    '120px minmax(280px, 1.7fr) 90px 150px 170px 170px 170px',
                  gap: 0,
                  alignItems: 'center',
                  minHeight: '48px',
                  padding: '0 18px',
                  borderBottom: '1px solid #dfe7ee',
                  background: '#f5f8fa',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#4a5b68',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                <span>Work Package</span>
                <span>Scope Item</span>
                <span>Unit</span>
                <span>Productivity</span>
                <span>Basis</span>
                <span>Effective Workforce</span>
                <span>Production Capacity</span>
              </div>

              {filteredScopeItems.map(
                (scopeItem) => {
                  const workPackage =
                    workPackageMap.get(
                      scopeItem.project_work_package_id
                    )

                  const draft =
                    drafts[scopeItem.id] || {}

                  const productivity =
                    Number(
                      normalizeNumericText(
                        draft.productivity_rate
                      )
                    )

                  const workforce =
                    Number(
                      normalizeNumericText(
                        draft.effective_workforce
                      )
                    )

                  const capacity =
                    Number.isFinite(productivity) &&
                    productivity > 0 &&
                    Number.isFinite(workforce) &&
                    workforce > 0
                      ? productivity * workforce
                      : null

                  const isSaving =
                    savingKey === scopeItem.id

                  return (
                    <div
                      key={scopeItem.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          '120px minmax(280px, 1.7fr) 90px 150px 170px 170px 170px',
                        gap: 0,
                        alignItems: 'center',
                        minHeight: '66px',
                        padding: '8px 18px',
                        borderBottom: '1px solid #edf1f4',
                        background: '#ffffff',
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          color: '#1f3b50',
                        }}
                      >
                        {workPackage?.code || '—'}
                      </span>

                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px',
                          paddingRight: '12px',
                        }}
                      >
                        <strong
                          style={{
                            color: '#18354a',
                            fontSize: '14px',
                          }}
                        >
                          {scopeItem.service_name}
                        </strong>
                        <span
                          style={{
                            color: '#71808c',
                            fontSize: '12px',
                          }}
                        >
                          {scopeItem.service_code || 'Scope Item'}
                        </span>
                      </div>

                      <span>
                        {scopeItem.unit || '—'}
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={draft.productivity_rate ?? ''}
                        disabled={isSaving}
                        onChange={(event) =>
                          updateDraft(
                            scopeItem.id,
                            'productivity_rate',
                            event.target.value
                          )
                        }
                        onBlur={() =>
                          saveParameter(scopeItem)
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.currentTarget.blur()
                          }
                        }}
                        placeholder="Rate"
                        style={{
                          width: '128px',
                          minHeight: '38px',
                          border: '1px solid #d7e0e8',
                          borderRadius: '7px',
                          padding: '0 10px',
                        }}
                      />

                      <select
                        value={
                          draft.productivity_basis ||
                          'worker_day'
                        }
                        disabled={isSaving}
                        onChange={(event) => {
                          updateDraft(
                            scopeItem.id,
                            'productivity_basis',
                            event.target.value
                          )
                        }}
                        onBlur={() =>
                          saveParameter(scopeItem)
                        }
                        style={{
                          width: '150px',
                          minHeight: '38px',
                          border: '1px solid #d7e0e8',
                          borderRadius: '7px',
                          padding: '0 8px',
                          background: '#ffffff',
                        }}
                      >
                        <option value="worker_day">
                          Per worker / day
                        </option>
                        <option value="crew_day">
                          Per crew / day
                        </option>
                      </select>

                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={draft.effective_workforce ?? ''}
                        disabled={isSaving}
                        onChange={(event) =>
                          updateDraft(
                            scopeItem.id,
                            'effective_workforce',
                            event.target.value
                          )
                        }
                        onBlur={() =>
                          saveParameter(scopeItem)
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.currentTarget.blur()
                          }
                        }}
                        placeholder="Workers"
                        style={{
                          width: '145px',
                          minHeight: '38px',
                          border: '1px solid #d7e0e8',
                          borderRadius: '7px',
                          padding: '0 10px',
                        }}
                      />

                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                        }}
                      >
                        <strong
                          style={{
                            color: '#18354a',
                            fontSize: '14px',
                          }}
                        >
                          {capacity === null
                            ? '—'
                            : formatNumber(capacity)}
                        </strong>

                        <span
                          style={{
                            color: '#71808c',
                            fontSize: '11px',
                          }}
                        >
                          {capacity === null
                            ? 'Waiting for inputs'
                            : `${scopeItem.unit || 'unit'}/day`}
                        </span>
                      </div>
                    </div>
                  )
                }
              )}
            </div>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '14px 18px',
            borderTop: '1px solid #e4ebf1',
            background: '#fbfcfd',
            color: '#667784',
            fontSize: '12px',
          }}
        >
          <span>
            {filteredScopeItems.length} Scope Item
            {filteredScopeItems.length === 1 ? '' : 's'} shown
          </span>

          <span>
            Project {projectCode || projectId}
          </span>
        </div>
      </section>
    </>
  )
}
