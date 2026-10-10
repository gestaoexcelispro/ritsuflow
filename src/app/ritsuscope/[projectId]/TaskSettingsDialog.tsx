'use client'

// ⚙ of an activity in Tasks: its work package (bridge to PreCon), how it is spread over locations,
// the carrier of dividing walls (default: first room in the location flow; per-wall picks on the plan)
// and its predecessors (default wall sequence, including the links to the carrier room).
import { useEffect, useMemo, useState } from 'react'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import { ALLOCATION_RULES, defaultRuleFor, type AllocationRule } from '@/lib/takeoff/scopeAllocation'
import { defaultPredecessors, type DepLink, type StepDep } from '@/lib/takeoff/stepPredecessors'
import { ui } from '../ui'

export type WorkPackageOption = { organization_work_package_id: string; code: string; description: string | null; color?: string | null; organization_package_active?: boolean; selected_for_project?: boolean }
export type SettingsScope = { id: string; scope_code: string; scope_name: string; unit: string | null; takeoff_layer_id: string | null; takeoff_step?: string | null; organization_work_package_id?: string | null; allocation_rule?: AllocationRule | null }

type Props = {
  scope: SettingsScope
  scopes: SettingsScope[]
  workPackages: WorkPackageOption[]
  /** The planner's predecessors of this line (empty = defaults). */
  deps: StepDep[]
  /** Dividing walls of this line's item whose carrier was picked by hand. */
  carrierPicks: number
  saving: boolean
  onSave: (v: { workPackageId: string | null; rule: AllocationRule | null; deps: StepDep[] | null }) => void
  onPickCarriers: () => void
  onClearCarriers: () => void
  onClose: () => void
}

