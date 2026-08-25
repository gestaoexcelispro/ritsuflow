'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import Link from 'next/link'
import { createClient } from '../../../../lib/supabase/client'
import styles from './location-breakdown.module.css'

const locationTypeOptions = [
  { value: 'building', label: 'Building' },
  { value: 'floor', label: 'Floor' },
  { value: 'zone', label: 'Zone' },
  { value: 'area', label: 'Area' },
  { value: 'room', label: 'Room' },
  { value: 'custom', label: 'Custom location' },
]

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

const emptyLocationForm = {
  id: null,
  location_type: 'area',
  name: '',
  parent_id: '',
  environment_type: '',
  sequence_number: '',
}

const emptyServiceForm = {
  service_name: '',
  service_code: '',
  unit: 'm²',
  custom_unit: '',
}

const emptyProductivityForm = {
  service_name: '',
  service_code: '',
  quantity_unit: 'm²',
  productivity_rate: '',
  productivity_basis: 'worker_day',
  description: '',
}

function getLocationTypeLabel(locationType) {
  return (
    locationTypeOptions.find(
      (option) => option.value === locationType
    )?.label || locationType
  )
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

  if (error.code === '42501') {
    return 'Your account does not have permission to perform this action.'
  }

  return (
    error.message ||
    'The requested operation could not be completed.'
  )
}

function normalizeServiceCode(value) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function createServiceCode(serviceName, services) {
  const base =
    normalizeServiceCode(serviceName) || 'SERVICE'

  const existingCodes = new Set(
    services.map((service) =>
      String(service.service_code || '').toUpperCase()
    )
  )

  if (!existingCodes.has(base)) {
    return base
  }

  let suffix = 2

  while (existingCodes.has(`${base}_${suffix}`)) {
    suffix += 1
  }

  return `${base}_${suffix}`
}

function getZoneColor(zoneName) {
  if (!zoneName) {
    return '#ffffff'
  }

  const normalized = zoneName.trim().toUpperCase()

  const fixedColors = {
    Z1: '#ebf8ff',
    Z2: '#f0fff4',
    Z3: '#fffaf0',
    Z4: '#f5f3ff',
    Z5: '#fff1f2',
    Z6: '#ecfeff',
    Z7: '#fefce8',
    Z8: '#f0fdf4',
    'ZONE 1': '#ebf8ff',
    'ZONE 2': '#f0fff4',
    'ZONE 3': '#fffaf0',
    'ZONE 4': '#f5f3ff',
    'ZONE 5': '#fff1f2',
    'ZONE 6': '#ecfeff',
  }

  if (fixedColors[normalized]) {
    return fixedColors[normalized]
  }

  const palette = [
    '#ebf8ff',
    '#f0fff4',
    '#fffaf0',
    '#f5f3ff',
    '#fff1f2',
    '#ecfeff',
    '#fefce8',
    '#f0fdf4',
    '#fdf4ff',
    '#f8fafc',
  ]

  let hash = 0

  for (let index = 0; index < normalized.length; index += 1) {
    hash =
      normalized.charCodeAt(index) + ((hash << 5) - hash)
  }

  return palette[Math.abs(hash) % palette.length]
}

function getZoneAccent(zoneName) {
  if (!zoneName) {
    return '#94a3b8'
  }

  const normalized = zoneName.trim().toUpperCase()

  const accents = {
    Z1: '#3182ce',
    Z2: '#16a085',
    Z3: '#805ad5',
    Z4: '#d69e2e',
    Z5: '#e53e3e',
    Z6: '#0891b2',
    Z7: '#65a30d',
    Z8: '#db2777',
    'ZONE 1': '#3182ce',
    'ZONE 2': '#16a085',
    'ZONE 3': '#805ad5',
    'ZONE 4': '#d69e2e',
    'ZONE 5': '#e53e3e',
    'ZONE 6': '#0891b2',
  }

  return accents[normalized] || '#64748b'
}

function formatQuantity(value) {
  const numberValue = Number(value)

  if (!Number.isFinite(numberValue)) {
    return '0'
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numberValue)
}

