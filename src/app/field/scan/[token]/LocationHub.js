'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../../../lib/supabase/client'
import { useT } from '../../../../lib/i18n/useT'
import { useLanguage } from '../../../../lib/i18n/LanguageProvider'
import LanguageSelector from '../../../../components/LanguageSelector'

const supabase = createClient()

function deviceLocation() {
  return new Promise((resolve) => {
    if (!navigator?.geolocation) return resolve({ latitude: null, longitude: null, accuracy: null })
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }),
      () => resolve({ latitude: null, longitude: null, accuracy: null }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    )
  })
}

// Database messages (English) -> translated, user-facing explanations.
const ERROR_KEYS = [
  ['No active FieldOp worker is linked', 'err.noWorker'],
  ['No active project assignment', 'err.noAssignment'],
  ['already has an open attendance session', 'err.alreadyIn'],
  ['while a FieldOp execution is still active', 'err.workActive'],
  ['already has work in progress', 'err.busy'],
  ['not enabled for FieldOp', 'err.notEnabled'],
  ['not active in FieldOp', 'err.inactiveActivity'],
  ['Check in to the project before starting work', 'err.checkInFirst'],
  ['exceeds the remaining allocated quantity', 'err.overQuantity'],
  ['Quantity must be zero or greater', 'err.quantity'],
]

function buildBreadcrumb(location, locations, projectName) {
  const byId = new Map((locations || []).map((item) => [item.id, item]))
  const names = []
  const visited = new Set()
  let current = location
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    names.unshift(current.name)
    current = current.parent_id ? byId.get(current.parent_id) : null
  }
  return [projectName, ...names].filter(Boolean).join(' / ')
}

