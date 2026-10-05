'use client'

import { useState } from 'react'
import RecordListSection from './RecordListSection'
import styles from '../daily-reports.module.css'
import { useLanguage } from '../../../../../lib/i18n/LanguageProvider'

const STATUS = ['operating', 'idle', 'maintenance', 'out_of_service'].map((v) => ({ value: v, label: `equipment.status.${v}` }))
const FIELDS = [
  { key: 'equipment_name', type: 'text', label: 'equipment.name', required: true },
  { key: 'equipment_code', type: 'text', label: 'equipment.code' },
  { key: 'company_name', type: 'text', label: 'equipment.company' },
  { key: 'quantity', type: 'number', label: 'equipment.quantity', required: true, min: 1, step: 1, default: 1 },
  { key: 'operating_status', type: 'select', label: 'equipment.statusLabel', options: STATUS, required: true, default: 'operating' },
  { key: 'hours_used', type: 'number', label: 'equipment.hoursUsed', min: 0, step: 0.25 },
  { key: 'idle_hours', type: 'number', label: 'equipment.idleHours', min: 0, step: 0.25 },
  { key: 'location_id', type: 'location', label: 'equipment.location' },
  { key: 'work_description', type: 'textarea', label: 'equipment.work', span: true },
  { key: 'notes', type: 'textarea', label: 'equipment.notes', span: true },
]
const SELECT = 'id,equipment_name,equipment_code,company_name,quantity,hours_used,idle_hours,operating_status,work_description,notes,location_id,created_at'
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v))

function toPayload(f, { location }) {
  return {
    equipment_name: f.equipment_name.trim(),
    equipment_code: f.equipment_code.trim() || null,
    company_name: f.company_name.trim() || null,
    quantity: Math.max(1, parseInt(f.quantity, 10) || 1),
    operating_status: f.operating_status,
    hours_used: num(f.hours_used),
    idle_hours: num(f.idle_hours),
    location_id: location?.id || null,
    work_description: f.work_description.trim() || null,
    notes: f.notes.trim() || null,
  }
}

/** Copies the equipment list of the most recent earlier report of this project (hours are left empty). */
async function copyFromPrevious(supabase, report) {
  const { data: previous, error } = await supabase.from('daily_reports').select('id,report_date')
    .eq('project_id', report.projects.id).lt('report_date', report.report_date).order('report_date', { ascending: false }).limit(10)
  if (error) return { error }
  for (const candidate of previous || []) {
    const { data: items } = await supabase.from('daily_report_equipment').select('equipment_name,equipment_code,company_name,quantity,operating_status,location_id').eq('daily_report_id', candidate.id)
    if (!items?.length) continue
    const { data: auth } = await supabase.auth.getUser()
    const rows = items.map((item) => ({ ...item, operating_status: item.operating_status === 'out_of_service' ? 'out_of_service' : 'operating', daily_report_id: report.id, created_by: auth?.user?.id || null }))
    const { error: insertError } = await supabase.from('daily_report_equipment').insert(rows)
    return insertError ? { error: insertError } : { count: rows.length, date: candidate.report_date }
  }
  return { count: 0 }
}

export default function EquipmentSection(props) {
  const { t, supabase, report, language } = props
  const [copying, setCopying] = useState(false)
  const [copyMessage, setCopyMessage] = useState('')

  const headerActions = ({ rows, reload, locked }) => !locked && rows.length === 0 && <button type="button" className={styles.secondaryButton} disabled={copying} onClick={async () => {
    setCopying(true); setCopyMessage('')
    const result = await copyFromPrevious(supabase, report)
    if (result.error) setCopyMessage(t('common.error', { message: result.error.message }))
    else if (!result.count) setCopyMessage(t('equipment.copyNone'))
    else { setCopyMessage(t('equipment.copied', { count: result.count, date: new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(`${result.date}T12:00:00`)) })); await reload() }
    setCopying(false)
  }}>{copying ? t('common.saving') : t('equipment.copyPrevious')}</button>
  const { formatNumber } = useLanguage()
  const h = (v) => (v === null || v === undefined ? '—' : `${formatNumber(Number(v))} h`)
  const columns = [
    { key: 'equipment_name', label: 'equipment.name', render: (r) => <><strong>{r.quantity > 1 ? `${r.quantity}× ` : ''}{r.equipment_name}</strong>{(r.equipment_code || r.company_name) && <small style={{ display: 'block', color: 'var(--fo-faint)' }}>{[r.equipment_code, r.company_name].filter(Boolean).join(' · ')}</small>}</> },
    { key: 'operating_status', label: 'equipment.statusLabel', render: (r) => t(`equipment.status.${r.operating_status}`) },
    { key: 'hours_used', label: 'equipment.hoursUsed', render: (r) => h(r.hours_used) },
    { key: 'idle_hours', label: 'equipment.idleHours', render: (r) => h(r.idle_hours) },
    { key: 'work_description', label: 'equipment.work' },
  ]
  const summary = (rows) => {
    const sum = (k) => rows.reduce((s, r) => s + Number(r[k] || 0) * 1, 0)
    return [
      { label: t('equipment.sumUnits'), value: rows.reduce((s, r) => s + (r.quantity || 0), 0) },
      { label: t('equipment.hoursUsed'), value: `${formatNumber(sum('hours_used'))} h` },
      { label: t('equipment.idleHours'), value: `${formatNumber(sum('idle_hours'))} h` },
    ]
  }
  return <>{copyMessage && <div className={styles.lockNote} style={{ background: 'var(--fo-teal-wash)', color: 'var(--fo-teal-ink)' }}>{copyMessage}</div>}<RecordListSection {...props} headerActions={headerActions} table="daily_report_equipment" select={SELECT} fields={FIELDS} columns={columns} toPayload={toPayload} summary={summary}
    tabKey="tab.equipment" textKey="equipment.text" emptyKey="equipment.empty" addKey="equipment.add" saveKey="equipment.save" savedKey="list.saved" deletedKey="list.deleted" confirmKey="list.confirmDelete" /></>
}
