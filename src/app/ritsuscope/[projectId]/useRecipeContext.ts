'use client'

// Loads what system recipes need for a set of items: their wall types (products by slot,
// build-up) and the catalog products the wall types and recipe lines point at.
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TakeoffItem } from '@/lib/takeoff/geometry'
import type { Recipe, RecipeContext } from '@/lib/takeoff/recipes'
import { MATERIAL_COLUMNS, RECIPE_SLOTS, type MaterialRow, type WallTypeLike } from '@/lib/takeoff/systemRecipes'

export function useRecipeContext(items: TakeoffItem[], recipeOf: (it: TakeoffItem) => Recipe | null | undefined): RecipeContext {
  const [wallTypes, setWallTypes] = useState<Map<string, WallTypeLike>>(new Map())
  const [catalog, setCatalog] = useState<Map<string, MaterialRow>>(new Map())

  const wtIds = useMemo(() => [...new Set(items.map(it => it.wallTypeId).filter((x): x is string => !!x))].sort(), [items])
  const lineMatIds = useMemo(() => {
    const ids = new Set<string>()
    for (const it of items) for (const l of recipeOf(it)?.lines || []) if (l.materialId) ids.add(l.materialId)
    return [...ids].sort()
  }, [items, recipeOf])
  const key = `${wtIds.join(',')}|${lineMatIds.join(',')}`

  useEffect(() => {
    let alive = true
    ;(async () => {
      const supabase = createClient()
      const wts = new Map<string, WallTypeLike>()
      if (wtIds.length) {
        const { data } = await supabase.from('takeoff_wall_types').select('id, thickness_m, framing, boards, materials').in('id', wtIds)
        for (const w of (data || []) as (WallTypeLike & { id: string })[]) wts.set(w.id, w)
      }
      const ids = new Set(lineMatIds)
      for (const w of wts.values()) for (const sl of RECIPE_SLOTS) { const id = w.materials?.[sl]; if (id) ids.add(id) }
      const cat = new Map<string, MaterialRow>()
      if (ids.size) {
        const { data } = await supabase.from('takeoff_materials').select(MATERIAL_COLUMNS).in('id', [...ids])
        for (const m of (data || []) as MaterialRow[]) cat.set(m.id, m)
      }
      if (!alive) return
      setWallTypes(wts)
      setCatalog(cat)
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return useMemo(() => ({ wallTypeOf: (it: TakeoffItem) => (it.wallTypeId ? wallTypes.get(it.wallTypeId) : null), catalog }), [wallTypes, catalog])
}
