// Item list groups, by discipline like the tool bar: Architecture (walls, ceilings, floors),
// Structure, Reinforcements, Electrical, Plumbing, and Other for items that fit none of them.
// Doors, windows and openings keep their own "Openings" section.
import type { TakeoffItem } from './geometry'
import { mepType } from './mep'

export type GroupKey = 'arch' | 'struct' | 'blocking' | 'electrical' | 'plumbing' | 'other'
export type SubKey = 'walls' | 'ceilings' | 'floors'

export const GROUP_ORDER: GroupKey[] = ['arch', 'struct', 'blocking', 'electrical', 'plumbing', 'other']
export const SUB_ORDER: SubKey[] = ['walls', 'ceilings', 'floors']

type ItemLike = Pick<TakeoffItem, 'kind' | 'mep' | 'struct' | 'ifcType' | 'ceiling' | 'floor'>

/** Where an item sits in the list: its discipline and, for Architecture, its feature. */
export function itemGroup(item: ItemLike): { group: GroupKey; sub?: SubKey } {
  const mep = mepType(item.mep)
  if (mep) return { group: mep.group }
  if (item.struct || item.ifcType === 'IfcSlab') return { group: 'struct' }
  if (item.kind === 'linear') return { group: 'arch', sub: 'walls' }
  if (item.kind === 'area') {
    if (item.ceiling || item.ifcType === 'IfcCovering.CEILING') return { group: 'arch', sub: 'ceilings' }
    if (item.floor || item.ifcType === 'IfcCovering.FLOORING') return { group: 'arch', sub: 'floors' }
  }
  return { group: 'other' }
}

/** Rows grouped and ordered: groups in tool-bar order; Architecture split into walls, ceilings, floors. */
export function groupRows<T>(rows: T[], itemOf: (row: T) => ItemLike): { group: GroupKey; subs: { sub: SubKey | null; rows: T[] }[] }[] {
  const out: { group: GroupKey; subs: { sub: SubKey | null; rows: T[] }[] }[] = []
  for (const g of GROUP_ORDER) {
    const mine = rows.filter(r => itemGroup(itemOf(r)).group === g)
    if (!mine.length) continue
    if (g === 'arch') {
      const subs = SUB_ORDER.map(s => ({ sub: s as SubKey | null, rows: mine.filter(r => itemGroup(itemOf(r)).sub === s) })).filter(s => s.rows.length)
      out.push({ group: g, subs })
    } else out.push({ group: g, subs: [{ sub: null, rows: mine }] })
  }
  return out
}
