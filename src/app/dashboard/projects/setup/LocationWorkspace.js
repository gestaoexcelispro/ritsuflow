'use client'

import { useMemo, useState } from 'react'

import { createClient } from '../../../../lib/supabase/client'
import styles from '../locations/location-breakdown.module.css'


const locationTypes = [
  { value: 'building', label: 'Building' },
  { value: 'floor', label: 'Division / Floor' },
  { value: 'zone', label: 'Zone / Area' },
  { value: 'area', label: 'Area' },
  { value: 'room', label: 'Room' },
  { value: 'custom', label: 'Custom' },
]


const emptyLocationForm = {
  id: null,
  location_type: 'area',
  name: '',
  parent_id: '',
  environment_type: '',
  sequence_number: '',
}


function getErrorMessage(error) {
  if (!error) return 'An unexpected error occurred.'
  if (error.code === '23505') return 'A location with the same identifying information already exists.'
  if (error.code === '23503') return 'This record is connected to other project information and cannot be changed.'
  if (error.code === '23514') return 'One or more values do not satisfy the location structure rules.'
  if (error.code === '42501') return 'Your account does not have permission to perform this action.'
  return error.message || 'The requested operation could not be completed.'
}


function locationTypeLabel(value) {
  return locationTypes.find((item) => item.value === value)?.label || value || 'Location'
}


function zoneAccent(name) {
  const key = String(name || '').trim().toUpperCase()
  const accents = {
    Z1: '#3182ce',
    Z2: '#16a085',
    Z3: '#805ad5',
    Z4: '#d69e2e',
    Z5: '#e53e3e',
    Z6: '#0891b2',
    'ZONE 1': '#3182ce',
    'ZONE 2': '#16a085',
    'ZONE 3': '#805ad5',
    'ZONE 4': '#d69e2e',
    'ZONE 5': '#e53e3e',
    'ZONE 6': '#0891b2',
  }
  return accents[key] || '#64748b'
}


function zoneSoft(name) {
  const key = String(name || '').trim().toUpperCase()
  const soft = {
    Z1: '#ebf8ff',
    Z2: '#f0fff4',
    Z3: '#f5f3ff',
    Z4: '#fffaf0',
    Z5: '#fff1f2',
    Z6: '#ecfeff',
    'ZONE 1': '#ebf8ff',
    'ZONE 2': '#f0fff4',
    'ZONE 3': '#f5f3ff',
    'ZONE 4': '#fffaf0',
    'ZONE 5': '#fff1f2',
    'ZONE 6': '#ecfeff',
  }
  return soft[key] || '#f8fafc'
}


function formatQuantity(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return '0'
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numericValue)
}


