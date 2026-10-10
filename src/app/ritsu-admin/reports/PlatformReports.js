'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  architectureAudit, architectureGaps, architectureWorkspaces, getArchitectureNode,
  getCoverageRows, getDependencyRows, getReportSummary, nodeTypeLabels, reportCsv, sourceUrl,
} from '../platform-map/platformMapModel'
import styles from './reports.module.css'

const tabs = [{ id: 'coverage', label: 'Coverage' }, { id: 'dependencies', label: 'Dependencies' }, { id: 'gaps', label: 'Gaps' }]
const statusLabels = { mapped: 'Mapped', embedded: 'Embedded', 'no-route': 'No page', unmapped: 'Not audited' }
function mapHref(id) { return '/ritsu-admin?node=' + encodeURIComponent(id) }
function SourceLink({ item, label = 'View source' }) {
  const href = sourceUrl(item)
  return href ? <a href={href} target="_blank" rel="noopener noreferrer">{label} ↗</a> : null
}
function EmptyState({ children }) { return <div className={styles.empty} role="status">{children}</div> }

export default function PlatformReports() {
  const [tab, setTab] = useState('coverage')
  const [workspace, setWorkspace] = useState('all')
  const [query, setQuery] = useState('')
  const [dependencyType, setDependencyType] = useState('all')
  const [onlyGaps, setOnlyGaps] = useState(false)
  const [exportError, setExportError] = useState('')
  const summary = useMemo(() => getReportSummary(workspace), [workspace])
  const coverage = useMemo(() => getCoverageRows(workspace, query).filter((row) => !onlyGaps || row.gaps.length), [workspace, query, onlyGaps])
  const dependencies = useMemo(() => getDependencyRows(workspace, query).filter((row) => dependencyType === 'all' || (dependencyType === 'database' ? ['table', 'view'].includes(row.type) : row.type === dependencyType)), [workspace, query, dependencyType])
  const gaps = useMemo(() => {
    const allowed = new Set(getCoverageRows(workspace).map((row) => row.id))
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return architectureGaps.filter((gap) => allowed.has(gap.moduleId) && words.every((word) => (gap.title + ' ' + gap.detail + ' ' + getArchitectureNode(gap.moduleId).label).toLowerCase().includes(word)))
  }, [workspace, query])
  const currentCount = tab === 'coverage' ? coverage.length : tab === 'dependencies' ? dependencies.length : gaps.length

  function exportReport() {
    setExportError('')
    let url
    try {
      const csv = reportCsv(tab, workspace, query, { onlyGaps, dependencyType })
      url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }))
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = 'ritsuflow-architecture-' + tab + '-' + architectureAudit.verifiedOn + '.csv'
      document.body.appendChild(anchor); anchor.click(); anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      if (url) URL.revokeObjectURL(url)
      setExportError('The export could not be created. Please retry.')
    }
  }

  return <div className={styles.reportPage}>
    <div className={styles.reportIntro}>
      <div><span className={styles.eyebrow}>RITSU ADMIN · ARCHITECTURE</span><h2>Platform coverage at a glance</h2><p>Explore the implemented pages, direct data dependencies and gaps across Projects, PreCon and FieldOp.</p></div>
      <div className={styles.snapshot}><span>Verified {architectureAudit.verifiedOn}</span><a href={'https://github.com/gestaoexcelispro/ritsuflow/tree/' + architectureAudit.sourceRef} target="_blank" rel="noopener noreferrer">Source snapshot {architectureAudit.sourceRef.slice(0, 7)} ↗</a></div>
    </div>
    <div className={styles.stats}>
      <div><span>Modules mapped</span><strong>{summary.mapped}<small> / {summary.modules}</small></strong><p>{summary.dataMapped} with data verified</p></div>
      <div><span>Application pages</span><strong>{summary.pages}</strong><p>{summary.components} components · {summary.apis} APIs</p></div>
      <div><span>Tables & views</span><strong>{summary.tables}</strong><p>Unique database objects</p></div>
      <div><span>RPC functions</span><strong>{summary.rpcs}</strong><p>{summary.storage} storage buckets</p></div>
      <div className={styles.gapStat}><span>Recorded gaps</span><strong>{summary.gaps}</strong><p>Source-backed review items</p></div>
    </div>
    <div className={styles.workspaceCards}>
      {architectureWorkspaces.filter((item) => workspace === 'all' || workspace === item.id).map((item) => {
        const totals = getReportSummary(item.id)
        return <button type="button" key={item.id} onClick={() => setWorkspace(item.id)} className={workspace === item.id ? styles.workspaceSelected : ''}>
          <div><strong>{item.label}</strong><span>{totals.mapped} / {totals.modules} modules mapped</span></div>
          <div className={styles.progressTrack} role="progressbar" aria-label={item.label + ' mapped modules'} aria-valuenow={totals.mapped} aria-valuemin={0} aria-valuemax={totals.modules}><span style={{ width: (totals.mapped / totals.modules * 100) + '%' }} /></div>
          <small>{totals.pages} pages · {totals.tables} tables/views · {totals.gaps} gaps</small>
        </button>
      })}
    </div>
    <div className={styles.reportControls}>
      <div className={styles.tabs} role="tablist" aria-label="Architecture report">{tabs.map((item) => <button type="button" role="tab" id={'report-tab-' + item.id} aria-controls="report-panel" aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} key={item.id} className={tab === item.id ? styles.activeTab : ''} onClick={() => { setTab(item.id); setQuery(''); setExportError('') }} onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const index = tabs.findIndex((entry) => entry.id === tab)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
        setTab(tabs[next].id); setQuery(''); document.getElementById('report-tab-' + tabs[next].id)?.focus()
      }}>{item.label}{item.id === 'gaps' && <span>{summary.gaps}</span>}</button>)}</div>
      <button type="button" className={styles.exportButton} onClick={exportReport}>↓ Export CSV</button>
    </div>
    <div className={styles.filters}>
      <label>Workspace<select value={workspace} onChange={(event) => setWorkspace(event.target.value)}><option value="all">All workspaces</option>{architectureWorkspaces.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label className={styles.search}>Search<input type="search" value={query} placeholder={tab === 'dependencies' ? 'Search table, function or handler...' : 'Search modules or gaps...'} onChange={(event) => setQuery(event.target.value)} /></label>
      {tab === 'dependencies' && <label>Type<select value={dependencyType} onChange={(event) => setDependencyType(event.target.value)}><option value="all">All dependencies</option><option value="database">Tables & views</option><option value="rpc">RPC functions</option><option value="storage">Storage buckets</option><option value="api">API handlers</option></select></label>}
      {tab === 'coverage' && <label className={styles.checkbox}><input type="checkbox" checked={onlyGaps} onChange={(event) => setOnlyGaps(event.target.checked)} />Modules with gaps</label>}
      <span className={styles.resultCount} role="status">{currentCount} {tab === 'coverage' ? 'modules' : tab === 'dependencies' ? 'dependencies' : 'gaps'}</span>
    </div>
    {exportError && <p role="alert" className={styles.exportError}>{exportError}</p>}
    <section id="report-panel" role="tabpanel" aria-labelledby={'report-tab-' + tab} className={styles.reportPanel}>
      {tab === 'coverage' && (coverage.length ? <div className={styles.tableScroll}><table className={styles.coverageTable}>
        <caption>Module coverage · pages and data verified from source</caption><thead><tr><th scope="col">Module</th><th scope="col">Implementation</th><th scope="col">Entry points</th><th scope="col">Data dependencies</th><th scope="col">Gaps</th><th scope="col">Explore</th></tr></thead>
        <tbody>{coverage.map((row) => <tr key={row.id}><td><strong>{row.label}</strong><small>{getArchitectureNode(row.workspace).label}</small></td>
          <td><span className={row.status === 'no-route' ? styles.gapBadge : styles.mappedBadge}>{statusLabels[row.status]}</span></td>
          <td>{row.routeCount} pages<small>{row.componentCount} components · {row.apiCount} APIs</small></td>
          <td>{row.database ? <>{row.dataCount} tables/views<small>{row.rpcCount} RPCs · {row.storageCount} buckets</small></> : <span className={styles.muted}>No implemented data inventory</span>}</td>
          <td>{row.gaps.length ? <button type="button" className={styles.gapButton} onClick={() => { setTab('gaps'); setQuery(row.label) }}>{row.gaps.length} {row.gaps.length === 1 ? 'gap' : 'gaps'}</button> : <span className={styles.muted}>—</span>}</td>
          <td><Link href={mapHref(row.id)}>Open map →</Link></td></tr>)}</tbody>
      </table></div> : <EmptyState>No modules match these filters.</EmptyState>)}
      {tab === 'dependencies' && (dependencies.length ? <div className={styles.tableScroll}><table className={styles.dependencyTable}>
        <caption>Unique dependencies · shared objects are counted once</caption><thead><tr><th scope="col">Dependency</th><th scope="col">Type</th><th scope="col">Used by</th><th scope="col">Verified access</th><th scope="col">Evidence</th></tr></thead>
        <tbody>{dependencies.map((row) => <tr key={row.id}><td><Link href={mapHref(row.id)}><code>{row.schema ? row.schema + '.' : ''}{row.label}</code></Link>{row.routes?.map((route) => <small key={route}>{route}</small>)}</td>
          <td><span className={styles.typeBadge}>{nodeTypeLabels[row.type]}</span></td>
          <td><div className={styles.moduleLinks}>{row.moduleIds.map((id) => <Link key={id} href={mapHref(id)}>{getArchitectureNode(id)?.label}</Link>)}</div></td>
          <td><div className={styles.accessBadges}>{[...new Set(row.access.map((edge) => edge.type))].map((type) => <span key={type}>{type}</span>)}</div>{!row.access.length && <small>Handler exists; caller not traced</small>}</td>
          <td><SourceLink item={row.access.find((edge) => edge.evidence.length)?.evidence[0] || row} /><Link href={mapHref(row.id)} className={styles.exploreLink}>Trace in map →</Link></td></tr>)}</tbody>
      </table></div> : <EmptyState>No dependencies match these filters.</EmptyState>)}
      {tab === 'gaps' && (gaps.length ? <div className={styles.gapList}>{gaps.map((gap) => {
        const module = getArchitectureNode(gap.moduleId)
        return <article key={gap.id} className={styles.gapCard}><div className={styles.gapCardHeading}><span>{getArchitectureNode(module.workspace).label} / {module.label}</span><span className={styles.gapBadge}>Review item</span></div><h3>{gap.title}</h3><p>{gap.detail}</p><div className={styles.gapActions}><Link href={mapHref(module.id)}>Explore module →</Link><SourceLink item={gap} />{!gap.sourcePath && <a href={'https://github.com/gestaoexcelispro/ritsuflow/tree/' + gap.sourceRef + '/src/app'} target="_blank" rel="noopener noreferrer">Audited route inventory ↗</a>}</div></article>
      })}</div> : <EmptyState>No recorded gaps match these filters.</EmptyState>)}
    </section>
    <footer className={styles.scopeNote}><strong>Audit scope</strong><p>{architectureAudit.scope}</p><p>This is a source snapshot. “Mapped” records implementation coverage; it does not certify runtime behavior. Shared pages and dependencies are counted once in summary totals and may appear in more than one module.</p></footer>
  </div>
}
