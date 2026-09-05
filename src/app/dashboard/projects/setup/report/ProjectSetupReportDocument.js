import React from 'react'

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'

const NAVY = '#0B2E4F'
const TEAL = '#00998B'
const TEXT = '#263C4D'
const MUTED = '#6C7C88'
const BORDER = '#D9E3EA'
const SOFT = '#F4F7F9'
const SUCCESS = '#E9F7F1'
const WARNING = '#FFF7E3'
const DANGER = '#FDECEC'

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 36,
    paddingHorizontal: 32,
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: TEXT,
    backgroundColor: '#FFFFFF',
  },
  landscapePage: {
    paddingTop: 30,
    paddingBottom: 34,
    paddingHorizontal: 28,
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: TEXT,
    backgroundColor: '#FFFFFF',
  },
  coverPage: {
    padding: 0,
    fontFamily: 'Helvetica',
    color: TEXT,
    backgroundColor: '#FFFFFF',
  },
  topBrand: {
    position: 'absolute',
    top: 22,
    left: 32,
    right: 32,
    height: 35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    width: 96,
    height: 32,
    objectFit: 'contain',
  },
  coverTitleBlock: {
    marginTop: 78,
    paddingHorizontal: 38,
  },
  coverEyebrow: {
    fontSize: 9,
    color: TEAL,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  coverTitle: {
    marginTop: 7,
    fontSize: 27,
    lineHeight: 1.05,
    color: NAVY,
    fontWeight: 700,
  },
  coverImage: {
    marginTop: 22,
    width: '100%',
    height: 300,
    objectFit: 'cover',
  },
  coverPlaceholder: {
    marginTop: 22,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SOFT,
    color: MUTED,
  },
  coverIdentity: {
    marginTop: 0,
    paddingHorizontal: 38,
    paddingVertical: 22,
    backgroundColor: NAVY,
  },
  coverProjectName: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 1.15,
    fontWeight: 700,
  },
  coverProjectCode: {
    marginTop: 5,
    color: '#B9D8EA',
    fontSize: 10,
    fontWeight: 700,
  },
  coverMeta: {
    paddingHorizontal: 38,
    paddingTop: 20,
    flexDirection: 'row',
    gap: 35,
  },
  coverMetaBlock: {
    flexGrow: 1,
  },
  label: {
    color: TEAL,
    fontSize: 7,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  value: {
    marginTop: 4,
    color: NAVY,
    fontSize: 9,
    lineHeight: 1.35,
  },
  pageHeader: {
    marginBottom: 18,
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageHeaderLogo: {
    width: 74,
    height: 25,
    objectFit: 'contain',
  },
  pageHeaderRight: {
    alignItems: 'flex-end',
  },
  pageHeaderTitle: {
    color: NAVY,
    fontSize: 7.5,
    fontWeight: 700,
  },
  pageHeaderCode: {
    marginTop: 2,
    color: MUTED,
    fontSize: 6.8,
  },
  sectionTitle: {
    marginBottom: 5,
    color: NAVY,
    fontSize: 18,
    fontWeight: 700,
  },
  sectionSubtitle: {
    marginBottom: 16,
    color: MUTED,
    fontSize: 8.5,
    lineHeight: 1.4,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  infoCard: {
    width: '50%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  infoCardInner: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 3,
    overflow: 'hidden',
  },
  infoCardTitle: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    color: NAVY,
    backgroundColor: SOFT,
    fontSize: 8,
    fontWeight: 700,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#EBF0F3',
  },
  infoRowLabel: {
    width: '38%',
    color: MUTED,
    fontSize: 7,
  },
  infoRowValue: {
    width: '62%',
    color: TEXT,
    fontSize: 7.2,
  },
  projectImageSection: {
    marginTop: 10,
  },
  projectImage: {
    marginTop: 7,
    width: '100%',
    height: 150,
    objectFit: 'cover',
  },
  table: {
    borderWidth: 1,
    borderColor: BORDER,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#EAF0F4',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E9EEF2',
    minHeight: 23,
  },
  tableRowAlt: {
    backgroundColor: '#FAFBFC',
  },
  cell: {
    paddingVertical: 5,
    paddingHorizontal: 5,
    justifyContent: 'center',
  },
  headerCellText: {
    color: NAVY,
    fontSize: 6.7,
    fontWeight: 700,
    lineHeight: 1.15,
  },
  cellText: {
    color: TEXT,
    fontSize: 6.7,
    lineHeight: 1.2,
  },
  mutedText: {
    color: MUTED,
  },
  totalRow: {
    backgroundColor: '#EAF0F4',
    fontWeight: 700,
  },
  treeRow: {
    flexDirection: 'row',
    minHeight: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E9EEF2',
  },
  treeName: {
    width: '64%',
    paddingVertical: 5,
    paddingRight: 5,
  },
  treeType: {
    width: '18%',
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  treeCode: {
    width: '18%',
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 8,
    fontSize: 5.8,
    textAlign: 'center',
  },
  badgeSuccess: {
    backgroundColor: SUCCESS,
    color: '#24724D',
  },
  badgeWarning: {
    backgroundColor: WARNING,
    color: '#996E16',
  },
  badgeDanger: {
    backgroundColor: DANGER,
    color: '#A74747',
  },
  footer: {
    position: 'absolute',
    bottom: 15,
    left: 32,
    right: 32,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    flexDirection: 'row',
    justifyContent: 'space-between',
    color: MUTED,
    fontSize: 6.2,
  },
  footerLandscape: {
    position: 'absolute',
    bottom: 13,
    left: 28,
    right: 28,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    flexDirection: 'row',
    justifyContent: 'space-between',
    color: MUTED,
    fontSize: 5.8,
  },
  noData: {
    paddingVertical: 18,
    paddingHorizontal: 12,
    color: MUTED,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SOFT,
  },
  matrixLocation: {
    width: 125,
    flexShrink: 0,
  },
  matrixType: {
    width: 56,
    flexShrink: 0,
  },
  matrixScope: {
    width: 78,
    flexShrink: 0,
  },
  quantLocation: {
    width: '46%',
  },
  quantType: {
    width: '17%',
  },
  quantQuantity: {
    width: '37%',
    textAlign: 'right',
  },
  scopeSummaryRow: {
    flexDirection: 'row',
    marginHorizontal: -3,
    marginBottom: 12,
  },
  scopeSummaryCard: {
    width: '25%',
    paddingHorizontal: 3,
  },
  scopeSummaryCardInner: {
    minHeight: 58,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  scopeSummaryLabel: {
    color: MUTED,
    fontSize: 5.8,
    fontWeight: 700,
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  scopeSummaryDescription: {
    marginTop: 3,
    color: MUTED,
    fontSize: 5.4,
  },
  scopeSummaryValue: {
    marginTop: 7,
    color: NAVY,
    fontSize: 14,
    fontWeight: 700,
    textAlign: 'right',
  },
  scopeReadinessCard: {
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scopeReadinessLeft: {
    width: '75%',
  },
  scopeReadinessTitle: {
    marginTop: 3,
    color: NAVY,
    fontSize: 9,
    fontWeight: 700,
  },
  scopeReadyBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: SUCCESS,
    color: '#24724D',
    fontSize: 5.8,
    fontWeight: 700,
  },
  scopeIncompleteBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: WARNING,
    color: '#996E16',
    fontSize: 5.8,
    fontWeight: 700,
  },
  scopePackageCard: {
    marginBottom: 9,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  scopePackageHeader: {
    paddingVertical: 8,
    paddingHorizontal: 9,
    backgroundColor: SOFT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scopePackageIdentity: {
    width: '57%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  scopePackageIndex: {
    width: 24,
    height: 24,
    marginRight: 8,
    borderRadius: 4,
    backgroundColor: '#EAF0F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopePackageIndexText: {
    color: NAVY,
    fontSize: 6.5,
    fontWeight: 700,
  },
  scopePackageCode: {
    color: TEAL,
    fontSize: 6,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  scopePackageName: {
    marginTop: 2,
    color: NAVY,
    fontSize: 9,
    fontWeight: 700,
  },
  scopePackageMeta: {
    width: '43%',
    alignItems: 'flex-end',
  },
  scopePackageMetaText: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 9,
    backgroundColor: '#EEF4F7',
    color: NAVY,
    fontSize: 5.6,
    fontWeight: 700,
  },
  scopeTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFB',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  scopeTableRow: {
    flexDirection: 'row',
    minHeight: 28,
    borderBottomWidth: 1,
    borderBottomColor: '#E9EEF2',
  },
  scopeIdCell: {
    width: '8%',
  },
  scopeItemCell: {
    width: '34%',
  },
  scopeUnitCell: {
    width: '9%',
  },
  scopeQuantityCell: {
    width: '14%',
    textAlign: 'right',
  },
  scopeUnitCostCell: {
    width: '14%',
    textAlign: 'right',
  },
  scopeTotalCostCell: {
    width: '15%',
    textAlign: 'right',
  },
  scopeStatusCell: {
    width: '6%',
    alignItems: 'center',
  },
  scopeStatusDotComplete: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#24724D',
  },
  scopeStatusDotIncomplete: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#996E16',
  },
  locationSummaryRow: {
    flexDirection: 'row',
    marginHorizontal: -3,
    marginBottom: 12,
  },
  locationSummaryCard: {
    width: '25%',
    paddingHorizontal: 3,
  },
  locationSummaryCardInner: {
    minHeight: 58,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  locationSummaryLabel: {
    color: MUTED,
    fontSize: 5.8,
    fontWeight: 700,
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  locationSummaryDescription: {
    marginTop: 3,
    color: MUTED,
    fontSize: 5.4,
  },
  locationSummaryValue: {
    marginTop: 7,
    color: NAVY,
    fontSize: 16,
    fontWeight: 700,
    textAlign: 'right',
  },
  locationProjectCard: {
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationProjectIdentity: {
    width: '66%',
  },
  locationEyebrow: {
    color: MUTED,
    fontSize: 5.8,
    fontWeight: 700,
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  locationProjectName: {
    marginTop: 3,
    color: NAVY,
    fontSize: 10,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  locationBadgeRow: {
    width: '34%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  locationCountBadge: {
    marginLeft: 4,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 9,
    backgroundColor: '#EEF4F7',
    color: NAVY,
    fontSize: 5.6,
    fontWeight: 700,
  },
  locationDivisionCard: {
    marginBottom: 9,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  locationDivisionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 9,
    backgroundColor: SOFT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationDivisionIdentity: {
    width: '62%',
  },
  locationDivisionName: {
    marginTop: 2,
    color: NAVY,
    fontSize: 9.5,
    fontWeight: 700,
  },
  locationZoneRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 7,
    marginHorizontal: -3,
  },
  locationZoneColumn: {
    paddingHorizontal: 3,
  },
  locationZoneCard: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  locationZoneHeader: {
    paddingVertical: 6,
    paddingHorizontal: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#E9EEF2',
  },
  locationZoneName: {
    marginTop: 2,
    color: NAVY,
    fontSize: 8,
    fontWeight: 700,
  },
  locationZoneBody: {
    paddingVertical: 7,
    paddingHorizontal: 7,
  },
  locationChildText: {
    color: TEXT,
    fontSize: 5.8,
    lineHeight: 1.35,
  },
  locationEmptyText: {
    color: MUTED,
    fontSize: 5.6,
    textAlign: 'center',
  },
})

function safe(value, fallback = '—') {
  if (value === null || value === undefined || value === '') {
    return fallback
  }

  return String(value)
}

function number(value, digits = 2) {
  const numeric = Number(value)

  if (!Number.isFinite(numeric)) {
    return '—'
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(numeric)
}

function money(value, currency = 'USD') {
  const numeric = Number(value)

  if (!Number.isFinite(numeric)) {
    return '—'
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(numeric)
  } catch {
    return `${currency || 'USD'} ${number(numeric, 2)}`
  }
}

function date(value) {
  if (!value) {
    return '—'
  }

  const parsed = new Date(`${value}T00:00:00`)

  if (Number.isNaN(parsed.getTime())) {
    return safe(value)
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed)
}

function generatedDate(value) {
  const parsed = value ? new Date(value) : new Date()

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed)
}

function statusLabel(value) {
  const labels = {
    planning: 'Planning',
    active: 'Active',
    on_hold: 'On Hold',
    completed: 'Completed',
    archived: 'Archived',
  }

  return labels[value] || safe(value)
}

function locationType(value) {
  const labels = {
    project: 'Project',
    building: 'Building',
    floor: 'Level',
    division: 'Level',
    zone: 'Zone',
    area: 'Area',
    room: 'Room',
    custom: 'Custom',
  }

  return labels[value] || safe(value)
}

function PageHeader({ logo, reportTitle, project }) {
  return (
    <View style={styles.pageHeader} fixed>
      {logo ? (
        <Image src={logo} style={styles.pageHeaderLogo} />
      ) : (
        <Text style={{ color: NAVY, fontSize: 12, fontWeight: 700 }}>
          RitsuFlow
        </Text>
      )}

      <View style={styles.pageHeaderRight}>
        <Text style={styles.pageHeaderTitle}>{reportTitle}</Text>
        <Text style={styles.pageHeaderCode}>
          {safe(project?.code, 'PROJECT')}
        </Text>
      </View>
    </View>
  )
}

function Footer({ landscape = false }) {
  return (
    <View
      style={landscape ? styles.footerLandscape : styles.footer}
      fixed
    >
      <Text>RitsuFlow™ · Location- and Flow-Based Construction Planning</Text>

      <Text
        render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  )
}

function StandardPage({
  children,
  logo,
  reportTitle,
  project,
  landscape = false,
}) {
  return (
    <Page
      size="A4"
      orientation={landscape ? 'landscape' : 'portrait'}
      style={landscape ? styles.landscapePage : styles.page}
    >
      <PageHeader
        logo={logo}
        reportTitle={reportTitle}
        project={project}
      />

      {children}

      <Footer landscape={landscape} />
    </Page>
  )
}

function SectionHeading({ number: sectionNumber, title, subtitle }) {
  return (
    <>
      <Text style={styles.sectionTitle}>
        {sectionNumber ? `${sectionNumber}. ` : ''}
        {title}
      </Text>

      {subtitle ? (
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      ) : null}
    </>
  )
}

function InfoCard({ title, rows }) {
  return (
    <View style={styles.infoCard}>
      <View style={styles.infoCardInner}>
        <Text style={styles.infoCardTitle}>{title}</Text>

        {rows.map((row, index) => (
          <View style={styles.infoRow} key={`${row[0]}-${index}`}>
            <Text style={styles.infoRowLabel}>{row[0]}</Text>
            <Text style={styles.infoRowValue}>{safe(row[1])}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function GenericTable({
  columns,
  rows,
  totalRow,
}) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader} fixed>
        {columns.map((column) => (
          <View
            key={column.key}
            style={[
              styles.cell,
              {
                width: column.width,
                textAlign: column.align || 'left',
              },
            ]}
          >
            <Text style={styles.headerCellText}>{column.label}</Text>
          </View>
        ))}
      </View>

      {rows.map((row, rowIndex) => (
        <View
          key={row.key || rowIndex}
          wrap={false}
          style={[
            styles.tableRow,
            rowIndex % 2 === 1 ? styles.tableRowAlt : null,
          ]}
        >
          {columns.map((column) => (
            <View
              key={column.key}
              style={[
                styles.cell,
                {
                  width: column.width,
                  textAlign: column.align || 'left',
                },
              ]}
            >
              <Text style={styles.cellText}>
                {safe(row[column.key])}
              </Text>
            </View>
          ))}
        </View>
      ))}

      {totalRow ? (
        <View style={[styles.tableRow, styles.totalRow]} wrap={false}>
          {columns.map((column) => (
            <View
              key={column.key}
              style={[
                styles.cell,
                {
                  width: column.width,
                  textAlign: column.align || 'left',
                },
              ]}
            >
              <Text style={styles.cellText}>
                {safe(totalRow[column.key])}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

function buildLocationMap(locations) {
  return new Map(
    (locations || []).map((location) => [location.id, location])
  )
}

function buildLocationDepth(location, locationMap) {
  let depth = 0
  let cursor = location
  const visited = new Set()

  while (cursor?.parent_id && !visited.has(cursor.parent_id)) {
    visited.add(cursor.parent_id)
    depth += 1
    cursor = locationMap.get(cursor.parent_id)
  }

  return depth
}

function buildLocationPath(location, locationMap) {
  const names = []
  let cursor = location
  const visited = new Set()

  while (cursor && !visited.has(cursor.id)) {
    visited.add(cursor.id)
    names.unshift(cursor.name)
    cursor = cursor.parent_id
      ? locationMap.get(cursor.parent_id)
      : null
  }

  return names.join(' / ')
}

function allocationStatus(scopeQuantity, allocatedQuantity) {
  if (scopeQuantity === null || scopeQuantity === undefined) {
    return 'Quantity missing'
  }

  const scope = Number(scopeQuantity)
  const allocated = Number(allocatedQuantity || 0)

  if (Math.abs(scope - allocated) <= 0.000001) {
    return 'Complete'
  }

  if (allocated === 0) {
    return 'Not allocated'
  }

  if (allocated < scope) {
    return 'Partial'
  }

  return 'Overallocated'
}

function statusBadgeStyle(status) {
  if (status === 'Complete') {
    return [styles.badge, styles.badgeSuccess]
  }

  if (status === 'Overallocated') {
    return [styles.badge, styles.badgeDanger]
  }

  return [styles.badge, styles.badgeWarning]
}

function splitIntoChunks(items, size) {
  const chunks = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

export default function ProjectSetupReportDocument({
  reportTitle = 'Project Setup Report',
  sections = {},
  project,
  organization,
  workPackages = [],
  scopeItems = [],
  locations = [],
  allocations = [],
  productionParameters = [],
  logoDataUri = '',
  coverDataUri = '',
  generatedAt,
}) {
  const activeWorkPackages = workPackages.filter(
    (workPackage) => workPackage.is_active !== false
  )

  const activeScopeItems = scopeItems.filter(
    (scopeItem) => scopeItem.is_active !== false
  )

  const workPackageMap = new Map(
    activeWorkPackages.map((workPackage) => [
      workPackage.id,
      workPackage,
    ])
  )

  const scopeItemMap = new Map(
    activeScopeItems.map((scopeItem) => [
      scopeItem.id,
      scopeItem,
    ])
  )

  const locationMap = buildLocationMap(locations)

  const allocatedByScopeItem = new Map()

  allocations.forEach((allocation) => {
    allocatedByScopeItem.set(
      allocation.service_id,
      (allocatedByScopeItem.get(allocation.service_id) || 0) +
        Number(allocation.quantity || 0)
    )
  })

  const allocationMap = new Map(
    allocations.map((allocation) => [
      `${allocation.location_id}___${allocation.service_id}`,
      Number(allocation.quantity || 0),
    ])
  )

  const productionMap = new Map(
    productionParameters.map((parameter) => [
      parameter.service_id,
      parameter,
    ])
  )

  const locationQuantityTotals = new Map()

  allocations.forEach((allocation) => {
    locationQuantityTotals.set(
      allocation.location_id,
      (locationQuantityTotals.get(allocation.location_id) || 0) +
        Number(allocation.quantity || 0)
    )
  })

  const orderedLocations = [...locations].sort((a, b) => {
    const depthDifference =
      buildLocationDepth(a, locationMap) -
      buildLocationDepth(b, locationMap)

    if (depthDifference !== 0) {
      return depthDifference
    }

    return (
      Number(a.sequence_number || 0) -
        Number(b.sequence_number || 0) ||
      safe(a.name).localeCompare(safe(b.name))
    )
  })

  const productionLocations = orderedLocations.filter((location) => {
    const children = locations.filter(
      (candidate) => candidate.parent_id === location.id
    )

    return children.length === 0
  })

  const matrixScopeChunks = splitIntoChunks(activeScopeItems, 5)

  const scopeRows = activeScopeItems.map((scopeItem) => {
    const workPackage = workPackageMap.get(
      scopeItem.project_work_package_id
    )

    return {
      key: scopeItem.id,
      workPackage: workPackage?.code || '—',
      scopeItem: scopeItem.service_name,
      unit: scopeItem.unit,
      quantity: number(scopeItem.scope_quantity),
      unitCost: money(
        scopeItem.unit_cost,
        project?.currency_code || 'USD'
      ),
    }
  })

  const scopeItemsAssigned = activeScopeItems.filter(
    (scopeItem) =>
      scopeItem.project_work_package_id &&
      workPackageMap.has(scopeItem.project_work_package_id)
  ).length

  const scopeCost = activeScopeItems.reduce((total, scopeItem) => {
    const quantity = Number(scopeItem.scope_quantity)
    const unitCost = Number(scopeItem.unit_cost)

    if (!Number.isFinite(quantity) || !Number.isFinite(unitCost)) {
      return total
    }

    return total + quantity * unitCost
  }, 0)

  const scopeItemIsComplete = (scopeItem) => {
    const quantity = Number(scopeItem.scope_quantity)
    const unitCost = Number(scopeItem.unit_cost)

    return Boolean(
      scopeItem.project_work_package_id &&
        scopeItem.service_name &&
        scopeItem.unit &&
        Number.isFinite(quantity) &&
        quantity >= 0 &&
        Number.isFinite(unitCost) &&
        unitCost >= 0
    )
  }

  const completedScopeItems = activeScopeItems.filter(scopeItemIsComplete).length
  const scopeDefinitionComplete =
    activeScopeItems.length > 0 &&
    completedScopeItems === activeScopeItems.length &&
    scopeItemsAssigned === activeScopeItems.length

  const projectScopePackages = activeWorkPackages
    .map((workPackage) => {
      const packageScopeItems = activeScopeItems.filter(
        (scopeItem) =>
          scopeItem.project_work_package_id === workPackage.id
      )

      const packageCost = packageScopeItems.reduce((total, scopeItem) => {
        const quantity = Number(scopeItem.scope_quantity)
        const unitCost = Number(scopeItem.unit_cost)

        if (!Number.isFinite(quantity) || !Number.isFinite(unitCost)) {
          return total
        }

        return total + quantity * unitCost
      }, 0)

      return {
        workPackage,
        scopeItems: packageScopeItems,
        packageCost,
      }
    })
    .filter((entry) => entry.scopeItems.length > 0)

  const reconciliationRows = activeScopeItems.map((scopeItem) => {
    const allocated = allocatedByScopeItem.get(scopeItem.id) || 0
    const scope =
      scopeItem.scope_quantity === null ||
      scopeItem.scope_quantity === undefined
        ? null
        : Number(scopeItem.scope_quantity)

    const remaining = scope === null ? null : scope - allocated
    const percentage =
      scope === null || scope === 0 ? null : (allocated / scope) * 100

    return {
      scopeItem,
      workPackage:
        workPackageMap.get(scopeItem.project_work_package_id)?.code ||
        '—',
      allocated,
      scope,
      remaining,
      percentage,
      status: allocationStatus(scope, allocated),
    }
  })

  return (
    <Document
      title={reportTitle}
      author="RitsuFlow"
      subject={`Project Setup Report - ${safe(project?.code)}`}
      creator="RitsuFlow"
    >
      {sections.cover && (
        <Page size="A4" style={styles.coverPage}>
          <View style={styles.topBrand}>
            {logoDataUri ? (
              <Image src={logoDataUri} style={styles.logo} />
            ) : (
              <Text style={{ color: NAVY, fontSize: 17, fontWeight: 700 }}>
                RitsuFlow
              </Text>
            )}

            <Text
              style={{
                color: MUTED,
                fontSize: 7,
                letterSpacing: 1,
              }}
            >
              PLAN. MAKE READY. FLOW.
            </Text>
          </View>

          <View style={styles.coverTitleBlock}>
            <Text style={styles.coverEyebrow}>Project Definition</Text>
            <Text style={styles.coverTitle}>{reportTitle}</Text>
          </View>

          {coverDataUri ? (
            <Image src={coverDataUri} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Text>Project cover image not available</Text>
            </View>
          )}

          <View style={styles.coverIdentity}>
            <Text style={styles.coverProjectName}>
              {safe(project?.name, 'Project')}
            </Text>

            <Text style={styles.coverProjectCode}>
              {safe(project?.code, 'PROJECT')}
            </Text>
          </View>

          <View style={styles.coverMeta}>
            <View style={styles.coverMetaBlock}>
              <Text style={styles.label}>Client</Text>
              <Text style={styles.value}>
                {safe(project?.client_name)}
              </Text>
            </View>

            <View style={styles.coverMetaBlock}>
              <Text style={styles.label}>Report Date</Text>
              <Text style={styles.value}>
                {generatedDate(generatedAt)}
              </Text>
            </View>
          </View>

          <Footer />
        </Page>
      )}

      {sections.basicInformation && (
        <StandardPage
          logo={logoDataUri}
          reportTitle={reportTitle}
          project={project}
        >
          <SectionHeading
            number="1"
            title="Project Basic Information"
            subtitle="Project identity, contractual information, planning boundaries, and geographic reference."
          />

          <View style={styles.infoGrid}>
            <InfoCard
              title="Project Identification"
              rows={[
                ['Project Name', project?.name],
                ['Project Code', project?.code],
                ['Client', project?.client_name],
                ['Status', statusLabel(project?.status)],
                ['Organization', organization?.name],
              ]}
            />

            <InfoCard
              title="Contract Information"
              rows={[
                ['Proposal', project?.proposal_number],
                ['Contract', project?.contract_number],
                [
                  'Contract Value',
                  money(
                    project?.contract_value,
                    project?.currency_code || 'USD'
                  ),
                ],
                ['Currency', project?.currency_code],
              ]}
            />

            <InfoCard
              title="Key Dates"
              rows={[
                ['Planned Start', date(project?.planned_start_date)],
                ['Planned Finish', date(project?.planned_finish_date)],
                ['Report Date', generatedDate(generatedAt)],
              ]}
            />

            <InfoCard
              title="Location"
              rows={[
                ['Address', project?.address_line],
                ['Neighborhood', project?.neighborhood],
                [
                  'City / State',
                  [project?.city, project?.state_region]
                    .filter(Boolean)
                    .join(', '),
                ],
                ['Postal Code', project?.postal_code],
                ['Country', project?.country_code],
                [
                  'Coordinates',
                  project?.latitude && project?.longitude
                    ? `${project.latitude}, ${project.longitude}`
                    : '—',
                ],
                [
                  'Geofence',
                  project?.geofence_enabled
                    ? `${number(project?.geofence_radius_m)} m`
                    : 'Disabled',
                ],
                [
                  'Max GPS Accuracy',
                  project?.max_gps_accuracy_m
                    ? `${number(project.max_gps_accuracy_m)} m`
                    : '—',
                ],
              ]}
            />
          </View>

          <View style={styles.projectImageSection}>
            <Text style={styles.infoCardTitle}>Project Image</Text>

            {coverDataUri ? (
              <Image src={coverDataUri} style={styles.projectImage} />
            ) : (
              <View style={styles.noData}>
                <Text>No project cover image is configured.</Text>
              </View>
            )}
          </View>
        </StandardPage>
      )}

      {sections.scopeSummary && (
        <StandardPage
          logo={logoDataUri}
          reportTitle={reportTitle}
          project={project}
        >
          <SectionHeading
            number="2"
            title="Project Scope"
            subtitle="Work Packages and Scope Items defining the project Scope Breakdown Structure, quantities, and cost basis."
          />

          <View style={styles.scopeSummaryRow}>
            {[
              [
                'Work Packages',
                'Active scope groups',
                activeWorkPackages.length,
              ],
              [
                'Scope Items',
                'Project deliverables',
                activeScopeItems.length,
              ],
              [
                'Package Assignment',
                'Scope Items classified',
                `${scopeItemsAssigned}/${activeScopeItems.length}`,
              ],
              [
                'Scope Cost',
                `${completedScopeItems}/${activeScopeItems.length} Scope Items costed`,
                money(scopeCost, project?.currency_code || 'USD'),
              ],
            ].map(([label, description, value]) => (
              <View key={label} style={styles.scopeSummaryCard}>
                <View style={styles.scopeSummaryCardInner}>
                  <Text style={styles.scopeSummaryLabel}>{label}</Text>
                  <Text style={styles.scopeSummaryDescription}>
                    {description}
                  </Text>
                  <Text style={styles.scopeSummaryValue}>{value}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.scopeReadinessCard} wrap={false}>
            <View style={styles.scopeReadinessLeft}>
              <Text style={styles.scopeSummaryLabel}>Scope Definition</Text>
              <Text style={styles.scopeReadinessTitle}>
                {scopeDefinitionComplete ? 'Complete' : 'Incomplete'}
              </Text>
            </View>

            <Text
              style={
                scopeDefinitionComplete
                  ? styles.scopeReadyBadge
                  : styles.scopeIncompleteBadge
              }
            >
              {scopeDefinitionComplete ? 'READY' : 'REVIEW'}
            </Text>
          </View>

          {projectScopePackages.length > 0 ? (
            projectScopePackages.map((entry, packageIndex) => {
              const workPackageName =
                entry.workPackage.name ||
                entry.workPackage.description ||
                entry.workPackage.code ||
                'Work Package'

              return (
                <View
                  key={entry.workPackage.id}
                  style={styles.scopePackageCard}
                  wrap={false}
                >
                  <View style={styles.scopePackageHeader}>
                    <View style={styles.scopePackageIdentity}>
                      <View style={styles.scopePackageIndex}>
                        <Text style={styles.scopePackageIndexText}>
                          {String(packageIndex + 1).padStart(2, '0')}
                        </Text>
                      </View>

                      <View>
                        <Text style={styles.scopePackageCode}>
                          {safe(entry.workPackage.code)}
                        </Text>
                        <Text style={styles.scopePackageName}>
                          {safe(workPackageName)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.scopePackageMeta}>
                      <Text style={styles.scopePackageMetaText}>
                        {entry.scopeItems.length} Scope Item
                        {entry.scopeItems.length === 1 ? '' : 's'} ·{' '}
                        {money(
                          entry.packageCost,
                          project?.currency_code || 'USD'
                        )}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.scopeTableHeader}>
                    <View style={[styles.cell, styles.scopeIdCell]}>
                      <Text style={styles.headerCellText}>ID</Text>
                    </View>
                    <View style={[styles.cell, styles.scopeItemCell]}>
                      <Text style={styles.headerCellText}>Scope Item</Text>
                    </View>
                    <View style={[styles.cell, styles.scopeUnitCell]}>
                      <Text style={styles.headerCellText}>Unit</Text>
                    </View>
                    <View style={[styles.cell, styles.scopeQuantityCell]}>
                      <Text style={styles.headerCellText}>Scope Quantity</Text>
                    </View>
                    <View style={[styles.cell, styles.scopeUnitCostCell]}>
                      <Text style={styles.headerCellText}>Unit Cost</Text>
                    </View>
                    <View style={[styles.cell, styles.scopeTotalCostCell]}>
                      <Text style={styles.headerCellText}>Total Cost</Text>
                    </View>
                    <View style={[styles.cell, styles.scopeStatusCell]}>
                      <Text style={styles.headerCellText}>Status</Text>
                    </View>
                  </View>

                  {entry.scopeItems.map((scopeItem, itemIndex) => {
                    const quantity = Number(scopeItem.scope_quantity)
                    const unitCost = Number(scopeItem.unit_cost)
                    const totalCost =
                      Number.isFinite(quantity) && Number.isFinite(unitCost)
                        ? quantity * unitCost
                        : null
                    const isComplete = scopeItemIsComplete(scopeItem)

                    return (
                      <View
                        key={scopeItem.id}
                        style={styles.scopeTableRow}
                        wrap={false}
                      >
                        <View style={[styles.cell, styles.scopeIdCell]}>
                          <Text style={styles.cellText}>
                            {packageIndex + 1}.{itemIndex + 1}
                          </Text>
                        </View>

                        <View style={[styles.cell, styles.scopeItemCell]}>
                          <Text style={styles.cellText}>
                            {safe(scopeItem.service_name)}
                          </Text>
                        </View>

                        <View style={[styles.cell, styles.scopeUnitCell]}>
                          <Text style={styles.cellText}>
                            {safe(scopeItem.unit)}
                          </Text>
                        </View>

                        <View style={[styles.cell, styles.scopeQuantityCell]}>
                          <Text style={styles.cellText}>
                            {number(scopeItem.scope_quantity)}
                          </Text>
                        </View>

                        <View style={[styles.cell, styles.scopeUnitCostCell]}>
                          <Text style={styles.cellText}>
                            {money(
                              scopeItem.unit_cost,
                              project?.currency_code || 'USD'
                            )}
                          </Text>
                        </View>

                        <View style={[styles.cell, styles.scopeTotalCostCell]}>
                          <Text style={styles.cellText}>
                            {totalCost === null
                              ? '—'
                              : money(
                                  totalCost,
                                  project?.currency_code || 'USD'
                                )}
                          </Text>
                        </View>

                        <View style={[styles.cell, styles.scopeStatusCell]}>
                          <View
                            style={
                              isComplete
                                ? styles.scopeStatusDotComplete
                                : styles.scopeStatusDotIncomplete
                            }
                          />
                        </View>
                      </View>
                    )
                  })}
                </View>
              )
            })
          ) : (
            <View style={styles.noData}>
              <Text>No Scope Items are configured for this project.</Text>
            </View>
          )}
        </StandardPage>
      )}

      {sections.locationStructure && (() => {
        const childrenByParent = new Map()

        locations.forEach((location) => {
          const parentKey = location.parent_id || '__root__'

          if (!childrenByParent.has(parentKey)) {
            childrenByParent.set(parentKey, [])
          }

          childrenByParent.get(parentKey).push(location)
        })

        childrenByParent.forEach((children) => {
          children.sort(
            (a, b) =>
              Number(a.sequence_number || 0) -
                Number(b.sequence_number || 0) ||
              safe(a.name).localeCompare(safe(b.name))
          )
        })

        const buildingLocations = locations.filter(
          (location) => location.location_type === 'building'
        )

        const divisionLocations = locations.filter((location) =>
          ['floor', 'division'].includes(location.location_type)
        )

        const zoneLocations = locations.filter((location) =>
          ['zone', 'area'].includes(location.location_type)
        )

        const explicitProductionLocations = locations.filter(
          (location) =>
            ![
              'project',
              'building',
              'floor',
              'division',
              'zone',
              'area',
            ].includes(location.location_type)
        )

        const getDescendants = (locationId) => {
          const descendants = []
          const stack = [...(childrenByParent.get(locationId) || [])]

          while (stack.length > 0) {
            const current = stack.shift()
            descendants.push(current)
            stack.push(...(childrenByParent.get(current.id) || []))
          }

          return descendants
        }

        const getZonesForDivision = (division) =>
          getDescendants(division.id).filter((location) =>
            ['zone', 'area'].includes(location.location_type)
          )

        const getProductionLocationsForNode = (node) =>
          getDescendants(node.id).filter(
            (location) =>
              ![
                'project',
                'building',
                'floor',
                'division',
                'zone',
                'area',
              ].includes(location.location_type)
          )

        return (
          <StandardPage
            logo={logoDataUri}
            reportTitle={reportTitle}
            project={project}
          >
            <SectionHeading
              number="3"
              title="Location Structure"
              subtitle="Physical production hierarchy used by planning and quantity allocation."
            />

            {locations.length > 0 ? (
              <>
                <View style={styles.locationSummaryRow}>
                  {[
                    ['Buildings', 'Physical structures', buildingLocations.length],
                    [
                      'Divisions / Floors',
                      'Production divisions',
                      divisionLocations.length,
                    ],
                    ['Zones / Areas', 'Production subdivisions', zoneLocations.length],
                    [
                      'Production Locations',
                      'Assignable locations',
                      explicitProductionLocations.length,
                    ],
                  ].map(([label, description, value]) => (
                    <View key={label} style={styles.locationSummaryCard}>
                      <View style={styles.locationSummaryCardInner}>
                        <Text style={styles.locationSummaryLabel}>{label}</Text>
                        <Text style={styles.locationSummaryDescription}>
                          {description}
                        </Text>
                        <Text style={styles.locationSummaryValue}>{value}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.locationProjectCard} wrap={false}>
                  <View style={styles.locationProjectIdentity}>
                    <Text style={styles.locationEyebrow}>Project</Text>
                    <Text style={styles.locationProjectName}>
                      {safe(project?.name, 'Project')}
                    </Text>
                  </View>

                  <View style={styles.locationBadgeRow}>
                    <Text style={styles.locationCountBadge}>
                      {divisionLocations.length} Divisions
                    </Text>
                    <Text style={styles.locationCountBadge}>
                      {zoneLocations.length} Zones
                    </Text>
                    <Text style={styles.locationCountBadge}>
                      {explicitProductionLocations.length} Locations
                    </Text>
                  </View>
                </View>

                {divisionLocations.length > 0 ? (
                  divisionLocations.map((division) => {
                    const zones = getZonesForDivision(division)
                    const divisionProductionLocations =
                      getProductionLocationsForNode(division)

                    return (
                      <View
                        key={division.id}
                        style={styles.locationDivisionCard}
                        wrap={false}
                      >
                        <View style={styles.locationDivisionHeader}>
                          <View style={styles.locationDivisionIdentity}>
                            <Text style={styles.locationEyebrow}>
                              Division / Floor
                            </Text>
                            <Text style={styles.locationDivisionName}>
                              {safe(division.name)}
                            </Text>
                          </View>

                          <View style={styles.locationBadgeRow}>
                            <Text style={styles.locationCountBadge}>
                              {zones.length} Zones
                            </Text>
                            <Text style={styles.locationCountBadge}>
                              {divisionProductionLocations.length} Locations
                            </Text>
                          </View>
                        </View>

                        {zones.length > 0 ? (
                          <View style={styles.locationZoneRow}>
                            {zones.map((zone) => {
                              const zoneProductionLocations =
                                getProductionLocationsForNode(zone)
                              const width =
                                zones.length === 1
                                  ? '100%'
                                  : zones.length === 2
                                    ? '50%'
                                    : '33.333%'

                              return (
                                <View
                                  key={zone.id}
                                  style={[
                                    styles.locationZoneColumn,
                                    { width },
                                  ]}
                                >
                                  <View style={styles.locationZoneCard}>
                                    <View style={styles.locationZoneHeader}>
                                      <Text style={styles.locationEyebrow}>
                                        Zone / Area
                                      </Text>
                                      <Text style={styles.locationZoneName}>
                                        {safe(zone.name)}
                                      </Text>
                                      <Text
                                        style={[
                                          styles.locationCountBadge,
                                          {
                                            marginLeft: 0,
                                            marginTop: 4,
                                            alignSelf: 'flex-start',
                                          },
                                        ]}
                                      >
                                        {zoneProductionLocations.length} Locations
                                      </Text>
                                    </View>

                                    <View style={styles.locationZoneBody}>
                                      {zoneProductionLocations.length > 0 ? (
                                        zoneProductionLocations.map(
                                          (productionLocation) => (
                                            <Text
                                              key={productionLocation.id}
                                              style={styles.locationChildText}
                                            >
                                              • {safe(productionLocation.name)}
                                            </Text>
                                          )
                                        )
                                      ) : (
                                        <Text style={styles.locationEmptyText}>
                                          No locations in this zone.
                                        </Text>
                                      )}
                                    </View>
                                  </View>
                                </View>
                              )
                            })}
                          </View>
                        ) : (
                          <View style={styles.locationZoneBody}>
                            <Text style={styles.locationEmptyText}>
                              No zones or areas are configured for this division.
                            </Text>
                          </View>
                        )}
                      </View>
                    )
                  })
                ) : (
                  <View style={styles.noData}>
                    <Text>
                      No divisions or floors are configured for this project.
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.noData}>
                <Text>No project locations are configured.</Text>
              </View>
            )}
          </StandardPage>
        )
      })()}

      {sections.quantityReconciliation && (
        <StandardPage
          logo={logoDataUri}
          reportTitle={reportTitle}
          project={project}
        >
          <SectionHeading
            number="4"
            title="Quantity Reconciliation"
            subtitle="Comparison between project Scope quantities and quantities allocated across production locations."
          />

          <View style={styles.table}>
            <View style={styles.tableHeader} fixed>
              {[
                ['WP', '10%'],
                ['Scope Item', '34%'],
                ['Scope', '13%'],
                ['Allocated', '13%'],
                ['Remaining', '13%'],
                ['Status', '17%'],
              ].map(([label, width]) => (
                <View
                  key={label}
                  style={[styles.cell, { width }]}
                >
                  <Text style={styles.headerCellText}>{label}</Text>
                </View>
              ))}
            </View>

            {reconciliationRows.map((row, index) => (
              <View
                key={row.scopeItem.id}
                wrap={false}
                style={[
                  styles.tableRow,
                  index % 2 === 1 ? styles.tableRowAlt : null,
                ]}
              >
                <View style={[styles.cell, { width: '10%' }]}>
                  <Text style={styles.cellText}>{row.workPackage}</Text>
                </View>

                <View style={[styles.cell, { width: '34%' }]}>
                  <Text style={styles.cellText}>
                    {row.scopeItem.service_name}
                  </Text>
                </View>

                <View style={[styles.cell, { width: '13%' }]}>
                  <Text style={styles.cellText}>
                    {number(row.scope)}
                  </Text>
                </View>

                <View style={[styles.cell, { width: '13%' }]}>
                  <Text style={styles.cellText}>
                    {number(row.allocated)}
                  </Text>
                </View>

                <View style={[styles.cell, { width: '13%' }]}>
                  <Text style={styles.cellText}>
                    {number(row.remaining)}
                  </Text>
                </View>

                <View style={[styles.cell, { width: '17%' }]}>
                  <Text style={statusBadgeStyle(row.status)}>
                    {row.status}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </StandardPage>
      )}

      {sections.scopeAllocationMatrix &&
        (matrixScopeChunks.length > 0 ? (
          matrixScopeChunks.map((scopeChunk, chunkIndex) => (
            <StandardPage
              key={`matrix-${chunkIndex}`}
              logo={logoDataUri}
              reportTitle={reportTitle}
              project={project}
              landscape
            >
              <SectionHeading
                number={chunkIndex === 0 ? '5' : ''}
                title={
                  chunkIndex === 0
                    ? 'Scope Allocation Matrix'
                    : 'Scope Allocation Matrix — Continued'
                }
                subtitle={`Quantities by production location. Scope Item columns ${
                  chunkIndex * 5 + 1
                }-${Math.min(
                  chunkIndex * 5 + scopeChunk.length,
                  activeScopeItems.length
                )} of ${activeScopeItems.length}.`}
              />

              <View style={styles.table}>
                <View style={styles.tableHeader} fixed>
                  <View style={[styles.cell, styles.matrixLocation]}>
                    <Text style={styles.headerCellText}>Location</Text>
                  </View>

                  <View style={[styles.cell, styles.matrixType]}>
                    <Text style={styles.headerCellText}>Type</Text>
                  </View>

                  {scopeChunk.map((scopeItem) => (
                    <View
                      key={scopeItem.id}
                      style={[styles.cell, styles.matrixScope]}
                    >
                      <Text style={styles.headerCellText}>
                        {scopeItem.service_name}
                      </Text>
                      <Text
                        style={[
                          styles.cellText,
                          styles.mutedText,
                          { marginTop: 2 },
                        ]}
                      >
                        {safe(scopeItem.unit)}
                      </Text>
                    </View>
                  ))}
                </View>

                {productionLocations.length > 0 ? (
                  productionLocations.map((location, rowIndex) => (
                    <View
                      key={location.id}
                      wrap={false}
                      style={[
                        styles.tableRow,
                        rowIndex % 2 === 1
                          ? styles.tableRowAlt
                          : null,
                      ]}
                    >
                      <View style={[styles.cell, styles.matrixLocation]}>
                        <Text style={styles.cellText}>
                          {buildLocationPath(location, locationMap)}
                        </Text>
                      </View>

                      <View style={[styles.cell, styles.matrixType]}>
                        <Text style={styles.cellText}>
                          {locationType(location.location_type)}
                        </Text>
                      </View>

                      {scopeChunk.map((scopeItem) => (
                        <View
                          key={scopeItem.id}
                          style={[styles.cell, styles.matrixScope]}
                        >
                          <Text style={styles.cellText}>
                            {number(
                              allocationMap.get(
                                `${location.id}___${scopeItem.id}`
                              ) || 0
                            )}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))
                ) : (
                  <View style={styles.noData}>
                    <Text>No production locations are available.</Text>
                  </View>
                )}
              </View>
            </StandardPage>
          ))
        ) : (
          <StandardPage
            logo={logoDataUri}
            reportTitle={reportTitle}
            project={project}
            landscape
          >
            <SectionHeading
              number="5"
              title="Scope Allocation Matrix"
              subtitle="Quantities by production location."
            />
            <View style={styles.noData}>
              <Text>No Scope Items are available.</Text>
            </View>
          </StandardPage>
        ))}

      {sections.quantificationByLocation && (
        <StandardPage
          logo={logoDataUri}
          reportTitle={reportTitle}
          project={project}
        >
          <SectionHeading
            number="6"
            title="Quantification by Location"
            subtitle="Aggregated allocated quantities organized through the project location hierarchy."
          />

          <View style={styles.table}>
            <View style={styles.tableHeader} fixed>
              <View style={[styles.cell, styles.quantLocation]}>
                <Text style={styles.headerCellText}>Location</Text>
              </View>

              <View style={[styles.cell, styles.quantType]}>
                <Text style={styles.headerCellText}>Type</Text>
              </View>

              <View style={[styles.cell, styles.quantQuantity]}>
                <Text style={styles.headerCellText}>
                  Direct Allocated Quantity
                </Text>
              </View>
            </View>

            {orderedLocations.length > 0 ? (
              orderedLocations.map((location, index) => {
                const depth = buildLocationDepth(location, locationMap)

                return (
                  <View
                    key={location.id}
                    wrap={false}
                    style={[
                      styles.tableRow,
                      index % 2 === 1 ? styles.tableRowAlt : null,
                    ]}
                  >
                    <View
                      style={[
                        styles.cell,
                        styles.quantLocation,
                        {
                          paddingLeft: 6 + Math.min(depth, 6) * 10,
                        },
                      ]}
                    >
                      <Text style={styles.cellText}>
                        {safe(location.name)}
                      </Text>
                    </View>

                    <View style={[styles.cell, styles.quantType]}>
                      <Text style={styles.cellText}>
                        {locationType(location.location_type)}
                      </Text>
                    </View>

                    <View style={[styles.cell, styles.quantQuantity]}>
                      <Text style={styles.cellText}>
                        {number(
                          locationQuantityTotals.get(location.id) || 0
                        )}
                      </Text>
                    </View>
                  </View>
                )
              })
            ) : (
              <View style={styles.noData}>
                <Text>No location quantification is available.</Text>
              </View>
            )}
          </View>
        </StandardPage>
      )}

      {sections.productionParameters && (
        <StandardPage
          logo={logoDataUri}
          reportTitle={reportTitle}
          project={project}
        >
          <SectionHeading
            number="7"
            title="Production Parameters"
            subtitle="Project-wide production assumptions used later as the basis for activity-duration calculations."
          />

          <View style={styles.table}>
            <View style={styles.tableHeader} fixed>
              {[
                ['WP', '9%'],
                ['Scope Item', '31%'],
                ['Unit', '8%'],
                ['Productivity', '15%'],
                ['Basis', '15%'],
                ['Workforce', '10%'],
                ['Capacity', '12%'],
              ].map(([label, width]) => (
                <View
                  key={label}
                  style={[styles.cell, { width }]}
                >
                  <Text style={styles.headerCellText}>{label}</Text>
                </View>
              ))}
            </View>

            {activeScopeItems.map((scopeItem, index) => {
              const parameter = productionMap.get(scopeItem.id)
              const productivity = Number(parameter?.productivity_rate)
              const workforce = Number(parameter?.effective_workforce)

              const capacity =
                Number.isFinite(productivity) &&
                productivity > 0 &&
                Number.isFinite(workforce) &&
                workforce > 0
                  ? productivity * workforce
                  : null

              return (
                <View
                  key={scopeItem.id}
                  wrap={false}
                  style={[
                    styles.tableRow,
                    index % 2 === 1 ? styles.tableRowAlt : null,
                  ]}
                >
                  <View style={[styles.cell, { width: '9%' }]}>
                    <Text style={styles.cellText}>
                      {workPackageMap.get(
                        scopeItem.project_work_package_id
                      )?.code || '—'}
                    </Text>
                  </View>

                  <View style={[styles.cell, { width: '31%' }]}>
                    <Text style={styles.cellText}>
                      {scopeItem.service_name}
                    </Text>
                  </View>

                  <View style={[styles.cell, { width: '8%' }]}>
                    <Text style={styles.cellText}>
                      {safe(scopeItem.unit)}
                    </Text>
                  </View>

                  <View style={[styles.cell, { width: '15%' }]}>
                    <Text style={styles.cellText}>
                      {number(parameter?.productivity_rate)}
                    </Text>
                  </View>

                  <View style={[styles.cell, { width: '15%' }]}>
                    <Text style={styles.cellText}>
                      {parameter?.productivity_basis === 'crew_day'
                        ? 'Per crew / day'
                        : parameter?.productivity_basis === 'worker_day'
                          ? 'Per worker / day'
                          : '—'}
                    </Text>
                  </View>

                  <View style={[styles.cell, { width: '10%' }]}>
                    <Text style={styles.cellText}>
                      {number(parameter?.effective_workforce)}
                    </Text>
                  </View>

                  <View style={[styles.cell, { width: '12%' }]}>
                    <Text style={styles.cellText}>
                      {capacity === null
                        ? '—'
                        : `${number(capacity)} ${safe(
                            scopeItem.unit,
                            'unit'
                          )}/day`}
                    </Text>
                  </View>
                </View>
              )
            })}
          </View>

          <Text
            style={{
              marginTop: 10,
              color: MUTED,
              fontSize: 6.8,
              lineHeight: 1.4,
            }}
          >
            Production Parameters are project-wide calculation inputs.
            Activity duration and Takt standardization are intentionally
            handled in later planning stages.
          </Text>
        </StandardPage>
      )}
    </Document>
  )
}