export default function LocationWorkspace({
  projectId,
  projectName = 'Project',
  projectCode = '',
  userId,
  initialLocations = [],
  scopeItems = [],
  allocations = [],
}) {
  const supabase = useMemo(() => createClient(), [])

  const [locations, setLocations] = useState(initialLocations)
  const [searchTerm, setSearchTerm] = useState('')
  const [collapsedBuildings, setCollapsedBuildings] = useState([])
  const [collapsedFloors, setCollapsedFloors] = useState([])
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false)
  const [locationForm, setLocationForm] = useState(emptyLocationForm)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [noticeMessage, setNoticeMessage] = useState('')


  const sortedLocations = useMemo(
    () =>
      [...locations].sort((a, b) => {
        const sequenceDifference =
          (Number(a.sequence_number) || 0) -
          (Number(b.sequence_number) || 0)

        if (sequenceDifference !== 0) return sequenceDifference

        return String(a.name || '').localeCompare(String(b.name || ''))
      }),
    [locations]
  )


  const locationMap = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations]
  )


  function ancestors(location) {
    const result = []
    const visited = new Set()
    let current = location

    while (current?.parent_id && !visited.has(current.parent_id)) {
      visited.add(current.parent_id)
      const parent = locationMap.get(current.parent_id)
      if (!parent) break
      result.unshift(parent)
      current = parent
    }

    return result
  }


  function belongsTo(location, ancestorId) {
    return ancestors(location).some((item) => item.id === ancestorId)
  }


  const buildings = sortedLocations.filter(
    (location) => location.location_type === 'building'
  )

  const floors = sortedLocations.filter(
    (location) => location.location_type === 'floor'
  )

  const zones = sortedLocations.filter(
    (location) => location.location_type === 'zone'
  )

  const productionLocations = sortedLocations.filter(
    (location) =>
      !['building', 'floor', 'zone'].includes(location.location_type)
  )


  const allocationsByLocation = useMemo(() => {
    const result = new Map()

    allocations.forEach((allocation) => {
      if (!allocation.location_id || !allocation.service_id) return

      if (!result.has(allocation.location_id)) {
        result.set(allocation.location_id, new Map())
      }

      const serviceMap = result.get(allocation.location_id)
      const currentValue = serviceMap.get(allocation.service_id) || 0

      serviceMap.set(
        allocation.service_id,
        currentValue + Number(allocation.quantity || 0)
      )
    })

    return result
  }, [allocations])


  function serviceQuantitiesForLocation(locationId) {
    const serviceMap = allocationsByLocation.get(locationId)

    if (!serviceMap) return []

    return scopeItems
      .map((scopeItem) => ({
        ...scopeItem,
        allocatedQuantity: serviceMap.get(scopeItem.id) || 0,
      }))
      .filter((scopeItem) => scopeItem.allocatedQuantity !== 0)
  }


  function directZonesForParent(parentId) {
    return zones.filter((zone) => {
      if (parentId) {
        return zone.parent_id === parentId
      }

      return !zone.parent_id
    })
  }


  const normalizedSearch = searchTerm.trim().toLowerCase()

  function matchesSearch(location) {
    if (!normalizedSearch) return true

    const path = [
      ...ancestors(location).map((item) => item.name),
      location.name,
      location.environment_type,
      location.location_type,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return path.includes(normalizedSearch)
  }


  function floorEntriesForBuilding(building) {
    return floors
      .filter((floor) =>
        building ? belongsTo(floor, building.id) : !ancestors(floor).some((item) => item.location_type === 'building')
      )
      .map((floor) => {
        const floorZones = zones.filter((zone) => belongsTo(zone, floor.id))

        const zoneEntries = floorZones
          .map((zone) => {
            const items = productionLocations.filter(
              (location) => belongsTo(location, zone.id) && matchesSearch(location)
            )

            return {
              zone,
              items,
              visible:
                !normalizedSearch ||
                matchesSearch(zone) ||
                items.length > 0,
            }
          })
          .filter((entry) => entry.visible)

        const unassigned = productionLocations.filter((location) => {
          if (!belongsTo(location, floor.id)) return false

          const hasZone = ancestors(location).some(
            (item) => item.location_type === 'zone'
          )

          return !hasZone && matchesSearch(location)
        })

        return {
          floor,
          zoneEntries,
          unassigned,
          visible:
            !normalizedSearch ||
            matchesSearch(floor) ||
            zoneEntries.length > 0 ||
            unassigned.length > 0,
        }
      })
      .filter((entry) => entry.visible)
  }


  const hierarchyGroups = useMemo(() => {
    const groups = buildings
      .map((building) => ({
        key: building.id,
        building,
        name: building.name,
        directZones: directZonesForParent(building.id),
        floors: floorEntriesForBuilding(building),
      }))
      .filter(
        (group) =>
          !normalizedSearch ||
          matchesSearch(group.building) ||
          group.floors.length > 0 ||
          group.directZones.some((zone) => matchesSearch(zone))
      )

    const orphanFloors = floorEntriesForBuilding(null)

    if (orphanFloors.length > 0 || buildings.length === 0) {
      groups.push({
        key: 'project-root',
        building: null,
        name: projectName,
        directZones: directZonesForParent(null),
        floors: buildings.length === 0
          ? floors
              .map((floor) => {
                const floorZones = zones.filter((zone) => belongsTo(zone, floor.id))
                const zoneEntries = floorZones
                  .map((zone) => ({
                    zone,
                    items: productionLocations.filter(
                      (location) => belongsTo(location, zone.id) && matchesSearch(location)
                    ),
                    visible: true,
                  }))
                  .filter(
                    (entry) =>
                      !normalizedSearch ||
                      matchesSearch(entry.zone) ||
                      entry.items.length > 0
                  )

                const unassigned = productionLocations.filter((location) => {
                  if (!belongsTo(location, floor.id)) return false
                  const hasZone = ancestors(location).some(
                    (item) => item.location_type === 'zone'
                  )
                  return !hasZone && matchesSearch(location)
                })

                return {
                  floor,
                  zoneEntries,
                  unassigned,
                  visible:
                    !normalizedSearch ||
                    matchesSearch(floor) ||
                    zoneEntries.length > 0 ||
                    unassigned.length > 0,
                }
              })
              .filter((entry) => entry.visible)
          : orphanFloors,
      })
    }

    return groups
  }, [
    buildings,
    floors,
    zones,
    productionLocations,
    normalizedSearch,
    projectName,
  ])


  function nextSequence() {
    return String(
      locations.reduce(
        (highest, location) =>
          Math.max(highest, Number(location.sequence_number) || 0),
        0
      ) + 1
    )
  }


  function openNewLocationModal({
    parentId = '',
    locationType = 'area',
  } = {}) {
    setLocationForm({
      ...emptyLocationForm,
      parent_id: parentId,
      location_type: locationType,
      sequence_number: nextSequence(),
    })
    setErrorMessage('')
    setIsLocationModalOpen(true)
  }


  function openEditLocationModal(location) {
    setLocationForm({
      id: location.id,
      location_type: location.location_type,
      name: location.name || '',
      parent_id: location.parent_id || '',
      environment_type: location.environment_type || '',
      sequence_number: String(location.sequence_number ?? 0),
    })
    setErrorMessage('')
    setIsLocationModalOpen(true)
  }


  function closeLocationModal() {
    if (isSaving) return
    setIsLocationModalOpen(false)
    setLocationForm(emptyLocationForm)
    setErrorMessage('')
  }


  async function saveLocation(event) {
    event.preventDefault()

    if (!projectId || !userId) return

    const normalizedName = locationForm.name.trim()

    if (!normalizedName) {
      setErrorMessage('Enter a location name.')
      return
    }

    if (locationForm.id && locationForm.parent_id === locationForm.id) {
      setErrorMessage('A location cannot be its own parent.')
      return
    }

    setIsSaving(true)
    setErrorMessage('')

    const locationPayload = {
      project_id: projectId,
      parent_id: locationForm.parent_id || null,
      name: normalizedName,
      location_type: locationForm.location_type,
      environment_type: locationForm.environment_type.trim() || null,
      sequence_number: Number(locationForm.sequence_number) || 0,
    }

    let result

    if (locationForm.id) {
      result = await supabase
        .from('locations')
        .update(locationPayload)
        .eq('id', locationForm.id)
        .eq('project_id', projectId)
        .select(`
          id,
          project_id,
          parent_id,
          name,
          location_type,
          environment_type,
          sequence_number,
          created_at,
          updated_at
        `)
        .single()
    } else {
      result = await supabase
        .from('locations')
        .insert({
          ...locationPayload,
          created_by: userId,
        })
        .select(`
          id,
          project_id,
          parent_id,
          name,
          location_type,
          environment_type,
          sequence_number,
          created_at,
          updated_at
        `)
        .single()
    }

    if (result.error) {
      setErrorMessage(getErrorMessage(result.error))
      setIsSaving(false)
      return
    }

    if (locationForm.id) {
      setLocations((current) =>
        current.map((location) =>
          location.id === result.data.id ? result.data : location
        )
      )
      setNoticeMessage(`${result.data.name} was updated.`)
    } else {
      setLocations((current) => [...current, result.data])
      setNoticeMessage(`${result.data.name} was added to the location structure.`)
    }

    setIsSaving(false)
    setIsLocationModalOpen(false)
    setLocationForm(emptyLocationForm)
  }


  function descendantIds(locationId) {
    const result = new Set()
    const queue = [locationId]

    while (queue.length > 0) {
      const parentId = queue.shift()

      locations
        .filter((location) => location.parent_id === parentId)
        .forEach((location) => {
          if (!result.has(location.id)) {
            result.add(location.id)
            queue.push(location.id)
          }
        })
    }

    return result
  }


  async function deleteTree(location) {
    if (!location) return

    const descendants = descendantIds(location.id)

    const confirmed = window.confirm(
      descendants.size > 0
        ? `Delete ${location.name}? This will also delete ${descendants.size} contained location${descendants.size === 1 ? '' : 's'}. This action cannot be undone.`
        : `Delete ${location.name}? This action cannot be undone.`
    )

    if (!confirmed) return

    setErrorMessage('')
    setIsSaving(true)

    const { data, error } = await supabase.rpc(
      'delete_project_location_tree',
      { target_location_id: location.id }
    )

    if (error) {
      setErrorMessage(getErrorMessage(error))
      setIsSaving(false)
      return
    }

    if (data?.deleted !== true) {
      setErrorMessage(data?.message || 'The location could not be deleted.')
      setIsSaving(false)
      return
    }

    const removedIds = new Set([location.id, ...descendants])

    setLocations((current) =>
      current.filter((item) => !removedIds.has(item.id))
    )

    setNoticeMessage(`${location.name} was deleted.`)
    setIsSaving(false)
  }


  async function deleteLeaf(location) {
    const hasChildren = locations.some(
      (item) => item.parent_id === location.id
    )

    if (hasChildren) {
      await deleteTree(location)
      return
    }

    const confirmed = window.confirm(
      `Delete ${location.name}? This action cannot be undone.`
    )

    if (!confirmed) return

    setErrorMessage('')
    setIsSaving(true)

    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', location.id)
      .eq('project_id', projectId)

    if (error) {
      setErrorMessage(getErrorMessage(error))
      setIsSaving(false)
      return
    }

    setLocations((current) =>
      current.filter((item) => item.id !== location.id)
    )

    setNoticeMessage(`${location.name} was deleted.`)
    setIsSaving(false)
  }


  function toggleBuilding(id) {
    setCollapsedBuildings((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    )
  }


  function toggleFloor(id) {
    setCollapsedFloors((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    )
  }


  function expandAll() {
    setCollapsedBuildings([])
    setCollapsedFloors([])
  }


  function collapseAll() {
    setCollapsedBuildings(hierarchyGroups.map((group) => group.key))
    setCollapsedFloors(floors.map((floor) => floor.id))
  }


  return (
    <div className={styles.container}>
      <section className={styles.summaryGrid} aria-label="Location summary">
        <article className={styles.summaryCard}>
          <div>
            <p className={styles.summaryLabel}>Buildings</p>
            <p className={styles.summaryDetail}>Physical structures</p>
          </div>
          <p className={styles.summaryValue}>{buildings.length}</p>
        </article>

        <article className={styles.summaryCard}>
          <div>
            <p className={styles.summaryLabel}>Divisions / Floors</p>
            <p className={styles.summaryDetail}>Production divisions</p>
          </div>
          <p className={styles.summaryValue}>{floors.length}</p>
        </article>

        <article className={styles.summaryCard}>
          <div>
            <p className={styles.summaryLabel}>Zones / Areas</p>
            <p className={styles.summaryDetail}>Production subdivisions</p>
          </div>
          <p className={styles.summaryValue}>{zones.length}</p>
        </article>

        <article className={styles.summaryCard}>
          <div>
            <p className={styles.summaryLabel}>Production Locations</p>
            <p className={styles.summaryDetail}>Assignable locations</p>
          </div>
          <p className={styles.summaryValue}>{productionLocations.length}</p>
        </article>
      </section>


      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <div className={styles.searchField}>
            <span className={styles.searchIcon} aria-hidden="true">⌕</span>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search locations..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => openNewLocationModal()}
          >
            + Add location
          </button>
        </div>

        {errorMessage && (
          <div className={styles.inlineError} role="alert">
            {errorMessage}
          </div>
        )}

        <div className={styles.hierarchyWorkspace}>
          <div className={styles.hierarchyUtilityBar}>
            <div>
              <strong>Location hierarchy</strong>
              <span>
                Building → Division → Zone → Production location
              </span>
            </div>

            <div className={styles.hierarchyUtilityActions}>
              <button
                type="button"
                className={styles.hierarchyUtilityButton}
                onClick={expandAll}
              >
                Expand all
              </button>

              <button
                type="button"
                className={styles.hierarchyUtilityButton}
                onClick={collapseAll}
              >
                Collapse all
              </button>
            </div>
          </div>


          {hierarchyGroups.length === 0 ? (
            <div className={styles.emptyState}>
              <h3 className={styles.emptyTitle}>
                No location hierarchy found.
              </h3>
              <p className={styles.emptyDescription}>
                Add a Division / Floor to start building the physical production hierarchy.
              </p>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() =>
                  openNewLocationModal({ locationType: 'floor' })
                }
              >
                + Add first division
              </button>
            </div>
          ) : (
            <div className={styles.buildingStack}>
              {hierarchyGroups.map((group) => {
                const buildingCollapsed =
                  collapsedBuildings.includes(group.key)

                return (
                  <article className={styles.buildingGroup} key={group.key}>
                    <div className={styles.buildingHeader}>
                      <div className={styles.hierarchyHeaderIdentity}>
                        <button
                          type="button"
                          className={styles.hierarchyChevron}
                          onClick={() => toggleBuilding(group.key)}
                          aria-label={
                            buildingCollapsed
                              ? 'Expand building'
                              : 'Collapse building'
                          }
                        >
                          {buildingCollapsed ? '›' : '⌄'}
                        </button>

                        <span className={styles.buildingIcon}>▦</span>

                        <div>
                          <span className={styles.hierarchyLevelLabel}>
                            {group.building ? 'Building' : 'Project'}
                          </span>
                          <h3 className={styles.buildingName}>{group.name}</h3>
                        </div>
                      </div>

                      <div className={styles.hierarchyHeaderActions}>
                        <div className={styles.hierarchyStats}>
                          <span>
                            {group.floors.length}{' '}
                            {group.floors.length === 1 ? 'Division' : 'Divisions'}
                          </span>
                        </div>

                        {group.building && (
                          <>
                            <button
                              type="button"
                              className={styles.hierarchyTextAction}
                              onClick={() => openEditLocationModal(group.building)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className={`${styles.hierarchyTextAction} ${styles.zoneDeleteButton}`}
                              onClick={() => deleteTree(group.building)}
                              disabled={isSaving}
                            >
                              Delete
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          className={styles.hierarchyTextAction}
                          onClick={() =>
                            openNewLocationModal({
                              parentId: group.building?.id || '',
                              locationType: 'floor',
                            })
                          }
                        >
                          + Division
                        </button>
                      </div>
                    </div>


                    {!buildingCollapsed && (
                      <>
                        {group.directZones
                          .filter(
                            (zone) =>
                              !normalizedSearch ||
                              matchesSearch(zone) ||
                              serviceQuantitiesForLocation(zone.id).some(
                                (scopeItem) =>
                                  String(scopeItem.service_name || '')
                                    .toLowerCase()
                                    .includes(normalizedSearch) ||
                                  String(scopeItem.service_code || '')
                                    .toLowerCase()
                                    .includes(normalizedSearch)
                              )
                          )
                          .map((zone) => {
                            const zoneServices =
                              serviceQuantitiesForLocation(zone.id)

                            return (
                              <div className={styles.zoneGrid} key={`direct-${zone.id}`}>
                                <article
                                  className={styles.zoneCard}
                                  style={{
                                    '--zone-accent': zoneAccent(zone.name),
                                    '--zone-soft': zoneSoft(zone.name),
                                  }}
                                >
                                  <div className={styles.zoneHeader}>
                                    <div className={styles.zoneIdentity}>
                                      <span className={styles.zoneDot} />
                                      <div>
                                        <span className={styles.hierarchyLevelLabel}>
                                          Zone / Area
                                        </span>
                                        <strong>{zone.name}</strong>
                                      </div>
                                    </div>

                                    <div className={styles.zoneHeaderActions}>
                                      <span className={styles.zoneCount}>
                                        {zoneServices.length}{' '}
                                        {zoneServices.length === 1
                                          ? 'Scope Item'
                                          : 'Scope Items'}
                                      </span>

                                      <button
                                        type="button"
                                        className={styles.zoneEditButton}
                                        onClick={() => openEditLocationModal(zone)}
                                      >
                                        Edit
                                      </button>

                                      <button
                                        type="button"
                                        className={`${styles.zoneEditButton} ${styles.zoneDeleteButton}`}
                                        onClick={() => deleteTree(zone)}
                                        disabled={isSaving}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>

                                  <div className={styles.zoneLocationList}>
                                    {zoneServices.length === 0 ? (
                                      <div className={styles.zoneEmptyState}>
                                        No service quantities allocated to this zone yet.
                                      </div>
                                    ) : (
                                      zoneServices.map((scopeItem) => (
                                        <div
                                          className={styles.zoneLocationRow}
                                          key={`${zone.id}-${scopeItem.id}`}
                                        >
                                          <div className={styles.zoneLocationIdentity}>
                                            <span className={styles.zoneLocationIcon}>
                                              {scopeItem.service_code || '•'}
                                            </span>

                                            <div>
                                              <strong>
                                                {scopeItem.service_name}
                                              </strong>

                                              <span>
                                                {scopeItem.service_code || 'Scope Item'}
                                              </span>
                                            </div>
                                          </div>

                                          <div className={styles.zoneLocationActions}>
                                            <strong>
                                              {formatQuantity(
                                                scopeItem.allocatedQuantity
                                              )}{' '}
                                              {scopeItem.unit || ''}
                                            </strong>
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    className={styles.zoneAddButton}
                                    onClick={() =>
                                      openNewLocationModal({
                                        parentId: zone.id,
                                        locationType: 'area',
                                      })
                                    }
                                  >
                                    + Add production location
                                  </button>
                                </article>
                              </div>
                            )
                          })}

                        <div className={styles.floorStack}>
                        {group.floors.length === 0 ? (
                          <div className={styles.floorEmptyState}>
                            <strong>No divisions yet.</strong>
                            <span>Create the first Division / Floor.</span>
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              onClick={() =>
                                openNewLocationModal({
                                  parentId: group.building?.id || '',
                                  locationType: 'floor',
                                })
                              }
                            >
                              + Add division
                            </button>
                          </div>
                        ) : (
                          group.floors.map((floorEntry) => {
                            const { floor, zoneEntries, unassigned } = floorEntry
                            const floorCollapsed =
                              collapsedFloors.includes(floor.id)

                            const floorProductionCount =
                              productionLocations.filter((location) =>
                                belongsTo(location, floor.id)
                              ).length

                            return (
                              <section className={styles.floorGroup} key={floor.id}>
                                <div className={styles.floorHeader}>
                                  <div className={styles.hierarchyHeaderIdentity}>
                                    <button
                                      type="button"
                                      className={styles.hierarchyChevron}
                                      onClick={() => toggleFloor(floor.id)}
                                    >
                                      {floorCollapsed ? '›' : '⌄'}
                                    </button>

                                    <span className={styles.floorIcon}>▤</span>

                                    <div>
                                      <span className={styles.hierarchyLevelLabel}>
                                        Division / Floor
                                      </span>
                                      <h4 className={styles.floorName}>{floor.name}</h4>
                                    </div>
                                  </div>

                                  <div className={styles.hierarchyHeaderActions}>
                                    <div className={styles.hierarchyStats}>
                                      <span>
                                        {zones.filter((zone) => belongsTo(zone, floor.id)).length}{' '}
                                        Zones
                                      </span>
                                      <span>{floorProductionCount} Locations</span>
                                    </div>

                                    <button
                                      type="button"
                                      className={styles.hierarchyTextAction}
                                      onClick={() => openEditLocationModal(floor)}
                                    >
                                      Edit
                                    </button>

                                    <button
                                      type="button"
                                      className={`${styles.hierarchyTextAction} ${styles.zoneDeleteButton}`}
                                      onClick={() => deleteTree(floor)}
                                      disabled={isSaving}
                                    >
                                      Delete
                                    </button>

                                    <button
                                      type="button"
                                      className={styles.hierarchyTextAction}
                                      onClick={() =>
                                        openNewLocationModal({
                                          parentId: floor.id,
                                          locationType: 'zone',
                                        })
                                      }
                                    >
                                      + Zone
                                    </button>
                                  </div>
                                </div>


                                {!floorCollapsed && (
                                  <div className={styles.zoneGrid}>
                                    {zoneEntries.map(({ zone, items }) => (
                                      <article
                                        className={styles.zoneCard}
                                        key={zone.id}
                                        style={{
                                          '--zone-accent': zoneAccent(zone.name),
                                          '--zone-soft': zoneSoft(zone.name),
                                        }}
                                      >
                                        <div className={styles.zoneHeader}>
                                          <div className={styles.zoneIdentity}>
                                            <span className={styles.zoneDot} />
                                            <div>
                                              <span className={styles.hierarchyLevelLabel}>
                                                Zone / Area
                                              </span>
                                              <strong>{zone.name}</strong>
                                            </div>
                                          </div>

                                          <div className={styles.zoneHeaderActions}>
                                            <span className={styles.zoneCount}>
                                              {items.length} Locations
                                            </span>
                                            <button
                                              type="button"
                                              className={styles.zoneEditButton}
                                              onClick={() => openEditLocationModal(zone)}
                                            >
                                              Edit
                                            </button>
                                            <button
                                              type="button"
                                              className={`${styles.zoneEditButton} ${styles.zoneDeleteButton}`}
                                              onClick={() => deleteTree(zone)}
                                              disabled={isSaving}
                                            >
                                              Delete
                                            </button>
                                          </div>
                                        </div>

                                        <div className={styles.zoneLocationList}>
                                          {items.length === 0 ? (
                                            <div className={styles.zoneEmptyState}>
                                              No locations yet.
                                            </div>
                                          ) : (
                                            items.map((location) => (
                                              <div
                                                className={styles.zoneLocationRow}
                                                key={location.id}
                                              >
                                                <div className={styles.zoneLocationIdentity}>
                                                  <span className={styles.zoneLocationIcon}>□</span>
                                                  <div>
                                                    <strong>{location.name}</strong>
                                                    <span>
                                                      {location.environment_type ||
                                                        locationTypeLabel(location.location_type)}
                                                    </span>
                                                  </div>
                                                </div>

                                                <div className={styles.zoneLocationActions}>
                                                  <button
                                                    type="button"
                                                    onClick={() => openEditLocationModal(location)}
                                                  >
                                                    Edit
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className={styles.zoneDeleteButton}
                                                    onClick={() => deleteLeaf(location)}
                                                    disabled={isSaving}
                                                  >
                                                    Delete
                                                  </button>
                                                </div>
                                              </div>
                                            ))
                                          )}
                                        </div>

                                        <button
                                          type="button"
                                          className={styles.zoneAddButton}
                                          onClick={() =>
                                            openNewLocationModal({
                                              parentId: zone.id,
                                              locationType: 'area',
                                            })
                                          }
                                        >
                                          + Add location to {zone.name}
                                        </button>
                                      </article>
                                    ))}


                                    {unassigned.length > 0 && (
                                      <article
                                        className={`${styles.zoneCard} ${styles.unassignedZoneCard}`}
                                      >
                                        <div className={styles.zoneHeader}>
                                          <div className={styles.zoneIdentity}>
                                            <span className={styles.zoneDot} />
                                            <div>
                                              <span className={styles.hierarchyLevelLabel}>
                                                Needs classification
                                              </span>
                                              <strong>Unassigned</strong>
                                            </div>
                                          </div>

                                          <span className={styles.zoneCount}>
                                            {unassigned.length} Locations
                                          </span>
                                        </div>

                                        <div className={styles.zoneLocationList}>
                                          {unassigned.map((location) => (
                                            <div
                                              className={styles.zoneLocationRow}
                                              key={location.id}
                                            >
                                              <div className={styles.zoneLocationIdentity}>
                                                <span className={styles.zoneLocationIcon}>□</span>
                                                <div>
                                                  <strong>{location.name}</strong>
                                                  <span>
                                                    {location.environment_type ||
                                                      locationTypeLabel(location.location_type)}
                                                  </span>
                                                </div>
                                              </div>

                                              <div className={styles.zoneLocationActions}>
                                                <button
                                                  type="button"
                                                  className={styles.zoneEditButton}
                                                  onClick={() => openEditLocationModal(location)}
                                                >
                                                  Assign zone
                                                </button>
                                                <button
                                                  type="button"
                                                  className={styles.zoneDeleteButton}
                                                  onClick={() => deleteLeaf(location)}
                                                  disabled={isSaving}
                                                >
                                                  Delete
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </article>
                                    )}


                                    {zoneEntries.length === 0 &&
                                      unassigned.length === 0 && (
                                        <div className={styles.floorEmptyState}>
                                          <strong>No zones yet.</strong>
                                          <span>
                                            Create the first production zone for {floor.name}.
                                          </span>
                                          <button
                                            type="button"
                                            className={styles.secondaryButton}
                                            onClick={() =>
                                              openNewLocationModal({
                                                parentId: floor.id,
                                                locationType: 'zone',
                                              })
                                            }
                                          >
                                            + Add zone
                                          </button>
                                        </div>
                                      )}
                                  </div>
                                )}
                              </section>
                            )
                          })
                        )}
                      </div>
                      </>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </div>

        <div className={styles.tableFooter}>
          <span>{locations.length} records shown</span>
          <span>Project: {projectCode || projectName}</span>
        </div>
      </section>


      {noticeMessage && (
        <div className={styles.notice}>
          <span className={styles.noticeIcon}>✓</span>
          <span>{noticeMessage}</span>
          <button
            type="button"
            className={styles.noticeClose}
            onClick={() => setNoticeMessage('')}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      )}


      {isLocationModalOpen && (
        <div
          className={styles.modalBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeLocationModal()
          }}
        >
          <form className={styles.modal} onSubmit={saveLocation}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.modalEyebrow}>
                  Location Breakdown Structure
                </p>
                <h2 className={styles.modalTitle}>
                  {locationForm.id ? 'Edit location' : 'Add location'}
                </h2>
              </div>

              <button
                type="button"
                className={styles.modalClose}
                onClick={closeLocationModal}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <p className={styles.modalDescription}>
              Define the physical hierarchy used to organize production.
            </p>

            <div className={styles.formGrid}>
              <label className={styles.formField}>
                <span>Location type</span>
                <select
                  value={locationForm.location_type}
                  onChange={(event) =>
                    setLocationForm((current) => ({
                      ...current,
                      location_type: event.target.value,
                    }))
                  }
                >
                  {locationTypes.map((item) => (
                    <option value={item.value} key={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.formField}>
                <span>Name</span>
                <input
                  type="text"
                  required
                  autoFocus
                  value={locationForm.name}
                  onChange={(event) =>
                    setLocationForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Example: PV1"
                />
              </label>

              <label className={styles.formField}>
                <span>Parent location</span>
                <select
                  value={locationForm.parent_id}
                  onChange={(event) =>
                    setLocationForm((current) => ({
                      ...current,
                      parent_id: event.target.value,
                    }))
                  }
                >
                  <option value="">Project root</option>
                  {sortedLocations
                    .filter((location) => location.id !== locationForm.id)
                    .map((location) => (
                      <option value={location.id} key={location.id}>
                        {locationTypeLabel(location.location_type)} — {location.name}
                      </option>
                    ))}
                </select>
              </label>

              <label className={styles.formField}>
                <span>Environment type</span>
                <input
                  type="text"
                  value={locationForm.environment_type}
                  onChange={(event) =>
                    setLocationForm((current) => ({
                      ...current,
                      environment_type: event.target.value,
                    }))
                  }
                  placeholder="Example: Internal"
                />
              </label>

              <label className={styles.formField}>
                <span>Sequence</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={locationForm.sequence_number}
                  onChange={(event) =>
                    setLocationForm((current) => ({
                      ...current,
                      sequence_number: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            {errorMessage && (
              <div className={styles.modalError} role="alert">
                {errorMessage}
              </div>
            )}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={closeLocationModal}
                disabled={isSaving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className={styles.primaryButton}
                disabled={isSaving}
              >
                {isSaving
                  ? 'Saving...'
                  : locationForm.id
                    ? 'Save location'
                    : 'Add location'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
