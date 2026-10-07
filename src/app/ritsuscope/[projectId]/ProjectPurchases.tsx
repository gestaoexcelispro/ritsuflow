'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { surfaceMaterials } from './surfaceFamilies'
import { useSurfaceLabels } from './SurfaceTypesLibrary'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import { buildQuantitiesCsv } from '@/lib/takeoff/csv'
import { recipeMaterials, rowToRecipe, type Recipe, type RecipeRow } from '@/lib/takeoff/recipes'
import { projectItemsInMetres, type ElementRow, type LayerRow, type SourceRow } from '@/lib/takeoff/rows'
import { LEVEL_COLUMNS, fillLevelHeights, normalizeLevels, sheetMultiplier, wallHeightOf, withTypicalCopies, type LevelRow } from '@/lib/takeoff/levels'
import FramingPanel from './FramingPanel'
import { useRecipeContext } from './useRecipeContext'
import { ui } from '../ui'

type Project = { id: string; project_code: string | null; name: string }
type View = 'project' | 'source'

/** Purchase list for the whole project (a section of the workspace): all calibrated sheets and IFC storeys together. */
export default function ProjectPurchases({ projectId }: { projectId: string }) {
  const t = useTakeoffT()
  const { numberFormat } = useLanguage()
  const [project, setProject] = useState<Project | null>(null)
  const [sources, setSources] = useState<SourceRow[]>([])
  const [layers, setLayers] = useState<LayerRow[]>([])
  const [elements, setElements] = useState<ElementRow[]>([])
  const [levels, setLevels] = useState<LevelRow[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [view, setView] = useState<View>('project')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const supabase = createClient()
    const [p, s, l, e, r] = await Promise.all([
      supabase.from('projects').select('id, project_code:code, name').eq('id', projectId).maybeSingle(),
      supabase.from('takeoff_sources')
        .select('id, project_id, kind, name, file_path, page_number, ifc_storey_guid, scale_pt_per_m, metadata, sort_order, level_id')
        .eq('project_id', projectId).order('sort_order').order('created_at'),
      supabase.from('takeoff_layers')
        .select('id, project_id, kind, name, system, color, thickness_m, height_m, elevation_m, deduct_openings, framing, is_visible, sort_order, recipe_id, wall_type_id')
        .eq('project_id', projectId).order('sort_order').order('created_at'),
      supabase.from('takeoff_elements')
        .select('id, project_id, layer_id, source_id, points, height_override_m, z_rel_m, ifc_guid, root_guid, layer_guids, openings, faces')
        .eq('project_id', projectId),
      supabase.from('takeoff_recipes').select('id, name, maker, system, kind, height_basis_m, waste_included_pct, status, lines, mode').order('name'),
    ])
    const lv = await supabase.from('takeoff_levels').select(LEVEL_COLUMNS).eq('project_id', projectId)
    setLevels(lv.error ? [] : normalizeLevels((lv.data || []) as Partial<LevelRow>[]))
    const failure = p.error || s.error || l.error || e.error || r.error
    if (failure) setError(t('workspace.error', { message: failure.message }))
    setProject((p.data as Project | null) || null)
    setSources((s.data || []) as SourceRow[])
    setLayers((l.data || []) as LayerRow[])
    setElements((e.data || []) as ElementRow[])
    setRecipes(((r.data || []) as RecipeRow[]).map(rowToRecipe))
    setLoading(false)
  }, [projectId, t])

  useEffect(() => { load() }, [load])

  // Typical floors count once per floor; walls without their own height take their level's height.
  const { items, pageOfSource } = useMemo(() => {
    const r = projectItemsInMetres(layers, withTypicalCopies(elements, sources, levels), sources)
    const byId = new Map<string, LevelRow>(levels.map(l => [l.id, l] as [string, LevelRow]))
    const hOfPage = new Map<number, number | null>()
    for (const s of sources) {
      const pg = r.pageOfSource.get(s.id)
      if (pg != null) hOfPage.set(pg, wallHeightOf(s.level_id ? byId.get(s.level_id) : null))
    }
    return { ...r, items: fillLevelHeights(r.items, pg => hOfPage.get(pg) ?? null) }
  }, [layers, elements, sources, levels])
  const recipeById = useMemo(() => new Map(recipes.map(r => [r.id, r])), [recipes])
  const recipeOfItem = useCallback((it: { recipeId?: string | null }) => (it.recipeId ? recipeById.get(it.recipeId) : null), [recipeById])
  const withShapes = useMemo(() => items.filter(it => it.shapes.length > 0), [items])
  const recipeCtx = useRecipeContext(withShapes, recipeOfItem)
  const uncalibrated = sources.filter(s => !(Number(s.scale_pt_per_m) > 0))

  const bySource = useMemo(
    () =>
      sources
        .filter(s => pageOfSource.has(s.id))
        .map(s => {
          const page = pageOfSource.get(s.id)!
          const sourceItems = items.map(it => ({ ...it, shapes: it.shapes.filter(sh => sh.page === page) })).filter(it => it.shapes.length > 0)
          return { source: s, items: sourceItems }
        })
        .filter(g => g.items.length > 0),
    [sources, items, pageOfSource],
  )

  const surfaceLabels = useSurfaceLabels()
  function exportCsv() {
    const csv = buildQuantitiesCsv(withShapes, 1, numberFormat, {
      layer: t('csv.layer'),
      kind: { linear: t('workspace.layer.linear'), area: t('workspace.layer.area'), count: t('workspace.layer.count') },
      system: t('csv.system'),
      elements: t('csv.elements'),
      length: t('csv.length'),
      grossArea: t('csv.grossArea'),
      openings: t('csv.openings'),
      netArea: t('csv.netArea'),
      area: t('csv.area'),
      perimeter: t('csv.perimeter'),
      count: t('csv.count'),
      material: t('csv.material'),
      type: t('csv.type'),
      profile: t('csv.profile'),
      board: t('csv.board'),
      quantity: t('csv.quantity'),
      unit: t('csv.unit'),
      bars: t('csv.bars'),
      sheets: t('csv.sheets'),
      waste: t('csv.waste'),
      splices: t('csv.splices'),
      recipe: t('csv.recipe'),
      packages: t('csv.packages'),
      screws: t('csv.screws'),
    }, [...recipeMaterials(withShapes, 1, recipeOfItem, recipeCtx), ...surfaceMaterials(withShapes, 1, surfaceLabels).flatMap(x => x.materials)])
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${project?.project_code || project?.name || 'projeto'} - ${t('purchases.title')}.csv`.replace(/[\\/:*?"<>|]+/g, '_')
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
  }

  const tab = (active: boolean) => ({
    ...ui.button,
    background: active ? '#109d91' : '#fff',
    color: active ? '#fff' : '#294955',
    border: '1px solid ' + (active ? '#109d91' : '#d3dfe2'),
  })

  return (
      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loading ? (
          <div style={ui.muted}>{t('workspace.loading')}</div>
        ) : !project ? (
          <div style={ui.empty}>{t('workspace.notFound')}</div>
        ) : (
          <>
            <div>
              <h2 style={ui.panelTitle}>{t('purchases.title')}</h2>
              <p style={{ ...ui.small, margin: '4px 0 0' }}>{t('purchases.subtitle')}</p>
            </div>
            {error && <div style={ui.error}>{error}</div>}
            {uncalibrated.length > 0 && (
              <div style={{ ...ui.small, color: '#9a6700' }}>{t('purchases.uncalibrated', { count: uncalibrated.length, names: uncalibrated.map(s => s.name).join(', ') })}</div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <button type="button" style={tab(view === 'project')} onClick={() => setView('project')}>{t('purchases.view.project')}</button>
              <button type="button" style={tab(view === 'source')} onClick={() => setView('source')}>{t('purchases.view.source')}</button>
              <span style={{ flex: 1 }} />
              {withShapes.length > 0 && <button type="button" style={ui.button} onClick={exportCsv}>{t('export.csv')}</button>}
            </div>

            {withShapes.length === 0 ? (
              <div style={ui.empty}>{t('purchases.empty')}</div>
            ) : view === 'project' ? (
              <>
                <div style={ui.small}>{t('purchases.projectNote', { count: pageOfSource.size })}</div>
                <FramingPanel items={withShapes} ptPerM={1} recipes={recipeById} />
              </>
            ) : (
              <>
                <div style={ui.small}>{t('purchases.sourceNote')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                  {bySource.map(g => (
                    <div key={g.source.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <strong style={{ fontSize: 13, color: '#173441' }}>{g.source.name}{sheetMultiplier(g.source, levels) > 1 ? ` · ×${sheetMultiplier(g.source, levels)}` : ''}</strong>
                      <FramingPanel items={g.items} ptPerM={1} recipes={recipeById} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>
  )
}