export default function LocationHub({ token }) {
  const t = useT('fieldopHub')
  const { language } = useLanguage()
  const [state, setState] = useState({ loading: true })
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [quantity, setQuantity] = useState('')
  const [now, setNow] = useState(Date.now())

  const explain = useCallback((err) => {
    const message = err?.message || String(err || '')
    const match = ERROR_KEYS.find(([fragment]) => message.includes(fragment))
    return match ? t(match[1]) : t('err.generic', { message })
  }, [t])

  const load = useCallback(async () => {
    const { data: location, error: locationError } = await supabase.from('locations').select('id, project_id, parent_id, name, location_type, environment_type, qr_token').eq('qr_token', token).maybeSingle()
    if (locationError || !location) { setState({ loading: false, unavailable: true }); return }

    const projectId = location.project_id
    const [projectResult, hierarchyResult, enabledResult, activitiesResult, allocationsResult, attendanceResult] = await Promise.all([
      supabase.from('projects').select('id, project_id, code, name').eq('id', projectId).maybeSingle(),
      supabase.from('locations').select('id, parent_id, name').eq('project_id', projectId),
      supabase.from('fieldop_project_locations').select('id').eq('project_id', projectId).eq('location_id', location.id).eq('is_active', true).maybeSingle(),
      supabase.from('fieldop_project_activities').select('id, activity_name, unit, source, scope_item_id, is_active, scope_item:project_scopes(id, scope_code, scope_name, unit)').eq('project_id', projectId).eq('is_active', true),
      supabase.from('location_service_quantities').select('id, service_id, quantity').eq('project_id', projectId).eq('location_id', location.id),
      supabase.rpc('fieldop_worker_attendance_status', { p_project_id: projectId }),
    ])
    if (!projectResult.data) { setState({ loading: false, unavailable: true }); return }

    const attendance = Array.isArray(attendanceResult.data) ? attendanceResult.data[0] || null : null
    const workerId = attendance?.worker_id || null
    const allocations = allocationsResult.data || []
    const allocationIds = allocations.map((a) => a.id)

    const [completedResult, activeResult, sessionResult] = await Promise.all([
      allocationIds.length
        ? supabase.from('field_execution_events').select('location_service_quantity_id, actual_quantity').in('location_service_quantity_id', allocationIds).eq('status', 'completed')
        : Promise.resolve({ data: [] }),
      workerId
        ? supabase.from('field_execution_events').select('id, location_id, location_service_quantity_id, fieldop_activity_id, unit, started_at').eq('worker_id', workerId).eq('status', 'in_progress').limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
      attendance?.session_id
        ? supabase.from('field_attendance_sessions').select('id, check_in_at, status').eq('id', attendance.session_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const doneBy = {}
    for (const row of completedResult.data || []) doneBy[row.location_service_quantity_id] = (doneBy[row.location_service_quantity_id] || 0) + Number(row.actual_quantity || 0)

    const activityById = new Map((activitiesResult.data || []).map((a) => [a.id, a]))
    const describe = (activity) => ({
      name: activity?.source === 'scope' ? (activity?.scope_item?.scope_name || activity?.activity_name) : activity?.activity_name,
      code: activity?.source === 'scope' ? (activity?.scope_item?.scope_code || '') : '',
      unit: activity?.source === 'scope' ? (activity?.scope_item?.unit || activity?.unit || '') : (activity?.unit || ''),
    })
    const enabled = Boolean(enabledResult.data)
    const items = enabled
      ? allocations.filter((a) => activityById.has(a.service_id)).map((allocation) => {
        const allocated = Number(allocation.quantity || 0)
        const done = doneBy[allocation.id] || 0
        return { allocationId: allocation.id, ...describe(activityById.get(allocation.service_id)), allocated, done, remaining: Math.max(allocated - done, 0) }
      })
      : []

    // Work in progress may be at another location; fetch its names for the banner.
    let active = activeResult.data || null
    if (active) {
      const [activeActivity, activeLocation, activeAllocation, activeDone] = await Promise.all([
        activityById.get(active.fieldop_activity_id) ? Promise.resolve({ data: activityById.get(active.fieldop_activity_id) }) : supabase.from('fieldop_project_activities').select('id, activity_name, unit, source, scope_item:project_scopes(scope_code, scope_name, unit)').eq('id', active.fieldop_activity_id).maybeSingle(),
        supabase.from('locations').select('name').eq('id', active.location_id).maybeSingle(),
        supabase.from('location_service_quantities').select('quantity').eq('id', active.location_service_quantity_id).maybeSingle(),
        supabase.from('field_execution_events').select('actual_quantity').eq('location_service_quantity_id', active.location_service_quantity_id).eq('status', 'completed'),
      ])
      const info = describe(activeActivity.data)
      const done = (activeDone.data || []).reduce((sum, row) => sum + Number(row.actual_quantity || 0), 0)
      active = { ...active, activityName: info.name, unit: active.unit || info.unit, locationName: activeLocation.data?.name || '', remaining: Math.max(Number(activeAllocation.data?.quantity || 0) - done, 0) }
    }

    setState({
      loading: false,
      location,
      project: projectResult.data,
      breadcrumb: buildBreadcrumb(location, hierarchyResult.data || [], projectResult.data.name),
      enabled,
      items,
      checkedIn: Boolean(attendance?.session_id && attendance?.status === 'open'),
      checkInAt: sessionResult.data?.check_in_at || attendance?.check_in_at || null,
      active,
    })
    setNow(Date.now())
  }, [token])

  useEffect(() => { load().catch((e) => { setError(explain(e)); setState({ loading: false, unavailable: true }) }) }, [load, explain])
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(id)
  }, [])

  const number = useMemo(() => new Intl.NumberFormat(language, { maximumFractionDigits: 2 }), [language])
  const time = useMemo(() => new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }), [language])
  const elapsed = (value) => {
    const minutes = Math.max(0, Math.floor((now - new Date(value).getTime()) / 60000))
    return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
  }

  async function run(kind, action, successKey, vars) {
    setBusy(kind); setError(''); setNotice('')
    try {
      await action()
      setNotice(t(successKey, vars))
      await load()
    } catch (e) { setError(explain(e)) }
    finally { setBusy('') }
  }

  const checkIn = () => run('checkIn', async () => {
    setNotice(t('capturing'))
    const position = await deviceLocation()
    const { error: rpcError } = await supabase.rpc('fieldop_self_check_in', { p_project_id: state.project.id, p_latitude: position.latitude, p_longitude: position.longitude, p_gps_accuracy_m: position.accuracy, p_location_id: state.location.id })
    if (rpcError) throw rpcError
  }, 'checkedIn')

  const checkOut = () => run('checkOut', async () => {
    setNotice(t('capturing'))
    const position = await deviceLocation()
    const { error: rpcError } = await supabase.rpc('fieldop_self_check_out', { p_project_id: state.project.id, p_latitude: position.latitude, p_longitude: position.longitude, p_gps_accuracy_m: position.accuracy })
    if (rpcError) throw rpcError
  }, 'checkedOut')

  const start = (allocationId) => run(`start-${allocationId}`, async () => {
    const { error: rpcError } = await supabase.rpc('fieldop_start_execution', { p_location_service_quantity_id: allocationId })
    if (rpcError) throw rpcError
    setQuantity('')
  }, 'started')

  const finish = () => {
    const value = Number(String(quantity).replace(',', '.'))
    if (quantity === '' || !Number.isFinite(value) || value < 0) { setError(t('err.quantity')); return }
    run('finish', async () => {
      const { error: rpcError } = await supabase.rpc('fieldop_finish_execution', { p_execution_id: state.active.id, p_quantity: value })
      if (rpcError) throw rpcError
      setQuantity('')
    }, 'finished', { quantity: number.format(value), unit: state.active?.unit || '' })
  }

  if (state.loading) return <main style={shell}><section style={card}><div style={eyebrow}>{t('eyebrow')}</div><p style={copy}>{t('loading')}</p></section></main>

  if (state.unavailable) return <main style={shell}><section style={card}>
    <div style={topRow}><div style={eyebrow}>{t('eyebrow')}</div><LanguageSelector compact /></div>
    <h1 style={title}>{t('unavailableTitle')}</h1>
    <p style={copy}>{t('unavailableText')}</p>
    {error && <div style={errorBox}>{error}</div>}
    <Link href="/workspaces" style={primaryButton}>{t('backToRitsuFlow')}</Link>
  </section></main>

  const { location, project, breadcrumb, enabled, items, checkedIn, checkInAt, active } = state

  return <main style={shell}><section style={card}>
    <div style={topRow}><div style={eyebrow}>{t('eyebrow')}</div><LanguageSelector compact /></div>
    <div style={projectLine}>{project.project_id || project.code || ''} · {project.name}</div>
    <h1 style={title}>{location.name}</h1>
    <p style={breadcrumbStyle}>{breadcrumb}</p>

    <div style={identityBox}>
      <div style={confirmedRow}><span style={confirmedDot} /><span style={identityLabel}>{t('confirmed')}</span></div>
      <strong style={identityValue}>{location.name}</strong>
      <span style={identityMeta}>{location.environment_type || location.location_type || t('productionLocation')}</span>
    </div>

    {error && <div style={{ ...errorBox, marginTop: 16 }}>{error}</div>}
    {notice && !error && <div style={noticeBox}>{notice}</div>}

    <div style={sectionHeader}><div><span style={identityLabel}>{t('attendanceLabel')}</span><h2 style={sectionTitle}>{t('attendanceTitle')}</h2></div></div>
    {checkedIn
      ? <div style={attendanceActiveBox}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <strong style={attendanceTitle}>{t('onSite')}</strong>
            <div style={identityMeta}>{checkInAt ? t('onSiteSince', { time: time.format(new Date(checkInAt)) }) : ''}</div>
          </div>
          <button type="button" onClick={checkOut} disabled={Boolean(busy) || Boolean(active)} title={active ? t('checkOutBlocked') : ''} style={{ ...secondaryAction, opacity: active ? 0.55 : 1 }}>{busy === 'checkOut' ? t('checkingOut') : t('checkOut')}</button>
        </div>
        {active && <span style={identityMeta}>{t('checkOutBlocked')}</span>}
      </div>
      : <div style={attendanceReadyBox}>
        <div><strong style={attendanceTitle}>{t('checkInTitle')}</strong><p style={attendanceCopy}>{t('checkInText')}</p></div>
        <button type="button" onClick={checkIn} disabled={Boolean(busy)} style={checkInButton}>{busy === 'checkIn' ? t('checkingIn') : t('checkIn')}</button>
      </div>}

    {active && <div style={activeBox}>
      <span style={{ ...identityLabel, color: '#9a5b00' }}>{t('activeLabel')}</span>
      <strong style={{ fontSize: 16 }}>{t('activeAt', { activity: active.activityName || '—', location: active.locationName || '—' })}</strong>
      <span style={identityMeta}>{t('activeSince', { time: time.format(new Date(active.started_at)), minutes: elapsed(active.started_at) })}</span>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 6 }}>
        <label style={{ display: 'grid', gap: 5, fontSize: 11, fontWeight: 800, color: '#4d6573' }}>
          {t('quantityDone', { unit: active.unit || '—' })}
          <input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={quantityInput} placeholder="0" />
          <small style={{ fontWeight: 400 }}>{t('quantityHint', { remaining: number.format(active.remaining), unit: active.unit || '' })}</small>
        </label>
        <button type="button" onClick={finish} disabled={Boolean(busy)} style={finishButton}>{busy === 'finish' ? t('finishing') : t('finish')}</button>
      </div>
    </div>}

    <div style={sectionHeader}>
      <div><span style={identityLabel}>{t('activitiesLabel')}</span><h2 style={sectionTitle}>{t('activitiesTitle')}</h2></div>
      <span style={countBadge}>{items.length}</span>
    </div>
    {!enabled
      ? <div style={warningBox}><strong>{t('notEnabledTitle')}</strong><span>{t('notEnabledText')}</span></div>
      : items.length === 0
        ? <div style={emptyState}>{t('noActivities')}</div>
        : <div style={activityList}>{items.map((item, index) => {
          const isActiveHere = active?.location_service_quantity_id === item.allocationId
          const complete = item.remaining <= 0
          let action
          if (isActiveHere) action = <span style={{ ...pill, background: '#fff4dc', color: '#946200' }}>{t('activeLabel')}</span>
          else if (complete) action = <span style={{ ...pill, background: '#e2f7ed', color: '#11864c' }}>{t('completedAllocation')}</span>
          else if (!checkedIn) action = <span style={pillMuted}>{t('checkInFirst')}</span>
          else if (active) action = <span style={pillMuted}>{t('busyElsewhere')}</span>
          else action = <button type="button" onClick={() => start(item.allocationId)} disabled={Boolean(busy)} style={startButton}>{busy === `start-${item.allocationId}` ? t('starting') : t('start')}</button>
          return <div key={item.allocationId} style={{ ...activityRow, ...(index === items.length - 1 ? { borderBottom: 0 } : {}) }}>
            <div style={{ minWidth: 0 }}>
              <strong style={activityName}>{item.name}</strong>
              {item.code ? <span style={activityCode}>{item.code}</span> : null}
              <span style={activityNumbers}>{t('allocated')} {number.format(item.allocated)} · {t('done')} {number.format(item.done)} · {t('remaining')} {number.format(item.remaining)} {item.unit}</span>
            </div>
            {action}
          </div>
        })}</div>}

    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 22 }}>
      <Link href={`/projects/${project.id}/locations`} style={secondaryButton}>{t('openBreakdown')}</Link>
    </div>
  </section></main>
}