export default function LocationBreakdownPage() {
  const supabase = useMemo(() => createClient(), [])

  const [userId, setUserId] = useState(null)
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [locations, setLocations] = useState([])
  const [scopeItems, setScopeItems] = useState([])
  const [projectServices, setProjectServices] = useState([])
  const [serviceQuantities, setServiceQuantities] = useState([])
  const [quantityDrafts, setQuantityDrafts] = useState({})
  const [activeTab, setActiveTab] = useState('locations')
  const [searchTerm, setSearchTerm] = useState('')
  const [floorFilter, setFloorFilter] = useState('all')
  const [locationForm, setLocationForm] = useState(emptyLocationForm)
  const [serviceForm, setServiceForm] = useState(emptyServiceForm)
  const [serviceCodeWasEdited, setServiceCodeWasEdited] = useState(false)
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false)
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [savingCellKey, setSavingCellKey] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [noticeMessage, setNoticeMessage] = useState('')
  const [showQuantification, setShowQuantification] = useState(true)
  const [showTaktPresizing, setShowTaktPresizing] = useState(true)
  const [productivityLibrary, setProductivityLibrary] = useState([])
  const [projectProductivities, setProjectProductivities] = useState([])
  const [effectiveDrafts, setEffectiveDrafts] = useState({})
  const [isProductivityModalOpen, setIsProductivityModalOpen] = useState(false)
  const [productivityTarget, setProductivityTarget] = useState(null)
  const [productivitySearch, setProductivitySearch] = useState('')
  const [productivityMode, setProductivityMode] = useState('select')
  const [productivityForm, setProductivityForm] = useState(emptyProductivityForm)
  const [divisionTaktTargets, setDivisionTaktTargets] = useState([])
  const [taktTargetDrafts, setTaktTargetDrafts] = useState({})
  const [savingTaktTargetId, setSavingTaktTargetId] = useState(null)
  const [collapsedBuildingIds, setCollapsedBuildingIds] = useState([])
  const [collapsedFloorIds, setCollapsedFloorIds] = useState([])

  const loadWorkspace = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    const queryParameters = new URLSearchParams(
      window.location.search
    )

    const selectedProjectId = queryParameters.get('projectId')

    const {
      data: userData,
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !userData?.user) {
      setErrorMessage(
        'Your authenticated session could not be verified.'
      )
      setIsLoading(false)
      return
    }

    setUserId(userData.user.id)

    const {
      data: projectsData,
      error: projectsError,
    } = await supabase
      .from('projects')
      .select(`
        id,
        code,
        name,
        client_name,
        organization_id,
        status,
        created_at
      `)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })

    if (projectsError) {
      setErrorMessage(getErrorMessage(projectsError))
      setIsLoading(false)
      return
    }

    const availableProjects = projectsData || []
    setProjects(availableProjects)

    if (!selectedProjectId) {
      setSelectedProject(null)
      setLocations([])
      setScopeItems([])
      setProjectServices([])
      setServiceQuantities([])
      setQuantityDrafts({})
      setProductivityLibrary([])
      setProjectProductivities([])
      setEffectiveDrafts({})
      setDivisionTaktTargets([])
      setTaktTargetDrafts({})
      setIsLoading(false)
      return
    }

    const activeProject = availableProjects.find(
      (project) => project.id === selectedProjectId
    )

    if (!activeProject) {
      setErrorMessage(
        'The selected project does not exist or your account cannot access it.'
      )
      setSelectedProject(null)
      setIsLoading(false)
      return
    }

    setSelectedProject(activeProject)

    const [
      locationsResult,
      scopeItemsResult,
      servicesResult,
      quantitiesResult,
      productivityLibraryResult,
      projectProductivitiesResult,
      divisionTaktTargetsResult,
    ] = await Promise.all([
      supabase
        .from('locations')
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
        .eq('project_id', selectedProjectId)
        .order('sequence_number', { ascending: true })
        .order('name', { ascending: true }),

      supabase
        .from('scope_items')
        .select(`
          id,
          project_id,
          location_id,
          service_code,
          service_name,
          quantity,
          unit,
          status,
          created_at,
          updated_at
        `)
        .eq('project_id', selectedProjectId),

      supabase
        .from('project_services')
        .select(`
          id,
          project_id,
          service_code,
          service_name,
          unit,
          sequence_number,
          is_active,
          created_at,
          updated_at
        `)
        .eq('project_id', selectedProjectId)
        .eq('is_active', true)
        .order('sequence_number', { ascending: true })
        .order('service_name', { ascending: true }),

      supabase
        .from('location_service_quantities')
        .select(`
          id,
          project_id,
          location_id,
          service_id,
          quantity,
          source_scope_item_id,
          created_at,
          updated_at
        `)
        .eq('project_id', selectedProjectId),

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
        .eq('organization_id', activeProject.organization_id)
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
        .eq('project_id', selectedProjectId),

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
        .eq('project_id', selectedProjectId),
    ])

    const workspaceError =
      locationsResult.error ||
      scopeItemsResult.error ||
      servicesResult.error ||
      quantitiesResult.error ||
      productivityLibraryResult.error ||
      projectProductivitiesResult.error ||
      divisionTaktTargetsResult.error

    if (workspaceError) {
      setErrorMessage(getErrorMessage(workspaceError))
      setIsLoading(false)
      return
    }

    const loadedQuantities = quantitiesResult.data || []

    setLocations(locationsResult.data || [])
    setScopeItems(scopeItemsResult.data || [])
    setProjectServices(servicesResult.data || [])
    setServiceQuantities(loadedQuantities)
    setProductivityLibrary(productivityLibraryResult.data || [])
    setProjectProductivities(projectProductivitiesResult.data || [])
    setDivisionTaktTargets(divisionTaktTargetsResult.data || [])

    const nextTaktTargetDrafts = {}
    ;(divisionTaktTargetsResult.data || []).forEach((item) => {
      nextTaktTargetDrafts[item.division_location_id] =
        item.target_takt_days === null ||
        item.target_takt_days === undefined
          ? ''
          : String(item.target_takt_days)
    })
    setTaktTargetDrafts(nextTaktTargetDrafts)

    const nextEffectiveDrafts = {}
    ;(projectProductivitiesResult.data || []).forEach((item) => {
      const key = `${item.division_location_id}___${item.service_id}`
      nextEffectiveDrafts[key] =
        item.effective === null || item.effective === undefined
          ? ''
          : String(item.effective)
    })
    setEffectiveDrafts(nextEffectiveDrafts)

    const nextDrafts = {}

    loadedQuantities.forEach((quantityItem) => {
      const key =
        `${quantityItem.location_id}___${quantityItem.service_id}`

      nextDrafts[key] =
        quantityItem.quantity === null ||
        quantityItem.quantity === undefined
          ? ''
          : String(quantityItem.quantity)
    })

    setQuantityDrafts(nextDrafts)
    setIsLoading(false)
  }, [supabase])

  useEffect(() => {
    loadWorkspace()
  }, [loadWorkspace])

  const locationMap = useMemo(() => {
    return new Map(
      locations.map((location) => [location.id, location])
    )
  }, [locations])

  const locationPathMap = useMemo(() => {
    const pathMap = new Map()

    function buildPath(location) {
      if (!location) {
        return []
      }

      if (pathMap.has(location.id)) {
        return pathMap.get(location.id)
      }

      const path = []
      const visitedIds = new Set()
      let currentLocation = location

      while (
        currentLocation &&
        !visitedIds.has(currentLocation.id)
      ) {
        visitedIds.add(currentLocation.id)
        path.unshift(currentLocation)

        currentLocation = currentLocation.parent_id
          ? locationMap.get(currentLocation.parent_id)
          : null
      }

      pathMap.set(location.id, path)
      return path
    }

    locations.forEach((location) => {
      buildPath(location)
    })

    return pathMap
  }, [locations, locationMap])

  const sortedLocations = useMemo(() => {
    return [...locations].sort(
      (firstLocation, secondLocation) => {
        if (
          Number(firstLocation.sequence_number) !==
          Number(secondLocation.sequence_number)
        ) {
          return (
            Number(firstLocation.sequence_number) -
            Number(secondLocation.sequence_number)
          )
        }

        return firstLocation.name.localeCompare(
          secondLocation.name
        )
      }
    )
  }, [locations])

  const floorLocations = useMemo(() => {
    return sortedLocations.filter(
      (location) => location.location_type === 'floor'
    )
  }, [sortedLocations])

  const areaCount = useMemo(() => {
    return locations.filter(
      (location) =>
        location.location_type === 'area' ||
        location.location_type === 'room'
    ).length
  }, [locations])

  const zoneCount = useMemo(() => {
    return locations.filter(
      (location) => location.location_type === 'zone'
    ).length
  }, [locations])

  const filteredLocations = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    if (!normalizedSearch) {
      return sortedLocations
    }

    return sortedLocations.filter((location) => {
      const parentLocation = location.parent_id
        ? locationMap.get(location.parent_id)
        : null

      const searchableText = [
        location.name,
        location.location_type,
        location.environment_type,
        parentLocation?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchableText.includes(normalizedSearch)
    })
  }, [locationMap, searchTerm, sortedLocations])

  const matrixLocations = useMemo(() => {
    const candidates = sortedLocations.filter(
      (location) =>
        location.location_type === 'area' ||
        location.location_type === 'room' ||
        location.location_type === 'custom'
    )

    const sourceLocations =
      candidates.length > 0
        ? candidates
        : sortedLocations.filter(
            (location) =>
              !locations.some(
                (candidate) =>
                  candidate.parent_id === location.id
              )
          )

    const normalizedSearch = searchTerm.trim().toLowerCase()

    return sourceLocations.filter((location) => {
      const path = locationPathMap.get(location.id) || []

      const floor = path.find(
        (pathLocation) =>
          pathLocation.location_type === 'floor'
      )

      const searchableText = [
        location.name,
        location.environment_type,
        ...path.map((pathLocation) => pathLocation.name),
        ...projectServices.map(
          (service) => service.service_name
        ),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch =
        !normalizedSearch ||
        searchableText.includes(normalizedSearch)

      const matchesFloor =
        floorFilter === 'all' || floor?.id === floorFilter

      return matchesSearch && matchesFloor
    })
  }, [
    floorFilter,
    locationPathMap,
    locations,
    projectServices,
    searchTerm,
    sortedLocations,
  ])

  const locationHierarchy = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    const buildingLocations = sortedLocations.filter(
      (location) => location.location_type === 'building'
    )

    const floorLocationsInHierarchy = sortedLocations.filter(
      (location) => location.location_type === 'floor'
    )

    const zoneLocations = sortedLocations.filter(
      (location) => location.location_type === 'zone'
    )

    const assignableLocations = sortedLocations.filter(
      (location) =>
        location.location_type === 'area' ||
        location.location_type === 'room' ||
        location.location_type === 'custom'
    )

    function locationMatches(location) {
      if (!normalizedSearch) {
        return true
      }

      const path = locationPathMap.get(location.id) || []

      return [
        location.name,
        location.location_type,
        location.environment_type,
        ...path.map((pathLocation) => pathLocation.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    }

    function buildFloorEntry(floor) {
      const floorMatches = locationMatches(floor)

      const zones = zoneLocations
        .filter((zone) => {
          const path = locationPathMap.get(zone.id) || []
          return path.some(
            (pathLocation) => pathLocation.id === floor.id
          )
        })
        .map((zone) => {
          const zoneMatches = locationMatches(zone)

          const locationsInZone = assignableLocations.filter(
            (location) => {
              const path = locationPathMap.get(location.id) || []
              return path.some(
                (pathLocation) => pathLocation.id === zone.id
              )
            }
          )

          const visibleLocations =
            !normalizedSearch || floorMatches || zoneMatches
              ? locationsInZone
              : locationsInZone.filter(locationMatches)

          const isVisible =
            !normalizedSearch ||
            floorMatches ||
            zoneMatches ||
            visibleLocations.length > 0

          return {
            zone,
            locations: visibleLocations,
            totalLocations: locationsInZone.length,
            isVisible,
          }
        })
        .filter((zoneEntry) => zoneEntry.isVisible)

      const unassignedLocations = assignableLocations.filter(
        (location) => {
          const path = locationPathMap.get(location.id) || []
          const belongsToFloor = path.some(
            (pathLocation) => pathLocation.id === floor.id
          )
          const belongsToZone = path.some(
            (pathLocation) => pathLocation.location_type === 'zone'
          )
          return belongsToFloor && !belongsToZone
        }
      )

      const visibleUnassignedLocations =
        !normalizedSearch || floorMatches
          ? unassignedLocations
          : unassignedLocations.filter(locationMatches)

      const isVisible =
        !normalizedSearch ||
        floorMatches ||
        zones.length > 0 ||
        visibleUnassignedLocations.length > 0

      return {
        floor,
        zones,
        unassignedLocations: visibleUnassignedLocations,
        totalZones: zoneLocations.filter((zone) => {
          const path = locationPathMap.get(zone.id) || []
          return path.some(
            (pathLocation) => pathLocation.id === floor.id
          )
        }).length,
        totalLocations: assignableLocations.filter((location) => {
          const path = locationPathMap.get(location.id) || []
          return path.some(
            (pathLocation) => pathLocation.id === floor.id
          )
        }).length,
        isVisible,
      }
    }

    const floorEntries = floorLocationsInHierarchy
      .map(buildFloorEntry)
      .filter((floorEntry) => floorEntry.isVisible)

    const groups = buildingLocations
      .map((building) => {
        const buildingMatches = locationMatches(building)

        const floors = floorEntries.filter((floorEntry) => {
          const path = locationPathMap.get(floorEntry.floor.id) || []
          return path.some(
            (pathLocation) => pathLocation.id === building.id
          )
        })

        return {
          id: building.id,
          building,
          label: building.name,
          floors,
          totalFloors: floorLocationsInHierarchy.filter((floor) => {
            const path = locationPathMap.get(floor.id) || []
            return path.some(
              (pathLocation) => pathLocation.id === building.id
            )
          }).length,
          isVisible:
            !normalizedSearch || buildingMatches || floors.length > 0,
        }
      })
      .filter((group) => group.isVisible)

    const orphanFloors = floorEntries.filter((floorEntry) => {
      const path = locationPathMap.get(floorEntry.floor.id) || []
      return !path.some(
        (pathLocation) => pathLocation.location_type === 'building'
      )
    })

    if (orphanFloors.length > 0 || buildingLocations.length === 0) {
      groups.push({
        id: 'project-root',
        building: null,
        label: selectedProject?.name || 'Project locations',
        floors:
          buildingLocations.length === 0 ? floorEntries : orphanFloors,
        totalFloors:
          buildingLocations.length === 0
            ? floorLocationsInHierarchy.length
            : orphanFloors.length,
        isVisible: true,
      })
    }

    return groups.filter((group) => group.floors.length > 0)
  }, [
    locationPathMap,
    searchTerm,
    selectedProject,
    sortedLocations,
  ])

  const quantityMap = useMemo(() => {
    const map = new Map()

    serviceQuantities.forEach((quantityItem) => {
      map.set(
        `${quantityItem.location_id}___${quantityItem.service_id}`,
        quantityItem
      )
    })

    return map
  }, [serviceQuantities])

  const quantificationByDivision = useMemo(() => {
    return floorLocations
      .map((floor) => {
        const zones = sortedLocations
          .filter(
            (location) => location.location_type === 'zone'
          )
          .filter((zone) => {
            const path = locationPathMap.get(zone.id) || []
            return path.some(
              (pathLocation) => pathLocation.id === floor.id
            )
          })

        const totals = new Map()

        projectServices.forEach((service) => {
          zones.forEach((zone) => {
            totals.set(`${service.id}___${zone.id}`, 0)
          })
        })

        serviceQuantities.forEach((quantityItem) => {
          const location = locationMap.get(
            quantityItem.location_id
          )

          if (!location) {
            return
          }

          const path = locationPathMap.get(location.id) || []

          const floorInPath = path.find(
            (pathLocation) =>
              pathLocation.location_type === 'floor'
          )

          const zoneInPath = path.find(
            (pathLocation) =>
              pathLocation.location_type === 'zone'
          )

          if (
            floorInPath?.id !== floor.id ||
            !zoneInPath ||
            !zones.some((zone) => zone.id === zoneInPath.id)
          ) {
            return
          }

          const key =
            `${quantityItem.service_id}___${zoneInPath.id}`

          totals.set(
            key,
            (totals.get(key) || 0) +
              (Number(quantityItem.quantity) || 0)
          )
        })

        return {
          floor,
          zones,
          totals,
        }
      })
      .filter((division) => division.zones.length > 0)
  }, [
    floorLocations,
    locationMap,
    locationPathMap,
    projectServices,
    serviceQuantities,
    sortedLocations,
  ])

  const projectProductivityMap = useMemo(() => {
    const map = new Map()

    projectProductivities.forEach((item) => {
      map.set(
        `${item.division_location_id}___${item.service_id}`,
        item
      )
    })

    return map
  }, [projectProductivities])

  const divisionTaktTargetMap = useMemo(() => {
    const map = new Map()

    divisionTaktTargets.forEach((item) => {
      map.set(item.division_location_id, item)
    })

    return map
  }, [divisionTaktTargets])

  const filteredProductivityLibrary = useMemo(() => {
    const normalizedSearch = productivitySearch.trim().toLowerCase()

    if (!normalizedSearch) {
      return productivityLibrary
    }

    return productivityLibrary.filter((item) =>
      [
        item.service_name,
        item.service_code,
        item.quantity_unit,
        item.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    )
  }, [productivityLibrary, productivitySearch])

  function changeProject(projectId) {
    window.location.href =
      `/dashboard/projects/locations?projectId=${projectId}`
  }

  function openNewLocationModal(options = {}) {
    const parentId = options.parentId || ''
    const locationType = options.locationType || 'area'

    const siblingLocations = locations.filter(
      (location) => (location.parent_id || '') === parentId
    )

    const nextSequence =
      siblingLocations.reduce(
        (largestSequence, location) =>
          Math.max(
            largestSequence,
            Number(location.sequence_number) || 0
          ),
        0
      ) + 1

    setLocationForm({
      ...emptyLocationForm,
      location_type: locationType,
      parent_id: parentId,
      sequence_number: String(nextSequence),
    })

    setErrorMessage('')
    setNoticeMessage('')
    setIsLocationModalOpen(true)
  }

  function toggleBuilding(buildingId) {
    setCollapsedBuildingIds((currentIds) =>
      currentIds.includes(buildingId)
        ? currentIds.filter((id) => id !== buildingId)
        : [...currentIds, buildingId]
    )
  }

  function toggleFloor(floorId) {
    setCollapsedFloorIds((currentIds) =>
      currentIds.includes(floorId)
        ? currentIds.filter((id) => id !== floorId)
        : [...currentIds, floorId]
    )
  }

  function expandAllHierarchy() {
    setCollapsedBuildingIds([])
    setCollapsedFloorIds([])
  }

  function collapseAllHierarchy() {
    setCollapsedBuildingIds(
      locationHierarchy.map((group) => group.id)
    )
    setCollapsedFloorIds(
      locationHierarchy.flatMap((group) =>
        group.floors.map((floorEntry) => floorEntry.floor.id)
      )
    )
  }

  function openEditLocationModal(location) {
    setLocationForm({
      id: location.id,
      location_type: location.location_type,
      name: location.name,
      parent_id: location.parent_id || '',
      environment_type: location.environment_type || '',
      sequence_number: String(location.sequence_number),
    })

    setErrorMessage('')
    setIsLocationModalOpen(true)
  }

  function closeLocationModal() {
    if (isSaving) {
      return
    }

    setIsLocationModalOpen(false)
    setLocationForm(emptyLocationForm)
  }

  function openServiceModal() {
    setServiceForm(emptyServiceForm)
    setServiceCodeWasEdited(false)
    setErrorMessage('')
    setIsServiceModalOpen(true)
  }

  function closeServiceModal() {
    if (isSaving) {
      return
    }

    setIsServiceModalOpen(false)
    setServiceForm(emptyServiceForm)
    setServiceCodeWasEdited(false)
  }

  function openProductivityModal(floor, service) {
    setProductivityTarget({ floor, service })
    setProductivitySearch(service.service_name || '')
    setProductivityMode('select')
    setProductivityForm({
      ...emptyProductivityForm,
      service_name: service.service_name || '',
      service_code: service.service_code || '',
      quantity_unit: service.unit || 'm²',
    })
    setErrorMessage('')
    setIsProductivityModalOpen(true)
  }

  function closeProductivityModal() {
    if (isSaving) {
      return
    }

    setIsProductivityModalOpen(false)
    setProductivityTarget(null)
    setProductivitySearch('')
    setProductivityMode('select')
    setProductivityForm(emptyProductivityForm)
  }

  async function applyProductivity(libraryItem) {
    if (!selectedProject || !userId || !productivityTarget) {
      return
    }

    const { floor, service } = productivityTarget
    const key = `${floor.id}___${service.id}`
    const existing = projectProductivityMap.get(key)

    setIsSaving(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('project_service_productivity')
      .upsert(
        {
          project_id: selectedProject.id,
          division_location_id: floor.id,
          service_id: service.id,
          productivity_library_id: libraryItem.id,
          productivity_rate: Number(libraryItem.productivity_rate),
          quantity_unit: libraryItem.quantity_unit || service.unit || null,
          productivity_basis: libraryItem.productivity_basis || 'worker_day',
          effective: existing?.effective ?? null,
          created_by: existing?.created_by || userId,
        },
        {
          onConflict: 'project_id,division_location_id,service_id',
        }
      )
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
      .single()

    if (error) {
      setErrorMessage(getErrorMessage(error))
      setIsSaving(false)
      return
    }

    setProjectProductivities((currentItems) => {
      const exists = currentItems.some((item) => item.id === data.id)
      return exists
        ? currentItems.map((item) => (item.id === data.id ? data : item))
        : [...currentItems, data]
    })

    setEffectiveDrafts((currentDrafts) => ({
      ...currentDrafts,
      [key]: data.effective === null || data.effective === undefined
        ? ''
        : String(data.effective),
    }))

    setNoticeMessage(
      `${libraryItem.service_name} productivity was applied to ${floor.name}.`
    )

    setIsSaving(false)
    setIsProductivityModalOpen(false)
    setProductivityTarget(null)
    setProductivitySearch('')
    setProductivityMode('select')
    setProductivityForm(emptyProductivityForm)
  }

  async function createProductivity(event) {
    event.preventDefault()

    if (!selectedProject || !userId || !productivityTarget) {
      return
    }

    const normalizedName = productivityForm.service_name.trim()
    const rate = Number(String(productivityForm.productivity_rate).replace(',', '.'))

    if (!normalizedName) {
      setErrorMessage('Enter a service name.')
      return
    }

    if (!Number.isFinite(rate) || rate <= 0) {
      setErrorMessage('Enter a productivity greater than zero.')
      return
    }

    if (!productivityForm.quantity_unit.trim()) {
      setErrorMessage('Enter a quantity unit.')
      return
    }

    setIsSaving(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('productivity_library')
      .insert({
        organization_id: selectedProject.organization_id,
        service_name: normalizedName,
        service_code: productivityForm.service_code.trim() || null,
        quantity_unit: productivityForm.quantity_unit.trim(),
        productivity_rate: rate,
        productivity_basis:
          productivityForm.productivity_basis.trim() || 'worker_day',
        description: productivityForm.description.trim() || null,
        is_active: true,
        created_by: userId,
      })
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
      .single()

    if (error) {
      setErrorMessage(getErrorMessage(error))
      setIsSaving(false)
      return
    }

    setProductivityLibrary((currentItems) => [...currentItems, data])
    setIsSaving(false)
    await applyProductivity(data)
  }

  async function saveEffective(floorId, serviceId) {
    if (!selectedProject || !userId) {
      return
    }

    const key = `${floorId}___${serviceId}`
    const rawValue = effectiveDrafts[key] ?? ''
    const normalizedText = String(rawValue).trim()
    const existing = projectProductivityMap.get(key)

    let effective = null

    if (normalizedText !== '') {
      effective = Number(normalizedText.replace(',', '.'))

      if (!Number.isFinite(effective) || effective < 0) {
        setErrorMessage('Enter a valid effective workforce.')
        setEffectiveDrafts((currentDrafts) => ({
          ...currentDrafts,
          [key]: existing?.effective === null || existing?.effective === undefined
            ? ''
            : String(existing.effective),
        }))
        return
      }
    }

    if (
      existing &&
      (existing.effective === null ? null : Number(existing.effective)) === effective
    ) {
      return
    }

    setErrorMessage('')

    const { data, error } = await supabase
      .from('project_service_productivity')
      .upsert(
        {
          project_id: selectedProject.id,
          division_location_id: floorId,
          service_id: serviceId,
          productivity_library_id: existing?.productivity_library_id || null,
          productivity_rate: existing?.productivity_rate ?? null,
          quantity_unit: existing?.quantity_unit ?? null,
          productivity_basis: existing?.productivity_basis || 'worker_day',
          effective,
          created_by: userId,
        },
        {
          onConflict: 'project_id,division_location_id,service_id',
        }
      )
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
      .single()

    if (error) {
      setErrorMessage(getErrorMessage(error))
      return
    }

    setProjectProductivities((currentItems) => {
      const exists = currentItems.some((item) => item.id === data.id)
      return exists
        ? currentItems.map((item) => (item.id === data.id ? data : item))
        : [...currentItems, data]
    })

    setEffectiveDrafts((currentDrafts) => ({
      ...currentDrafts,
      [key]: data.effective === null || data.effective === undefined
        ? ''
        : String(data.effective),
    }))

    const savedFloor = locationMap.get(floorId)
    const savedService = projectServices.find(
      (service) => service.id === serviceId
    )

    setNoticeMessage(
      `Effective workforce saved${savedService ? ` for ${savedService.service_name}` : ''}${savedFloor ? ` on ${savedFloor.name}` : ''}.`
    )
  }

  async function saveDivisionTaktTarget(floorId) {
    if (!selectedProject || !userId) {
      return
    }

    const rawValue = taktTargetDrafts[floorId] ?? ''
    const normalizedText = String(rawValue).trim()
    const existing = divisionTaktTargetMap.get(floorId)

    if (normalizedText === '') {
      if (!existing) {
        return
      }

      setSavingTaktTargetId(floorId)
      setErrorMessage('')

      const { error } = await supabase
        .from('project_division_takt_targets')
        .delete()
        .eq('id', existing.id)
        .eq('project_id', selectedProject.id)

      if (error) {
        setErrorMessage(getErrorMessage(error))
        setTaktTargetDrafts((currentDrafts) => ({
          ...currentDrafts,
          [floorId]: String(existing.target_takt_days),
        }))
        setSavingTaktTargetId(null)
        return
      }

      setDivisionTaktTargets((currentItems) =>
        currentItems.filter((item) => item.id !== existing.id)
      )

      setSavingTaktTargetId(null)
      setNoticeMessage('Target Takt was cleared for this division.')
      return
    }

    const targetValue = Number(normalizedText.replace(',', '.'))

    if (!Number.isFinite(targetValue) || targetValue <= 0) {
      setErrorMessage('Enter a Target Takt greater than zero.')
      setTaktTargetDrafts((currentDrafts) => ({
        ...currentDrafts,
        [floorId]:
          existing?.target_takt_days === null ||
          existing?.target_takt_days === undefined
            ? ''
            : String(existing.target_takt_days),
      }))
      return
    }

    if (
      existing &&
      Number(existing.target_takt_days) === targetValue
    ) {
      return
    }

    setSavingTaktTargetId(floorId)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('project_division_takt_targets')
      .upsert(
        {
          project_id: selectedProject.id,
          division_location_id: floorId,
          target_takt_days: targetValue,
          created_by: userId,
        },
        {
          onConflict: 'project_id,division_location_id',
        }
      )
      .select(`
        id,
        project_id,
        division_location_id,
        target_takt_days,
        created_at,
        updated_at
      `)
      .single()

    if (error) {
      setErrorMessage(getErrorMessage(error))
      setTaktTargetDrafts((currentDrafts) => ({
        ...currentDrafts,
        [floorId]:
          existing?.target_takt_days === null ||
          existing?.target_takt_days === undefined
            ? ''
            : String(existing.target_takt_days),
      }))
      setSavingTaktTargetId(null)
      return
    }

    setDivisionTaktTargets((currentItems) => {
      const exists = currentItems.some((item) => item.id === data.id)

      return exists
        ? currentItems.map((item) => (item.id === data.id ? data : item))
        : [...currentItems, data]
    })

    setTaktTargetDrafts((currentDrafts) => ({
      ...currentDrafts,
      [floorId]: String(data.target_takt_days),
    }))

    setSavingTaktTargetId(null)

    const floor = locationMap.get(floorId)
    setNoticeMessage(
      `Target Takt saved${floor ? ` for ${floor.name}` : ''}.`
    )
  }

  async function saveLocation(event) {
    event.preventDefault()

    if (!selectedProject || !userId) {
      return
    }

    const normalizedName = locationForm.name.trim()

    if (!normalizedName) {
      setErrorMessage('Enter a location name.')
      return
    }

    if (
      locationForm.id &&
      locationForm.parent_id === locationForm.id
    ) {
      setErrorMessage('A location cannot be its own parent.')
      return
    }

    setIsSaving(true)
    setErrorMessage('')

    const locationPayload = {
      project_id: selectedProject.id,
      parent_id: locationForm.parent_id || null,
      name: normalizedName,
      location_type: locationForm.location_type,
      environment_type:
        locationForm.environment_type.trim() || null,
      sequence_number:
        Number(locationForm.sequence_number) || 0,
    }

    let operationResult

    if (locationForm.id) {
      operationResult = await supabase
        .from('locations')
        .update(locationPayload)
        .eq('id', locationForm.id)
        .eq('project_id', selectedProject.id)
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
      operationResult = await supabase
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

    if (operationResult.error) {
      setErrorMessage(getErrorMessage(operationResult.error))
      setIsSaving(false)
      return
    }

    if (locationForm.id) {
      setLocations((currentLocations) =>
        currentLocations.map((location) =>
          location.id === operationResult.data.id
            ? operationResult.data
            : location
        )
      )

      setNoticeMessage(
        `${operationResult.data.name} was updated.`
      )
    } else {
      setLocations((currentLocations) => [
        ...currentLocations,
        operationResult.data,
      ])

      setNoticeMessage(
        `${operationResult.data.name} was added to the location structure.`
      )
    }

    setIsSaving(false)
    setIsLocationModalOpen(false)
    setLocationForm(emptyLocationForm)
  }

  async function deleteLocation(location) {
    const hasChildLocations = locations.some(
      (childLocation) =>
        childLocation.parent_id === location.id
    )

    if (hasChildLocations) {
      setNoticeMessage(
        `Cannot delete ${location.name} because it still contains child locations. Delete or move the child locations first.`
      )
      return
    }

    const locationQuantities = serviceQuantities.filter(
      (quantityItem) =>
        quantityItem.location_id === location.id
    )

    const legacyScopeAssignments = scopeItems.filter(
      (scopeItem) =>
        scopeItem.location_id === location.id
    )

    const dependentRecordCount =
      locationQuantities.length +
      legacyScopeAssignments.length

    const confirmed = window.confirm(
      dependentRecordCount > 0
        ? `Delete ${location.name}? This will also remove ${dependentRecordCount} connected quantity/scope record${dependentRecordCount === 1 ? '' : 's'} for this location. This action cannot be undone.`
        : `Delete ${location.name}? This action cannot be undone.`
    )

    if (!confirmed) {
      return
    }

    setErrorMessage('')
    setIsSaving(true)

    /*
     * Remove dependent matrix quantities first.
     *
     * The current RitsuFlow schema already protects project
     * boundaries with RLS. Deleting these records explicitly
     * makes the UI behavior predictable even when a legacy
     * foreign-key definition does not use ON DELETE CASCADE.
     */
    if (locationQuantities.length > 0) {
      const { error: quantityDeleteError } = await supabase
        .from('location_service_quantities')
        .delete()
        .eq('project_id', selectedProject.id)
        .eq('location_id', location.id)

      if (quantityDeleteError) {
        setErrorMessage(
          getErrorMessage(quantityDeleteError)
        )
        setIsSaving(false)
        return
      }
    }

    /*
     * scope_items is retained as a legacy/safety structure,
     * but records assigned specifically to a location cannot
     * remain after that location is deleted.
     */
    if (legacyScopeAssignments.length > 0) {
      const { error: scopeDeleteError } = await supabase
        .from('scope_items')
        .delete()
        .eq('project_id', selectedProject.id)
        .eq('location_id', location.id)

      if (scopeDeleteError) {
        setErrorMessage(
          getErrorMessage(scopeDeleteError)
        )
        setIsSaving(false)
        return
      }
    }

    const { error: locationDeleteError } = await supabase
      .from('locations')
      .delete()
      .eq('id', location.id)
      .eq('project_id', selectedProject.id)

    if (locationDeleteError) {
      /*
       * Reload the workspace because dependent records may
       * already have been removed before the location delete
       * failed.
       */
      setErrorMessage(
        getErrorMessage(locationDeleteError)
      )
      setIsSaving(false)
      await loadWorkspace()
      return
    }

    setLocations((currentLocations) =>
      currentLocations.filter(
        (currentLocation) =>
          currentLocation.id !== location.id
      )
    )

    setScopeItems((currentScopeItems) =>
      currentScopeItems.filter(
        (scopeItem) =>
          scopeItem.location_id !== location.id
      )
    )

    setServiceQuantities((currentQuantities) =>
      currentQuantities.filter(
        (quantityItem) =>
          quantityItem.location_id !== location.id
      )
    )

    setQuantityDrafts((currentDrafts) => {
      const nextDrafts = {
        ...currentDrafts,
      }

      projectServices.forEach((service) => {
        delete nextDrafts[
          `${location.id}___${service.id}`
        ]
      })

      return nextDrafts
    })

    setNoticeMessage(
      `${location.name} was deleted successfully.`
    )

    setIsSaving(false)
  }

  async function saveService(event) {
    event.preventDefault()

    if (!selectedProject || !userId) {
      return
    }

    const normalizedName = serviceForm.service_name.trim()

    if (!normalizedName) {
      setErrorMessage('Enter a service name.')
      return
    }

    if (
      serviceForm.unit === 'OTHER' &&
      !serviceForm.custom_unit.trim()
    ) {
      setErrorMessage('Enter a custom unit.')
      return
    }

    let normalizedCode = normalizeServiceCode(
      serviceForm.service_code
    )

    if (!normalizedCode) {
      normalizedCode = createServiceCode(
        normalizedName,
        projectServices
      )
    }

    const duplicateName = projectServices.some(
      (service) =>
        service.service_name.trim().toLowerCase() ===
        normalizedName.toLowerCase()
    )

    if (duplicateName) {
      setErrorMessage(
        'A service with this name already exists in the project.'
      )
      return
    }

    const duplicateCode = projectServices.some(
      (service) =>
        String(service.service_code).toUpperCase() ===
        normalizedCode
    )

    if (duplicateCode) {
      setErrorMessage(
        'A service with this code already exists in the project.'
      )
      return
    }

    const finalUnit =
      serviceForm.unit === 'OTHER'
        ? serviceForm.custom_unit.trim()
        : serviceForm.unit

    const nextSequence =
      projectServices.reduce(
        (largestSequence, service) =>
          Math.max(
            largestSequence,
            Number(service.sequence_number) || 0
          ),
        -1
      ) + 1

    setIsSaving(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('project_services')
      .insert({
        project_id: selectedProject.id,
        service_code: normalizedCode,
        service_name: normalizedName,
        unit: finalUnit || null,
        sequence_number: nextSequence,
        is_active: true,
        created_by: userId,
      })
      .select(`
        id,
        project_id,
        service_code,
        service_name,
        unit,
        sequence_number,
        is_active,
        created_at,
        updated_at
      `)
      .single()

    if (error) {
      setErrorMessage(getErrorMessage(error))
      setIsSaving(false)
      return
    }

    setProjectServices((currentServices) => [
      ...currentServices,
      data,
    ])

    setNoticeMessage(
      `${data.service_name} was added as a new quantity column.`
    )

    setIsSaving(false)
    setIsServiceModalOpen(false)
    setServiceForm(emptyServiceForm)
    setServiceCodeWasEdited(false)
  }

  async function saveQuantity(locationId, serviceId) {
    if (!selectedProject || !userId) {
      return
    }

    const key = `${locationId}___${serviceId}`
    const rawValue = quantityDrafts[key] ?? ''
    const normalizedText = String(rawValue).trim()
    const existingRecord = quantityMap.get(key)

    if (normalizedText === '') {
      if (!existingRecord) {
        return
      }

      setSavingCellKey(key)
      setErrorMessage('')

      const { error } = await supabase
        .from('location_service_quantities')
        .delete()
        .eq('id', existingRecord.id)
        .eq('project_id', selectedProject.id)

      if (error) {
        setErrorMessage(getErrorMessage(error))

        setQuantityDrafts((currentDrafts) => ({
          ...currentDrafts,
          [key]:
            existingRecord.quantity === null
              ? ''
              : String(existingRecord.quantity),
        }))

        setSavingCellKey(null)
        return
      }

      setServiceQuantities((currentQuantities) =>
        currentQuantities.filter(
          (quantityItem) =>
            quantityItem.id !== existingRecord.id
        )
      )

      setSavingCellKey(null)
      return
    }

    const numericValue = Number(
      normalizedText.replace(',', '.')
    )

    if (
      Number.isNaN(numericValue) ||
      numericValue < 0
    ) {
      setErrorMessage(
        'Enter a valid quantity greater than or equal to zero.'
      )

      if (existingRecord) {
        setQuantityDrafts((currentDrafts) => ({
          ...currentDrafts,
          [key]: String(existingRecord.quantity ?? ''),
        }))
      } else {
        setQuantityDrafts((currentDrafts) => ({
          ...currentDrafts,
          [key]: '',
        }))
      }

      return
    }

    if (
      existingRecord &&
      Number(existingRecord.quantity) === numericValue
    ) {
      return
    }

    setSavingCellKey(key)
    setErrorMessage('')

    if (existingRecord) {
      const { data, error } = await supabase
        .from('location_service_quantities')
        .update({ quantity: numericValue })
        .eq('id', existingRecord.id)
        .eq('project_id', selectedProject.id)
        .select(`
          id,
          project_id,
          location_id,
          service_id,
          quantity,
          source_scope_item_id,
          created_at,
          updated_at
        `)
        .single()

      if (error) {
        setErrorMessage(getErrorMessage(error))

        setQuantityDrafts((currentDrafts) => ({
          ...currentDrafts,
          [key]: String(existingRecord.quantity ?? ''),
        }))

        setSavingCellKey(null)
        return
      }

      setServiceQuantities((currentQuantities) =>
        currentQuantities.map((quantityItem) =>
          quantityItem.id === data.id ? data : quantityItem
        )
      )

      setQuantityDrafts((currentDrafts) => ({
        ...currentDrafts,
        [key]: String(data.quantity),
      }))

      setSavingCellKey(null)
      return
    }

    const { data, error } = await supabase
      .from('location_service_quantities')
      .insert({
        project_id: selectedProject.id,
        location_id: locationId,
        service_id: serviceId,
        quantity: numericValue,
        created_by: userId,
      })
      .select(`
        id,
        project_id,
        location_id,
        service_id,
        quantity,
        source_scope_item_id,
        created_at,
        updated_at
      `)
      .single()

    if (error) {
      setErrorMessage(getErrorMessage(error))

      setQuantityDrafts((currentDrafts) => ({
        ...currentDrafts,
        [key]: '',
      }))

      setSavingCellKey(null)
      return
    }

    setServiceQuantities((currentQuantities) => [
      ...currentQuantities,
      data,
    ])

    setQuantityDrafts((currentDrafts) => ({
      ...currentDrafts,
      [key]: String(data.quantity),
    }))

    setSavingCellKey(null)
  }

  if (isLoading) {
    return (
      <div className={styles.loadingState}>
        <span className={styles.loadingSpinner} />
        <p>Loading location workspace...</p>
      </div>
    )
  }

  if (errorMessage && projects.length === 0) {
    return (
      <div className={styles.errorState}>
        <h1 className={styles.errorTitle}>
          Workspace unavailable
        </h1>

        <p className={styles.errorDescription}>
          {errorMessage}
        </p>

        <button
          type="button"
          className={styles.primaryButton}
          onClick={loadWorkspace}
        >
          Try again
        </button>
      </div>
    )
  }

  if (!selectedProject) {
    return (
      <div className={styles.container}>
        <section className={styles.heading}>
          <div className={styles.headingContent}>
            <p className={styles.eyebrow}>
              Location-based planning
            </p>

            <h1 className={styles.title}>
              Location & Scope Workspace
            </h1>

            <p className={styles.description}>
              Select a project to define its location breakdown
              structure, services, and measurable quantities.
            </p>
          </div>

          <Link
            href="/dashboard/projects"
            className={styles.backLink}
          >
            ← Back to projects
          </Link>
        </section>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>
                Select a project
              </h2>

              <p className={styles.panelDescription}>
                Every project has an independent location and
                production scope structure.
              </p>
            </div>

            <span className={styles.projectCode}>
              {projects.length === 1
                ? '1 project'
                : `${projects.length} projects`}
            </span>
          </div>

          {projects.length === 0 ? (
            <div className={styles.emptyState}>
              <h3 className={styles.emptyTitle}>
                No projects available.
              </h3>

              <p className={styles.emptyDescription}>
                Create a project before defining its location
                breakdown structure.
              </p>

              <Link
                href="/dashboard/projects"
                className={styles.primaryButton}
              >
                Open projects
              </Link>
            </div>
          ) : (
            <div className={styles.projectGrid}>
              {projects.map((project) => (
                <button
                  type="button"
                  className={styles.projectCard}
                  onClick={() => changeProject(project.id)}
                  key={project.id}
                >
                  <div className={styles.projectIdentity}>
                    <span className={styles.projectName}>
                      {project.name}
                    </span>

                    <span className={styles.projectClient}>
                      {project.code || 'Unassigned'} ·{' '}
                      {project.client_name ||
                        'Client not specified'}
                    </span>
                  </div>

                  <span
                    className={styles.projectArrow}
                    aria-hidden="true"
                  >
                    →
                  </span>
                </button>
              ))}
            </div>
          )}
        </article>
      </div>
    )
  }

  const summaryItems = [
    {
      label: 'Floors',
      value: floorLocations.length,
      detail: 'Building levels',
    },
    {
      label: 'Zones',
      value: zoneCount,
      detail: 'Production subdivisions',
    },
    {
      label: 'Areas and rooms',
      value: areaCount,
      detail: 'Assignable locations',
    },
    {
      label: 'Services',
      value: projectServices.length,
      detail: 'Dynamic quantity columns',
    },
  ]

  return (
    <div className={styles.container}>
      <section className={styles.heading}>
        <div className={styles.headingContent}>
          <p className={styles.eyebrow}>
            Location-based planning foundation
          </p>

          <h1 className={styles.title}>
            Location & Scope Workspace
          </h1>

          <p className={styles.description}>
            Build the physical production hierarchy first, then
            quantify each service across the locations where
            production will be planned and controlled.
          </p>
        </div>

        <div className={styles.projectSelector}>
          <label
            htmlFor="active-project"
            className={styles.projectSelectorLabel}
          >
            Active project
          </label>

          <select
            id="active-project"
            className={styles.projectSelectorInput}
            value={selectedProject.id}
            onChange={(event) =>
              changeProject(event.target.value)
            }
          >
            {projects.map((project) => (
              <option value={project.id} key={project.id}>
                {project.code || 'Unassigned'} · {project.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section
        className={styles.summaryGrid}
        aria-label="Location summary"
      >
        {summaryItems.map((item) => (
          <article
            className={styles.summaryCard}
            key={item.label}
          >
            <p className={styles.summaryLabel}>{item.label}</p>
            <p className={styles.summaryValue}>{item.value}</p>
            <p className={styles.summaryDetail}>{item.detail}</p>
          </article>
        ))}
      </section>

      <section className={styles.panel}>
        <div className={styles.tabList}>
          <button
            type="button"
            className={
              activeTab === 'locations'
                ? `${styles.tabButton} ${styles.tabButtonActive}`
                : styles.tabButton
            }
            onClick={() => {
              setActiveTab('locations')
              setSearchTerm('')
            }}
          >
            <span className={styles.tabNumber}>01</span>
            Location Structure
            <span className={styles.tabCount}>
              {locations.length}
            </span>
          </button>

          <button
            type="button"
            className={
              activeTab === 'scope'
                ? `${styles.tabButton} ${styles.tabButtonActive}`
                : styles.tabButton
            }
            onClick={() => {
              setActiveTab('scope')
              setSearchTerm('')
            }}
          >
            <span className={styles.tabNumber}>02</span>
            Scope & Quantities
            <span className={styles.tabCount}>
              {projectServices.length}
            </span>
          </button>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.searchField}>
            <span
              className={styles.searchIcon}
              aria-hidden="true"
            >
              ⌕
            </span>

            <input
              type="search"
              className={styles.searchInput}
              placeholder={
                activeTab === 'locations'
                  ? 'Search locations...'
                  : 'Search locations or services...'
              }
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
            />
          </div>

          {activeTab === 'scope' && (
            <select
              className={styles.filterSelect}
              value={floorFilter}
              onChange={(event) =>
                setFloorFilter(event.target.value)
              }
              aria-label="Filter matrix by floor"
            >
              <option value="all">All divisions</option>

              {floorLocations.map((floor) => (
                <option value={floor.id} key={floor.id}>
                  {floor.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => {
              if (activeTab === 'locations') {
                openNewLocationModal()
              } else {
                openServiceModal()
              }
            }}
            disabled={
              activeTab === 'scope' && locations.length === 0
            }
          >
            {activeTab === 'locations'
              ? '+ Add location'
              : '+ Add service'}
          </button>
        </div>

        {errorMessage && (
          <div className={styles.inlineError} role="alert">
            {errorMessage}
          </div>
        )}

        {activeTab === 'locations' ? (
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
                  onClick={expandAllHierarchy}
                >
                  Expand all
                </button>

                <button
                  type="button"
                  className={styles.hierarchyUtilityButton}
                  onClick={collapseAllHierarchy}
                >
                  Collapse all
                </button>
              </div>
            </div>

            {locationHierarchy.length === 0 ? (
              <div className={styles.emptyState}>
                <h3 className={styles.emptyTitle}>
                  No location hierarchy found.
                </h3>

                <p className={styles.emptyDescription}>
                  Add a Floor and its Zones to start building the
                  location-based production structure.
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
                {locationHierarchy.map((group) => {
                  const buildingCollapsed =
                    collapsedBuildingIds.includes(group.id)

                  const totalZones = group.floors.reduce(
                    (total, floorEntry) =>
                      total + floorEntry.totalZones,
                    0
                  )

                  const totalLocations = group.floors.reduce(
                    (total, floorEntry) =>
                      total + floorEntry.totalLocations,
                    0
                  )

                  return (
                    <article
                      className={styles.buildingGroup}
                      key={group.id}
                    >
                      <div className={styles.buildingHeader}>
                        <div className={styles.hierarchyHeaderIdentity}>
                          <button
                            type="button"
                            className={styles.hierarchyChevron}
                            onClick={() => toggleBuilding(group.id)}
                            aria-label={
                              buildingCollapsed
                                ? `Expand ${group.label}`
                                : `Collapse ${group.label}`
                            }
                          >
                            {buildingCollapsed ? '›' : '⌄'}
                          </button>

                          <span className={styles.buildingIcon}>
                            ▦
                          </span>

                          <div>
                            <span className={styles.hierarchyLevelLabel}>
                              {group.building ? 'Building' : 'Project'}
                            </span>
                            <h3 className={styles.buildingName}>
                              {group.label}
                            </h3>
                          </div>
                        </div>

                        <div className={styles.hierarchyHeaderActions}>
                          <div className={styles.hierarchyStats}>
                            <span>{group.totalFloors} Divisions</span>
                            <span>{totalZones} Zones</span>
                            <span>{totalLocations} Locations</span>
                          </div>

                          {group.building && (
                            <>
                              <button
                                type="button"
                                className={styles.hierarchyTextAction}
                                onClick={() =>
                                  openEditLocationModal(group.building)
                                }
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className={styles.hierarchyTextAction}
                                onClick={() =>
                                  openNewLocationModal({
                                    parentId: group.building.id,
                                    locationType: 'floor',
                                  })
                                }
                              >
                                + Floor
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {!buildingCollapsed && (
                        <div className={styles.floorStack}>
                          {group.floors.map((floorEntry) => {
                            const { floor, zones, unassignedLocations } =
                              floorEntry

                            const floorCollapsed =
                              collapsedFloorIds.includes(floor.id)

                            return (
                              <section
                                className={styles.floorGroup}
                                key={floor.id}
                              >
                                <div className={styles.floorHeader}>
                                  <div
                                    className={styles.hierarchyHeaderIdentity}
                                  >
                                    <button
                                      type="button"
                                      className={styles.hierarchyChevron}
                                      onClick={() => toggleFloor(floor.id)}
                                      aria-label={
                                        floorCollapsed
                                          ? `Expand ${floor.name}`
                                          : `Collapse ${floor.name}`
                                      }
                                    >
                                      {floorCollapsed ? '›' : '⌄'}
                                    </button>

                                    <span className={styles.floorIcon}>
                                      ▱
                                    </span>

                                    <div>
                                      <span
                                        className={styles.hierarchyLevelLabel}
                                      >
                                        Division / Floor
                                      </span>
                                      <h4 className={styles.floorName}>
                                        {floor.name}
                                      </h4>
                                    </div>
                                  </div>

                                  <div className={styles.hierarchyHeaderActions}>
                                    <div className={styles.hierarchyStats}>
                                      <span>
                                        {floorEntry.totalZones} Zones
                                      </span>
                                      <span>
                                        {floorEntry.totalLocations} Locations
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      className={styles.hierarchyTextAction}
                                      onClick={() =>
                                        openEditLocationModal(floor)
                                      }
                                    >
                                      Edit
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
                                    {zones.map(({ zone, locations: zoneLocations, totalLocations }) => (
                                      <article
                                        className={styles.zoneCard}
                                        key={zone.id}
                                        style={{
                                          '--zone-accent': getZoneAccent(zone.name),
                                          '--zone-soft': getZoneColor(zone.name),
                                        }}
                                      >
                                        <div className={styles.zoneHeader}>
                                          <div className={styles.zoneIdentity}>
                                            <span className={styles.zoneDot} />
                                            <div>
                                              <span
                                                className={styles.hierarchyLevelLabel}
                                              >
                                                Zone
                                              </span>
                                              <strong>{zone.name}</strong>
                                            </div>
                                          </div>

                                          <div className={styles.zoneHeaderActions}>
                                            <span className={styles.zoneCount}>
                                              {totalLocations}{' '}
                                              {totalLocations === 1
                                                ? 'Location'
                                                : 'Locations'}
                                            </span>

                                            <button
                                              type="button"
                                              className={styles.zoneEditButton}
                                              onClick={() =>
                                                openEditLocationModal(zone)
                                              }
                                            >
                                              Edit
                                            </button>
                                          </div>
                                        </div>

                                        <div className={styles.zoneLocationList}>
                                          {zoneLocations.length === 0 ? (
                                            <div
                                              className={styles.zoneEmptyState}
                                            >
                                              No matching locations.
                                            </div>
                                          ) : (
                                            zoneLocations.map((location) => (
                                              <div
                                                className={styles.zoneLocationRow}
                                                key={location.id}
                                              >
                                                <div
                                                  className={
                                                    styles.zoneLocationIdentity
                                                  }
                                                >
                                                  <span
                                                    className={
                                                      styles.zoneLocationIcon
                                                    }
                                                  >
                                                    □
                                                  </span>

                                                  <div>
                                                    <strong>
                                                      {location.name}
                                                    </strong>
                                                    <span>
                                                      {location.environment_type ||
                                                        getLocationTypeLabel(
                                                          location.location_type
                                                        )}
                                                    </span>
                                                  </div>
                                                </div>

                                                <div
                                                  className={
                                                    styles.zoneLocationActions
                                                  }
                                                >
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      openEditLocationModal(
                                                        location
                                                      )
                                                    }
                                                  >
                                                    Edit
                                                  </button>

                                                  <button
                                                    type="button"
                                                    className={
                                                      styles.zoneDeleteButton
                                                    }
                                                    onClick={() =>
                                                      deleteLocation(location)
                                                    }
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

                                    {unassignedLocations.length > 0 && (
                                      <article
                                        className={`${styles.zoneCard} ${styles.unassignedZoneCard}`}
                                      >
                                        <div className={styles.zoneHeader}>
                                          <div className={styles.zoneIdentity}>
                                            <span className={styles.zoneDot} />
                                            <div>
                                              <span
                                                className={styles.hierarchyLevelLabel}
                                              >
                                                Needs classification
                                              </span>
                                              <strong>Unassigned</strong>
                                            </div>
                                          </div>

                                          <span className={styles.zoneCount}>
                                            {unassignedLocations.length}{' '}
                                            Locations
                                          </span>
                                        </div>

                                        <div className={styles.zoneLocationList}>
                                          {unassignedLocations.map((location) => (
                                            <div
                                              className={styles.zoneLocationRow}
                                              key={location.id}
                                            >
                                              <div
                                                className={
                                                  styles.zoneLocationIdentity
                                                }
                                              >
                                                <span
                                                  className={
                                                    styles.zoneLocationIcon
                                                  }
                                                >
                                                  □
                                                </span>
                                                <div>
                                                  <strong>{location.name}</strong>
                                                  <span>
                                                    {location.environment_type ||
                                                      getLocationTypeLabel(
                                                        location.location_type
                                                      )}
                                                  </span>
                                                </div>
                                              </div>

                                              <button
                                                type="button"
                                                className={styles.zoneEditButton}
                                                onClick={() =>
                                                  openEditLocationModal(location)
                                                }
                                              >
                                                Assign zone
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      </article>
                                    )}

                                    {zones.length === 0 &&
                                      unassignedLocations.length === 0 && (
                                        <div className={styles.floorEmptyState}>
                                          <strong>No zones yet.</strong>
                                          <span>
                                            Create the first production zone for
                                            {` ${floor.name}`}.
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
                          })}
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div
            className={styles.tableContainer}
            style={{
              overflowX: 'auto',
              maxHeight: '520px',
              overflowY: 'auto',
            }}
          >
            <table
              className={styles.table}
              style={{
                width: 'max-content',
                minWidth: '100%',
                borderCollapse: 'separate',
                borderSpacing: 0,
              }}
            >
              <thead
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 20,
                }}
              >
                <tr>
                  <th
                    style={{
                      minWidth: '200px',
                      position: 'sticky',
                      left: 0,
                      zIndex: 25,
                      background: '#2a4365',
                    }}
                  >
                    LOCATION
                  </th>

                  <th style={{ minWidth: '120px' }}>TYPE</th>
                  <th style={{ minWidth: '110px' }}>DIVISION</th>
                  <th style={{ minWidth: '125px' }}>
                    SUBDIVISION
                  </th>

                  {projectServices.map((service) => (
                    <th
                      key={service.id}
                      style={{
                        minWidth: '135px',
                        maxWidth: '165px',
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px',
                          alignItems: 'center',
                        }}
                      >
                        <span>
                          {service.service_name.toUpperCase()}
                        </span>

                        {service.unit && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              opacity: 0.72,
                              fontWeight: 500,
                            }}
                          >
                            {service.unit}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {matrixLocations.map((location) => {
                  const path =
                    locationPathMap.get(location.id) || []

                  const floor = path.find(
                    (pathLocation) =>
                      pathLocation.location_type === 'floor'
                  )

                  const zone = path.find(
                    (pathLocation) =>
                      pathLocation.location_type === 'zone'
                  )

                  const rowColor = getZoneColor(zone?.name)

                  return (
                    <tr
                      key={location.id}
                      style={{ backgroundColor: rowColor }}
                    >
                      <td
                        style={{
                          minWidth: '200px',
                          position: 'sticky',
                          left: 0,
                          zIndex: 10,
                          backgroundColor: rowColor,
                          fontWeight: 700,
                          borderRight: '1px solid #cbd5e0',
                        }}
                      >
                        {location.name}
                      </td>

                      <td
                        style={{
                          textAlign: 'center',
                          backgroundColor: rowColor,
                        }}
                      >
                        <span className={styles.locationTypeBadge}>
                          {location.environment_type ||
                            getLocationTypeLabel(
                              location.location_type
                            )}
                        </span>
                      </td>

                      <td
                        style={{
                          textAlign: 'center',
                          backgroundColor: rowColor,
                        }}
                      >
                        {floor?.name || '—'}
                      </td>

                      <td
                        style={{
                          textAlign: 'center',
                          fontWeight: 700,
                          backgroundColor: rowColor,
                        }}
                      >
                        {zone?.name || '—'}
                      </td>

                      {projectServices.map((service) => {
                        const cellKey =
                          `${location.id}___${service.id}`

                        const value = quantityDrafts[cellKey] ?? ''
                        const isCellSaving =
                          savingCellKey === cellKey

                        return (
                          <td
                            key={service.id}
                            style={{
                              minWidth: '135px',
                              textAlign: 'center',
                              backgroundColor: rowColor,
                            }}
                          >
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              value={value}
                              onChange={(event) => {
                                const nextValue =
                                  event.target.value

                                setQuantityDrafts(
                                  (currentDrafts) => ({
                                    ...currentDrafts,
                                    [cellKey]: nextValue,
                                  })
                                )
                              }}
                              onBlur={() =>
                                saveQuantity(
                                  location.id,
                                  service.id
                                )
                              }
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.currentTarget.blur()
                                }
                              }}
                              disabled={isCellSaving}
                              aria-label={`Quantity of ${service.service_name} at ${location.name}`}
                              style={{
                                width: '88px',
                                maxWidth: '100%',
                                padding: '7px 8px',
                                textAlign: 'center',
                                backgroundColor: isCellSaving
                                  ? '#edf2f7'
                                  : '#ffffff',
                                border: '1px solid #cbd5e0',
                                borderRadius: '6px',
                                fontSize: '0.84rem',
                                outline: 'none',
                              }}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {matrixLocations.length === 0 && (
              <div className={styles.emptyState}>
                <h3 className={styles.emptyTitle}>
                  No production locations found.
                </h3>

                <p className={styles.emptyDescription}>
                  Add Area or Room locations to build the
                  quantity matrix.
                </p>
              </div>
            )}

            {matrixLocations.length > 0 &&
              projectServices.length === 0 && (
                <div className={styles.emptyState}>
                  <h3 className={styles.emptyTitle}>
                    No services have been added.
                  </h3>

                  <p className={styles.emptyDescription}>
                    Click Add service to create the first dynamic
                    quantity column.
                  </p>
                </div>
              )}
          </div>
        )}

        <div className={styles.tableFooter}>
          <span>
            {activeTab === 'locations'
              ? filteredLocations.length
              : matrixLocations.length}{' '}
            {activeTab === 'locations'
              ? 'records shown'
              : 'locations shown'}
          </span>

          {activeTab === 'scope' && (
            <span>
              {projectServices.length}{' '}
              {projectServices.length === 1
                ? 'service column'
                : 'service columns'}
            </span>
          )}

          <span>
            Project: {selectedProject.code || selectedProject.name}
          </span>
        </div>
      </section>

      {activeTab === 'scope' && (
        <section
          className={styles.panel}
          style={{ marginTop: '28px' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
              marginBottom: showQuantification ? '18px' : 0,
            }}
          >
            <div>
              <p
                className={styles.eyebrow}
                style={{ marginBottom: '6px' }}
              >
                Quantity consolidation
              </p>

              <h2
                className={styles.panelTitle}
                style={{ margin: 0 }}
              >
                Quantification by Location
              </h2>
            </div>

            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() =>
                setShowQuantification(
                  (currentValue) => !currentValue
                )
              }
            >
              {showQuantification ? 'Hide ▲' : 'Show ▼'}
            </button>
          </div>

          {showQuantification && (
            <div
              style={{
                border: '1px solid #cbd5e0',
                borderRadius: '8px',
                overflowX: 'auto',
                background: '#ffffff',
              }}
            >
              {quantificationByDivision.length === 0 ? (
                <div className={styles.emptyState}>
                  <h3 className={styles.emptyTitle}>
                    No division totals available.
                  </h3>

                  <p className={styles.emptyDescription}>
                    Create Floor and Zone locations and enter
                    service quantities to generate this table.
                  </p>
                </div>
              ) : (
                quantificationByDivision.map(
                  ({ floor, zones, totals }) => (
                    <div
                      key={floor.id}
                      style={{
                        marginBottom: '24px',
                      }}
                    >
                      <table
                        style={{
                          width: '100%',
                          minWidth: `${Math.max(
                            680,
                            360 + zones.length * 180
                          )}px`,
                          borderCollapse: 'collapse',
                          fontSize: '0.86rem',
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              backgroundColor: '#2a4365',
                              color: '#ffffff',
                            }}
                          >
                            <th
                              style={{
                                width: '34%',
                                padding: '12px 14px',
                                border: '1px solid #1a365d',
                                textAlign: 'left',
                                fontWeight: 800,
                              }}
                            >
                              {floor.name}
                            </th>

                            <th
                              colSpan={zones.length}
                              style={{
                                padding: '12px 14px',
                                border: '1px solid #1a365d',
                                textAlign: 'center',
                                fontWeight: 800,
                                letterSpacing: '0.06em',
                              }}
                            >
                              ZONES
                            </th>
                          </tr>

                          <tr
                            style={{
                              backgroundColor: '#e2e8f0',
                              color: '#1a365d',
                            }}
                          >
                            <th
                              style={{
                                padding: '10px 14px',
                                border: '1px solid #cbd5e0',
                                textAlign: 'left',
                                fontStyle: 'italic',
                                fontWeight: 800,
                              }}
                            >
                              DESCRIPTION
                            </th>

                            {zones.map((zone) => (
                              <th
                                key={zone.id}
                                style={{
                                  padding: '10px 14px',
                                  border: '1px solid #cbd5e0',
                                  textAlign: 'center',
                                  fontWeight: 800,
                                  backgroundColor: getZoneColor(
                                    zone.name
                                  ),
                                }}
                              >
                                {zone.name}
                              </th>
                            ))}
                          </tr>
                        </thead>

                        <tbody>
                          {projectServices.map(
                            (service, serviceIndex) => (
                              <tr
                                key={service.id}
                                style={{
                                  backgroundColor:
                                    serviceIndex % 2 === 0
                                      ? '#ffffff'
                                      : '#f8fafc',
                                }}
                              >
                                <td
                                  style={{
                                    padding: '11px 14px',
                                    border: '1px solid #cbd5e0',
                                    textAlign: 'left',
                                    fontWeight: 800,
                                    color: '#1a365d',
                                  }}
                                >
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'baseline',
                                      gap: '8px',
                                      flexWrap: 'wrap',
                                    }}
                                  >
                                    <span>
                                      {service.service_name.toUpperCase()}
                                    </span>

                                    {service.unit && (
                                      <span
                                        style={{
                                          fontSize: '0.72rem',
                                          color: '#718096',
                                          fontWeight: 600,
                                        }}
                                      >
                                        {service.unit}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {zones.map((zone) => {
                                  const total =
                                    totals.get(
                                      `${service.id}___${zone.id}`
                                    ) || 0

                                  return (
                                    <td
                                      key={zone.id}
                                      style={{
                                        padding: '11px 14px',
                                        border: '1px solid #cbd5e0',
                                        textAlign: 'center',
                                        fontWeight: total > 0 ? 700 : 500,
                                        color:
                                          total > 0
                                            ? '#1a202c'
                                            : '#a0aec0',
                                        backgroundColor:
                                          total > 0
                                            ? getZoneColor(zone.name)
                                            : undefined,
                                      }}
                                    >
                                      {formatQuantity(total)}
                                    </td>
                                  )
                                })}
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  )
                )
              )}
            </div>
          )}
        </section>
      )}

      {activeTab === 'scope' && (
        <section
          className={styles.panel}
          style={{ marginTop: '28px' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
              marginBottom: showTaktPresizing ? '18px' : 0,
            }}
          >
            <div>
              <p
                className={styles.eyebrow}
                style={{ marginBottom: '6px' }}
              >
                Takt pre-sizing
              </p>

              <h2
                className={styles.panelTitle}
                style={{ margin: 0 }}
              >
                Takt Pre-dimensioning
              </h2>
            </div>

            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() =>
                setShowTaktPresizing((currentValue) => !currentValue)
              }
            >
              {showTaktPresizing ? 'Hide ▲' : 'Show ▼'}
            </button>
          </div>

          {showTaktPresizing && (
            <>
              <div
                style={{
                  marginBottom: '14px',
                  padding: '12px 14px',
                  border: '1px solid #dbe7f3',
                  borderRadius: '8px',
                  background: '#f8fbff',
                  color: '#4a5568',
                  fontSize: '0.82rem',
                  lineHeight: 1.5,
                }}
              >
                Select a productivity from the organization library, or create
                a new one, then enter the effective workforce and the Target
                Takt for each division. Zone durations are calculated as:
                Quantity ÷ (Productivity × Effective). The result remains
                decimal so imbalances are visible before planning integration.
              </div>

              <div
                style={{
                  border: '1px solid #cbd5e0',
                  borderRadius: '8px',
                  overflowX: 'auto',
                  background: '#ffffff',
                }}
              >
              {quantificationByDivision.length === 0 ? (
                <div className={styles.emptyState}>
                  <h3 className={styles.emptyTitle}>
                    No Takt pre-sizing data available.
                  </h3>
                  <p className={styles.emptyDescription}>
                    Create divisions, zones, services and quantities first.
                  </p>
                </div>
              ) : (
                quantificationByDivision.map(({ floor, zones, totals }) => (
                  <div key={floor.id} style={{ marginBottom: '24px' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        border: '1px solid #dbe7f3',
                        borderBottom: 'none',
                        background: '#f8fbff',
                      }}
                    >
                      <label
                        htmlFor={`target-takt-${floor.id}`}
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          color: '#4a5568',
                        }}
                      >
                        TARGET TAKT
                      </label>

                      <input
                        id={`target-takt-${floor.id}`}
                        type="number"
                        min="0.01"
                        step="any"
                        value={taktTargetDrafts[floor.id] ?? ''}
                        onChange={(event) =>
                          setTaktTargetDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [floor.id]: event.target.value,
                          }))
                        }
                        onBlur={() => saveDivisionTaktTarget(floor.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.currentTarget.blur()
                          }
                        }}
                        disabled={savingTaktTargetId === floor.id}
                        placeholder="Days"
                        style={{
                          width: '92px',
                          padding: '7px 8px',
                          textAlign: 'center',
                          border: '1px solid #cbd5e0',
                          borderRadius: '6px',
                          background:
                            savingTaktTargetId === floor.id
                              ? '#edf2f7'
                              : '#ffffff',
                          outline: 'none',
                          fontWeight: 700,
                        }}
                      />

                      <span
                        style={{
                          fontSize: '0.78rem',
                          color: '#718096',
                          fontWeight: 700,
                        }}
                      >
                        days
                      </span>
                    </div>

                    <table
                      style={{
                        width: '100%',
                        minWidth: `${Math.max(820, 560 + zones.length * 160)}px`,
                        borderCollapse: 'collapse',
                        fontSize: '0.86rem',
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            backgroundColor: '#2a4365',
                            color: '#ffffff',
                          }}
                        >
                          <th
                            style={{
                              width: '25%',
                              padding: '12px 14px',
                              border: '1px solid #1a365d',
                              textAlign: 'left',
                              fontWeight: 800,
                            }}
                          >
                            {floor.name}
                          </th>
                          <th
                            style={{
                              width: '15%',
                              padding: '12px 14px',
                              border: '1px solid #1a365d',
                              textAlign: 'center',
                              fontWeight: 800,
                            }}
                          >
                            PRODUCTIVITY
                          </th>
                          <th
                            colSpan={zones.length}
                            style={{
                              padding: '12px 14px',
                              border: '1px solid #1a365d',
                              textAlign: 'center',
                              fontWeight: 800,
                              letterSpacing: '0.06em',
                            }}
                          >
                            ZONES
                          </th>
                          <th
                            style={{
                              width: '15%',
                              padding: '12px 14px',
                              border: '1px solid #1a365d',
                              textAlign: 'center',
                              fontWeight: 800,
                            }}
                          >
                            EFFECTIVE
                          </th>
                        </tr>

                        <tr
                          style={{
                            backgroundColor: '#e2e8f0',
                            color: '#1a365d',
                          }}
                        >
                          <th
                            style={{
                              padding: '10px 14px',
                              border: '1px solid #cbd5e0',
                              textAlign: 'left',
                              fontStyle: 'italic',
                              fontWeight: 800,
                            }}
                          >
                            DESCRIPTION
                          </th>
                          <th style={{ border: '1px solid #cbd5e0' }} />
                          {zones.map((zone) => (
                            <th
                              key={zone.id}
                              style={{
                                padding: '10px 14px',
                                border: '1px solid #cbd5e0',
                                textAlign: 'center',
                                fontWeight: 800,
                                backgroundColor: getZoneColor(zone.name),
                              }}
                            >
                              {zone.name}
                            </th>
                          ))}
                          <th style={{ border: '1px solid #cbd5e0' }} />
                        </tr>
                      </thead>

                      <tbody>
                        {projectServices.map((service, serviceIndex) => {
                          const key = `${floor.id}___${service.id}`
                          const setup = projectProductivityMap.get(key)
                          const productivity = Number(setup?.productivity_rate) || 0
                          const effective = Number(effectiveDrafts[key]) || 0

                          return (
                            <tr
                              key={service.id}
                              style={{
                                backgroundColor:
                                  serviceIndex % 2 === 0 ? '#ffffff' : '#f8fafc',
                              }}
                            >
                              <td
                                style={{
                                  padding: '11px 14px',
                                  border: '1px solid #cbd5e0',
                                  textAlign: 'left',
                                  fontWeight: 800,
                                  color: '#1a365d',
                                }}
                              >
                                {service.service_name.toUpperCase()}
                              </td>

                              <td
                                style={{
                                  padding: '7px',
                                  border: '1px solid #cbd5e0',
                                  textAlign: 'center',
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => openProductivityModal(floor, service)}
                                  style={{
                                    minWidth: '112px',
                                    padding: '7px 10px',
                                    border: '1px solid #cbd5e0',
                                    borderRadius: '6px',
                                    background: '#ffffff',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    color: productivity > 0 ? '#1a365d' : '#718096',
                                  }}
                                >
                                  {productivity > 0
                                    ? `${formatQuantity(productivity)} ${setup?.quantity_unit || service.unit || ''}`
                                    : 'Search productivity'}
                                </button>
                              </td>

                              {zones.map((zone) => {
                                const quantity =
                                  totals.get(`${service.id}___${zone.id}`) || 0
                                const duration =
                                  quantity > 0 && productivity > 0 && effective > 0
                                    ? quantity / (productivity * effective)
                                    : 0

                                const targetTakt =
                                  Number(taktTargetDrafts[floor.id]) || 0

                                let balanceStatus = 'not_evaluated'

                                if (duration > 0 && targetTakt > 0) {
                                  if (duration <= targetTakt) {
                                    balanceStatus = 'within_target'
                                  } else if (duration <= targetTakt * 1.1) {
                                    balanceStatus = 'near_limit'
                                  } else {
                                    balanceStatus = 'above_target'
                                  }
                                }

                                const balanceStyles = {
                                  not_evaluated: {
                                    backgroundColor:
                                      duration > 0
                                        ? getZoneColor(zone.name)
                                        : undefined,
                                    color:
                                      duration > 0 ? '#2b6cb0' : '#a0aec0',
                                  },
                                  within_target: {
                                    backgroundColor: '#f0fff4',
                                    color: '#276749',
                                  },
                                  near_limit: {
                                    backgroundColor: '#fffaf0',
                                    color: '#975a16',
                                  },
                                  above_target: {
                                    backgroundColor: '#fff5f5',
                                    color: '#c53030',
                                  },
                                }

                                const balanceLabel = {
                                  not_evaluated: 'Target Takt not defined',
                                  within_target: 'Within target',
                                  near_limit: 'Near limit',
                                  above_target: 'Above target',
                                }[balanceStatus]

                                return (
                                  <td
                                    key={zone.id}
                                    style={{
                                      padding: '8px 10px',
                                      border: '1px solid #cbd5e0',
                                      textAlign: 'center',
                                      fontWeight: 800,
                                      ...balanceStyles[balanceStatus],
                                    }}
                                    title={
                                      quantity > 0
                                        ? `Quantity: ${formatQuantity(quantity)} ${service.unit || ''} · Duration: ${formatQuantity(duration)} days · ${balanceLabel}`
                                        : 'No quantity in this zone'
                                    }
                                  >
                                    {duration > 0 ? (
                                      <div
                                        style={{
                                          display: 'flex',
                                          flexDirection: 'column',
                                          alignItems: 'center',
                                          gap: '2px',
                                        }}
                                      >
                                        <span>{formatQuantity(duration)} d</span>

                                        {targetTakt > 0 && (
                                          <span
                                            style={{
                                              fontSize: '0.62rem',
                                              fontWeight: 800,
                                              textTransform: 'uppercase',
                                              letterSpacing: '0.03em',
                                              opacity: 0.85,
                                            }}
                                          >
                                            {balanceLabel}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      '0'
                                    )}
                                  </td>
                                )
                              })}

                              <td
                                style={{
                                  padding: '7px',
                                  border: '1px solid #cbd5e0',
                                  textAlign: 'center',
                                }}
                              >
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={effectiveDrafts[key] ?? ''}
                                  onChange={(event) =>
                                    setEffectiveDrafts((currentDrafts) => ({
                                      ...currentDrafts,
                                      [key]: event.target.value,
                                    }))
                                  }
                                  onBlur={() => saveEffective(floor.id, service.id)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      event.currentTarget.blur()
                                    }
                                  }}
                                  style={{
                                    width: '88px',
                                    padding: '7px 8px',
                                    textAlign: 'center',
                                    border: '1px solid #cbd5e0',
                                    borderRadius: '6px',
                                    outline: 'none',
                                  }}
                                  aria-label={`Effective workforce for ${service.service_name} on ${floor.name}`}
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
              </div>
            </>
          )}
        </section>
      )}

      {noticeMessage && (
        <div className={styles.notice} role="status">
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
            if (event.target === event.currentTarget) {
              closeLocationModal()
            }
          }}
        >
          <form className={styles.modal} onSubmit={saveLocation}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.modalEyebrow}>
                  Location structure
                </p>

                <h2 className={styles.modalTitle}>
                  {locationForm.id
                    ? 'Edit location'
                    : 'Add a new location'}
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
              Define the location level and its relationship to
              the physical production hierarchy.
            </p>

            <div className={styles.formGrid}>
              <label className={styles.formField}>
                <span>Location type</span>

                <select
                  value={locationForm.location_type}
                  onChange={(event) =>
                    setLocationForm((currentForm) => ({
                      ...currentForm,
                      location_type: event.target.value,
                    }))
                  }
                >
                  {locationTypeOptions.map((option) => (
                    <option
                      value={option.value}
                      key={option.value}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.formField}>
                <span>Location name</span>

                <input
                  type="text"
                  required
                  autoFocus
                  value={locationForm.name}
                  onChange={(event) =>
                    setLocationForm((currentForm) => ({
                      ...currentForm,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Example: East Wing"
                />
              </label>

              <label className={styles.formField}>
                <span>Parent location</span>

                <select
                  value={locationForm.parent_id}
                  onChange={(event) =>
                    setLocationForm((currentForm) => ({
                      ...currentForm,
                      parent_id: event.target.value,
                    }))
                  }
                >
                  <option value="">No parent location</option>

                  {sortedLocations
                    .filter(
                      (location) => location.id !== locationForm.id
                    )
                    .map((location) => (
                      <option
                        value={location.id}
                        key={location.id}
                      >
                        {(
                          locationPathMap.get(location.id) || []
                        )
                          .map(
                            (pathLocation) => pathLocation.name
                          )
                          .join(' / ')}
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
                    setLocationForm((currentForm) => ({
                      ...currentForm,
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
                  required
                  value={locationForm.sequence_number}
                  onChange={(event) =>
                    setLocationForm((currentForm) => ({
                      ...currentForm,
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
                {isSaving ? 'Saving...' : 'Save location'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isProductivityModalOpen && productivityTarget && (
        <div
          className={styles.modalBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeProductivityModal()
            }
          }}
        >
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.modalEyebrow}>Productivity library</p>
                <h2 className={styles.modalTitle}>
                  {productivityMode === 'select'
                    ? `Select productivity · ${productivityTarget.service.service_name}`
                    : 'Add productivity'}
                </h2>
              </div>

              <button
                type="button"
                className={styles.modalClose}
                onClick={closeProductivityModal}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            {productivityMode === 'select' ? (
              <>
                <p className={styles.modalDescription}>
                  Search the organization productivity library and select the
                  rate to use for this division and service. If the rate does
                  not exist yet, create it here and RitsuFlow will save it in
                  Supabase and apply it immediately to this project.
                </p>

                <div className={styles.searchField} style={{ marginBottom: '14px' }}>
                  <span className={styles.searchIcon} aria-hidden="true">⌕</span>
                  <input
                    type="search"
                    className={styles.searchInput}
                    value={productivitySearch}
                    onChange={(event) => setProductivitySearch(event.target.value)}
                    placeholder="Search service, code or unit..."
                    autoFocus
                  />
                </div>

                <div
                  style={{
                    maxHeight: '320px',
                    overflowY: 'auto',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                >
                  {filteredProductivityLibrary.length === 0 ? (
                    <div className={styles.emptyState} style={{ padding: '24px' }}>
                      <h3 className={styles.emptyTitle}>No productivity found.</h3>
                      <p className={styles.emptyDescription}>
                        Add the first productivity for this service.
                      </p>
                    </div>
                  ) : (
                    filteredProductivityLibrary.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => applyProductivity(item)}
                        disabled={isSaving}
                        style={{
                          width: '100%',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '16px',
                          padding: '12px 14px',
                          border: 'none',
                          borderBottom: '1px solid #e2e8f0',
                          background: '#ffffff',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span>
                          <strong style={{ display: 'block', color: '#1a365d' }}>
                            {item.service_name}
                          </strong>
                          <span style={{ fontSize: '0.78rem', color: '#718096' }}>
                            {item.service_code || 'No code'} · {item.productivity_basis}
                          </span>
                        </span>
                        <strong style={{ color: '#2b6cb0', whiteSpace: 'nowrap' }}>
                          {formatQuantity(item.productivity_rate)} {item.quantity_unit}
                        </strong>
                      </button>
                    ))
                  )}
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
                    onClick={closeProductivityModal}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => {
                      setProductivityMode('create')
                      setErrorMessage('')
                    }}
                    disabled={isSaving}
                  >
                    + Add new productivity
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={createProductivity}>
                <p className={styles.modalDescription}>
                  Save this productivity to the organization library so it can
                  be reused in future projects.
                </p>

                <div className={styles.formGrid}>
                  <label className={`${styles.formField} ${styles.formFieldFull}`}>
                    <span>Service name</span>
                    <input
                      type="text"
                      required
                      value={productivityForm.service_name}
                      onChange={(event) =>
                        setProductivityForm((currentForm) => ({
                          ...currentForm,
                          service_name: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className={styles.formField}>
                    <span>Service code</span>
                    <input
                      type="text"
                      value={productivityForm.service_code}
                      onChange={(event) =>
                        setProductivityForm((currentForm) => ({
                          ...currentForm,
                          service_code: event.target.value.toUpperCase(),
                        }))
                      }
                    />
                  </label>

                  <label className={styles.formField}>
                    <span>Quantity unit</span>
                    <input
                      type="text"
                      required
                      value={productivityForm.quantity_unit}
                      onChange={(event) =>
                        setProductivityForm((currentForm) => ({
                          ...currentForm,
                          quantity_unit: event.target.value,
                        }))
                      }
                      placeholder="Example: m²"
                    />
                  </label>

                  <label className={styles.formField}>
                    <span>Productivity</span>
                    <input
                      type="number"
                      min="0.0001"
                      step="any"
                      required
                      value={productivityForm.productivity_rate}
                      onChange={(event) =>
                        setProductivityForm((currentForm) => ({
                          ...currentForm,
                          productivity_rate: event.target.value,
                        }))
                      }
                      placeholder="Example: 18"
                    />
                  </label>

                  <label className={styles.formField}>
                    <span>Productivity basis</span>
                    <select
                      value={productivityForm.productivity_basis}
                      onChange={(event) =>
                        setProductivityForm((currentForm) => ({
                          ...currentForm,
                          productivity_basis: event.target.value,
                        }))
                      }
                    >
                      <option value="worker_day">Per worker-day</option>
                      <option value="crew_day">Per crew-day</option>
                      <option value="worker_hour">Per worker-hour</option>
                      <option value="crew_hour">Per crew-hour</option>
                    </select>
                  </label>

                  <label className={`${styles.formField} ${styles.formFieldFull}`}>
                    <span>Description / notes</span>
                    <input
                      type="text"
                      value={productivityForm.description}
                      onChange={(event) =>
                        setProductivityForm((currentForm) => ({
                          ...currentForm,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Optional context for this productivity"
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
                    onClick={() => {
                      setProductivityMode('select')
                      setErrorMessage('')
                    }}
                    disabled={isSaving}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className={styles.primaryButton}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save and use productivity'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {isServiceModalOpen && (
        <div
          className={styles.modalBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeServiceModal()
            }
          }}
        >
          <form className={styles.modal} onSubmit={saveService}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.modalEyebrow}>
                  Production scope
                </p>

                <h2 className={styles.modalTitle}>
                  Add service column
                </h2>
              </div>

              <button
                type="button"
                className={styles.modalClose}
                onClick={closeServiceModal}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <p className={styles.modalDescription}>
              Create a service once and use it as a quantity
              column across every production location in the
              project.
            </p>

            <div className={styles.formGrid}>
              <label
                className={`${styles.formField} ${styles.formFieldFull}`}
              >
                <span>Service name</span>

                <input
                  type="text"
                  required
                  autoFocus
                  value={serviceForm.service_name}
                  onChange={(event) => {
                    const nextName = event.target.value

                    setServiceForm((currentForm) => ({
                      ...currentForm,
                      service_name: nextName,
                      service_code: serviceCodeWasEdited
                        ? currentForm.service_code
                        : createServiceCode(
                            nextName,
                            projectServices
                          ),
                    }))
                  }}
                  placeholder="Example: Drywall"
                />
              </label>

              <label className={styles.formField}>
                <span>Service code</span>

                <input
                  type="text"
                  value={serviceForm.service_code}
                  onChange={(event) => {
                    setServiceCodeWasEdited(true)

                    setServiceForm((currentForm) => ({
                      ...currentForm,
                      service_code: normalizeServiceCode(
                        event.target.value
                      ),
                    }))
                  }}
                  placeholder="Example: DRYWALL"
                />
              </label>

              <label className={styles.formField}>
                <span>Unit</span>

                <select
                  value={serviceForm.unit}
                  onChange={(event) =>
                    setServiceForm((currentForm) => ({
                      ...currentForm,
                      unit: event.target.value,
                      custom_unit:
                        event.target.value === 'OTHER'
                          ? currentForm.custom_unit
                          : '',
                    }))
                  }
                >
                  {unitOptions.map((unit) => (
                    <option value={unit} key={unit}>
                      {unit === 'OTHER' ? 'Other...' : unit}
                    </option>
                  ))}
                </select>
              </label>

              {serviceForm.unit === 'OTHER' && (
                <label className={styles.formField}>
                  <span>Custom unit</span>

                  <input
                    type="text"
                    required
                    maxLength={20}
                    value={serviceForm.custom_unit}
                    onChange={(event) =>
                      setServiceForm((currentForm) => ({
                        ...currentForm,
                        custom_unit: event.target.value,
                      }))
                    }
                    placeholder="Example: box"
                  />
                </label>
              )}
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
                onClick={closeServiceModal}
                disabled={isSaving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className={styles.primaryButton}
                disabled={isSaving}
              >
                {isSaving ? 'Adding...' : 'Add service'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
