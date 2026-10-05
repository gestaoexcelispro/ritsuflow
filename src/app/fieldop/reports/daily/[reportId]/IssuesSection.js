'use client'

import RecordListSection from './RecordListSection'

const opts = (prefix, values) => values.map((v) => ({ value: v, label: `${prefix}.${v}` }))
const TYPES = opts('issues.type', ['general', 'production', 'material', 'equipment', 'design', 'quality', 'safety', 'coordination', 'weather', 'other'])
const SEVERITY = opts('issues.sev', ['low', 'medium', 'high', 'critical'])
const STATUS = opts('issues.status', ['open', 'in_progress', 'resolved', 'closed'])
const IMPACT = opts('issues.impactValue', ['none', 'minor', 'moderate', 'severe', 'stopped'])
const FIELDS = [
  { key: 'title', type: 'text', label: 'issues.title', required: true, span: true },
  { key: 'issue_type', type: 'select', label: 'issues.typeLabel', options: TYPES, required: true, default: 'general' },
  { key: 'severity', type: 'select', label: 'issues.severity', options: SEVERITY, required: true, default: 'low' },
  { key: 'status', type: 'select', label: 'issues.statusLabel', options: STATUS, required: true, default: 'open' },
  { key: 'location_id', type: 'location', label: 'issues.location' },
  { key: 'production_impact', type: 'select', label: 'issues.impact', options: IMPACT, required: true, default: 'none' },
  { key: 'impact_description', type: 'textarea', label: 'issues.impactText', span: true, showIf: (f) => f.production_impact !== 'none' },
  { key: 'description', type: 'textarea', label: 'issues.description', span: true },
  { key: 'responsible_party', type: 'text', label: 'issues.responsible' },
  { key: 'due_date', type: 'date', label: 'issues.due' },
  { key: 'corrective_action', type: 'textarea', label: 'issues.corrective', span: true },
]
const SELECT = 'id,title,description,issue_type,severity,status,location_id,location_name,production_impact,impact_description,responsible_party,corrective_action,due_date,resolved_at,created_at'
const DONE = ['resolved', 'closed']

// Keeps the original resolution time when an already resolved issue is edited again.
function toPayload(f, { location, original }) {
  return {
    title: f.title.trim(),
    issue_type: f.issue_type,
    severity: f.severity,
    status: f.status,
    resolved_at: DONE.includes(f.status) ? original?.resolved_at || new Date().toISOString() : null,
    location_id: location?.id || null,
    location_name: location?.name || null,
    production_impact: f.production_impact,
    impact_description: f.production_impact !== 'none' ? f.impact_description.trim() || null : null,
    description: f.description.trim() || null,
    responsible_party: f.responsible_party.trim() || null,
    due_date: f.due_date || null,
    corrective_action: f.corrective_action.trim() || null,
  }
}

const SEV_COLOR = { low: ['#eef2f4', '#607888'], medium: ['#fff3d6', '#986100'], high: ['#ffe6d5', '#b4500c'], critical: ['#fde2e2', '#a32020'] }

export default function IssuesSection(props) {
  const { t, language } = props
  const date = new Intl.DateTimeFormat(language, { dateStyle: 'medium' })
  const columns = [
    { key: 'severity', label: 'issues.severity', render: (r) => { const [bg, fg] = SEV_COLOR[r.severity] || SEV_COLOR.low; return <span style={{ padding: '4px 8px', borderRadius: 999, background: bg, color: fg, fontWeight: 800, fontSize: 10 }}>{t(`issues.sev.${r.severity}`)}</span> } },
    { key: 'title', label: 'issues.title', render: (r) => <><strong>{r.title}</strong><small style={{ display: 'block', color: '#82939e' }}>{[t(`issues.type.${r.issue_type}`), r.location_name].filter(Boolean).join(' · ')}</small></> },
    { key: 'production_impact', label: 'issues.impact', render: (r) => t(`issues.impactValue.${r.production_impact}`) },
    { key: 'responsible_party', label: 'issues.responsible', render: (r) => [r.responsible_party, r.due_date && date.format(new Date(`${r.due_date}T12:00:00`))].filter(Boolean).join(' · ') || '—' },
    { key: 'status', label: 'issues.statusLabel', render: (r) => t(`issues.status.${r.status}`) },
  ]
  const summary = (rows) => [
    { label: t('issues.sumOpen'), value: rows.filter((r) => !DONE.includes(r.status)).length },
    { label: t('issues.sumCritical'), value: rows.filter((r) => ['high', 'critical'].includes(r.severity) && !DONE.includes(r.status)).length },
    { label: t('issues.sumResolved'), value: rows.filter((r) => DONE.includes(r.status)).length },
  ]
  return <RecordListSection {...props} table="daily_report_issues" select={SELECT} fields={FIELDS} columns={columns} toPayload={toPayload} summary={summary}
    validate={(f) => (f.production_impact !== 'none' && !f.impact_description.trim() ? 'issues.errImpact' : null)}
    tabKey="tab.issues" textKey="issues.text" emptyKey="issues.empty" addKey="issues.add" saveKey="issues.save" savedKey="list.saved" deletedKey="list.deleted" confirmKey="list.confirmDelete" />
}
