'use client'

import RecordListSection from './RecordListSection'
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

export default function EquipmentSection(props) {
  const { t } = props
  const { formatNumber } = useLanguage()
  const h = (v) => (v === null || v === undefined ? '—' : `${formatNumber(Number(v))} h`)
  const columns = [
    { key: 'equipment_name', label: 'equipment.name', render: (r) => <><strong>{r.quantity > 1 ? `${r.quantity}× ` : ''}{r.equipment_name}</strong>{(r.equipment_code || r.company_name) && <small style={{ display: 'block', color: '#82939e' }}>{[r.equipment_code, r.company_name].filter(Boolean).join(' · ')}</small>}</> },
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
  return <RecordListSection {...props} table="daily_report_equipment" select={SELECT} fields={FIELDS} columns={columns} toPayload={toPayload} summary={summary}
    tabKey="tab.equipment" textKey="equipment.text" emptyKey="equipment.empty" addKey="equipment.add" saveKey="equipment.save" savedKey="list.saved" deletedKey="list.deleted" confirmKey="list.confirmDelete" />
}
