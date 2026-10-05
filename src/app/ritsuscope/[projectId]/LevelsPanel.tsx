'use client'

import { useState, type ReactNode } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import { groupLabel, levelGroups, type LevelRow } from '@/lib/takeoff/levels'
import type { SourceRow } from '@/lib/takeoff/rows'
import { NO_LEVEL, levelBranches, type LevelBranch } from '@/lib/takeoff/levelTree'
import Icon from './icons'

type Props = {
  levels: LevelRow[]
  sources: SourceRow[]
  selectedSourceId: string | null
  editingLevelId: string | null
  onSelectSource: (id: string) => void
  onEditLevel: (id: string) => void
  onAddLevel: () => void
  onGenerate: () => void
  onAssign: (sourceId: string, levelId: string | null) => void
  /** Opens "copy to levels" from this level's sheet. */
  onCopyLevel?: (levelId: string) => void
  /** Tree mode: the items drawn on each level, under its sheets. */
  renderItems?: (branch: LevelBranch) => ReactNode
  /** Level groups hidden with the eye (this session only). */
  hiddenBranches?: Set<string>
  onToggleBranch?: (id: string) => void
  /** Adds a "Floor" location to the Location Breakdown for every level without one. */
  onSyncFloors?: () => void
}

/** Left sidebar: the building, roof to ground, with each level's sheets under it. */
export default function LevelsPanel({ levels, sources, selectedSourceId, editingLevelId, onSelectSource, onEditLevel, onAddLevel, onGenerate, onAssign, onCopyLevel, renderItems, hiddenBranches, onToggleBranch, onSyncFloors }: Props) {
  const t = useTakeoffT()
  const { formatNumber } = useLanguage()
  const [open, setOpen] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const tree = !!renderItems
  const branches = tree ? levelBranches(levels, sources) : []
  const toggleCollapsed = (id: string) => setCollapsed(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const groups = levelGroups(levels)
  const followerIds = new Set(groups.flatMap(g => g.followers.map(f => f.id)))
  const masters = groups.map(g => g.master)
  const known = new Set(levels.map(l => l.id))
  const unassigned = sources.filter(s => !s.level_id || !known.has(s.level_id) || followerIds.has(s.level_id))
  const elev = (v: number) => `${v >= 0 ? '+' : ''}${formatNumber(v, 2)}`

  const sheetRow = (s: SourceRow) => {
    const active = s.id === selectedSourceId
    return (
      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0 2px 18px' }}>
        <button
          type="button"
          onClick={() => onSelectSource(s.id)}
          title={s.name}
          style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 0, borderRadius: 5, padding: '4px 6px', background: active ? '#e6f6f4' : 'transparent', color: active ? '#0d7f77' : '#294955', fontSize: 11, fontWeight: active ? 800 : 600, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          • {s.name}
        </button>
        {masters.length > 0 && (
          <select
            title={t('level.moveTo')}
            value={s.level_id && known.has(s.level_id) && !followerIds.has(s.level_id) ? s.level_id : ''}
            onChange={e => onAssign(s.id, e.target.value || null)}
            style={{ width: 22, height: 22, padding: 0, border: '1px solid #d3dfe2', borderRadius: 5, background: '#fff', color: '#536d78', fontSize: 10, cursor: 'pointer' }}
          >
            <option value="">{t('level.unassigned')}</option>
            {masters.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
      </div>
    )
  }

  /** Tree mode: eye (hide the level's drawings) and the arrow that folds the level. */
  const branchControls = (id: string) => {
    const hidden = !!hiddenBranches?.has(id)
    return (
      <>
        <button type="button" title={t(hidden ? 'level.show' : 'level.hide')} onClick={() => onToggleBranch?.(id)} style={{ ...iconBtn, width: 22, color: hidden ? '#a0b0b6' : '#294955' }}>
          <Icon name={hidden ? 'eyeOff' : 'eye'} size={13} />
        </button>
        <button type="button" title={t(collapsed.has(id) ? 'level.expand' : 'level.collapse')} onClick={() => toggleCollapsed(id)} style={{ ...iconBtn, width: 16 }}>
          <span style={{ display: 'inline-block', transform: collapsed.has(id) ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform .15s' }}><Icon name="chevron" size={11} /></span>
        </button>
      </>
    )
  }
  const branchBody = (id: string) => {
    const b = branches.find(x => x.id === id)
    return b && renderItems ? <div style={{ margin: '2px -10px 6px' }}>{renderItems(b)}</div> : null
  }

  return (
    <div style={{ borderBottom: '1px solid #e5ecee' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 14px 8px' }}>
        <button type="button" onClick={() => setOpen(o => !o)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontSize: 11, fontWeight: 800, color: '#173441', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          <span style={{ display: 'inline-block', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .15s' }}><Icon name="chevron" size={12} /></span>
          {t('level.title')}
          {levels.length > 0 && <span style={{ fontSize: 10, color: '#6b8089', fontWeight: 700, textTransform: 'none', letterSpacing: 0 }}>· {levels.length}</span>}
        </button>
        <button type="button" onClick={onGenerate} style={smallBtn(levels.length === 0)} title={t('level.generateHint')}>{t('level.generate')}</button>
        <button type="button" onClick={onAddLevel} style={smallBtn(false)} title={t('level.add')}><Icon name="plus" size={12} /></button>
      </div>
      {open && onSyncFloors && levels.some(l => !l.location_id) && (
        <div style={{ padding: '0 14px 8px' }}>
          <button type="button" onClick={onSyncFloors} style={{ ...smallBtn(false), width: '100%', justifyContent: 'center', color: '#5b21b6', borderColor: '#d8c8f5', background: '#f7f3fe' }}>
            {t('level.syncFloors', { count: levels.filter(l => !l.location_id).length })}
          </button>
        </div>
      )}
      {open && (
        <div style={tree ? { padding: '0 10px 10px' } : { maxHeight: '34vh', overflow: 'auto', padding: '0 10px 10px' }}>
          {levels.length === 0 && <div style={{ fontSize: 10, color: '#6b8089', padding: '2px 4px 6px' }}>{t('level.empty')}</div>}
          {groups.map(g => {
            const sheets = sources.filter(s => s.level_id === g.master.id)
            const editing = editingLevelId === g.master.id || g.followers.some(f => f.id === editingLevelId)
            return (
              <div key={g.master.id} style={{ marginBottom: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderRadius: 6, background: editing ? '#f1f7f8' : 'transparent', opacity: hiddenBranches?.has(g.master.id) ? 0.5 : 1 }}>
                  {tree && branchControls(g.master.id)}
                  <button
                    type="button"
                    onClick={() => (sheets[0] ? onSelectSource(sheets[0].id) : onEditLevel(g.master.id))}
                    style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 6, border: 0, background: 'transparent', padding: '5px 4px', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#173441', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{groupLabel(g)}</span>
                    <span style={{ fontSize: 10, color: '#6b8089', whiteSpace: 'nowrap' }}>{elev(g.master.elevation_m)} m</span>
                    {!sheets.length && <span style={{ fontSize: 10, color: '#a0b0b6', whiteSpace: 'nowrap' }}>{t('level.noSheets')}</span>}
                  </button>
                  {onCopyLevel && levels.length > 1 && (
                    <button type="button" title={sheets.length ? t('copy.levelButton') : t('copy.noSheet')} disabled={!sheets.length} onClick={() => onCopyLevel(g.master.id)} style={{ ...iconBtn, opacity: sheets.length ? 1 : 0.35, cursor: sheets.length ? 'pointer' : 'default' }}><Icon name="copy" size={12} /></button>
                  )}
                  <button type="button" title={t('level.edit')} onClick={() => onEditLevel(g.master.id)} style={iconBtn}><Icon name="edit" size={12} /></button>
                </div>
                {!collapsed.has(g.master.id) && sheets.map(sheetRow)}
                {tree && !collapsed.has(g.master.id) && branchBody(g.master.id)}
              </div>
            )
          })}
          {unassigned.length > 0 && levels.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: hiddenBranches?.has(NO_LEVEL) ? 0.5 : 1 }}>
                {tree && branchControls(NO_LEVEL)}
                <div style={{ fontSize: 10, fontWeight: 800, color: '#8a9ca3', padding: '4px 4px 2px', textTransform: 'uppercase', letterSpacing: '.05em' }}>{t('level.unassigned')}</div>
              </div>
              {!collapsed.has(NO_LEVEL) && unassigned.map(sheetRow)}
              {tree && !collapsed.has(NO_LEVEL) && branchBody(NO_LEVEL)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const smallBtn = (primary: boolean) => ({ display: 'flex', alignItems: 'center', gap: 4, height: 24, padding: '0 8px', border: '1px solid ' + (primary ? '#109d91' : '#d3dfe2'), borderRadius: 6, background: primary ? '#109d91' : '#fff', color: primary ? '#fff' : '#294955', fontSize: 10, fontWeight: 800, cursor: 'pointer' }) as const
const iconBtn = { width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 0, borderRadius: 5, background: 'transparent', color: '#536d78', cursor: 'pointer' } as const
