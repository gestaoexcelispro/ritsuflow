'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../../../lib/supabase/client'
import styles from './project-setup.module.css'

function getErrorMessage(error) {
  if (!error) return 'An unexpected error occurred.'
  if (error.code === '23505') return 'A record with the same identifying information already exists.'
  if (error.code === '23503') return 'This record is connected to other project information and cannot be changed.'
  if (error.code === '23514') return 'One or more values do not satisfy the production parameter rules.'
  if (error.code === '42501') return 'Your account does not have permission to perform this action.'
  return error.message || 'The requested operation could not be completed.'
}

function formatQuantity(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return '0'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numericValue)
}

function getZoneColor(zoneName) {
  if (!zoneName) return '#ffffff'
  const normalized = String(zoneName).trim().toUpperCase()
  const fixedColors = {
    Z1: '#ebf8ff', Z2: '#f0fff4', Z3: '#fffaf0', Z4: '#f5f3ff',
    Z5: '#fff1f2', Z6: '#ecfeff', Z7: '#fefce8', Z8: '#f0fdf4',
    'ZONE 1': '#ebf8ff', 'ZONE 2': '#f0fff4', 'ZONE 3': '#fffaf0',
    'ZONE 4': '#f5f3ff', 'ZONE 5': '#fff1f2', 'ZONE 6': '#ecfeff',
    'ZONE A': '#f5f3ff', 'ZONE B': '#fffaf0', 'ZONE C': '#f0fff4',
  }
  if (fixedColors[normalized]) return fixedColors[normalized]
  const palette = ['#ebf8ff', '#f0fff4', '#fffaf0', '#f5f3ff', '#fff1f2', '#ecfeff', '#fefce8', '#f0fdf4']
  let hash = 0
  for (let index = 0; index < normalized.length; index += 1) {
    hash = normalized.charCodeAt(index) + ((hash << 5) - hash)
  }
  return palette[Math.abs(hash) % palette.length]
}

const emptyProductivityForm = {
  service_name: '',
  service_code: '',
  quantity_unit: '',
  productivity_rate: '',
  productivity_basis: 'worker_day',
  description: '',
}

