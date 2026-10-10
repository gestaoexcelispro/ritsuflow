'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../../lib/supabase'
import { useT } from '../../../../lib/i18n/useT'

function typeLabel(value, fallback) {
  if (!value) return fallback
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export default function FieldOpLocationsSetup({ projectId, onCountChange }) {
  const t = useT('fieldopSetup')
  const [locations, setLocations] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function loadLocations() {
    if (!projectId) return
    setLoading(true)
    setError('')
    try {
      const [locationsResult, selectionResult] = await Promise.all([
        supabase
          .from('locations')
          .select('id,project_id,parent_id,name,location_type,environment_type,sequence_number')
          .eq('project_id', projectId)
          .order('sequence_number', { ascending: true })
          .order('name', { ascending: true }),
        supabase
          .from('fieldop_project_locations')
          .select('location_id')
          .eq('project_id', projectId)
          .eq('is_active', true),
      ])
      if (locationsResult.error) throw locationsResult.error
      if (selectionResult.error) throw selectionResult.error
      setLocations(locationsResult.data || [])
      const ids = (selectionResult.data || []).map((item) => item.location_id)
      setSelectedIds(ids)
      onCountChange?.(ids.length)
    } catch (err) {
      setError(err?.message || String(err))
      setLocations([])
      setSelectedIds([])
      onCountChange?.(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadLocations() }, [projectId])

  const childrenByParent = useMemo(() => {
    const map = new Map()
    for (const location of locations) {
      const key = location.parent_id || '__root__'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(location)
    }
    return map
  }, [locations])

  const descendants = (id) => {
    const result = []
    const visit = (parentId) => {
      for (const child of childrenByParent.get(parentId) || []) {
        result.push(child.id)
        visit(child.id)
      }
    }
    visit(id)
    return result
  }

  const ancestors = (id) => {
    const result = []
    const byId = new Map(locations.map((item) => [item.id, item]))
    let current = byId.get(id)
    while (current?.parent_id) {
      result.push(current.parent_id)
      current = byId.get(current.parent_id)
    }
    return result
  }

  function toggleLocation(id) {
    setSaved(false)
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
        descendants(id).forEach((childId) => next.delete(childId))
      } else {
        next.add(id)
        descendants(id).forEach((childId) => next.add(childId))
        ancestors(id).forEach((parentId) => next.add(parentId))
      }
      return Array.from(next)
    })
  }

  function selectAll() {
    setSaved(false)
    setSelectedIds(locations.map((item) => item.id))
  }

  function clearAll() {
    setSaved(false)
    setSelectedIds([])
  }

  async function saveSelection() {
    if (saving) return
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const { data: currentRows, error: currentError } = await supabase
        .from('fieldop_project_locations')
        .select('id,location_id')
        .eq('project_id', projectId)
      if (currentError) throw currentError

      const currentIds = new Set((currentRows || []).map((row) => row.location_id))
      const selected = new Set(selectedIds)
      const toAdd = selectedIds.filter((id) => !currentIds.has(id))
      const toRemove = (currentRows || []).filter((row) => !selected.has(row.location_id)).map((row) => row.id)

      if (toAdd.length) {
        const { error: insertError } = await supabase
          .from('fieldop_project_locations')
          .insert(toAdd.map((location_id) => ({ project_id: projectId, location_id })))
        if (insertError) throw insertError
      }
      if (toRemove.length) {
        const { error: deleteError } = await supabase
          .from('fieldop_project_locations')
          .delete()
          .in('id', toRemove)
        if (deleteError) throw deleteError
      }
      setSaved(true)
      onCountChange?.(selectedIds.length)
    } catch (err) {
      setError(err?.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  function renderBranch(parentId = null, depth = 0) {
    const key = parentId || '__root__'
    return (childrenByParent.get(key) || []).map((item) => {
      const checked = selectedIds.includes(item.id)
      const childCount = descendants(item.id).length
      return (
        <div key={item.id}>
          <label style={{ display: 'grid', gridTemplateColumns: '22px 1fr auto', alignItems: 'center', gap: 10, marginLeft: depth * 24, minHeight: 48, padding: '7px 10px', borderBottom: '1px solid #e5ebee', cursor: 'pointer', background: checked ? '#f4fbfa' : '#fff' }}>
            <input type="checkbox" checked={checked} onChange={() => toggleLocation(item.id)} style={{ width: 16, height: 16, accentColor: 'var(--fo-teal-ink)' }} />
            <span style={{ display: 'grid', gap: 2 }}>
              <strong style={{ color: 'var(--fo-ink)' }}>{item.name}</strong>
              <small style={{ color: 'var(--fo-muted)' }}>{[typeLabel(item.location_type, t('locations.typeFallback')), item.environment_type].filter(Boolean).join(' · ')}</small>
            </span>
            {childCount > 0 && <small style={{ color: 'var(--fo-muted)' }}>{t('locations.nested', { count: childCount })}</small>}
          </label>
          {renderBranch(item.id, depth + 1)}
        </div>
      )
    })
  }

  return <section style={{ marginTop: 12, minHeight: 430, background: '#fff', border: '1px solid #d6e0e5', borderRadius: 10, padding: 17 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
      <div><h2 style={{ margin: 0, fontSize: 17 }}>{t('tab.locations')}</h2><p style={{ margin: '5px 0', color: 'var(--fo-muted)' }}>{t('locations.text')}</p></div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <Link href={`/projects/${projectId}/locations`} style={{ height: 32, border: '1px solid #cbd9df', borderRadius: 7, background: '#fff', padding: '0 11px', color: 'var(--fo-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', fontWeight: 700 }}>{t('locations.viewStructure')}</Link>
        <button onClick={selectAll} disabled={loading || !locations.length} style={{ height: 32, border: '1px solid #cbd9df', borderRadius: 7, background: '#fff', padding: '0 11px', color: 'var(--fo-muted)', fontWeight: 700, cursor: 'pointer' }}>{t('locations.selectAll')}</button>
        <button onClick={clearAll} disabled={loading || !locations.length} style={{ height: 32, border: '1px solid #cbd9df', borderRadius: 7, background: '#fff', padding: '0 11px', color: 'var(--fo-muted)', fontWeight: 700, cursor: 'pointer' }}>{t('locations.clear')}</button>
        <button onClick={saveSelection} disabled={saving || loading} style={{ height: 32, border: '1px solid #0aa695', borderRadius: 7, background: 'var(--fo-teal-ink)', padding: '0 13px', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{saving ? t('common.saving') : t('locations.save')}</button>
      </div>
    </div>
    {error && <div style={{ marginTop: 18, border: '1px solid #f0c6c6', background: 'var(--fo-bad-wash)', color: 'var(--fo-bad)', padding: '10px 12px', borderRadius: 7 }}>{error}</div>}
    {saved && <div style={{ marginTop: 18, border: '1px solid #bfe5dd', background: 'var(--fo-ok-wash)', color: '#087c70', padding: '10px 12px', borderRadius: 7, fontWeight: 700 }}>{t('locations.saved')}</div>}
    {loading ? <div style={{ minHeight: 300, display: 'grid', placeContent: 'center', color: 'var(--fo-muted)' }}>{t('locations.loading')}</div> : locations.length === 0 ? <div style={{ minHeight: 300, display: 'grid', placeContent: 'center', textAlign: 'center', gap: 7, color: 'var(--fo-muted)' }}><b style={{ fontSize: 15, color: '#385365' }}>{t('locations.emptyTitle')}</b><span>{t('locations.emptyText')}</span></div> : <>
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', color: 'var(--fo-muted)' }}><span>{t('locations.selectedCount', { selected: selectedIds.length, total: locations.length })}</span><span>{t('locations.hierarchy')}</span></div>
      <div style={{ marginTop: 9, border: '1px solid #dfe7eb', borderRadius: 8, overflow: 'hidden' }}>{renderBranch()}</div>
    </>}
  </section>
}
