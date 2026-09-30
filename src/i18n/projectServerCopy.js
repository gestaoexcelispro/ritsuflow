import { projectCopy, projectStatusLabels, projectText } from './projects'
import { resolveOrganizationLocale } from './serverLocale'

const SETUP_SECTION_KEYS = [
  { id: 'general', number: '01', labelKey: 'general', descriptionKey: 'generalDescription' },
  { id: 'scope', number: '02', labelKey: 'scope', descriptionKey: 'scopeDescription' },
  { id: 'locations', number: '03', labelKey: 'locations', descriptionKey: 'locationsDescription' },
  { id: 'allocation', number: '04', labelKey: 'allocation', descriptionKey: 'allocationDescription' },
  { id: 'production', number: '05', labelKey: 'productionParameters', descriptionKey: 'productionDescription' },
]

const ALLOCATION_STATUS_KEYS = {
  quantity_missing: 'quantityMissing',
  not_allocated: 'notAllocated',
  partially_allocated: 'partiallyAllocated',
  fully_allocated: 'fullyAllocated',
  overallocated: 'overallocated',
}

export async function resolveProjectCopy(supabase, userId) {
  const locale = await resolveOrganizationLocale(supabase, userId)
  const copy = projectCopy(locale)
  const text = (key, vars = {}) => projectText(locale, key, vars)
  const formatNumber = (value, options = {}) => new Intl.NumberFormat(locale, options).format(value)

  return {
    locale,
    copy,
    statusLabels: projectStatusLabels(locale),
    text,
    formatNumber,
    formatCurrency: (value, currency = 'USD') => new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(value),
    formatDate: (value, options = {}) => {
      if (!value) return '—'
      const date = value instanceof Date ? value : new Date(value)
      if (Number.isNaN(date.getTime())) return String(value)
      return new Intl.DateTimeFormat(locale, options).format(date)
    },
    formatQuantity: (value) => {
      if (value === null || value === undefined || value === '') return '—'
      const numericValue = Number(value)
      if (!Number.isFinite(numericValue)) return String(value)
      return formatNumber(numericValue, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    },
    formatProjectCount: (count) => {
      const key = Number(count) === 1 ? 'projectCountOne' : 'projectCountMany'
      return text(key, { count })
    },
    formatLocation: (project) => {
      const locationParts = [project?.city, project?.state_region].filter(Boolean)
      if (locationParts.length) return locationParts.join(', ')
      return project?.country_code || text('locationNotSpecified')
    },
    setupSections: SETUP_SECTION_KEYS.map(section => ({
      id: section.id,
      number: section.number,
      label: text(section.labelKey),
      description: text(section.descriptionKey),
    })),
    allocationStatusLabel: (status) => {
      const key = ALLOCATION_STATUS_KEYS[status]
      return key ? text(key) : text('notEvaluated')
    },
  }
}