const shell = { minHeight: '100vh', background: '#edf4f6', padding: '28px 18px', boxSizing: 'border-box', fontFamily: 'Arial,sans-serif', color: '#082f43' }
const card = { width: '100%', maxWidth: 760, margin: '0 auto', background: '#fff', border: '1px solid #d7e3e8', borderRadius: 18, padding: 28, boxSizing: 'border-box', boxShadow: '0 16px 40px rgba(7,47,67,.08)' }
const topRow = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }
const eyebrow = { fontSize: 10, fontWeight: 900, letterSpacing: '.14em', color: '#008f84' }
const projectLine = { marginTop: 16, fontSize: 11, color: '#6d8290', fontWeight: 700 }
const title = { margin: '6px 0 0', fontSize: 30, lineHeight: 1.1 }
const copy = { margin: '12px 0 22px', color: '#607888', fontSize: 14, lineHeight: 1.6 }
const breadcrumbStyle = { margin: '8px 0 22px', color: '#718594', fontSize: 12, lineHeight: 1.5 }
const identityBox = { display: 'flex', flexDirection: 'column', gap: 5, padding: 18, borderRadius: 12, background: '#effaf8', border: '1px solid #cbe9e4' }
const confirmedRow = { display: 'flex', alignItems: 'center', gap: 7 }
const confirmedDot = { width: 7, height: 7, borderRadius: '50%', background: '#008f84', flex: '0 0 auto' }
const identityLabel = { fontSize: 9, fontWeight: 900, letterSpacing: '.12em', color: '#008f84' }
const identityValue = { fontSize: 18 }
const identityMeta = { fontSize: 11, color: '#607888' }
const sectionHeader = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginTop: 28, marginBottom: 12 }
const sectionTitle = { margin: '4px 0 0', fontSize: 18 }
const countBadge = { minWidth: 32, height: 32, borderRadius: 16, display: 'grid', placeItems: 'center', background: '#073b58', color: '#fff', fontWeight: 900, fontSize: 12 }
const attendanceActiveBox = { display: 'flex', flexDirection: 'column', gap: 6, padding: 18, borderRadius: 12, background: '#effaf8', border: '1px solid #b9ddd8' }
const attendanceReadyBox = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: 18, borderRadius: 12, background: '#f8fafb', border: '1px solid #dce6ea' }
const attendanceTitle = { fontSize: 14 }
const attendanceCopy = { maxWidth: 480, margin: '5px 0 0', color: '#607888', fontSize: 11, lineHeight: 1.5 }
const checkInButton = { minHeight: 42, padding: '0 16px', border: 0, borderRadius: 9, background: '#008f84', color: '#fff', fontWeight: 850, fontSize: 12, cursor: 'pointer' }
const secondaryAction = { minHeight: 38, padding: '0 14px', border: '1px solid #b9ddd8', borderRadius: 9, background: '#fff', color: '#0b4f4a', fontWeight: 800, fontSize: 12, cursor: 'pointer' }
const activeBox = { display: 'flex', flexDirection: 'column', gap: 5, marginTop: 16, padding: 18, borderRadius: 12, background: '#fff8ea', border: '1px solid #f3d9a4' }
const quantityInput = { width: 160, height: 40, border: '1px solid #cbd9df', borderRadius: 8, padding: '0 10px', fontSize: 16 }
const finishButton = { minHeight: 42, padding: '0 18px', border: 0, borderRadius: 9, background: '#073b58', color: '#fff', fontWeight: 850, fontSize: 12, cursor: 'pointer' }
const activityList = { border: '1px solid #e0e8ec', borderRadius: 12, overflow: 'hidden' }
const activityRow = { minHeight: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '10px 14px', borderBottom: '1px solid #e8eef1' }
const activityName = { display: 'block', fontSize: 13 }
const activityCode = { display: 'block', marginTop: 3, fontSize: 9, color: '#718594', fontWeight: 800 }
const activityNumbers = { display: 'block', marginTop: 4, fontSize: 11, color: '#4d6573' }
const startButton = { minHeight: 38, padding: '0 14px', border: 0, borderRadius: 9, background: '#008f84', color: '#fff', fontWeight: 850, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }
const pill = { padding: '6px 10px', borderRadius: 999, fontSize: 10, fontWeight: 900, whiteSpace: 'nowrap' }
const pillMuted = { ...pill, background: '#eef2f4', color: '#5f7684' }
const emptyState = { padding: 20, border: '1px dashed #d3e0e6', borderRadius: 10, color: '#718594', textAlign: 'center', fontSize: 12 }
const warningBox = { display: 'flex', flexDirection: 'column', gap: 5, padding: 16, borderRadius: 10, background: '#fff8ea', border: '1px solid #f3d9a4', color: '#6b4a00', fontSize: 12, lineHeight: 1.5 }
const errorBox = { display: 'block', padding: 14, borderRadius: 10, background: '#fff6f2', border: '1px solid #f1cfc2', color: '#7a3825', fontSize: 12, lineHeight: 1.5, marginBottom: 14 }
const noticeBox = { marginTop: 16, padding: 14, borderRadius: 10, background: '#effaf8', border: '1px solid #cbe9e4', color: '#0b4f4a', fontSize: 12 }
const primaryButton = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 42, padding: '0 16px', borderRadius: 9, background: '#073b58', color: '#fff', textDecoration: 'none', fontWeight: 850, fontSize: 12 }
const secondaryButton = { ...primaryButton, background: '#edf3f6', color: '#173f53' }
