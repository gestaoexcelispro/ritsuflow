'use client'

import { useRef, useState } from 'react'
import RecordListSection from './RecordListSection'
import InvoiceImport from './InvoiceImport'
import styles from '../daily-reports.module.css'
import { useLanguage } from '../../../../../lib/i18n/LanguageProvider'

const MOVEMENT = [{ value: 'received', label: 'materials.move.received' }, { value: 'used', label: 'materials.move.used' }]
const FIELDS = [
  { key: 'movement_type', type: 'select', label: 'materials.movement', options: MOVEMENT, required: true, default: 'received' },
  { key: 'material_name', type: 'text', label: 'materials.name', required: true },
  { key: 'material_code', type: 'text', label: 'materials.code' },
  { key: 'quantity', type: 'number', label: 'materials.quantity', required: true, min: 0, step: 'any' },
  { key: 'unit', type: 'text', label: 'materials.unit' },
  { key: 'supplier_name', type: 'text', label: 'materials.supplier', showIf: (f) => f.movement_type === 'received' },
  { key: 'delivery_reference', type: 'text', label: 'materials.reference', showIf: (f) => f.movement_type === 'received' },
  { key: 'delivery_time', type: 'time', label: 'materials.time', showIf: (f) => f.movement_type === 'received' },
  { key: 'notes', type: 'textarea', label: 'materials.notes', span: true },
]
const SELECT = 'id,movement_type,material_name,material_code,quantity,unit,supplier_name,delivery_reference,delivery_time,notes,created_at'

function toPayload(f) {
  const received = f.movement_type === 'received'
  return {
    movement_type: f.movement_type,
    material_name: f.material_name.trim(),
    material_code: f.material_code.trim() || null,
    quantity: Number(f.quantity),
    unit: f.unit.trim() || null,
    supplier_name: received ? f.supplier_name.trim() || null : null,
    delivery_reference: received ? f.delivery_reference.trim() || null : null,
    delivery_time: received && f.delivery_time ? f.delivery_time : null,
    notes: f.notes.trim() || null,
  }
}

export default function MaterialsSection(props) {
  const { t } = props
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState('')
  const reloadRef = useRef(null)
  const headerActions = ({ reload, locked }) => { reloadRef.current = reload; return !locked && !importing && <button type="button" className={styles.secondaryButton} onClick={() => { setImported(''); setImporting(true) }}>{t('invoice.button')}</button> }
  const { formatNumber } = useLanguage()
  const columns = [
    { key: 'movement_type', label: 'materials.movement', render: (r) => t(`materials.move.${r.movement_type}`) },
    { key: 'material_name', label: 'materials.name', render: (r) => <><strong>{r.material_name}</strong>{r.material_code && <small style={{ display: 'block', color: 'var(--fo-faint)' }}>{r.material_code}</small>}</> },
    { key: 'quantity', label: 'materials.quantity', render: (r) => `${formatNumber(Number(r.quantity))} ${r.unit || ''}` },
    { key: 'supplier_name', label: 'materials.supplier', render: (r) => [r.supplier_name, r.delivery_reference].filter(Boolean).join(' · ') || '—' },
    { key: 'delivery_time', label: 'materials.time', render: (r) => r.delivery_time?.slice(0, 5) || '—' },
    { key: 'notes', label: 'materials.notes' },
  ]
  const summary = (rows) => [
    { label: t('materials.sumReceived'), value: rows.filter((r) => r.movement_type === 'received').length },
    { label: t('materials.sumUsed'), value: rows.filter((r) => r.movement_type === 'used').length },
  ]
  return <>
    {imported && <div className={styles.lockNote} style={{ background: 'var(--fo-ok-wash)', color: 'var(--fo-ok)' }}>{imported}</div>}
    {importing && <InvoiceImport {...props} onClose={() => setImporting(false)} onImported={async (count) => { setImporting(false); setImported(t('invoice.done', { count })); await reloadRef.current?.() }} />}
    <RecordListSection {...props} headerActions={headerActions} table="daily_report_materials" select={SELECT} fields={FIELDS} columns={columns} toPayload={toPayload} summary={summary}
    tabKey="tab.materials" textKey="materials.text" emptyKey="materials.empty" addKey="materials.add" saveKey="materials.save" savedKey="list.saved" deletedKey="list.deleted" confirmKey="list.confirmDelete" />
  </>
}
