// Actual costs in money on a converted project (commercial_actual_costs): typed in or imported
// from a CSV (ERP or spreadsheet export), and compared with the baseline estimate and earned value.
// Pure functions, tested in scripts/commercial-pricing.test.mjs.
import { parseCsv, parseDate } from './csvImport'
import { inPrice, itemDirect, type ItemRow } from './estimates'

export const COST_CATEGORIES = ['material', 'labor', 'equipment', 'subcontract', 'other'] as const
export type CostCategory = (typeof COST_CATEGORIES)[number]

export type CostRow = {
  id: string
  project_id: string
  estimate_item_id: string | null
  category: CostCategory
  incurred_on: string
  description: string
  supplier: string | null
  document: string | null
  quantity: number | null
  unit: string | null
  amount: number
  currency_code: string
  source: 'manual' | 'import'
  import_batch: string | null
  created_at: string
}

export const COST_COLUMNS = 'id, project_id, estimate_item_id, category, incurred_on, description, supplier, document, quantity, unit, amount, currency_code, source, import_batch, created_at'

// ---------------------------------------------------------------- CSV import

export type CostImportRow = {
  line: number
  incurredOn: string
  description: string
  amount: number
  category: CostCategory
  supplier: string | null
  document: string | null
  quantity: number | null
  unit: string | null
  /** Estimate line matched by the "item" column (its description), or null. */
  itemId: string | null
  /** The "item" column had text but no estimate line matched it. */
  itemUnmatched: boolean
}

export type CostImportResult = {
  rows: CostImportRow[]
  errors: { line: number; reason: 'date' | 'description' | 'amount' }[]
  missingColumns: string[]
}

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const HEADERS = {
  incurredOn: ['date', 'data', 'fecha', 'data lancamento', 'data emissao', 'issue date', 'invoice date', 'posting date', 'competencia'],
  description: ['description', 'descricao', 'historico', 'descripcion', 'memo', 'detail', 'detalhe'],
  amount: ['amount', 'valor', 'total', 'value', 'importe', 'monto', 'valor total', 'cost', 'custo'],
  category: ['category', 'categoria', 'type', 'tipo', 'cost type', 'natureza', 'classe'],
  supplier: ['supplier', 'fornecedor', 'vendor', 'proveedor', 'favorecido', 'payee'],
  document: ['document', 'documento', 'invoice', 'nota', 'nf', 'nota fiscal', 'factura', 'invoice number', 'numero', 'doc'],
  quantity: ['quantity', 'quantidade', 'qty', 'qtd', 'cantidad'],
  unit: ['unit', 'unidade', 'un', 'unidad', 'uom'],
  item: ['item', 'estimate item', 'item do orcamento', 'servico', 'service', 'cost code', 'partida'],
} as const

const CATEGORY_WORDS: Record<CostCategory, string[]> = {
  material: ['material', 'materiais', 'materiales', 'insumo', 'insumos', 'mat'],
  labor: ['labor', 'labour', 'mao de obra', 'mo', 'mano de obra', 'payroll', 'folha'],
  equipment: ['equipment', 'equipamento', 'equipamentos', 'equipo', 'locacao', 'rental', 'eq'],
  subcontract: ['subcontract', 'subcontractor', 'empreitada', 'subcontrato', 'terceirizado', 'servico terceirizado', 'sub'],
  other: ['other', 'outro', 'outros', 'otro', 'otros', 'diversos', 'misc'],
}

/**
 * An amount from an ERP / spreadsheet export. `decimalComma` = pt-BR / es files ("1.234,56").
 * A lone separator followed by exactly three digits is a thousands separator ("4.580" = 4580 in
 * pt-BR, "1,234" = 1234 in en-US). "(1.234,56)" and "1.234,56-" are negative (credits).
 */
export function parseAmount(input: string, decimalComma: boolean): number {
  let s = input.trim()
  let negative = false
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1).trim() }
  if (/-$/.test(s)) { negative = true; s = s.slice(0, -1) }
  if (/^[^\d]*-/.test(s)) { negative = true; s = s.replace('-', '') }
  s = s.replace(/[^\d,.]/g, '')
  if (!/\d/.test(s)) return NaN
  const commas = (s.match(/,/g) || []).length, dots = (s.match(/\./g) || []).length
  let n: number
  if (commas && dots) {
    // Both marks: the last one is the decimal mark.
    n = s.lastIndexOf(',') > s.lastIndexOf('.') ? parseFloat(s.replace(/\./g, '').replace(',', '.')) : parseFloat(s.replace(/,/g, ''))
  } else if (commas || dots) {
    const sep = commas ? ',' : '.'
    const thousandsSep = decimalComma ? '.' : ','
    const lastGroup = s.slice(s.lastIndexOf(sep) + 1)
    if ((commas || dots) > 1 || (sep === thousandsSep && lastGroup.length === 3)) n = parseFloat(s.split(sep).join(''))
    else n = parseFloat(s.replace(sep, '.'))
  } else n = parseFloat(s)
  return negative ? -n : n
}

export function categoryOf(text: string): CostCategory | null {
  const k = strip(text)
  if (!k) return null
  return (Object.keys(CATEGORY_WORDS) as CostCategory[]).find(c => CATEGORY_WORDS[c].includes(k)) ?? null
}

