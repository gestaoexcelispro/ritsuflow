'use client'

import { useRef, useState } from 'react'
import styles from '../daily-reports.module.css'

const BUCKET = 'daily-report-attachments'
const MAX_PDF = 3 * 1024 * 1024

/* ---------- NF-e XML (Brazil): exact data, read in the browser ---------- */
function parseNfeXml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) return null
  const all = (parent, tag) => Array.from(parent.getElementsByTagNameNS('*', tag))
  const one = (parent, tag) => all(parent, tag)[0]?.textContent?.trim() || null
  const emit = all(doc, 'emit')[0]
  const ide = all(doc, 'ide')[0]
  const items = all(doc, 'det').map((det) => {
    const prod = all(det, 'prod')[0] || det
    const qty = Number(one(prod, 'qCom'))
    return { description: one(prod, 'xProd') || '', code: one(prod, 'cProd'), quantity: Number.isFinite(qty) ? qty : null, unit: one(prod, 'uCom') }
  }).filter((i) => i.description)
  if (!items.length) return null
  const number = ide ? one(ide, 'nNF') : null
  const series = ide ? one(ide, 'serie') : null
  return {
    source: 'xml',
    supplier_name: emit ? one(emit, 'xNome') : null,
    supplier_tax_id: emit ? one(emit, 'CNPJ') || one(emit, 'CPF') : null,
    invoice_number: number ? `${number}${series ? `/${series}` : ''}` : null,
    invoice_date: ide ? (one(ide, 'dhEmi') || one(ide, 'dEmi') || '').slice(0, 10) || null : null,
    items,
    warnings: [],
  }
}

/* ---------- Photos are reduced before upload (faster on site, under the server limit) ---------- */
async function shrinkPhoto(file, maxSide = 2000) {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    return blob ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: file.lastModified }) : file
  } catch { return file }
}

const toBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result).split(',')[1])
  reader.onerror = reject
  reader.readAsDataURL(file)
})

const isXml = (file) => /xml/.test(file.type) || /\.xml$/i.test(file.name)

/**
 * "Import from invoice" for the Materials section: photo / PDF (read by AI on the server) or
 * NF-e XML (read exactly in the browser). The user reviews the lines before anything is saved.
 */
