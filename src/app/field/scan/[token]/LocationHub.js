'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../../../lib/supabase/client'
import { useT } from '../../../../lib/i18n/useT'
import { useLanguage } from '../../../../lib/i18n/LanguageProvider'
import LanguageSelector from '../../../../components/LanguageSelector'
import { plex } from '../../../fieldop/ui/font'
import styles from './hub.module.css'

// Page frame (kept outside the component so the quantity input keeps focus while typing).
function Frame({ children, head }) {
  return <main className={`${styles.hub} ${plex.variable}`}>
    <header className={styles.band}>
      <div className={styles.bandTop}><img src="/logo-white.png" alt="RitsuFlow" className={styles.logo} /><LanguageSelector compact dark /></div>
      {head}
    </header>
    <div className={styles.body}>{children}</div>
  </main>
}

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

  if (state.loading) return <Frame head={<p className={styles.bandText}>{t('loading')}</p>} />

  if (state.unavailable) return <Frame head={<h1 className={styles.place}>{t('unavailableTitle')}</h1>}>
    <p className={styles.text}>{t('unavailableText')}</p>
    {error && <div className={styles.error}>{error}</div>}
    <Link href="/workspaces" className={styles.secondary}>{t('backToRitsuFlow')}</Link>
  </Frame>

  const { location, project, breadcrumb, enabled, items, checkedIn, checkInAt, active } = state

  return <Frame head={<>
    <div className={styles.project}>{[project.project_id || project.code, project.name].filter(Boolean).join(' · ')}</div>
    <h1 className={styles.place}>{location.name}</h1>
    <div className={styles.where}><span className={styles.qrOk}>{t('confirmed')}</span><span>{breadcrumb}</span></div>
  </>}>
    {error && <div className={styles.error} role="alert">{error}</div>}
    {notice && !error && <div className={styles.notice} role="status">{notice}</div>}

    <section className={`${styles.attendance} ${checkedIn ? styles.onSite : ''}`} aria-label={t('attendanceTitle')}>
      {checkedIn ? <>
        <div className={styles.attLine}><span className={styles.dot} /><div><strong>{t('onSite')}</strong><span>{checkInAt ? t('onSiteSince', { time: time.format(new Date(checkInAt)) }) : ''}</span></div></div>
        <button type="button" onClick={checkOut} disabled={Boolean(busy) || Boolean(active)} className={styles.outline}>{busy === 'checkOut' ? t('checkingOut') : t('checkOut')}</button>
        {active && <small className={styles.hint}>{t('checkOutBlocked')}</small>}
      </> : <>
        <div><strong>{t('checkInTitle')}</strong><span>{t('checkInText')}</span></div>
        <button type="button" onClick={checkIn} disabled={Boolean(busy)} className={styles.big}>{busy === 'checkIn' ? t('checkingIn') : t('checkIn')}</button>
      </>}
    </section>

    {active && <section className={styles.active}>
      <span className={styles.activeTag}>{t('activeLabel')} · {elapsed(active.started_at)}</span>
      <strong className={styles.activeName}>{active.activityName || '—'}</strong>
      <span className={styles.muted}>{t('activeSince', { time: time.format(new Date(active.started_at)), minutes: elapsed(active.started_at) })}{active.locationName && active.locationName !== location.name ? ` · ${active.locationName}` : ''}</span>
      <label className={styles.qtyLabel} htmlFor="hub-qty">{t('quantityDone', { unit: active.unit || '—' })}</label>
      <div className={styles.qtyRow}>
        <input id="hub-qty" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={styles.qty} placeholder="0" />
        <button type="button" onClick={finish} disabled={Boolean(busy)} className={styles.big}>{busy === 'finish' ? t('finishing') : t('finish')}</button>
      </div>
      <small className={styles.hint}>{t('quantityHint', { remaining: number.format(active.remaining), unit: active.unit || '' })}</small>
    </section>}

    <h2 className={styles.heading}>{t('activitiesTitle')} <span>{items.length}</span></h2>
    {!enabled
      ? <div className={styles.warn}><strong>{t('notEnabledTitle')}</strong><span>{t('notEnabledText')}</span></div>
      : items.length === 0
        ? <div className={styles.empty}>{t('noActivities')}</div>
        : <div className={styles.list}>{items.map((item) => {
          const isActiveHere = active?.location_service_quantity_id === item.allocationId
          const complete = item.remaining <= 0
          const pct = item.allocated > 0 ? Math.min(100, Math.round((item.done / item.allocated) * 100)) : 0
          let action
          if (isActiveHere) action = <span className={`${styles.tag} ${styles.tagWarn}`}>{t('activeLabel')}</span>
          else if (complete) action = <span className={`${styles.tag} ${styles.tagOk}`}>{t('completedAllocation')}</span>
          else if (!checkedIn) action = <span className={styles.tag}>{t('checkInFirst')}</span>
          else if (active) action = <span className={styles.tag}>{t('busyElsewhere')}</span>
          else action = <button type="button" onClick={() => start(item.allocationId)} disabled={Boolean(busy)} className={styles.big}>{busy === `start-${item.allocationId}` ? t('starting') : t('start')}</button>
          return <article key={item.allocationId} className={styles.item}>
            <div className={styles.itemHead}><strong>{item.name}</strong>{item.code && <small>{item.code}</small>}</div>
            <div className={styles.progress} aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
            <div className={styles.figures}>
              <span><b>{number.format(item.done)}</b> / {number.format(item.allocated)} {item.unit} {t('done').toLowerCase()}</span>
              <span>{t('remaining')} <b>{number.format(item.remaining)}</b></span>
            </div>
            <div className={styles.itemAction}>{action}</div>
          </article>
        })}</div>}

    <Link href={`/projects/${project.id}/locations`} className={styles.secondary}>{t('openBreakdown')}</Link>
  </Frame>
}