/** Reads a cost CSV. Lines are matched to estimate lines by description (case and accents ignored). */
export function readCostCsv(text: string, dayFirst: boolean, items: { id: string; description: string }[]): CostImportResult {
  const table = parseCsv(text)
  const header = (table[0] || []).map(strip)
  const col = {} as Record<keyof typeof HEADERS, number>
  for (const key of Object.keys(HEADERS) as (keyof typeof HEADERS)[]) col[key] = header.findIndex(h => (HEADERS[key] as readonly string[]).includes(h))
  const missingColumns = (['incurredOn', 'description', 'amount'] as const).filter(k => col[k] < 0)
  if (missingColumns.length) return { rows: [], errors: [], missingColumns }

  const byName = new Map(items.map(i => [strip(i.description), i.id]))
  const rows: CostImportRow[] = []
  const errors: CostImportResult['errors'] = []
  table.slice(1).forEach((cells, i) => {
    const line = i + 2
    const get = (k: keyof typeof HEADERS) => (col[k] >= 0 ? (cells[col[k]] ?? '').trim() : '')
    const incurredOn = parseDate(get('incurredOn'), dayFirst)
    if (!incurredOn) { errors.push({ line, reason: 'date' }); return }
    const description = get('description')
    if (!description) { errors.push({ line, reason: 'description' }); return }
    const amount = parseAmount(get('amount'), dayFirst)
    if (!Number.isFinite(amount)) { errors.push({ line, reason: 'amount' }); return }
    const rawQty = get('quantity')
    const qty = rawQty ? parseAmount(rawQty, dayFirst) : NaN
    const itemText = get('item')
    const itemId = itemText ? byName.get(strip(itemText)) ?? null : null
    rows.push({
      line, incurredOn, description, amount: Math.round(amount * 100) / 100,
      category: categoryOf(get('category')) ?? 'material',
      supplier: get('supplier') || null, document: get('document') || null,
      quantity: Number.isFinite(qty) && qty >= 0 ? qty : null, unit: get('unit') || null,
      itemId, itemUnmatched: !!itemText && !itemId,
    })
  })
  return { rows, errors, missingColumns }
}

/** Template the user can open in Excel and fill in (or map their ERP export to). */
export function costTemplateCsv(language: string): string {
  const pt = language === 'pt-BR', es = language === 'es'
  const head = pt ? 'Data;Descrição;Valor;Categoria;Fornecedor;Documento;Quantidade;Unidade;Item'
    : es ? 'Fecha;Descripción;Importe;Categoría;Proveedor;Documento;Cantidad;Unidad;Partida'
    : 'Date,Description,Amount,Category,Supplier,Document,Quantity,Unit,Item'
  const rows = pt
    ? ['06/10/2026;Chapas ST 12,5 mm;4.580,00;Material;Fornecedor A;NF 1234;200;m2;Parede drywall 90 mm', '10/10/2026;Folha equipe drywall;3.200,00;Mão de obra;;;;;']
    : es
      ? ['06/10/2026;Placas ST 12,5 mm;4.580,00;Material;Proveedor A;FAC 1234;200;m2;Muro drywall 90 mm', '10/10/2026;Planilla cuadrilla;3.200,00;Mano de obra;;;;;']
      : ['10/06/2026,"Gypsum board 5/8"" Type X",4580.00,Material,Supplier A,INV-1234,2000,sf,Partition type A', '10/10/2026,Drywall crew payroll,3200.00,Labor,,,,,']
  return `﻿${head}\n${rows.join('\n')}\n`
}

// ---------------------------------------------------------------- comparison

export type CostVariance = {
  /** Baseline direct cost vs. actual cost, per category. */
  byCategory: { category: CostCategory; estimated: number; actual: number }[]
  /** Actual cost linked to each estimate line. */
  byItem: Map<string, number>
  estimated: number
  actual: number
  /** Actual cost not linked to any estimate line. */
  unlinked: number
}

export function costVariance(items: ItemRow[], costs: Pick<CostRow, 'estimate_item_id' | 'category' | 'amount'>[]): CostVariance {
  const base = inPrice(items)
  const est: Record<CostCategory, number> = { material: 0, labor: 0, equipment: 0, subcontract: 0, other: 0 }
  for (const it of base) {
    const q = Number(it.quantity) || 0
    est.material += q * (Number(it.material_unit_cost) || 0)
    est.labor += q * (Number(it.labor_unit_cost) || 0)
    est.equipment += q * (Number(it.equipment_unit_cost) || 0)
    est.subcontract += q * (Number(it.subcontract_unit_cost) || 0)
  }
  const act: Record<CostCategory, number> = { material: 0, labor: 0, equipment: 0, subcontract: 0, other: 0 }
  const byItem = new Map<string, number>()
  let unlinked = 0
  for (const c of costs) {
    const a = Number(c.amount) || 0
    act[c.category] = (act[c.category] || 0) + a
    if (c.estimate_item_id) byItem.set(c.estimate_item_id, (byItem.get(c.estimate_item_id) || 0) + a)
    else unlinked += a
  }
  return {
    byCategory: COST_CATEGORIES.filter(k => est[k] || act[k]).map(category => ({ category, estimated: est[category], actual: act[category] })),
    byItem,
    estimated: base.reduce((s, i) => s + itemDirect(i).total, 0),
    actual: COST_CATEGORIES.reduce((s, k) => s + act[k], 0),
    unlinked,
  }
}

/**
 * Earned-value cost figures: CPI = earned value ÷ actual cost (above 1 = under budget for the work
 * done), CV = earned value − actual cost. Null when there is no actual cost yet.
 */
export function costPerformance(earned: number, actual: number): { cpi: number | null; cv: number | null } {
  if (!(actual > 0)) return { cpi: null, cv: null }
  return { cpi: earned / actual, cv: earned - actual }
}
