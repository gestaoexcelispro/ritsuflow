'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import type { LayerKind } from '@/lib/takeoff/geometry'
import { formToLines, lineToForm, type Recipe, type RecipeBase, type RecipeLine, type RecipeLineForm } from '@/lib/takeoff/recipes'
import { checkFormula } from '@/lib/takeoff/formula'
import { MATERIAL_COLUMNS, RECIPE_SLOTS, RECIPE_VARIABLES, RECIPE_VARIABLE_NAMES, type MaterialRow, type RecipeSlot } from '@/lib/takeoff/systemRecipes'
import { COUNTRIES } from '@/lib/takeoff/wallTypes'
import type { TakeoffMessageKey } from '@/lib/i18n/messages/takeoff.pt-BR'
import { materialCategoryKey } from './MaterialsCatalog'
import { ui } from '../ui'

type Row = {
  id: string
  name: string
  maker: string | null
  system: string | null
  kind: LayerKind
  height_basis_m: number | null
  waste_included_pct: number
  status: Recipe['status']
  source: Record<string, unknown> | null
  notes: string | null
  lines: RecipeLine[]
  mode?: 'fixed' | 'system' | null
  country_code?: string | null
  labor?: LaborLine[] | null
}

/** Labor productivity: hours of a trade per m², m or unit (priced in Commercial with the trade's rate). */
type LaborLine = { trade: string; hours: number; base: RecipeBase; note?: string | null }
type LaborForm = { trade: string; hours: string; base: RecipeBase; note: string }
const blankLabor = (): LaborForm => ({ trade: '', hours: '', base: 'm2', note: '' })

type Form = {
  name: string
  maker: string
  system: string
  kind: LayerKind
  heightBasis: string
  wasteIncluded: string
  status: Recipe['status']
  notes: string
  mode: 'fixed' | 'system'
  country: string
  lines: RecipeLineForm[]
  labor: LaborForm[]
}

const blankLine = (): RecipeLineForm => ({ mat: '', code: '', unit: '', coef: '', base: 'm2', waste: '', packSize: '', packName: '', materialId: '', slot: '', qty: '', layoutCovered: false })

export const slotKey: Record<RecipeSlot, TakeoffMessageKey> = {
  stud: 'recipes.slot.stud', track: 'recipes.slot.track', boardA: 'recipes.slot.boardA', boardB: 'recipes.slot.boardB', insulation: 'recipes.slot.insulation',
}

