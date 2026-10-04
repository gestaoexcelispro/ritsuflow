'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import type { TakeoffMessageKey } from '@/lib/i18n/messages/takeoff.pt-BR'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import { parseBars } from '@/lib/takeoff/framing/framing'
import { rowToRecipe, type Recipe, type RecipeRow } from '@/lib/takeoff/recipes'
import { MATERIAL_COLUMNS, RECIPE_SLOTS, SLOT_CATEGORY, previewPerM2, type MaterialRow, type RecipeSlot } from '@/lib/takeoff/systemRecipes'
import {
  COUNTRIES,
  WALL_CATEGORIES,
  WALL_TYPE_COLUMNS,
  filterWallTypes,
  wallTypeLabel,
  type BoardSpec,
  type ReferenceSourceRow,
  type WallCategory,
  type WallTypeRow,
  type WallTypeStatus,
} from '@/lib/takeoff/wallTypes'
import { ui } from '../ui'

type Props = {
  projectId: string
  projectCountry: string | null
  onChanged?: () => Promise<void> | void
}

type Form = {
  scope: 'library' | 'project'
  country: string
  region: string
  code: string
  name: string
  category: WallCategory
  fire: string
  stcMin: string
  stcMax: string
  rated: string
  thickness: string
  spacing: string
  bars: string
  studName: string
  trackName: string
  aProduct: string
  aThick: string
  aCount: string
  bProduct: string
  bThick: string
  bCount: string
  recipeId: string
  sourceId: string
  sourceRef: string
  status: WallTypeStatus
  notes: string
  doubleStuds: boolean
  slots: Record<RecipeSlot, string>
}

export const categoryKey: Record<WallCategory, TakeoffMessageKey> = {
  non_rated: 'walltype.cat.non_rated',
  rated: 'walltype.cat.rated',
  shaft: 'walltype.cat.shaft',
  furring: 'walltype.cat.furring',
  chase: 'walltype.cat.chase',
  exterior: 'walltype.cat.exterior',
  other: 'walltype.cat.other',
}
export const statusKey: Record<WallTypeStatus, TakeoffMessageKey> = {
  draft: 'recipe.status.draft',
  review: 'recipe.status.review',
  approved: 'recipe.status.approved',
}
export const statusColor: Record<WallTypeStatus, string> = { approved: '#0b7c73', review: '#9a6700', draft: '#6b8089' }

