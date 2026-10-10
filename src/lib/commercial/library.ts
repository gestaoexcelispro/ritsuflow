// Commercial library: the company's price book, labor rates and pricing templates (Supabase rows).
import type { createClient } from '@/lib/supabase/client'
import type { AppliesTo, LaborRate, LineMethod, PriceItem, PricingLine } from './pricing'

type Supabase = ReturnType<typeof createClient>

export const CURRENCIES = ['BRL', 'USD', 'EUR', 'CAD', 'MXN', 'GBP', 'AUD'] as const

/** Default currency for a country; the user can still pick another. */
export function currencyOf(country: string): string {
  return ({ BR: 'BRL', US: 'USD', CA: 'CAD', MX: 'MXN', GB: 'GBP', AU: 'AUD', PT: 'EUR', ES: 'EUR' } as Record<string, string>)[country] || 'USD'
}

export const PRICE_KINDS = ['material', 'equipment', 'subcontract', 'other'] as const
export type PriceKind = (typeof PRICE_KINDS)[number]

export type PriceItemRow = PriceItem & {
  organization_id: string
  country_code: string
  currency_code: string
  kind: PriceKind
  code: string | null
  supplier: string | null
  notes: string | null
}

export const PRICE_ITEM_COLUMNS = 'id, organization_id, country_code, currency_code, kind, material_id, code, name, unit, unit_cost, supplier, valid_from, notes'

export type LaborRateRow = LaborRate & {
  organization_id: string
  country_code: string
  currency_code: string
  notes: string | null
}

export const LABOR_RATE_COLUMNS = 'id, organization_id, country_code, currency_code, trade, name, base_rate_hour, burden_pct, valid_from, notes'

export type TemplateRow = {
  id: string
  organization_id: string | null
  country_code: string
  name: string
  lines: PricingLine[]
  is_default: boolean
  notes: string | null
}

export const TEMPLATE_COLUMNS = 'id, organization_id, country_code, name, lines, is_default, notes'

export const APPLIES_TO: AppliesTo[] = ['direct', 'material', 'labor', 'equipment', 'subcontract', 'subtotal']
export const METHODS: LineMethod[] = ['percent', 'divisor']

/** The signed-in user's company (first active membership), as the rest of RitsuFlow does. */
export async function currentOrganizationId(supabase: Supabase): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return null
  const { data } = await supabase.from('organization_members').select('organization_id')
    .eq('user_id', auth.user.id).eq('status', 'active').limit(1).maybeSingle()
  return (data?.organization_id as string | undefined) ?? null
}

/** Groups price rows by product (catalog id, else name + unit): the current price and its history. */
export function groupPrices(rows: PriceItemRow[], onDate: string) {
  const groups = new Map<string, PriceItemRow[]>()
  for (const r of rows) {
    const key = r.material_id ? `id:${r.material_id}` : `${r.name.trim().toLowerCase()}|${r.unit.trim().toLowerCase()}|${r.currency_code}`
    groups.set(key, [...(groups.get(key) || []), r])
  }
  return [...groups.values()].map(list => {
    const sorted = [...list].sort((a, b) => (a.valid_from < b.valid_from ? 1 : -1))
    const current = sorted.find(r => r.valid_from <= onDate) || null
    return { current, upcoming: sorted.filter(r => r.valid_from > onDate), history: sorted }
  })
}

/** Today as YYYY-MM-DD in the user's time zone. */
export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** A blank line for the template editor. */
export function newLine(n: number): PricingLine {
  return { key: `line_${Date.now().toString(36)}_${n}`, label: '', applies_to: 'subtotal', method: 'percent', rate: 0 }
}