/** Recipe editor (shared by all projects); a section of the workspace. */
export default function RecipesEditor({ onChanged }: { onChanged?: () => Promise<void> | void }) {
  const t = useTakeoffT()
  const { numberFormat, language } = useLanguage()
  const [catalog, setCatalog] = useState<MaterialRow[]>([])
  const [usedBy, setUsedBy] = useState<number | null>(null)
  const [showVars, setShowVars] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [trades, setTrades] = useState<{ trade: string; name: string }[]>([])

  // No thousands separators, so the text parses back exactly (1234,5 not 1.234,5).
  const num = useCallback((v: number) => String(v).replace('.', numberFormat === 'pt-BR' ? ',' : '.'), [numberFormat])

  const load = useCallback(async () => {
    const { data, error: e } = await createClient()
      .from('takeoff_recipes')
      .select('id, name, maker, system, kind, height_basis_m, waste_included_pct, status, source, notes, lines, mode, country_code, labor')
      .order('name')
    if (e) setError(t('workspace.error', { message: e.message }))
    setRows((data || []) as Row[])
    setLoading(false)
  }, [t])

  useEffect(() => { load() }, [load])

  const selected = rows.find(r => r.id === selectedId) || null

  useEffect(() => {
    if (!selected) { setForm(null); return }
    setForm({
      name: selected.name,
      maker: selected.maker || '',
      system: selected.system || '',
      kind: selected.kind,
      heightBasis: selected.height_basis_m == null ? '' : num(Number(selected.height_basis_m)),
      wasteIncluded: num(Number(selected.waste_included_pct || 0)),
      status: selected.status,
      notes: selected.notes || '',
      mode: selected.mode === 'system' ? 'system' : 'fixed',
      country: selected.country_code || 'BR',
      lines: [...(selected.lines || []).map(l => lineToForm({ ...l, coef: Number(l.coef) || 0 }, num)), blankLine()],
      labor: [...(Array.isArray(selected.labor) ? selected.labor : []).map(l => ({ trade: l.trade, hours: num(Number(l.hours) || 0), base: l.base, note: l.note || '' })), blankLabor()],
    })
    setError('')
    // How many wall types use this recipe (impact of a change).
    setUsedBy(null)
    createClient().from('takeoff_wall_types').select('id', { count: 'exact', head: true }).eq('recipe_id', selected.id)
      .then(({ count }) => setUsedBy(count ?? 0))
  }, [selected, num])

  // Catalog products of the recipe's country, for the product column.
  const recipeCountry = form?.country || 'BR'
  useEffect(() => {
    createClient().from('takeoff_materials').select(MATERIAL_COLUMNS).eq('country_code', recipeCountry).order('category').order('name').limit(2000)
      .then(({ data }) => setCatalog((data || []) as MaterialRow[]))
  }, [recipeCountry])
  const productById = new Map<string, MaterialRow>(catalog.map((m: MaterialRow) => [m.id, m]))

  // Trades of the company's labor rates (Commercial), offered as suggestions for the labor lines.
  useEffect(() => {
    createClient().from('commercial_labor_rates').select('trade, name').eq('country_code', recipeCountry).order('name').limit(500)
      .then(({ data }) => {
        const seen = new Map<string, string>()
        for (const r of (data || []) as { trade: string; name: string }[]) if (!seen.has(r.trade)) seen.set(r.trade, r.name)
        setTrades([...seen.entries()].map(([trade, name]) => ({ trade, name })))
      })
  }, [recipeCountry])
  const setLabor = (i: number, patch: Partial<LaborForm>) =>
    setForm(f => (f ? { ...f, labor: f.labor.map((l, k) => (k === i ? { ...l, ...patch } : l)) } : f))

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(f => (f ? { ...f, [key]: value } : f))
  const setLine = (i: number, patch: Partial<RecipeLineForm>) =>
    setForm(f => (f ? { ...f, lines: f.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) } : f))

  async function createRecipe() {
    setError('')
    setMessage('')
    const { data, error: e } = await createClient()
      .from('takeoff_recipes')
      .insert({ name: t('recipes.newName'), kind: 'linear', status: 'draft', lines: [] })
      .select('id')
      .single()
    if (e || !data) { setError(t('workspace.error', { message: e?.message || '' })); return }
    await load()
    setSelectedId(data.id)
    setMessage(t('recipes.created'))
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!form || !selected) return
    setError('')
    setMessage('')
    if (!form.name.trim()) { setError(t('layer.nameRequired')); return }
    const { lines, invalidRow } = formToLines(form.lines, parseLocaleNumber, form.mode, id => productById.get(id)?.unit || null)
    if (invalidRow) { setError(t('recipes.invalidLine', { n: invalidRow })); return }
    const labor: LaborLine[] = []
    for (let i = 0; i < form.labor.length; i++) {
      const l = form.labor[i]
      if (!l.trade.trim() && !l.hours.trim()) continue
      const hours = parseLocaleNumber(l.hours)
      const trade = l.trade.trim()
      if (!trade || !/^[a-z0-9_]+$/.test(trade) || !(hours > 0)) { setError(t('recipes.labor.invalid', { n: i + 1 })); return }
      labor.push({ trade, hours, base: l.base, note: l.note.trim() || null })
    }
    const heightBasis = parseLocaleNumber(form.heightBasis)
    const wasteIncluded = parseLocaleNumber(form.wasteIncluded)
    setSaving(true)
    const { error: e } = await createClient()
      .from('takeoff_recipes')
      .update({
        name: form.name.trim(),
        maker: form.maker.trim() || null,
        system: form.system.trim() || null,
        kind: form.kind,
        height_basis_m: heightBasis > 0 ? heightBasis : null,
        waste_included_pct: wasteIncluded >= 0 ? wasteIncluded : 0,
        status: form.status,
        notes: form.notes.trim() || null,
        mode: form.mode,
        country_code: form.country,
        lines,
        labor,
      })
      .eq('id', selected.id)
    setSaving(false)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    await load()
    await onChanged?.()
    setMessage(t('recipes.saved'))
  }

  const statusLabel = (s: Recipe['status']) => t(s === 'approved' ? 'recipe.status.approved' : s === 'review' ? 'recipe.status.review' : 'recipe.status.draft')
  const statusColor = { approved: '#0b7c73', review: '#9a6700', draft: '#6b8089' } as const
  const src = (selected?.source || {}) as Record<string, string | number>

  return (
      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <h2 style={ui.panelTitle}>{t('recipes.title')}</h2>
          <p style={{ ...ui.small, margin: '4px 0 0' }}>{t('recipes.subtitle')}</p>
        </div>
        {error && <div style={ui.error}>{error}</div>}
        {message && <div style={ui.small}>{message}</div>}

        <div style={ui.workspace}>
          <aside style={ui.panel}>
            <button type="button" style={ui.button} onClick={createRecipe}>+ {t('recipes.new')}</button>
            {loading ? (
              <div style={ui.small}>{t('list.loading')}</div>
            ) : rows.length === 0 ? (
              <div style={ui.small}>{t('recipes.empty')}</div>
            ) : rows.map(r => {
              const active = r.id === selectedId
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { setSelectedId(r.id); setMessage('') }}
                  style={{ ...ui.listItem, width: '100%', font: 'inherit', textAlign: 'left', cursor: 'pointer', background: active ? '#edf9f7' : '#fff', borderColor: active ? '#69c9c0' : '#edf1f2' }}
                >
                  <strong>{r.name}</strong>
                  <span style={ui.small}>
                    {[r.maker, r.system].filter(Boolean).join(' · ')}{' · '}
                    <span style={{ color: statusColor[r.status], fontWeight: 700 }}>{statusLabel(r.status)}</span>
                  </span>
                </button>
              )
            })}
          </aside>

          <div style={{ minWidth: 0 }}>
            {!form || !selected ? (
              <div style={ui.viewer}>{t('recipes.select')}</div>
            ) : (
              <form onSubmit={save} style={{ ...ui.panel, gap: 12 }}>
                <div style={grid}>
                  <label style={field}>{t('recipes.name')}<input style={input} value={form.name} onChange={e => set('name', e.target.value)} /></label>
                  <label style={field}>{t('recipes.maker')}<input style={input} value={form.maker} onChange={e => set('maker', e.target.value)} /></label>
                  <label style={field}>{t('recipes.system')}<input style={input} value={form.system} onChange={e => set('system', e.target.value)} /></label>
                  <label style={field}>{t('recipes.kind')}
                    <select style={input} value={form.kind} onChange={e => set('kind', e.target.value as LayerKind)}>
                      <option value="linear">{t('workspace.layer.linear')}</option>
                      <option value="area">{t('workspace.layer.area')}</option>
                      <option value="count">{t('workspace.layer.count')}</option>
                    </select>
                  </label>
                  <label style={field}>{t('recipes.heightBasis')}<input style={input} inputMode="decimal" value={form.heightBasis} onChange={e => set('heightBasis', e.target.value)} /></label>
                  <label style={field}>{t('recipes.wasteIncluded')}<input style={input} inputMode="decimal" value={form.wasteIncluded} onChange={e => set('wasteIncluded', e.target.value)} /></label>
                  <label style={field}>{t('recipes.status')}
                    <select style={input} value={form.status} onChange={e => set('status', e.target.value as Recipe['status'])}>
                      <option value="draft">{statusLabel('draft')}</option>
                      <option value="review">{statusLabel('review')}</option>
                      <option value="approved">{statusLabel('approved')}</option>
                    </select>
                  </label>
                  <label style={field}>{t('recipes.mode')}
                    <select style={input} value={form.mode} onChange={e => set('mode', e.target.value === 'system' ? 'system' : 'fixed')}>
                      <option value="fixed">{t('recipes.mode.fixed')}</option>
                      <option value="system">{t('recipes.mode.system')}</option>
                    </select>
                  </label>
                  <label style={field}>{t('walltype.country')}
                    <select style={input} value={form.country} onChange={e => set('country', e.target.value)}>
                      {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name[language]}</option>)}
                    </select>
                  </label>
                </div>
                <div style={ui.small}>{form.mode === 'system' ? t('recipes.mode.systemHint') : t('recipes.mode.fixedHint')}{usedBy != null ? ` ${t('recipes.usedBy', { count: usedBy })}` : ''}</div>
                <label style={field}>{t('recipes.notes')}<textarea style={{ ...input, height: 56, padding: 8 }} value={form.notes} onChange={e => set('notes', e.target.value)} /></label>
                {src.catalog && (
                  <div style={ui.small}>
                    <strong>{t('recipes.source')}:</strong>{' '}
                    {t('recipes.sourceDetail', { catalog: String(src.catalog), pdfPage: String(src.pdfPage ?? '—'), printedPage: String(src.printedPage ?? '—'), table: String(src.table ?? ''), column: String(src.column ?? '') })}
                  </div>
                )}

                <h2 style={ui.panelTitle}>{t('recipes.lines')}</h2>
                {form.mode === 'system' && (
                  <div style={{ ...ui.small, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button type="button" style={{ ...linkBtn, alignSelf: 'flex-start' }} onClick={() => setShowVars(v => !v)}>{showVars ? '▾' : '▸'} {t('recipes.varsTitle')}</button>
                    {showVars && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2px 16px', padding: 8, border: '1px solid #e2ebf0', borderRadius: 8, background: '#f9fbfc' }}>
                        {RECIPE_VARIABLES.map(v => <span key={v.name}><code style={{ fontWeight: 700 }}>{v.name}</code> — {language !== 'pt-BR' ? v.en : v.pt}</span>)}
                        <span style={{ gridColumn: '1 / -1', marginTop: 4 }}>{t('recipes.varsExamples')}</span>
                      </div>
                    )}
                  </div>
                )}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 980, fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#f2f7f8', color: '#536d78', textAlign: 'left' }}>
                        {(form.mode === 'system'
                          ? ['recipes.line.product', 'recipes.line.mat', 'recipes.line.unit', 'recipes.line.qty', 'recipes.line.waste', 'recipes.line.layout']
                          : ['recipes.line.product', 'recipes.line.mat', 'recipes.line.code', 'recipes.line.unit', 'recipes.line.coef', 'recipes.line.base', 'recipes.line.waste', 'recipes.line.packSize', 'recipes.line.packName']
                        ).map(k => (
                          <th key={k} style={th}>{t(k as Parameters<typeof t>[0])}</th>
                        ))}
                        <th style={th} />
                      </tr>
                    </thead>
                    <tbody>
                      {form.lines.map((l, i) => {
                        const product = l.materialId ? productById.get(l.materialId) : undefined
                        const fErr = form.mode === 'system' && (l.qty || '').trim() ? checkFormula((l.qty || '').trim(), RECIPE_VARIABLE_NAMES) : null
                        const pick = (
                          <select
                            style={{ ...cell, width: 210 }}
                            value={l.slot ? `slot:${l.slot}` : l.materialId ? `mat:${l.materialId}` : ''}
                            onChange={e => {
                              const v = e.target.value
                              if (v.startsWith('slot:')) setLine(i, { slot: v.slice(5) as RecipeSlot, materialId: '' })
                              else if (v.startsWith('mat:')) {
                                const m = productById.get(v.slice(4))
                                setLine(i, { slot: '', materialId: v.slice(4), ...(m ? { mat: m.name, unit: m.unit } : {}) })
                              } else setLine(i, { slot: '', materialId: '' })
                            }}
                          >
                            <option value="">{t('recipes.product.typed')}</option>
                            {form.mode === 'system' && (
                              <optgroup label={t('recipes.product.fromWallType')}>
                                {RECIPE_SLOTS.map(sl => <option key={sl} value={`slot:${sl}`}>{t(slotKey[sl])}</option>)}
                              </optgroup>
                            )}
                            {(Object.entries(catalog.reduce((acc: Record<string, MaterialRow[]>, m: MaterialRow) => { (acc[m.category] ||= []).push(m); return acc }, {})) as [string, MaterialRow[]][]).map(([cat, list]) => (
                              <optgroup key={cat} label={t(materialCategoryKey[cat as MaterialRow['category']])}>
                                {list.map(m => <option key={m.id} value={`mat:${m.id}`}>{m.name} ({m.unit})</option>)}
                              </optgroup>
                            ))}
                          </select>
                        )
                        return form.mode === 'system' ? (
                          <tr key={i} style={{ borderTop: '1px solid #edf1f2', verticalAlign: 'top' }}>
                            <td style={td}>{pick}</td>
                            <td style={td}><input style={{ ...cell, width: 170 }} value={l.mat} placeholder={l.slot ? t(slotKey[l.slot as RecipeSlot]) : product?.name || ''} disabled={!!l.slot || !!product} onChange={e => setLine(i, { mat: e.target.value })} /></td>
                            <td style={td}><input style={{ ...cell, width: 54 }} value={l.unit} placeholder={product?.unit || ''} onChange={e => setLine(i, { unit: e.target.value })} /></td>
                            <td style={td}>
                              <input style={{ ...cell, width: 300, fontFamily: 'ui-monospace, monospace', borderColor: fErr ? '#e0a0a0' : '#d6e0e3' }} value={l.qty || ''} placeholder="area * layers_a" onChange={e => setLine(i, { qty: e.target.value })} />
                              {fErr && <div style={{ color: '#a44343', fontSize: 10, marginTop: 2 }}>{t('recipes.formulaError', { message: fErr.message, at: fErr.at + 1 })}</div>}
                            </td>
                            <td style={td}><input style={{ ...cell, width: 60 }} inputMode="decimal" value={l.waste} onChange={e => setLine(i, { waste: e.target.value })} /></td>
                            <td style={{ ...td, textAlign: 'center' }}><input type="checkbox" title={t('recipes.line.layoutHint')} checked={!!l.layoutCovered} onChange={e => setLine(i, { layoutCovered: e.target.checked })} /></td>
                            <td style={td}>
                              <button type="button" title={t('recipes.removeLine')} style={removeBtn} onClick={() => set('lines', form.lines.filter((_, k) => k !== i))}>×</button>
                            </td>
                          </tr>
                        ) : (
                          <tr key={i} style={{ borderTop: '1px solid #edf1f2' }}>
                            <td style={td}>{pick}</td>
                            <td style={td}><input style={{ ...cell, width: 200 }} value={l.mat} onChange={e => setLine(i, { mat: e.target.value })} /></td>
                            <td style={td}><input style={{ ...cell, width: 80 }} value={l.code} onChange={e => setLine(i, { code: e.target.value })} /></td>
                            <td style={td}><input style={{ ...cell, width: 60 }} value={l.unit} onChange={e => setLine(i, { unit: e.target.value })} /></td>
                            <td style={td}><input style={{ ...cell, width: 80 }} inputMode="decimal" value={l.coef} onChange={e => setLine(i, { coef: e.target.value })} /></td>
                            <td style={td}>
                              <select style={{ ...cell, width: 110 }} value={l.base} onChange={e => setLine(i, { base: e.target.value as RecipeBase })}>
                                <option value="m2">{t('recipes.base.m2')}</option>
                                <option value="m">{t('recipes.base.m')}</option>
                                <option value="un">{t('recipes.base.un')}</option>
                              </select>
                            </td>
                            <td style={td}><input style={{ ...cell, width: 70 }} inputMode="decimal" value={l.waste} onChange={e => setLine(i, { waste: e.target.value })} /></td>
                            <td style={td}><input style={{ ...cell, width: 70 }} inputMode="decimal" value={l.packSize} onChange={e => setLine(i, { packSize: e.target.value })} /></td>
                            <td style={td}><input style={{ ...cell, width: 120 }} value={l.packName} onChange={e => setLine(i, { packName: e.target.value })} /></td>
                            <td style={td}>
                              <button type="button" title={t('recipes.removeLine')} style={removeBtn} onClick={() => set('lines', form.lines.filter((_, k) => k !== i))}>×</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" style={{ ...ui.button, background: '#fff', color: '#294955', border: '1px solid #d3dfe2' }} onClick={() => set('lines', [...form.lines, blankLine()])}>+ {t('recipes.addLine')}</button>
                </div>

                <h2 style={ui.panelTitle}>{t('recipes.labor.title')}</h2>
                <div style={ui.small}>{t('recipes.labor.hint')}</div>
                <datalist id="recipe-trades">{trades.map(tr => <option key={tr.trade} value={tr.trade}>{tr.name}</option>)}</datalist>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640, fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#f2f7f8', color: '#536d78', textAlign: 'left' }}>
                        <th style={th}>{t('recipes.labor.trade')}</th>
                        <th style={th}>{t('recipes.labor.hours')}</th>
                        <th style={th}>{t('recipes.labor.base')}</th>
                        <th style={th}>{t('recipes.labor.note')}</th>
                        <th style={th} />
                      </tr>
                    </thead>
                    <tbody>
                      {form.labor.map((l, i) => {
                        const known = trades.find(tr => tr.trade === l.trade.trim())
                        return (
                          <tr key={i} style={{ borderTop: '1px solid #edf1f2', verticalAlign: 'top' }}>
                            <td style={td}>
                              <input style={{ ...cell, width: 220, fontFamily: 'ui-monospace, monospace' }} list="recipe-trades" value={l.trade} placeholder="drywall_installer" onChange={e => setLabor(i, { trade: e.target.value.toLowerCase().replace(/\s+/g, '_') })} />
                              <div style={{ fontSize: 10, color: known ? '#0b7c73' : '#9a6700', marginTop: 2, minHeight: 12 }}>{l.trade.trim() ? (known ? known.name : t('recipes.labor.noRate')) : ''}</div>
                            </td>
                            <td style={td}><input style={{ ...cell, width: 90 }} inputMode="decimal" value={l.hours} onChange={e => setLabor(i, { hours: e.target.value })} /></td>
                            <td style={td}>
                              <select style={{ ...cell, width: 110 }} value={l.base} onChange={e => setLabor(i, { base: e.target.value as RecipeBase })}>
                                <option value="m2">{t('recipes.base.m2')}</option>
                                <option value="m">{t('recipes.base.m')}</option>
                                <option value="un">{t('recipes.base.un')}</option>
                              </select>
                            </td>
                            <td style={td}><input style={{ ...cell, width: 220 }} value={l.note} onChange={e => setLabor(i, { note: e.target.value })} /></td>
                            <td style={td}><button type="button" title={t('recipes.removeLine')} style={removeBtn} onClick={() => set('labor', form.labor.filter((_, k) => k !== i))}>×</button></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" style={{ ...ui.button, background: '#fff', color: '#294955', border: '1px solid #d3dfe2' }} onClick={() => set('labor', [...form.labor, blankLabor()])}>+ {t('recipes.labor.add')}</button>
                  <button type="submit" style={{ ...ui.button, opacity: saving ? 0.6 : 1 }} disabled={saving}>{t('recipes.save')}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
  )
}

const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 } as const
const field = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10, fontWeight: 700, color: '#607681' } as const
const input = { height: 32, padding: '0 8px', border: '1px solid #d6e0e3', borderRadius: 7, fontSize: 12, background: '#fff', boxSizing: 'border-box', width: '100%' } as const
const th = { padding: '7px 6px', fontWeight: 800, fontSize: 10 } as const
const td = { padding: '4px 6px' } as const
const cell = { height: 28, padding: '0 6px', border: '1px solid #d6e0e3', borderRadius: 6, fontSize: 11, background: '#fff' } as const
const linkBtn = { border: 0, background: 'transparent', padding: 0, color: '#0d7f77', fontSize: 11, fontWeight: 700, cursor: 'pointer' } as const
const removeBtn = { width: 26, height: 26, border: '1px solid #efcaca', borderRadius: 6, background: '#fff7f7', color: '#c94a4a', cursor: 'pointer' } as const
