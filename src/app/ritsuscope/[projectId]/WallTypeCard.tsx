'use client'

import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import { wallTypeLabel, type WallTypeRow } from '@/lib/takeoff/wallTypes'
import { ui } from '../ui'
import { categoryKey } from './WallTypesLibrary'

type Props = {
  itemName: string
  wallCount: number
  wallType: WallTypeRow | null
  /** The item points at a wall type that isn't in the library any more (deleted). */
  missing: boolean
  busy: boolean
  onChoose: () => void
  onSaveToLibrary: () => void
  onOpenLibrary: () => void
}

/** Right sidebar, selected wall: which library wall type its item uses, and ways to set one. */
export default function WallTypeCard({ itemName, wallCount, wallType, missing, busy, onChoose, onSaveToLibrary, onOpenLibrary }: Props) {
  const t = useTakeoffT()
  const { formatNumber } = useLanguage()
  const a = wallType?.boards.find(b => b.side === 'A')
  const b = wallType?.boards.find(x => x.side === 'B')
  return (
    <div style={{ ...ui.panel, gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <strong style={{ fontSize: 13, color: '#173441', flex: 1 }}>{t('walltype.cardTitle')}</strong>
        <span style={ui.small}>{t('walltype.cardItem', { name: itemName, count: wallCount })}</span>
      </div>
      {wallType ? (
        <div style={{ ...ui.listItem, gap: 3 }}>
          <strong style={{ fontSize: 12 }}>{wallTypeLabel(wallType)}</strong>
          <span style={ui.small}>
            {t(categoryKey[wallType.category])}
            {wallType.thickness_m ? ` · ${formatNumber(wallType.thickness_m * 1000, 0)} mm` : ''}
            {wallType.fire_rating_hr ? ` · ${formatNumber(wallType.fire_rating_hr, 1)} h` : ''}
            {wallType.status !== 'approved' ? ` · ${t('walltype.notApprovedShort')}` : ''}
          </span>
          {(a || b) && <span style={ui.small}>{[a && `A: ${a.count}× ${a.product}`, b && `B: ${b.count}× ${b.product}`].filter(Boolean).join(' · ')}</span>}
        </div>
      ) : (
        <div style={ui.small}>{missing ? t('walltype.cardMissing') : t('walltype.cardNone')}</div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" style={{ ...ui.button, height: 30, fontSize: 11 }} disabled={busy} onClick={onChoose}>
          {wallType ? t('walltype.cardChange') : t('walltype.cardChoose')}
        </button>
        {!wallType && <button type="button" style={ghost} disabled={busy} onClick={onSaveToLibrary}>{t('walltype.cardSave')}</button>}
        <button type="button" style={ghost} onClick={onOpenLibrary}>{t('walltype.openLibrary')}</button>
      </div>
    </div>
  )
}

const ghost = { height: 30, padding: '0 10px', border: '1px solid #d3dfe2', borderRadius: 7, background: '#fff', color: '#294955', fontSize: 11, fontWeight: 700, cursor: 'pointer' } as const
