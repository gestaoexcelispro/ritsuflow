'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '../../../../../../lib/supabase/client'
import { useT } from '../../../../../../lib/i18n/useT'
import { useLanguage } from '../../../../../../lib/i18n/LanguageProvider'
import { plex } from '../../../../ui/font'
import styles from './print.module.css'

const PERIODS = ['morning', 'afternoon', 'evening']
const minutesOf = (s) => s.worked_minutes ?? Math.max(0, Math.floor((new Date(s.check_out_at || Date.now()) - new Date(s.check_in_at)) / 60000))
const fullName = (w) => [w?.first_name, w?.last_name].filter(Boolean).join(' ')

/** Printable Daily Report: one clean document with every section, for the client or owner (print or save as PDF). */
export default function DailyReportPrint() {
  const { reportId } = useParams()
  const supabase = useMemo(() => createClient(), [])
  const t = useT('fieldopReports')
  const { language } = useLanguage()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    async function load() {
      const { data: report, error: reportError } = await supabase.from('daily_reports')
        .select('id,report_number,report_date,status,work_start_time,work_end_time,general_notes,submitted_at,reviewed_at,approved_at,projects(id,code,name,project_id,client_name,city,state_region,organization_id)')
        .eq('id', reportId).single()
      if (reportError) { if (alive) setError(reportError.message); return }
      const q = (table, select, order = 'created_at') => supabase.from(table).select(select).eq('daily_report_id', reportId).order(order)
      const [org, weather, sessions, production, materials, equipment, safety, issues, notes, attachments, history] = await Promise.all([
        supabase.from('organizations').select('name,legal_name,logo_url').eq('id', report.projects.organization_id).maybeSingle(),
        q('daily_report_weather', '*'),
        supabase.from('field_attendance_sessions').select('id,worker_id,check_in_at,check_out_at,worked_minutes,field_workers(field_id,first_name,last_name),field_project_assignments(field_companies(name),field_roles(name))').eq('project_id', report.projects.id).eq('work_date', report.report_date).neq('status', 'cancelled').order('check_in_at'),
        q('daily_report_production', 'location_name,service_code,service_name,unit,planned_quantity,actual_quantity,cumulative_quantity,production_status', 'location_name'),
        q('daily_report_materials', 'movement_type,material_name,material_code,quantity,unit,supplier_name,delivery_reference,delivery_time,notes'),
        q('daily_report_equipment', 'equipment_name,equipment_code,company_name,quantity,hours_used,idle_hours,operating_status,work_description'),
        supabase.from('daily_report_safety').select('*').eq('daily_report_id', reportId).maybeSingle(),
        q('daily_report_issues', 'title,description,issue_type,severity,status,location_name,production_impact,impact_description,responsible_party,due_date,corrective_action'),
        q('daily_report_notes', 'category,title,content,location_name,created_at'),
        q('daily_report_attachments', 'attachment_type,file_name,storage_path,title,location_name,captured_at,created_at'),
        supabase.from('daily_report_approval_history').select('action,to_status,comments,performed_by,performed_at').eq('daily_report_id', reportId).order('performed_at'),
      ])
      const photos = (attachments.data || []).filter((a) => a.attachment_type === 'photo')
      const signed = photos.length ? (await supabase.storage.from('daily-report-attachments').createSignedUrls(photos.map((p) => p.storage_path), 3600)).data || [] : []
      const urls = Object.fromEntries(signed.filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]))
      const people = [...new Set((history.data || []).map((h) => h.performed_by).filter(Boolean))]
      const profiles = people.length ? (await supabase.from('user_profiles').select('user_id,full_name,email').in('user_id', people)).data || [] : []
      if (!alive) return
      setData({
        report, org: org.data, weather: weather.data || [], sessions: sessions.data || [], production: production.data || [],
        materials: materials.data || [], equipment: equipment.data || [], safety: safety.data, issues: issues.data || [],
        notes: notes.data || [], photos: photos.map((p) => ({ ...p, url: urls[p.storage_path] })), files: (attachments.data || []).filter((a) => a.attachment_type !== 'photo'),
        history: history.data || [], names: new Map(profiles.map((p) => [p.user_id, p.full_name || p.email])),
      })
    }
    load()
    return () => { alive = false }
  }, [reportId, supabase])

  const num = useMemo(() => new Intl.NumberFormat(language, { maximumFractionDigits: 2 }), [language])
  const time = useMemo(() => new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }), [language])
  const dateTime = useMemo(() => new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }), [language])
  const dateOnly = useMemo(() => new Intl.DateTimeFormat(language, { dateStyle: 'medium' }), [language])
  const label = (key, fallback) => { const text = t(key); return text === key ? (fallback ?? '—') : text }

  if (error) return <main className={`${styles.page} ${plex.variable}`}><p>{t('report.unavailable')}: {error}</p></main>
  if (!data) return <main className={`${styles.page} ${plex.variable}`}><p className={styles.muted}>{t('report.loading')}</p></main>

  const { report, org } = data
  const number = `DR-${String(report.report_number || 0).padStart(4, '0')}`
  const reportDate = new Intl.DateTimeFormat(language, { dateStyle: 'full' }).format(new Date(`${report.report_date}T12:00:00`))
  const workers = new Set(data.sessions.map((s) => s.worker_id)).size
  const minutes = data.sessions.reduce((sum, s) => sum + minutesOf(s), 0)
  const weatherRows = PERIODS.map((p) => data.weather.find((w) => w.period === p)).filter(Boolean)
  const signer = (status) => { const h = [...data.history].reverse().find((x) => x.to_status === status); return h ? { name: data.names.get(h.performed_by) || '—', at: dateTime.format(new Date(h.performed_at)) } : null }
  const signatures = [['submitted', 'print.signSubmitted'], ['reviewed', 'print.signReviewed'], ['approved', 'print.signApproved']].map(([status, key]) => ({ key, who: signer(status) }))
  const safety = data.safety
  const empty = <p className={styles.muted}>{t('print.none')}</p>

  return <main className={`${styles.page} ${plex.variable}`}>
    <div className={styles.toolbar}>
      <button type="button" onClick={() => window.print()}>{t('print.print')}</button>
      <span>{t('print.hint')}</span>
    </div>

    <header className={styles.head}>
      <div className={styles.brand}>
        {org?.logo_url ? <img src={org.logo_url} alt="" /> : null}
        <div><strong>{org?.legal_name || org?.name || ''}</strong><span>{t('print.title')}</span></div>
      </div>
      <div className={styles.number}><strong>{number}</strong><span>{label(`status.${report.status}`)}</span></div>
    </header>

    <section className={styles.facts}>
      <div><span>{t('print.project')}</span><strong>{report.projects?.name}</strong>{(report.projects?.project_id || report.projects?.code) && <small>{[report.projects.project_id, report.projects.code].filter(Boolean).join(' · ')}</small>}</div>
      <div><span>{t('print.client')}</span><strong>{report.projects?.client_name || '—'}</strong><small>{[report.projects?.city, report.projects?.state_region].filter(Boolean).join(', ')}</small></div>
      <div><span>{t('print.date')}</span><strong>{reportDate}</strong><small>{report.work_start_time ? `${report.work_start_time.slice(0, 5)} – ${report.work_end_time?.slice(0, 5) || '…'}` : ''}</small></div>
      <div><span>{t('tab.workforce')}</span><strong>{t('print.workforceLine', { workers, hours: (minutes / 60).toFixed(1) })}</strong></div>
    </section>

    {report.general_notes && <section className={styles.block}><h2>{t('general.notes')}</h2><p className={styles.pre}>{report.general_notes}</p></section>}

    <section className={styles.block}><h2>{t('tab.weather')}</h2>
      {weatherRows.length === 0 ? empty : <table><thead><tr><th>{t('print.period')}</th><th>{t('weather.condition')}</th><th>{t('print.temp')}</th><th>{t('weather.wind')}</th><th>{t('weather.site')}</th><th>{t('weather.impact')}</th></tr></thead>
        <tbody>{weatherRows.map((w) => <tr key={w.period}>
          <td>{t(`weather.period.${w.period}`)}</td>
          <td>{w.condition ? label(`weather.cond.${w.condition}`, w.condition) : '—'}</td>
          <td>{[w.temperature_min, w.temperature_max].filter((v) => v !== null && v !== undefined).map((v) => num.format(v)).join(' – ') || '—'}{w.temperature_min != null || w.temperature_max != null ? ` °${w.temperature_unit}` : ''}{w.rainfall != null ? ` · ${num.format(w.rainfall)} ${w.temperature_unit === 'F' ? 'in' : 'mm'}` : ''}</td>
          <td>{w.wind_condition ? label(`weather.windValue.${w.wind_condition}`) : '—'}</td>
          <td>{w.site_condition ? label(`weather.siteValue.${w.site_condition}`) : '—'}</td>
          <td>{label(`weather.impactValue.${w.production_impact}`)}{w.impact_hours ? ` · ${num.format(w.impact_hours)} h` : ''}{w.notes ? <small>{w.notes}</small> : null}</td>
        </tr>)}</tbody></table>}
    </section>

    <section className={styles.block}><h2>{t('tab.production')}</h2>
      {data.production.length === 0 ? empty : <table><thead><tr><th>{t('production.colLocation')}</th><th>{t('production.colActivity')}</th><th className={styles.num}>{t('production.colAllocated')}</th><th className={styles.num}>{t('production.colToday')}</th><th className={styles.num}>{t('production.colCumulative')}</th><th>{t('production.colStatus')}</th></tr></thead>
        <tbody>{data.production.map((p, i) => <tr key={i}>
          <td>{p.location_name || '—'}</td>
          <td>{[p.service_code, p.service_name].filter(Boolean).join(' · ')}</td>
          <td className={styles.num}>{num.format(p.planned_quantity || 0)} {p.unit}</td>
          <td className={styles.num}><strong>{num.format(p.actual_quantity || 0)}</strong> {p.unit}</td>
          <td className={styles.num}>{num.format(p.cumulative_quantity || 0)} {p.unit}</td>
          <td>{label(`production.status.${p.production_status}`, p.production_status)}</td>
        </tr>)}</tbody></table>}
    </section>

    <section className={styles.block}><h2>{t('tab.workforce')}</h2>
      {data.sessions.length === 0 ? empty : <table><thead><tr><th>{t('workforce.colWorker')}</th><th>{t('workforce.colCompany')}</th><th>{t('workforce.colRole')}</th><th>{t('workforce.colIn')}</th><th>{t('workforce.colOut')}</th><th className={styles.num}>{t('workforce.colHours')}</th></tr></thead>
        <tbody>{data.sessions.map((s) => <tr key={s.id}>
          <td>{fullName(s.field_workers) || '—'}</td>
          <td>{s.field_project_assignments?.field_companies?.name || '—'}</td>
          <td>{s.field_project_assignments?.field_roles?.name || '—'}</td>
          <td>{time.format(new Date(s.check_in_at))}</td>
          <td>{s.check_out_at ? time.format(new Date(s.check_out_at)) : '—'}</td>
          <td className={styles.num}>{(minutesOf(s) / 60).toFixed(2)}</td>
        </tr>)}</tbody></table>}
    </section>

    <div className={styles.two}>
      <section className={styles.block}><h2>{t('tab.materials')}</h2>
        {data.materials.length === 0 ? empty : <table><tbody>{data.materials.map((m, i) => <tr key={i}>
          <td>{label(`materials.move.${m.movement_type}`)}</td>
          <td><strong>{m.material_name}</strong>{m.supplier_name ? <small>{[m.supplier_name, m.delivery_reference].filter(Boolean).join(' · ')}</small> : null}</td>
          <td className={styles.num}>{num.format(m.quantity)} {m.unit || ''}</td>
        </tr>)}</tbody></table>}
      </section>
      <section className={styles.block}><h2>{t('tab.equipment')}</h2>
        {data.equipment.length === 0 ? empty : <table><tbody>{data.equipment.map((e, i) => <tr key={i}>
          <td><strong>{e.quantity > 1 ? `${e.quantity}× ` : ''}{e.equipment_name}</strong>{e.company_name ? <small>{e.company_name}</small> : null}</td>
          <td>{label(`equipment.status.${e.operating_status}`)}</td>
          <td className={styles.num}>{e.hours_used != null ? `${num.format(e.hours_used)} h` : '—'}{e.idle_hours ? <small>{t('equipment.idleHours')}: {num.format(e.idle_hours)} h</small> : null}</td>
        </tr>)}</tbody></table>}
      </section>
    </div>

    <section className={styles.block}><h2>{t('tab.safety')}</h2>
      {!safety ? empty : <div className={styles.safety}>
        <div><span>{t('safety.overall')}</span><strong>{label(`safety.status.${safety.overall_status}`)}</strong></div>
        <div><span>{t('safety.toolbox')}</span><strong>{safety.toolbox_talk_held ? `${safety.toolbox_talk_topic || t('print.yes')}${safety.toolbox_talk_attendees ? ` · ${safety.toolbox_talk_attendees}` : ''}` : t('print.no')}</strong></div>
        <div><span>{t('safety.ppe')}</span><strong>{label(`safety.ppeValue.${safety.ppe_compliance}`)}</strong></div>
        <div><span>{t('safety.incidents')} / {t('safety.nearMisses')} / {t('safety.unsafe')}</span><strong>{safety.incidents_count} / {safety.near_misses_count} / {safety.unsafe_conditions_count}</strong></div>
        {safety.stop_work_event && <div className={styles.wide}><span>{t('safety.stopWork')}</span><strong>{safety.stop_work_description}</strong></div>}
        {safety.corrective_actions_summary && <div className={styles.wide}><span>{t('safety.corrective')}</span><p className={styles.pre}>{safety.corrective_actions_summary}</p></div>}
      </div>}
    </section>

    <section className={styles.block}><h2>{t('tab.issues')}</h2>
      {data.issues.length === 0 ? empty : <table><thead><tr><th>{t('issues.severity')}</th><th>{t('issues.title')}</th><th>{t('issues.impact')}</th><th>{t('issues.responsible')}</th><th>{t('issues.statusLabel')}</th></tr></thead>
        <tbody>{data.issues.map((x, i) => <tr key={i}>
          <td>{label(`issues.sev.${x.severity}`)}</td>
          <td><strong>{x.title}</strong><small>{[label(`issues.type.${x.issue_type}`), x.location_name].filter(Boolean).join(' · ')}</small>{x.corrective_action ? <small>{t('issues.corrective')}: {x.corrective_action}</small> : null}</td>
          <td>{label(`issues.impactValue.${x.production_impact}`)}</td>
          <td>{x.responsible_party || '—'}{x.due_date ? <small>{dateOnly.format(new Date(`${x.due_date}T12:00:00`))}</small> : null}</td>
          <td>{label(`issues.status.${x.status}`)}</td>
        </tr>)}</tbody></table>}
    </section>

    {data.notes.length > 0 && <section className={styles.block}><h2>{t('tab.notes')}</h2>
      {data.notes.map((n, i) => <div key={i} className={styles.note}><strong>{label(`notes.cat.${n.category}`)}{n.title ? ` · ${n.title}` : ''}</strong><p className={styles.pre}>{n.content}</p>{n.location_name && <small>{n.location_name}</small>}</div>)}
    </section>}

    {data.photos.length > 0 && <section className={styles.block}><h2>{t('print.photos')}</h2>
      <div className={styles.photos}>{data.photos.map((p, i) => <figure key={i}>{p.url && <img src={p.url} alt={p.title || p.file_name} />}<figcaption>{p.title || p.file_name}{p.location_name ? ` · ${p.location_name}` : ''} · {dateTime.format(new Date(p.captured_at || p.created_at))}</figcaption></figure>)}</div>
    </section>}
    {data.files.length > 0 && <section className={styles.block}><h2>{t('print.otherFiles')}</h2><ul className={styles.files}>{data.files.map((f, i) => <li key={i}>{f.title || f.file_name}</li>)}</ul></section>}

    <section className={styles.signs}>
      {signatures.map(({ key, who }) => <div key={key}><div className={styles.line}>{who ? <><strong>{who.name}</strong><small>{who.at}</small></> : null}</div><span>{t(key)}</span></div>)}
    </section>

    <footer className={styles.foot}>{number} · {report.projects?.name} · {t('print.generated', { date: dateTime.format(new Date()) })} · RitsuFlow FieldOp</footer>
  </main>
}
