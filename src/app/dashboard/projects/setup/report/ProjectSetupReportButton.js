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
            title="Scope Summary"
            subtitle="Project Scope Breakdown Structure and project-level quantities."
          />

          {scopeRows.length > 0 ? (
            <GenericTable
              columns={[
                {
                  key: 'workPackage',
                  label: 'Work Package',
                  width: '13%',
                },
                {
                  key: 'scopeItem',
                  label: 'Scope Item',
                  width: '43%',
                },
                {
                  key: 'unit',
                  label: 'Unit',
                  width: '10%',
                },
                {
                  key: 'quantity',
                  label: 'Quantity',
                  width: '16%',
                  align: 'right',
                },
                {
                  key: 'unitCost',
                  label: 'Unit Cost',
                  width: '18%',
                  align: 'right',
                },
              ]}
              rows={scopeRows}
            />
          ) : (
            <View style={styles.noData}>
              <Text>No Scope Items are configured for this project.</Text>
            </View>
          )}
        </StandardPage>
      )}

      {sections.locationStructure && (
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

          <View style={styles.table}>
            <View style={styles.tableHeader} fixed>
              <View style={[styles.cell, { width: '64%' }]}>
                <Text style={styles.headerCellText}>Location</Text>
              </View>

              <View style={[styles.cell, { width: '18%' }]}>
                <Text style={styles.headerCellText}>Type</Text>
              </View>

              <View style={[styles.cell, { width: '18%' }]}>
                <Text style={styles.headerCellText}>Sequence</Text>
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
                      styles.treeRow,
                      index % 2 === 1 ? styles.tableRowAlt : null,
                    ]}
                  >
                    <View
                      style={[
                        styles.treeName,
                        {
                          paddingLeft: 6 + Math.min(depth, 6) * 12,
                        },
                      ]}
                    >
                      <Text style={styles.cellText}>
                        {depth > 0 ? '› ' : ''}
                        {safe(location.name)}
                      </Text>
                    </View>

                    <View style={styles.treeType}>
                      <Text style={styles.cellText}>
                        {locationType(location.location_type)}
                      </Text>
                    </View>

                    <View style={styles.treeCode}>
                      <Text style={styles.cellText}>
                        {number(location.sequence_number, 0)}
                      </Text>
                    </View>
                  </View>
                )
              })
            ) : (
              <View style={styles.noData}>
                <Text>No project locations are configured.</Text>
              </View>
            )}
          </View>
        </StandardPage>
      )}

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