export default function ProductionParametersWorkspace({
  projectId,
  organizationId,
  userId,
  locations = [],
  scopeItems = [],
  allocations = [],
}) {
  const supabase = useMemo(() => createClient(), [])
  const [productivityLibrary, setProductivityLibrary] = useState([])
  const [projectProductivities, setProjectProductivities] = useState([])
  const [divisionTaktTargets, setDivisionTaktTargets] = useState([])
  const [effectiveDrafts, setEffectiveDrafts] = useState({})
  const [taktTargetDrafts, setTaktTargetDrafts] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [savingEffectiveKey, setSavingEffectiveKey] = useState(null)
  const [savingTaktTargetId, setSavingTaktTargetId] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [noticeMessage, setNoticeMessage] = useState('')
  const [showTaktPresizing, setShowTaktPresizing] = useState(true)
  const [isProductivityModalOpen, setIsProductivityModalOpen] = useState(false)
  const [productivityTarget, setProductivityTarget] = useState(null)
  const [productivitySearch, setProductivitySearch] = useState('')
  const [productivityMode, setProductivityMode] = useState('select')
  const [productivityForm, setProductivityForm] = useState(emptyProductivityForm)

  useEffect(() => {
    let cancelled = false

    async function loadProductionParameters() {
      if (!projectId || !organizationId) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setErrorMessage('')

      const [libraryResult, projectResult, taktResult] = await Promise.all([
        supabase
          .from('productivity_library')
          .select(`
            id,
            organization_id,
            service_name,
            service_code,
            quantity_unit,
            productivity_rate,
            productivity_basis,
            description,
            is_active,
            created_at,
            updated_at
          `)
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .order('service_name', { ascending: true }),
        supabase
          .from('project_service_productivity')
          .select(`
            id,
            project_id,
            division_location_id,
            service_id,
            productivity_library_id,
            productivity_rate,
            quantity_unit,
            productivity_basis,
            effective,
            created_at,
            updated_at
          `)
          .eq('project_id', projectId),
        supabase
          .from('project_division_takt_targets')
          .select(`
            id,
            project_id,
            division_location_id,
            target_takt_days,
            created_at,
            updated_at
          `)
          .eq('project_id', projectId),
      ])

      if (cancelled) return

      const loadError = libraryResult.error || projectResult.error || taktResult.error
      if (loadError) {
        setErrorMessage(getErrorMessage(loadError))
        setIsLoading(false)
        return
      }

      const loadedProductivities = projectResult.data || []
      const loadedTargets = taktResult.data || []
      setProductivityLibrary(libraryResult.data || [])
      setProjectProductivities(loadedProductivities)
      setDivisionTaktTargets(loadedTargets)

      const nextEffectiveDrafts = {}
      loadedProductivities.forEach((item) => {
        const key = `${item.division_location_id}___${item.service_id}`
        nextEffectiveDrafts[key] = item.effective === null || item.effective === undefined
          ? ''
          : String(item.effective)
      })
      setEffectiveDrafts(nextEffectiveDrafts)

      const nextTargetDrafts = {}
      loadedTargets.forEach((item) => {
        nextTargetDrafts[item.division_location_id] =
          item.target_takt_days === null || item.target_takt_days === undefined
            ? ''
            : String(item.target_takt_days)
      })
      setTaktTargetDrafts(nextTargetDrafts)
      setIsLoading(false)
    }

    loadProductionParameters()
    return () => { cancelled = true }
  }, [organizationId, projectId, supabase])

  const activeScopeItems = useMemo(
    () => [...scopeItems]
      .filter((scopeItem) => scopeItem.is_active !== false)
      .sort((a, b) => (Number(a.sequence_number) || 0) - (Number(b.sequence_number) || 0)),
    [scopeItems]
  )

  const sortedLocations = useMemo(
    () => [...locations].sort((a, b) => {
      const diff = (Number(a.sequence_number) || 0) - (Number(b.sequence_number) || 0)
      return diff !== 0 ? diff : String(a.name || '').localeCompare(String(b.name || ''))
    }),
    [locations]
  )

  const locationMap = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations]
  )

  const locationPathMap = useMemo(() => {
    const map = new Map()
    locations.forEach((location) => {
      const path = []
      const visited = new Set()
      let current = location
      while (current && !visited.has(current.id)) {
        visited.add(current.id)
        path.unshift(current)
        current = current.parent_id ? locationMap.get(current.parent_id) : null
      }
      map.set(location.id, path)
    })
    return map
  }, [locationMap, locations])

  const floorLocations = useMemo(
    () => sortedLocations.filter((location) => location.location_type === 'floor'),
    [sortedLocations]
  )

  const quantificationByDivision = useMemo(() => {
    return floorLocations
      .map((floor) => {
        const zones = sortedLocations
          .filter((location) => location.location_type === 'zone')
          .filter((zone) => {
            const path = locationPathMap.get(zone.id) || []
            return path.some((item) => item.id === floor.id)
          })

        const totals = new Map()
        activeScopeItems.forEach((scopeItem) => {
          zones.forEach((zone) => totals.set(`${scopeItem.id}___${zone.id}`, 0))
        })

        allocations.forEach((allocation) => {
          const location = locationMap.get(allocation.location_id)
          if (!location) return
          const path = locationPathMap.get(location.id) || []
          const floorInPath = path.find((item) => item.location_type === 'floor')
          const zoneInPath = path.find((item) => item.location_type === 'zone')
          if (floorInPath?.id !== floor.id || !zoneInPath) return
          const key = `${allocation.service_id}___${zoneInPath.id}`
          totals.set(key, (totals.get(key) || 0) + Number(allocation.quantity || 0))
        })

        return { floor, zones, totals }
      })
      .filter((division) => division.zones.length > 0)
  }, [activeScopeItems, allocations, floorLocations, locationMap, locationPathMap, sortedLocations])

  const projectProductivityMap = useMemo(() => {
    const map = new Map()
    projectProductivities.forEach((item) => {
      map.set(`${item.division_location_id}___${item.service_id}`, item)
    })
    return map
  }, [projectProductivities])

  const divisionTaktTargetMap = useMemo(() => {
    const map = new Map()
    divisionTaktTargets.forEach((item) => map.set(item.division_location_id, item))
    return map
  }, [divisionTaktTargets])

  const filteredProductivityLibrary = useMemo(() => {
    const search = productivitySearch.trim().toLowerCase()
    if (!search) return productivityLibrary
    return productivityLibrary.filter((item) =>
      [item.service_name, item.service_code, item.quantity_unit, item.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(search)
    )
  }, [productivityLibrary, productivitySearch])

  const configuredCount = useMemo(
    () => activeScopeItems.filter((scopeItem) =>
      projectProductivities.some((item) =>
        item.service_id === scopeItem.id && Number(item.productivity_rate) > 0
      )
    ).length,
    [activeScopeItems, projectProductivities]
  )

  function openProductivityModal(floor, scopeItem) {
    setProductivityTarget({ floor, scopeItem })
    setProductivitySearch(scopeItem.service_name || '')
    setProductivityMode('select')
    setProductivityForm({
      ...emptyProductivityForm,
      service_name: scopeItem.service_name || '',
      service_code: scopeItem.service_code || '',
      quantity_unit: scopeItem.unit || '',
    })
    setErrorMessage('')
    setIsProductivityModalOpen(true)
  }

  function closeProductivityModal() {
    if (isSaving) return
    setIsProductivityModalOpen(false)
    setProductivityTarget(null)
    setProductivitySearch('')
    setProductivityMode('select')
    setProductivityForm(emptyProductivityForm)
  }

  async function applyProductivity(libraryItem) {
    if (!projectId || !userId || !productivityTarget) return
    const { floor, scopeItem } = productivityTarget
    const key = `${floor.id}___${scopeItem.id}`
    const existing = projectProductivityMap.get(key)
    setIsSaving(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('project_service_productivity')
      .upsert({
        project_id: projectId,
        division_location_id: floor.id,
        service_id: scopeItem.id,
        productivity_library_id: libraryItem.id,
        productivity_rate: Number(libraryItem.productivity_rate),
        quantity_unit: libraryItem.quantity_unit || scopeItem.unit || null,
        productivity_basis: libraryItem.productivity_basis || 'worker_day',
        effective: existing?.effective ?? null,
        created_by: userId,
      }, { onConflict: 'project_id,division_location_id,service_id' })
      .select(`
        id, project_id, division_location_id, service_id,
        productivity_library_id, productivity_rate, quantity_unit,
        productivity_basis, effective, created_at, updated_at
      `)
      .single()

    if (error) {
      setErrorMessage(getErrorMessage(error))
      setIsSaving(false)
      return
    }

    setProjectProductivities((current) => {
      const exists = current.some((item) => item.id === data.id)
      return exists ? current.map((item) => item.id === data.id ? data : item) : [...current, data]
    })
    setEffectiveDrafts((current) => ({
      ...current,
      [key]: data.effective === null || data.effective === undefined ? '' : String(data.effective),
    }))
    setNoticeMessage(`${libraryItem.service_name} productivity was applied to ${floor.name}.`)
    setIsSaving(false)
    closeProductivityModal()
  }

  async function createProductivity(event) {
    event.preventDefault()
    if (!organizationId || !userId || !productivityTarget) return
    const serviceName = productivityForm.service_name.trim()
    const rate = Number(String(productivityForm.productivity_rate).replace(',', '.'))
    if (!serviceName) return setErrorMessage('Enter a Scope Item name.')
    if (!Number.isFinite(rate) || rate <= 0) return setErrorMessage('Enter a productivity greater than zero.')
    if (!productivityForm.quantity_unit.trim()) return setErrorMessage('Enter a quantity unit.')

    setIsSaving(true)
    setErrorMessage('')
    const { data, error } = await supabase
      .from('productivity_library')
      .insert({
        organization_id: organizationId,
        service_name: serviceName,
        service_code: productivityForm.service_code.trim() || null,
        quantity_unit: productivityForm.quantity_unit.trim(),
        productivity_rate: rate,
        productivity_basis: productivityForm.productivity_basis.trim() || 'worker_day',
        description: productivityForm.description.trim() || null,
        is_active: true,
        created_by: userId,
      })
      .select(`
        id, organization_id, service_name, service_code, quantity_unit,
        productivity_rate, productivity_basis, description, is_active,
        created_at, updated_at
      `)
      .single()

    if (error) {
      setErrorMessage(getErrorMessage(error))
      setIsSaving(false)
      return
    }

    setProductivityLibrary((current) => [...current, data])
    setIsSaving(false)
    await applyProductivity(data)
  }

  async function saveEffective(floorId, serviceId) {
    if (!projectId || !userId) return
    const key = `${floorId}___${serviceId}`
    const existing = projectProductivityMap.get(key)
    const raw = String(effectiveDrafts[key] ?? '').trim()
    const effective = raw === '' ? null : Number(raw.replace(',', '.'))

    if (effective !== null && (!Number.isFinite(effective) || effective < 0)) {
      setErrorMessage('Enter a valid effective workforce.')
      setEffectiveDrafts((current) => ({
        ...current,
        [key]: existing?.effective === null || existing?.effective === undefined ? '' : String(existing.effective),
      }))
      return
    }

    setSavingEffectiveKey(key)
    setErrorMessage('')
    const { data, error } = await supabase
      .from('project_service_productivity')
      .upsert({
        project_id: projectId,
        division_location_id: floorId,
        service_id: serviceId,
        productivity_library_id: existing?.productivity_library_id || null,
        productivity_rate: existing?.productivity_rate ?? null,
        quantity_unit: existing?.quantity_unit ?? null,
        productivity_basis: existing?.productivity_basis || 'worker_day',
        effective,
        created_by: userId,
      }, { onConflict: 'project_id,division_location_id,service_id' })
      .select(`
        id, project_id, division_location_id, service_id,
        productivity_library_id, productivity_rate, quantity_unit,
        productivity_basis, effective, created_at, updated_at
      `)
      .single()

    if (error) {
      setErrorMessage(getErrorMessage(error))
      setSavingEffectiveKey(null)
      return
    }

    setProjectProductivities((current) => {
      const exists = current.some((item) => item.id === data.id)
      return exists ? current.map((item) => item.id === data.id ? data : item) : [...current, data]
    })
    setEffectiveDrafts((current) => ({ ...current, [key]: data.effective ?? '' }))
    setSavingEffectiveKey(null)
    setNoticeMessage('Effective workforce saved.')
  }

  async function saveDivisionTaktTarget(floorId) {
    if (!projectId || !userId) return
    const existing = divisionTaktTargetMap.get(floorId)
    const raw = String(taktTargetDrafts[floorId] ?? '').trim()

    if (raw === '') {
      if (!existing) return
      setSavingTaktTargetId(floorId)
      const { error } = await supabase
        .from('project_division_takt_targets')
        .delete()
        .eq('id', existing.id)
        .eq('project_id', projectId)
      if (error) {
        setErrorMessage(getErrorMessage(error))
        setSavingTaktTargetId(null)
        return
      }
      setDivisionTaktTargets((current) => current.filter((item) => item.id !== existing.id))
      setSavingTaktTargetId(null)
      setNoticeMessage('Target Takt was cleared for this division.')
      return
    }

    const value = Number(raw.replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) {
      setErrorMessage('Enter a Target Takt greater than zero.')
      setTaktTargetDrafts((current) => ({
        ...current,
        [floorId]: existing?.target_takt_days ?? '',
      }))
      return
    }

    setSavingTaktTargetId(floorId)
    setErrorMessage('')
    const { data, error } = await supabase
      .from('project_division_takt_targets')
      .upsert({
        project_id: projectId,
        division_location_id: floorId,
        target_takt_days: value,
        created_by: userId,
      }, { onConflict: 'project_id,division_location_id' })
      .select(`
        id, project_id, division_location_id, target_takt_days,
        created_at, updated_at
      `)
      .single()

    if (error) {
      setErrorMessage(getErrorMessage(error))
      setSavingTaktTargetId(null)
      return
    }

    setDivisionTaktTargets((current) => {
      const exists = current.some((item) => item.id === data.id)
      return exists ? current.map((item) => item.id === data.id ? data : item) : [...current, data]
    })
    setTaktTargetDrafts((current) => ({ ...current, [floorId]: String(data.target_takt_days) }))
    setSavingTaktTargetId(null)
    setNoticeMessage(`Target Takt saved for ${locationMap.get(floorId)?.name || 'division'}.`)
  }

  if (isLoading) {
    return <section className={styles.formPanel}><div className={styles.workspaceEmpty}><p>Loading production parameters...</p></div></section>
  }

  return (
    <>
      <section className={styles.metricGrid}>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Scope Items</span>
          <strong className={styles.metricValue}>{activeScopeItems.length}</strong>
          <span className={styles.metricDetail}>Active project scope</span>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Configured Scope Items</span>
          <strong className={styles.metricValue}>{configuredCount}</strong>
          <span className={styles.metricDetail}>With productivity records</span>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Divisions</span>
          <strong className={styles.metricValue}>{floorLocations.length}</strong>
          <span className={styles.metricDetail}>Production divisions</span>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Takt Targets</span>
          <strong className={styles.metricValue}>{divisionTaktTargets.length}</strong>
          <span className={styles.metricDetail}>Division-specific targets</span>
        </article>
      </section>

      {errorMessage && <div className={styles.scopeWorkspaceError} role="alert">{errorMessage}</div>}

      <section className={styles.formPanel} style={{ marginTop: '24px' }}>
        <div className={styles.formHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <div>
            <p className={styles.formDescription} style={{ margin: '0 0 6px' }}>Takt pre-sizing</p>
            <h2 className={styles.formTitle}>Takt Pre-dimensioning</h2>
            <p className={styles.formDescription}>
              Quantity ÷ (Productivity × Effective Workforce) = calculated duration. Compare the calculated duration with the division Target Takt before planning integration.
            </p>
          </div>
          <button type="button" className={styles.secondaryButton} onClick={() => setShowTaktPresizing((current) => !current)}>
            {showTaktPresizing ? 'Hide ▲' : 'Show ▼'}
          </button>
        </div>

        {showTaktPresizing && (
          <div style={{ overflowX: 'auto', padding: '0 18px 18px' }}>
            {quantificationByDivision.length === 0 ? (
              <div className={styles.workspaceEmpty}>
                <h3>No Takt pre-sizing data available.</h3>
                <p>Create divisions, zones, Scope Items and allocation quantities first.</p>
              </div>
            ) : (
              quantificationByDivision.map(({ floor, zones, totals }) => {
                const targetTakt = Number(divisionTaktTargetMap.get(floor.id)?.target_takt_days || 0)
                return (
                  <div key={floor.id} style={{ marginTop: '20px', border: '1px solid #dbe7f3', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', padding: '12px 14px', background: '#f8fbff' }}>
                      <strong style={{ color: '#1a365d' }}>{floor.name}</strong>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', fontWeight: 800, color: '#4a5568' }}>
                        TARGET TAKT
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={taktTargetDrafts[floor.id] ?? ''}
                          onChange={(event) => setTaktTargetDrafts((current) => ({ ...current, [floor.id]: event.target.value }))}
                          onBlur={() => saveDivisionTaktTarget(floor.id)}
                          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
                          disabled={savingTaktTargetId === floor.id}
                          style={{ width: '92px', minHeight: '34px', padding: '0 8px', border: '1px solid #cbd5e0', borderRadius: '6px', textAlign: 'center' }}
                        />
                        days
                      </label>
                    </div>

                    <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ background: '#2a4365', color: '#fff' }}>
                          <th style={{ minWidth: '220px', padding: '10px 12px', border: '1px solid #365475', textAlign: 'left' }}>Scope Item</th>
                          <th style={{ minWidth: '120px', padding: '10px 12px', border: '1px solid #365475' }}>Productivity</th>
                          <th style={{ minWidth: '115px', padding: '10px 12px', border: '1px solid #365475' }}>Effective</th>
                          {zones.map((zone) => <th key={zone.id} style={{ minWidth: '125px', padding: '10px 12px', border: '1px solid #365475' }}>{zone.name}<br/><span style={{ fontSize: '0.65rem', fontWeight: 500 }}>Qty / Duration</span></th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {activeScopeItems.map((scopeItem) => {
                          const key = `${floor.id}___${scopeItem.id}`
                          const record = projectProductivityMap.get(key)
                          const rate = Number(record?.productivity_rate || 0)
                          const effective = Number(record?.effective || 0)
                          return (
                            <tr key={scopeItem.id}>
                              <td style={{ padding: '10px 12px', border: '1px solid #cbd5e0', fontWeight: 750 }}>
                                <div>{scopeItem.service_name}</div>
                                <div style={{ marginTop: '3px', fontSize: '0.66rem', color: '#718096' }}>{scopeItem.unit || '—'}</div>
                              </td>
                              <td style={{ padding: '8px 10px', border: '1px solid #cbd5e0', textAlign: 'center' }}>
                                <button type="button" className={styles.secondaryButton} onClick={() => openProductivityModal(floor, scopeItem)} style={{ minHeight: '32px', padding: '0 10px' }}>
                                  {rate > 0 ? `${formatQuantity(rate)} ${record?.quantity_unit || scopeItem.unit || ''}/worker-day` : 'Select'}
                                </button>
                              </td>
                              <td style={{ padding: '8px 10px', border: '1px solid #cbd5e0', textAlign: 'center' }}>
                                <input
                                  type="number" min="0" step="any"
                                  value={effectiveDrafts[key] ?? ''}
                                  onChange={(event) => setEffectiveDrafts((current) => ({ ...current, [key]: event.target.value }))}
                                  onBlur={() => saveEffective(floor.id, scopeItem.id)}
                                  onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
                                  disabled={savingEffectiveKey === key}
                                  style={{ width: '78px', minHeight: '32px', padding: '0 7px', border: '1px solid #cbd5e0', borderRadius: '6px', textAlign: 'center' }}
                                />
                              </td>
                              {zones.map((zone) => {
                                const quantity = totals.get(`${scopeItem.id}___${zone.id}`) || 0
                                const duration = rate > 0 && effective > 0 ? quantity / (rate * effective) : null
                                const overTarget = targetTakt > 0 && duration !== null && duration > targetTakt
                                return (
                                  <td key={zone.id} style={{ padding: '8px 10px', border: '1px solid #cbd5e0', textAlign: 'center', background: quantity > 0 ? getZoneColor(zone.name) : undefined }}>
                                    <strong>{formatQuantity(quantity)}</strong>
                                    <div style={{ marginTop: '4px', fontSize: '0.68rem', fontWeight: 800, color: overTarget ? '#c53030' : '#4a5568' }}>
                                      {duration === null ? '—' : `${formatQuantity(duration)} d`}
                                    </div>
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })
            )}
          </div>
        )}
      </section>

      {noticeMessage && (
        <div className={styles.scopeWorkspaceNotice} role="status">
          <span>✓</span><span>{noticeMessage}</span>
          <button type="button" onClick={() => setNoticeMessage('')} aria-label="Close notification">×</button>
        </div>
      )}

      {isProductivityModalOpen && productivityTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: '24px', background: 'rgba(15, 23, 42, 0.5)' }} onMouseDown={(event) => { if (event.target === event.currentTarget) closeProductivityModal() }}>
          <div style={{ width: 'min(760px, 100%)', maxHeight: '85vh', overflowY: 'auto', borderRadius: '12px', background: '#fff', boxShadow: '0 24px 60px rgba(15, 23, 42, 0.22)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '20px 22px', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <p className={styles.formDescription} style={{ margin: '0 0 4px' }}>Productivity</p>
                <h2 className={styles.formTitle} style={{ margin: 0 }}>{productivityTarget.scopeItem.service_name} — {productivityTarget.floor.name}</h2>
              </div>
              <button type="button" className={styles.secondaryButton} onClick={closeProductivityModal}>×</button>
            </div>

            <div style={{ display: 'flex', gap: '8px', padding: '14px 22px', borderBottom: '1px solid #e2e8f0' }}>
              <button type="button" className={productivityMode === 'select' ? styles.primaryButton : styles.secondaryButton} onClick={() => setProductivityMode('select')}>Select from library</button>
              <button type="button" className={productivityMode === 'create' ? styles.primaryButton : styles.secondaryButton} onClick={() => setProductivityMode('create')}>Create productivity</button>
            </div>

            {productivityMode === 'select' ? (
              <div style={{ padding: '18px 22px' }}>
                <input type="search" value={productivitySearch} onChange={(event) => setProductivitySearch(event.target.value)} placeholder="Search productivity library..." style={{ width: '100%', minHeight: '40px', boxSizing: 'border-box', padding: '0 12px', border: '1px solid #cbd5e0', borderRadius: '7px', marginBottom: '14px' }} />
                {filteredProductivityLibrary.length === 0 ? (
                  <div className={styles.workspaceEmpty}><p>No matching productivity records.</p></div>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {filteredProductivityLibrary.map((item) => (
                      <button key={item.id} type="button" onClick={() => applyProductivity(item)} disabled={isSaving} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', padding: '12px 14px', border: '1px solid #dbe7f3', borderRadius: '8px', background: '#fff', textAlign: 'left', cursor: 'pointer' }}>
                        <span><strong>{item.service_name}</strong><br/><small>{item.service_code || 'No code'} · {item.quantity_unit || 'No unit'}</small></span>
                        <strong>{formatQuantity(item.productivity_rate)} / {item.productivity_basis || 'worker_day'}</strong>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={createProductivity} style={{ display: 'grid', gap: '12px', padding: '18px 22px' }}>
                <label>Scope Item name<input required value={productivityForm.service_name} onChange={(event) => setProductivityForm((current) => ({ ...current, service_name: event.target.value }))} style={{ width: '100%', minHeight: '38px', boxSizing: 'border-box' }} /></label>
                <label>Code<input value={productivityForm.service_code} onChange={(event) => setProductivityForm((current) => ({ ...current, service_code: event.target.value }))} style={{ width: '100%', minHeight: '38px', boxSizing: 'border-box' }} /></label>
                <label>Quantity unit<input required value={productivityForm.quantity_unit} onChange={(event) => setProductivityForm((current) => ({ ...current, quantity_unit: event.target.value }))} style={{ width: '100%', minHeight: '38px', boxSizing: 'border-box' }} /></label>
                <label>Productivity rate<input type="number" min="0.000001" step="any" required value={productivityForm.productivity_rate} onChange={(event) => setProductivityForm((current) => ({ ...current, productivity_rate: event.target.value }))} style={{ width: '100%', minHeight: '38px', boxSizing: 'border-box' }} /></label>
                <label>Basis<select value={productivityForm.productivity_basis} onChange={(event) => setProductivityForm((current) => ({ ...current, productivity_basis: event.target.value }))} style={{ width: '100%', minHeight: '38px' }}><option value="worker_day">worker_day</option><option value="crew_day">crew_day</option><option value="hour">hour</option></select></label>
                <label>Description<textarea value={productivityForm.description} onChange={(event) => setProductivityForm((current) => ({ ...current, description: event.target.value }))} rows={3} style={{ width: '100%', boxSizing: 'border-box' }} /></label>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><button type="button" className={styles.secondaryButton} onClick={closeProductivityModal} disabled={isSaving}>Cancel</button><button type="submit" className={styles.primaryButton} disabled={isSaving}>{isSaving ? 'Saving...' : 'Create and apply'}</button></div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