/** Company wall-type library plus this project's own types, filtered by country. */
export default function WallTypesLibrary({ projectId, projectCountry, onChanged }: Props) {
  const t = useTakeoffT()
  const { language, numberFormat } = useLanguage()
  const [rows, setRows] = useState<WallTypeRow[]>([])
  const [sources, setSources] = useState<ReferenceSourceRow[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [catalog, setCatalog] = useState<MaterialRow[]>([])
  const [country, setCountry] = useState<string>(projectCountry || 'all')
  const [category, setCategory] = useState<WallCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [newSource, setNewSource] = useState<{ name: string; edition: string; url: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // No thousands separators, so the text parses back exactly.
  const num = useCallback((v: number | null | undefined) => (v == null ? '' : String(v).replace('.', numberFormat === 'pt-BR' ? ',' : '.')), [numberFormat])

  const load = useCallback(async () => {
    const supabase = createClient()
    const [w, s, r] = await Promise.all([
      supabase.from('takeoff_wall_types').select(WALL_TYPE_COLUMNS).order('name'),
      supabase.from('takeoff_reference_sources').select('id, name, publisher, edition, country_code, url, license_note').order('name'),
      supabase.from('takeoff_recipes').select('id, name, maker, system, kind, height_basis_m, waste_included_pct, status, lines, mode').order('name'),
    ])
    const failure = w.error || s.error || r.error
    if (failure) setError(t('workspace.error', { message: failure.message }))
    setRows(((w.data || []) as WallTypeRow[]).map(x => ({ ...x, boards: Array.isArray(x.boards) ? x.boards : [], framing: x.framing || {} })))
    setSources((s.data || []) as ReferenceSourceRow[])
    setRecipes(((r.data || []) as RecipeRow[]).map(rowToRecipe))
  }, [t])

  useEffect(() => { load() }, [load])

  const visible = useMemo(() => filterWallTypes(rows, { country, category, search, projectId }), [rows, country, category, search, projectId])
  const selected = rows.find(r => r.id === selectedId) || null

  const toForm = useCallback((wt: WallTypeRow): Form => {
    const a = wt.boards.find(b => b.side === 'A')
    const b = wt.boards.find(x => x.side === 'B')
    const f = wt.framing || {}
    return {
      scope: wt.project_id ? 'project' : 'library',
      country: wt.country_code,
      region: wt.region || '',
      code: wt.code || '',
      name: wt.name,
      category: wt.category,
      fire: num(wt.fire_rating_hr),
      stcMin: wt.stc_min == null ? '' : String(wt.stc_min),
      stcMax: wt.stc_max == null ? '' : String(wt.stc_max),
      rated: wt.rated_design || '',
      thickness: num(wt.thickness_m),
      spacing: num(f.spacing),
      bars: (f.bars || []).map(v => num(v)).join('; '),
      studName: f.studName || '',
      trackName: f.trackName || '',
      aProduct: a?.product || '',
      aThick: num(a?.thickness_m),
      aCount: a ? String(a.count) : '',
      bProduct: b?.product || '',
      bThick: num(b?.thickness_m),
      bCount: b ? String(b.count) : '',
      recipeId: wt.recipe_id || '',
      sourceId: wt.source_id || '',
      sourceRef: wt.source_ref || '',
      status: wt.status,
      notes: wt.notes || '',
      doubleStuds: !!(f as { doubleStuds?: boolean }).doubleStuds,
      slots: Object.fromEntries(RECIPE_SLOTS.map(sl => [sl, wt.materials?.[sl] || ''])) as Record<RecipeSlot, string>,
    }
  }, [num])

  useEffect(() => {
    setForm(selected ? toForm(selected) : null)
    setNewSource(null)
    // Reset only when another type is selected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(f => (f ? { ...f, [key]: value } : f))

  // Catalog products of the type's country for the product pickers (studs, tracks, boards, insulation).
  const formCountry = form?.country || null
  useEffect(() => {
    if (!formCountry) return
    createClient().from('takeoff_materials').select(MATERIAL_COLUMNS).eq('country_code', formCountry)
      .in('category', ['stud', 'track', 'board', 'insulation']).order('name').limit(3000)
      .then(({ data }) => setCatalog((data || []) as MaterialRow[]))
  }, [formCountry])
  const catalogById = useMemo(() => new Map<string, MaterialRow>(catalog.map((m: MaterialRow) => [m.id, m])), [catalog])

  /** Consumption per m² of the type being edited with its recipe (live, before saving). */
  const preview = useMemo(() => {
    if (!form) return null
    const recipe = recipes.find((r: Recipe) => r.id === form.recipeId)
    if (!recipe) return null
    const n = (s: string) => { const v = parseLocaleNumber(s); return Number.isFinite(v) ? v : null }
    const heightM = Number((selected?.framing as { maxHeightM?: number } | undefined)?.maxHeightM) || 2.8
    const lines = previewPerM2(recipe, {
      thickness_m: n(form.thickness),
      framing: { spacing: n(form.spacing) ?? undefined, doubleStuds: form.doubleStuds } as never,
      boards: [{ side: 'A', count: parseInt(form.aCount, 10) || (form.aProduct ? 1 : 0) }, { side: 'B', count: parseInt(form.bCount, 10) || (form.bProduct ? 1 : 0) }],
      materials: form.slots,
    }, catalogById, Math.min(heightM, 2.8))
    return { recipe, lines }
  }, [form, recipes, catalogById, selected])

  async function create() {
    setError('')
    setMessage('')
    const { data, error: e } = await createClient()
      .from('takeoff_wall_types')
      .insert({ name: `${t('walltype.newName')} ${new Date().toLocaleTimeString(language)}`, country_code: country === 'all' ? projectCountry || 'BR' : country, category: 'non_rated', status: 'draft' })
      .select('id')
      .single()
    if (e || !data) { setError(t('workspace.error', { message: e?.message || '' })); return }
    await load()
    setSelectedId(data.id)
    setMessage(t('walltype.created'))
  }

  async function duplicate() {
    if (!selected) return
    setError('')
    setMessage('')
    const { id: _id, ...rest } = selected
    void _id
    const { data, error: e } = await createClient()
      .from('takeoff_wall_types')
      .insert({ ...rest, name: `${selected.name} (${t('walltype.copy')} ${new Date().toLocaleTimeString(language)})`, code: selected.code ? `${selected.code}-${t('walltype.copy').toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}` : null, status: 'draft' })
      .select('id')
      .single()
    if (e || !data) { setError(t('workspace.error', { message: e?.message || '' })); return }
    await load()
    setSelectedId(data.id)
    setMessage(t('walltype.created'))
  }

  async function remove() {
    if (!selected || !window.confirm(t('walltype.deleteConfirm', { name: wallTypeLabel(selected) }))) return
    setError('')
    const { error: e } = await createClient().from('takeoff_wall_types').delete().eq('id', selected.id)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    setSelectedId(null)
    await load()
    setMessage(t('walltype.deleted'))
  }

  async function addSource() {
    if (!newSource || !newSource.name.trim()) return
    setError('')
    const { data, error: e } = await createClient()
      .from('takeoff_reference_sources')
      .insert({ name: newSource.name.trim(), edition: newSource.edition.trim() || null, url: newSource.url.trim() || null, country_code: form?.country || null })
      .select('id')
      .single()
    if (e || !data) { setError(t('workspace.error', { message: e?.message || '' })); return }
    await load()
    set('sourceId', data.id)
    setNewSource(null)
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!form || !selected) return
    setError('')
    setMessage('')
    if (!form.name.trim()) { setError(t('layer.nameRequired')); return }
    const opt = (s: string) => { const v = parseLocaleNumber(s); return s.trim() && Number.isFinite(v) ? v : null }
    const int = (s: string) => { const v = parseInt(s, 10); return Number.isFinite(v) && v > 0 ? v : null }
    const spacing = opt(form.spacing)
    const thickness = opt(form.thickness)
    const fire = opt(form.fire)
    if ((spacing != null && !(spacing > 0)) || (thickness != null && !(thickness > 0)) || (fire != null && fire < 0)) {
      setError(t('walltype.invalidNumber'))
      return
    }
    const framing: Record<string, unknown> = { ...(selected.framing || {}) }
    const putOrDrop = (k: string, v: unknown) => { if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) delete framing[k]; else framing[k] = v }
    putOrDrop('spacing', spacing)
    putOrDrop('bars', parseBars(form.bars))
    putOrDrop('studName', form.studName.trim())
    putOrDrop('trackName', form.trackName.trim())
    putOrDrop('doubleStuds', form.doubleStuds || null)
    const boards: BoardSpec[] = []
    if (form.aProduct.trim()) boards.push({ side: 'A', product: form.aProduct.trim(), thickness_m: opt(form.aThick), count: int(form.aCount) ?? 1 })
    if (form.bProduct.trim()) boards.push({ side: 'B', product: form.bProduct.trim(), thickness_m: opt(form.bThick), count: int(form.bCount) ?? 1 })
    setSaving(true)
    const { error: e } = await createClient()
      .from('takeoff_wall_types')
      .update({
        project_id: form.scope === 'project' ? projectId : null,
        country_code: form.country,
        region: form.region.trim() || null,
        code: form.code.trim() || null,
        name: form.name.trim(),
        category: form.category,
        fire_rating_hr: fire,
        stc_min: int(form.stcMin),
        stc_max: int(form.stcMax),
        rated_design: form.rated.trim() || null,
        thickness_m: thickness,
        framing,
        boards,
        recipe_id: form.recipeId || null,
        source_id: form.sourceId || null,
        source_ref: form.sourceRef.trim() || null,
        status: form.status,
        notes: form.notes.trim() || null,
        materials: Object.fromEntries(RECIPE_SLOTS.filter(sl => form.slots[sl]).map(sl => [sl, form.slots[sl]])),
      })
      .eq('id', selected.id)
    setSaving(false)
    if (e) { setError(/duplicate key|unique/i.test(e.message) ? t('walltype.duplicateExists') : t('workspace.error', { message: e.message })); return }
    await load()
    await onChanged?.()
    setMessage(t('walltype.saved'))
  }

  const countryName = (code: string) => COUNTRIES.find(c => c.code === code)?.name[language] || code
  const source = sources.find(s => s.id === form?.sourceId)

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={ui.panelTitle}>{t('walltype.title')}</h2>
        <p style={{ ...ui.small, margin: '4px 0 0' }}>{t('walltype.subtitle')}</p>
      </div>
      {error && <div style={ui.error}>{error}</div>}
      {message && <div style={ui.small}>{message}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '340px minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <aside style={ui.panel}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select style={{ ...input, width: 160 }} value={country} onChange={e => setCountry(e.target.value)} aria-label={t('walltype.country')}>
              <option value="all">{t('walltype.allCountries')}</option>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name[language]}</option>)}
            </select>
            <select style={{ ...input, width: 150 }} value={category} onChange={e => setCategory(e.target.value as WallCategory | 'all')} aria-label={t('walltype.category')}>
              <option value="all">{t('walltype.allCategories')}</option>
              {WALL_CATEGORIES.map(c => <option key={c} value={c}>{t(categoryKey[c])}</option>)}
            </select>
          </div>
          <input style={input} placeholder={t('walltype.search')} value={search} onChange={e => setSearch(e.target.value)} />
          <button type="button" style={ui.button} onClick={() => void create()}>+ {t('walltype.new')}</button>
          {visible.length > LIST_MAX && <div style={ui.small}>{t('material.showing', { shown: LIST_MAX, total: visible.length })}</div>}
          {visible.length === 0 ? (
            <div style={ui.small}>{t('walltype.empty')}</div>
          ) : visible.slice(0, LIST_MAX).map(wt => {
            const active = wt.id === selectedId
            return (
              <button
                key={wt.id}
                type="button"
                onClick={() => { setSelectedId(wt.id); setMessage('') }}
                style={{ ...ui.listItem, width: '100%', font: 'inherit', textAlign: 'left', cursor: 'pointer', background: active ? '#edf9f7' : '#fff', borderColor: active ? '#69c9c0' : '#edf1f2' }}
              >
                <strong>{wallTypeLabel(wt)}</strong>
                <span style={ui.small}>
                  {countryName(wt.country_code)}{wt.region ? ` · ${wt.region}` : ''} · {t(categoryKey[wt.category])}
                  {wt.rated_design ? ` · ${wt.rated_design}` : ''}
                  {wt.project_id ? ` · ${t('walltype.scope.project')}` : ''}
                  {' · '}<span style={{ color: statusColor[wt.status], fontWeight: 700 }}>{t(statusKey[wt.status])}</span>
                </span>
              </button>
            )
          })}
        </aside>

        <div style={{ minWidth: 0 }}>
          {!form || !selected ? (
            <div style={ui.viewer}>{t('walltype.select')}</div>
          ) : (
            <form onSubmit={save} style={{ ...ui.panel, gap: 12 }}>
              <div style={grid}>
                <label style={field}>{t('walltype.code')}<input style={input} value={form.code} onChange={e => set('code', e.target.value)} placeholder="A1" /></label>
                <label style={{ ...field, gridColumn: 'span 2' }}>{t('walltype.name')}<input style={input} value={form.name} onChange={e => set('name', e.target.value)} /></label>
                <label style={field}>{t('walltype.category')}
                  <select style={input} value={form.category} onChange={e => set('category', e.target.value as WallCategory)}>
                    {WALL_CATEGORIES.map(c => <option key={c} value={c}>{t(categoryKey[c])}</option>)}
                  </select>
                </label>
                <label style={field}>{t('walltype.country')}
                  <select style={input} value={form.country} onChange={e => set('country', e.target.value)}>
                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name[language]}</option>)}
                  </select>
                </label>
                <label style={field}>{t('walltype.region')}<input style={input} value={form.region} onChange={e => set('region', e.target.value)} /></label>
                <label style={field}>{t('walltype.scope')}
                  <select style={input} value={form.scope} onChange={e => set('scope', e.target.value as Form['scope'])}>
                    <option value="library">{t('walltype.scope.library')}</option>
                    <option value="project">{t('walltype.scope.project')}</option>
                  </select>
                </label>
                <label style={field}>{t('recipes.status')}
                  <select style={input} value={form.status} onChange={e => set('status', e.target.value as WallTypeStatus)}>
                    {(['draft', 'review', 'approved'] as const).map(s => <option key={s} value={s}>{t(statusKey[s])}</option>)}
                  </select>
                </label>
              </div>

              <h3 style={subTitle}>{t('walltype.performance')}</h3>
              <div style={grid}>
                <label style={field}>{t('walltype.fire')}<input style={input} inputMode="decimal" value={form.fire} onChange={e => set('fire', e.target.value)} /></label>
                <label style={field}>{t('walltype.stcMin')}<input style={input} inputMode="numeric" value={form.stcMin} onChange={e => set('stcMin', e.target.value)} /></label>
                <label style={field}>{t('walltype.stcMax')}<input style={input} inputMode="numeric" value={form.stcMax} onChange={e => set('stcMax', e.target.value)} /></label>
                <label style={field}>{t('walltype.rated')}<input style={input} value={form.rated} onChange={e => set('rated', e.target.value)} placeholder="UL U465" /></label>
              </div>

              <h3 style={subTitle}>{t('walltype.buildup')}</h3>
              <div style={grid}>
                <label style={field}>{t('walltype.thickness')}<input style={input} inputMode="decimal" value={form.thickness} onChange={e => set('thickness', e.target.value)} /></label>
                <label style={field}>{t('framing.spacing')}<input style={input} inputMode="decimal" value={form.spacing} onChange={e => set('spacing', e.target.value)} /></label>
                <label style={field}>{t('framing.bars')}<input style={input} value={form.bars} onChange={e => set('bars', e.target.value)} /></label>
                <label style={field}>{t('walltype.studName')}<input style={input} value={form.studName} onChange={e => set('studName', e.target.value)} /></label>
                <label style={field}>{t('walltype.trackName')}<input style={input} value={form.trackName} onChange={e => set('trackName', e.target.value)} /></label>
              </div>
              <div style={grid}>
                <label style={{ ...field, gridColumn: 'span 2' }}>{t('walltype.sideA')}<input style={input} value={form.aProduct} onChange={e => set('aProduct', e.target.value)} /></label>
                <label style={field}>{t('walltype.boardThickness')}<input style={input} inputMode="decimal" value={form.aThick} onChange={e => set('aThick', e.target.value)} /></label>
                <label style={field}>{t('walltype.layers')}<input style={input} inputMode="numeric" value={form.aCount} onChange={e => set('aCount', e.target.value)} /></label>
              </div>
              <div style={grid}>
                <label style={{ ...field, gridColumn: 'span 2' }}>{t('walltype.sideB')}<input style={input} value={form.bProduct} onChange={e => set('bProduct', e.target.value)} /></label>
                <label style={field}>{t('walltype.boardThickness')}<input style={input} inputMode="decimal" value={form.bThick} onChange={e => set('bThick', e.target.value)} /></label>
                <label style={field}>{t('walltype.layers')}<input style={input} inputMode="numeric" value={form.bCount} onChange={e => set('bCount', e.target.value)} /></label>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#294955' }}>
                <input type="checkbox" checked={form.doubleStuds} onChange={e => set('doubleStuds', e.target.checked)} />{t('walltype.doubleStuds')}
              </label>
              <div style={ui.small}>{t('walltype.unitsNote')}</div>

              <h3 style={subTitle}>{t('walltype.products')}</h3>
              <div style={ui.small}>{t('walltype.productsHint')}</div>
              <div style={grid}>
                {RECIPE_SLOTS.map(sl => (
                  <label key={sl} style={{ ...field, gridColumn: 'span 2' }}>{t(`recipes.slot.${sl}` as TakeoffMessageKey)}
                    <select style={input} value={form.slots[sl]} onChange={e => set('slots', { ...form.slots, [sl]: e.target.value })}>
                      <option value="">{t('walltype.noProduct')}</option>
                      {catalog.filter((m: MaterialRow) => m.category === SLOT_CATEGORY[sl] || m.id === form.slots[sl]).map((m: MaterialRow) => (
                        <option key={m.id} value={m.id}>{m.name}{m.supplier ? ` · ${m.supplier}${m.code ? ` ${m.code}` : ''}` : ''}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>

              <h3 style={subTitle}>{t('walltype.recipeAndSource')}</h3>
              <div style={grid}>
                <label style={{ ...field, gridColumn: 'span 2' }}>{t('walltype.recipe')}
                  <select style={input} value={form.recipeId} onChange={e => set('recipeId', e.target.value)}>
                    <option value="">—</option>
                    {recipes.map(r => <option key={r.id} value={r.id}>{r.name}{r.maker ? ` · ${r.maker}` : ''}</option>)}
                  </select>
                </label>
                <label style={{ ...field, gridColumn: 'span 2' }}>{t('walltype.source')}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select style={{ ...input, flex: 1 }} value={form.sourceId} onChange={e => set('sourceId', e.target.value)}>
                      <option value="">—</option>
                      {sources.map(s => <option key={s.id} value={s.id}>{s.name}{s.edition ? ` (${s.edition})` : ''}</option>)}
                    </select>
                    <button type="button" style={ghostBtn} onClick={() => setNewSource(v => (v ? null : { name: '', edition: '', url: '' }))}>+</button>
                  </div>
                </label>
                <label style={{ ...field, gridColumn: 'span 2' }}>{t('walltype.sourceRef')}<input style={input} value={form.sourceRef} onChange={e => set('sourceRef', e.target.value)} placeholder="https://… / p. 12" /></label>
              </div>
              {preview && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <strong style={{ fontSize: 11, color: '#173441' }}>{t('walltype.previewTitle', { recipe: preview.recipe.name })}</strong>
                  <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
                    <tbody>
                      {preview.lines.map(pl => (
                        <tr key={pl.line} style={{ borderTop: '1px solid #edf1f2', color: pl.skipped || pl.error ? '#9aa8ae' : '#294955' }}>
                          <td style={{ padding: '3px 6px' }}>{pl.name}</td>
                          <td style={{ padding: '3px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {pl.error ? t('walltype.previewError') : pl.skipped ? t('walltype.previewNoProduct') : `${pl.perM2.toLocaleString(language, { maximumFractionDigits: 3 })} ${pl.unit}/m²`}
                          </td>
                          <td style={{ padding: '3px 6px', fontSize: 10, color: '#6b8089' }}>{pl.layoutCovered ? t('walltype.previewLayout') : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <span style={ui.small}>{t('walltype.previewHint')}</span>
                </div>
              )}
              {source?.url && <a href={source.url} target="_blank" rel="noreferrer" style={ui.backLink}>{source.url}</a>}
              {newSource && (
                <div style={{ ...grid, padding: 10, border: '1px dashed #cddcdf', borderRadius: 8 }}>
                  <label style={field}>{t('walltype.sourceName')}<input style={input} value={newSource.name} onChange={e => setNewSource({ ...newSource, name: e.target.value })} /></label>
                  <label style={field}>{t('walltype.sourceEdition')}<input style={input} value={newSource.edition} onChange={e => setNewSource({ ...newSource, edition: e.target.value })} /></label>
                  <label style={{ ...field, gridColumn: 'span 2' }}>URL<input style={input} value={newSource.url} onChange={e => setNewSource({ ...newSource, url: e.target.value })} /></label>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}><button type="button" style={ghostBtn} onClick={() => void addSource()}>{t('walltype.addSource')}</button></div>
                </div>
              )}
              <label style={field}>{t('recipes.notes')}<textarea style={{ ...input, height: 56, padding: 8 }} value={form.notes} onChange={e => set('notes', e.target.value)} /></label>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="submit" style={{ ...ui.button, opacity: saving ? 0.6 : 1 }} disabled={saving}>{t('walltype.save')}</button>
                <button type="button" style={ghostBtn} onClick={() => void duplicate()}>{t('walltype.duplicate')}</button>
                <span style={{ flex: 1 }} />
                <button type="button" style={{ ...ghostBtn, color: '#c94a4a', borderColor: '#efcaca' }} onClick={() => void remove()}>{t('walltype.delete')}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

/** The list shows the first matches; search and filters narrow thousands of types. */
const LIST_MAX = 300
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 } as const
const field = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10, fontWeight: 700, color: '#607681' } as const
const input = { height: 32, padding: '0 8px', border: '1px solid #d6e0e3', borderRadius: 7, fontSize: 12, background: '#fff', boxSizing: 'border-box', width: '100%' } as const
const subTitle = { margin: '4px 0 0', fontSize: 11, fontWeight: 800, color: '#173441', textTransform: 'uppercase', letterSpacing: '.05em' } as const
const ghostBtn = { height: 32, padding: '0 12px', border: '1px solid #d3dfe2', borderRadius: 7, background: '#fff', color: '#294955', fontSize: 11, fontWeight: 700, cursor: 'pointer' } as const
