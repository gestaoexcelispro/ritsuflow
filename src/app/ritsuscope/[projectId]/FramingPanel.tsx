'use client'

import { useCallback, useMemo } from 'react'
import { framingTotals, packBars, packSheets } from '@/lib/takeoff/framing/framing'
import type { TakeoffItem } from '@/lib/takeoff/geometry'
import { recipeMaterials, type Recipe } from '@/lib/takeoff/recipes'
import { useRecipeContext } from './useRecipeContext'
import { surfaceMaterials } from './surfaceFamilies'
import { useSurfaceLabels } from './SurfaceTypesLibrary'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import { ui } from '../ui'

type Props = { items: TakeoffItem[]; ptPerM: number; recipes: Map<string, Recipe> }

/** Bars and sheets to buy for every framed layer, optimised across all walls shown. */
export default function FramingPanel({ items, ptPerM, recipes }: Props) {
  const t = useTakeoffT()
  const { formatNumber } = useLanguage()

  const result = useMemo(() => {
    const totals = framingTotals(items, ptPerM)
    const profiles = [...totals.prof.values()].map(g => ({ name: g.name, pieces: g.pieces.length, packing: packBars(g.pieces, g.bars), bars: g.bars }))
    const boards = [...totals.boards.values()].map(g => ({ name: g.name, packing: packSheets(g.pieces, g.W, g.H), W: g.W, H: g.H }))
    const studs = [...totals.perItem.values()].reduce((s, a) => s + a.studs, 0)
    const corners = totals.junctions.filter(j => j.kind === 'corner').length
    const tees = totals.junctions.filter(j => j.kind === 'tee').length
    const junctionStuds = totals.junctions.reduce((s, j) => s + j.studs, 0)
    const screws = [...totals.screws].map(([name, n]) => ({ name, n: Math.ceil(n) }))
    return { profiles, boards, studs, corners, tees, junctionStuds, screws }
  }, [items, ptPerM])

  const pct = (v: number) => formatNumber(v * 100, 1)

  const recipeOf = useCallback((it: TakeoffItem) => (it.recipeId ? recipes.get(it.recipeId) : null), [recipes])
  const ctx = useRecipeContext(items, recipeOf)
  const materials = useMemo(() => recipeMaterials(items, ptPerM, recipeOf, ctx), [items, ptPerM, recipeOf, ctx])
  const linked = useMemo(() => {
    const used = new Map<string, Recipe>()
    for (const it of items) { const r = recipeOf(it); if (r && it.shapes.length) used.set(r.id, r) }
    return [...used.values()]
  }, [items, recipes]) // eslint-disable-line react-hooks/exhaustive-deps
  const surfaceLabels = useSurfaceLabels()
  /** Ceilings and floors drawn from a type: their build-up materials (estimates), one list per family. */
  const surfaces = useMemo(() => surfaceMaterials(items, ptPerM, surfaceLabels), [items, ptPerM, surfaceLabels])
  const anyFramed = items.some(it => it.kind === 'linear' && it.framing?.on && it.recipeId)

  return (
    <div style={ui.panel}>
      <h2 style={ui.panelTitle}>{t('workspace.framing')}</h2>
      {result.profiles.length === 0 && result.boards.length === 0 ? (
        <div style={ui.small}>{t('workspace.framing.empty')}</div>
      ) : (
        <>
          <div style={ui.small}>{t('workspace.framing.studs', { count: result.studs })}</div>
          {(result.corners > 0 || result.tees > 0) && (
            <div style={ui.small}>{t('framing.junctions', { corners: result.corners, tees: result.tees, studs: result.junctionStuds })}</div>
          )}
          {result.profiles.map(p => (
            <div key={p.name} style={ui.listItem}>
              <strong>{p.name}</strong>
              <span style={ui.small}>
                {Object.entries(p.packing.byLen)
                  .map(([len, n]) => `${n} × ${formatNumber(Number(len), 2)} m`)
                  .join(' + ')}
              </span>
              <span style={ui.small}>
                {t('workspace.framing.bars', { count: p.packing.count, waste: pct(p.packing.waste) })}
                {' · '}
                {t('workspace.framing.pieces', { count: p.pieces })}
                {p.packing.splices > 0 && <> · {t('workspace.framing.splices', { count: p.packing.splices })}</>}
              </span>
            </div>
          ))}
          {result.boards.map(b => (
            <div key={b.name} style={ui.listItem}>
              <strong>{b.name}</strong>
              <span style={ui.small}>
                {t('workspace.framing.sheets', {
                  count: b.packing.count,
                  w: formatNumber(b.W, 2),
                  h: formatNumber(b.H, 2),
                  waste: pct(b.packing.waste),
                })}
              </span>
              <span style={ui.small}>{t('workspace.framing.pieces', { count: b.packing.pieces })}</span>
            </div>
          ))}
          {result.screws.map(sc => (
            <div key={sc.name} style={{ ...ui.listItem, flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <span>{sc.name} <span style={ui.small}>· {t('framing.screwsFromLayout')}</span></span>
              <strong>{formatNumber(sc.n, 0)} un</strong>
            </div>
          ))}
        </>
      )}

      <h3 style={{ ...ui.panelTitle, fontSize: 12, marginTop: 6 }}>{t('recipe.materials')}</h3>
      {linked.filter(r => r.status !== 'approved').map(r => (
        <div key={r.id} style={{ ...ui.small, color: '#9a6700' }}>{t('recipe.reviewWarning', { name: r.name })}</div>
      ))}
      {anyFramed && <div style={ui.small}>{t('recipe.framedNote')}</div>}
      {materials.length === 0 ? (
        <div style={ui.small}>{t('recipe.empty')}</div>
      ) : materials.map(m => (
        <div key={`${m.mat}|${m.unit}`} style={{ ...ui.listItem, flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <span>{m.mat}</span>
          <strong>{formatNumber(m.qty, m.unit === 'un' ? 0 : 2)} {m.unit}{m.packs != null ? ` · ${m.packs} ${m.packName || ''}` : ''}</strong>
        </div>
      ))}

      {surfaces.map(({ family, materials: list }) => (
        <div key={family.id} style={{ display: 'contents' }}>
          <h3 style={{ ...ui.panelTitle, fontSize: 12, marginTop: 6 }}>{t(family.msg.materials)}</h3>
          <div style={ui.small}>{t(family.msg.materialsNote)}</div>
          {list.map(m => (
            <div key={`${family.id}|${m.mat}|${m.unit}`} style={{ ...ui.listItem, flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <span>{m.mat}</span>
              <strong>{formatNumber(m.qty, Number.isInteger(m.qty) ? 0 : 2)} {m.unit}</strong>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