export default function InvoiceImport({ report, supabase, t, onImported, onClose }) {
  const [step, setStep] = useState('pick') // pick → reading → review
  const [error, setError] = useState('')
  const [invoice, setInvoice] = useState(null)
  const [lines, setLines] = useState([])
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const camera = useRef(null)
  const picker = useRef(null)

  async function read(picked) {
    if (!picked) return
    setError(''); setStep('reading')
    try {
      let result
      let keep = null
      if (isXml(picked)) {
        result = parseNfeXml(await picked.text())
        if (!result) throw new Error(t('invoice.errXml'))
      } else if (picked.type === 'application/pdf') {
        if (picked.size > MAX_PDF) throw new Error(t('invoice.errTooLarge'))
        keep = picked
        result = await askAi(picked)
      } else if (picked.type.startsWith('image/')) {
        keep = await shrinkPhoto(picked)
        result = await askAi(keep)
      } else throw new Error(t('invoice.errType'))
      if (!result.items.length) throw new Error(t('invoice.errNoItems'))
      setFile(keep)
      setInvoice({ supplier_name: result.supplier_name || '', invoice_number: result.invoice_number || '', invoice_date: result.invoice_date, source: result.source, warnings: result.warnings || [] })
      setLines(result.items.map((item, i) => ({ key: i, include: true, description: item.description, code: item.code || '', quantity: item.quantity ?? '', unit: item.unit || '' })))
      setStep('review')
    } catch (e) {
      setError(e.message || t('invoice.errGeneric')); setStep('pick')
    } finally {
      if (camera.current) camera.current.value = ''
      if (picker.current) picker.current.value = ''
    }
  }

  async function askAi(upload) {
    const response = await fetch('/api/fieldop/invoice-import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reportId: report.id, mediaType: upload.type, data: await toBase64(upload) }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      const key = `invoice.err_${body.error || 'generic'}`
      const text = t(key)
      throw new Error(text === key ? t('invoice.errGeneric') : text)
    }
    return body
  }

  const setLine = (key, field, value) => setLines((cur) => cur.map((l) => (l.key === key ? { ...l, [field]: value } : l)))
  const chosen = lines.filter((l) => l.include)
  const invalid = chosen.some((l) => !l.description.trim() || l.quantity === '' || !Number.isFinite(Number(String(l.quantity).replace(',', '.'))))

  async function save() {
    if (!chosen.length || invalid) { setError(t('invoice.errReview')); return }
    setSaving(true); setError('')
    const { data: auth } = await supabase.auth.getUser()
    const userId = auth?.user?.id || null
    const rows = chosen.map((l) => ({
      daily_report_id: report.id,
      movement_type: 'received',
      material_name: l.description.trim(),
      material_code: l.code.trim() || null,
      quantity: Number(String(l.quantity).replace(',', '.')),
      unit: l.unit.trim() || null,
      supplier_name: invoice.supplier_name.trim() || null,
      delivery_reference: invoice.invoice_number.trim() || null,
      notes: invoice.source === 'xml' ? t('invoice.noteXml') : t('invoice.noteAi'),
      created_by: userId,
    }))
    const { error: insertError } = await supabase.from('daily_report_materials').insert(rows)
    if (insertError) { setError(t('common.error', { message: insertError.message })); setSaving(false); return }

    // Keep the invoice itself with the report (photo or PDF).
    if (file && report.projects?.id) {
      const ext = file.type === 'application/pdf' ? 'pdf' : 'jpg'
      const path = `${report.projects.id}/${report.id}/${crypto.randomUUID()}.${ext}`
      const upload = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false })
      if (!upload.error) {
        await supabase.from('daily_report_attachments').insert({
          daily_report_id: report.id, attachment_type: file.type === 'application/pdf' ? 'document' : 'photo',
          file_name: file.name, storage_bucket: BUCKET, storage_path: path, mime_type: file.type, file_size_bytes: file.size,
          title: t('invoice.attachmentTitle', { number: invoice.invoice_number || '—' }), uploaded_by: userId,
        })
      }
    }
    setSaving(false)
    onImported?.(rows.length)
  }

  const box = { border: '1px solid var(--fo-line)', borderRadius: 10, background: 'var(--fo-surface)', padding: 18, display: 'grid', gap: 14, marginBottom: 14 }
  const cell = { minHeight: 38, padding: '6px 8px' }

  return <section style={box} aria-label={t('invoice.title')}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
      <div><h3 style={{ margin: 0, fontSize: 17 }}>{t('invoice.title')}</h3><p style={{ margin: '4px 0 0', color: 'var(--fo-muted)', fontSize: 14 }}>{step === 'review' ? t('invoice.reviewText') : t('invoice.text')}</p></div>
      <button type="button" className={styles.secondaryButton} onClick={onClose}>{t('common.cancel')}</button>
    </div>
    {error && <div className={styles.error} style={{ marginBottom: 0 }}>{error}</div>}

    {step === 'pick' && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => read(e.target.files?.[0])} />
      <input ref={picker} type="file" accept="image/*,application/pdf,.xml,text/xml,application/xml" hidden onChange={(e) => read(e.target.files?.[0])} />
      <button type="button" className={styles.primaryButton} onClick={() => camera.current?.click()}>📷 {t('invoice.takePhoto')}</button>
      <button type="button" className={styles.secondaryButton} onClick={() => picker.current?.click()}>{t('invoice.chooseFile')}</button>
      <small style={{ color: 'var(--fo-muted)' }}>{t('invoice.hint')}</small>
    </div>}

    {step === 'reading' && <div className={styles.empty} style={{ padding: 24 }}>{t('invoice.reading')}</div>}

    {step === 'review' && <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}><b>{t('materials.supplier')}</b><input value={invoice.supplier_name} onChange={(e) => setInvoice({ ...invoice, supplier_name: e.target.value })} /></label>
        <label style={{ display: 'grid', gap: 6 }}><b>{t('materials.reference')}</b><input value={invoice.invoice_number} onChange={(e) => setInvoice({ ...invoice, invoice_number: e.target.value })} /></label>
        <div style={{ display: 'grid', gap: 6, alignContent: 'end', color: 'var(--fo-muted)', fontSize: 14 }}>{invoice.source === 'xml' ? t('invoice.fromXml') : t('invoice.fromAi')}</div>
      </div>
      {invoice.warnings.length > 0 && <div className={styles.lockNote} style={{ marginBottom: 0 }}>{t('invoice.warnings')}: {invoice.warnings.join(' · ')}</div>}
      <div style={{ overflowX: 'auto' }}><table className={`${styles.table} ${styles.cardsTable}`}>
        <thead><tr><th /><th>{t('materials.name')}</th><th>{t('materials.code')}</th><th>{t('materials.quantity')}</th><th>{t('materials.unit')}</th></tr></thead>
        <tbody>{lines.map((l) => <tr key={l.key} style={l.include ? undefined : { opacity: 0.45 }}>
          <td data-label=""><input type="checkbox" checked={l.include} onChange={(e) => setLine(l.key, 'include', e.target.checked)} aria-label={t('invoice.include')} /></td>
          <td data-label=""><input style={{ ...cell, minWidth: 240 }} value={l.description} onChange={(e) => setLine(l.key, 'description', e.target.value)} /></td>
          <td data-label={t('materials.code')}><input style={{ ...cell, width: 120 }} value={l.code} onChange={(e) => setLine(l.key, 'code', e.target.value)} /></td>
          <td data-label={t('materials.quantity')}><input style={{ ...cell, width: 110, textAlign: 'right' }} inputMode="decimal" value={l.quantity} onChange={(e) => setLine(l.key, 'quantity', e.target.value)} /></td>
          <td data-label={t('materials.unit')}><input style={{ ...cell, width: 80 }} value={l.unit} onChange={(e) => setLine(l.key, 'unit', e.target.value)} /></td>
        </tr>)}</tbody>
      </table></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--fo-muted)', fontSize: 14 }}>{t('invoice.selected', { count: chosen.length, total: lines.length })}</span>
        <span style={{ display: 'flex', gap: 8 }}>
          <button type="button" className={styles.secondaryButton} onClick={() => { setStep('pick'); setLines([]); setInvoice(null); setFile(null) }}>{t('invoice.another')}</button>
          <button type="button" className={styles.primaryButton} disabled={saving || !chosen.length} onClick={save}>{saving ? t('common.saving') : t('invoice.add', { count: chosen.length })}</button>
        </span>
      </div>
    </>}
  </section>
}