export default function TaskSettingsDialog({ scope, scopes, workPackages, deps, carrierPicks, saving, onSave, onPickCarriers, onClearCarriers, onClose }: Props) {
  const t = useTakeoffT()
  const defaults = useMemo(() => defaultPredecessors(scope, scopes), [scope, scopes])
  const [wp, setWp] = useState(scope.organization_work_package_id || '')
  const [rule, setRule] = useState<AllocationRule | ''>(scope.allocation_rule || '')
  const [list, setList] = useState<StepDep[]>(deps.length ? deps : defaults)
  const [add, setAdd] = useState('')
  const isWall = !!scope.takeoff_step && scope.takeoff_step !== 'measure' && scope.takeoff_step !== 'scope'
  const ruleDefault = defaultRuleFor(scope.takeoff_step)
  const nameOf = (id: string) => { const s = scopes.find(x => x.id === id); return s ? `${s.scope_code} · ${s.scope_name}` : '—' }
  const sameAsDefaults = list.length === defaults.length && list.every(d => defaults.some(x => x.predecessorId === d.predecessorId && x.link === d.link && x.lagDays === d.lagDays))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const packages = [...workPackages].filter(w => w.organization_package_active !== false).sort((a, b) => Number(!!b.selected_for_project) - Number(!!a.selected_for_project) || a.code.localeCompare(b.code))

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={dialog} onClick={e => e.stopPropagation()} role="dialog" aria-label={t('taskSettings.title')}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <strong style={{ fontSize: 14, color: '#173441', flex: 1 }}>{t('taskSettings.title')}</strong>
          <button type="button" style={ghost} onClick={onClose}>×</button>
        </div>
        <div style={{ fontSize: 12, color: '#294955' }}><b>{scope.scope_code}</b> · {scope.scope_name}{scope.unit ? ` · ${scope.unit}` : ''}</div>

        <section style={box}>
          <div style={head}>{t('taskSettings.wp')}</div>
          <select style={input} value={wp} onChange={e => setWp(e.target.value)}>
            <option value="">{t('taskSettings.wpNone')}</option>
            {packages.map(w => <option key={w.organization_work_package_id} value={w.organization_work_package_id}>{w.code}{w.description ? ` – ${w.description}` : ''}{w.selected_for_project === false ? ` (${t('taskSettings.wpNotInProject')})` : ''}</option>)}
          </select>
          <span style={ui.small}>{t('taskSettings.wpHint')}</span>
        </section>

        <section style={box}>
          <div style={head}>{t('taskSettings.rule')}</div>
          <select style={input} value={rule} onChange={e => setRule(e.target.value as AllocationRule | '')}>
            <option value="">{t('taskSettings.ruleDefault', { rule: t(`taskSettings.rule.${ruleDefault}` as const) })}</option>
            {ALLOCATION_RULES.map(r => <option key={r} value={r}>{t(`taskSettings.rule.${r}` as const)}</option>)}
          </select>
          <span style={ui.small}>{t(`taskSettings.ruleHint.${(rule || ruleDefault) as AllocationRule}` as const)}</span>
        </section>

        {isWall && (
          <section style={box}>
            <div style={head}>{t('taskSettings.carrier')}</div>
            <span style={ui.small}>{t('taskSettings.carrierHint')}</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: '#294955', flex: 1 }}>{carrierPicks ? t('taskSettings.carrierPicks', { count: carrierPicks }) : t('taskSettings.carrierNone')}</span>
              <button type="button" style={ghost} onClick={onPickCarriers}>{t('taskSettings.carrierPick')}</button>
              {carrierPicks > 0 && <button type="button" style={ghost} onClick={onClearCarriers}>{t('taskSettings.carrierClear')}</button>}
            </div>
          </section>
        )}

        <section style={box}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <div style={{ ...head, flex: 1 }}>{t('taskSettings.preds')}</div>
            {!sameAsDefaults && defaults.length > 0 && <button type="button" style={ghost} onClick={() => setList(defaults)}>{t('taskSettings.predsDefaults')}</button>}
          </div>
          {!list.length && <span style={ui.small}>{t('taskSettings.predsNone')}</span>}
          {list.map((d, i) => (
            <div key={`${d.predecessorId}|${d.link}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 150px 64px 26px', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11.5, color: '#173441', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={nameOf(d.predecessorId)}>{nameOf(d.predecessorId)}</span>
              <select style={input} value={d.link} onChange={e => setList(l => l.map((x, j) => (j === i ? { ...x, link: e.target.value as DepLink } : x)))}>
                <option value="same_location">{t('taskSettings.link.same_location')}</option>
                <option value="carrier_location">{t('taskSettings.link.carrier_location')}</option>
              </select>
              <input style={input} type="number" value={d.lagDays} title={t('taskSettings.lag')} onChange={e => setList(l => l.map((x, j) => (j === i ? { ...x, lagDays: Math.max(-365, Math.min(365, Math.round(Number(e.target.value) || 0))) } : x)))} />
              <button type="button" style={ghost} onClick={() => setList(l => l.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6 }}>
            <select style={{ ...input, flex: 1 }} value={add} onChange={e => setAdd(e.target.value)}>
              <option value="">{t('taskSettings.predsAdd')}</option>
              {scopes.filter(s => s.id !== scope.id && !list.some(d => d.predecessorId === s.id)).map(s => <option key={s.id} value={s.id}>{s.scope_code} · {s.scope_name}</option>)}
            </select>
            <button type="button" style={ghost} disabled={!add} onClick={() => { setList(l => [...l, { predecessorId: add, link: 'same_location', lagDays: 0 }]); setAdd('') }}>+</button>
          </div>
          <span style={ui.small}>{t('taskSettings.predsHint')}</span>
        </section>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" style={ghost} onClick={onClose}>{t('taskSettings.cancel')}</button>
          <button type="button" style={{ ...ui.button, opacity: saving ? 0.6 : 1 }} disabled={saving}
            onClick={() => onSave({ workPackageId: wp || null, rule: rule || null, deps: sameAsDefaults ? null : list })}>{t('taskSettings.save')}</button>
        </div>
      </div>
    </div>
  )
}

const backdrop = { position: 'fixed', inset: 0, background: 'rgba(15, 35, 45, .35)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 } as const
const dialog = { width: 'min(620px, 100%)', maxHeight: 'min(760px, 100%)', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10, padding: 16, background: '#fff', borderRadius: 12, boxShadow: '0 20px 50px rgba(0,0,0,.2)' } as const
const box = { display: 'flex', flexDirection: 'column', gap: 6, padding: 10, border: '1px solid #e5edef', borderRadius: 8 } as const
const head = { fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#536d78' } as const
const input = { height: 30, padding: '0 8px', border: '1px solid #d6e0e3', borderRadius: 7, fontSize: 12, background: '#fff', boxSizing: 'border-box', minWidth: 0 } as const
const ghost = { height: 30, padding: '0 10px', border: '1px solid #d3dfe2', borderRadius: 7, background: '#fff', color: '#294955', fontSize: 11, fontWeight: 700, cursor: 'pointer' } as const
