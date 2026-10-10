'use client';

// PreCon by location (Lookahead / Weekly plan): the RitsuScope Tasks quantities per location × work
// package, what is already done (Weekly plan items tied to a location and a package) and the Koskela
// "Predecessor" check. See src/lib/planning/locationPlan.ts.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { loadLocationPlan, locationPath, progressIndex, waitsFor } from '../../../lib/planning/locationPlan';

export function useLocationPlan(projectId) {
  const [plan, setPlan] = useState(null);
  const [packages, setPackages] = useState([]);
  const [progress, setProgress] = useState([]);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!projectId) { setPlan(null); return; }
    setLoading(true);
    setError('');
    try {
      const [p, wp, pr] = await Promise.all([
        loadLocationPlan(supabase, projectId),
        supabase.rpc('get_project_work_package_options', { target_project_id: projectId }),
        supabase
          .from('weekly_plan_items')
          .select('location_id, organization_work_package_id, unit, actual_quantity, planned_quantity, execution_result, weekly_plans!inner(status)')
          .eq('project_id', projectId)
          .not('location_id', 'is', null)
          .neq('weekly_plans.status', 'cancelled'),
      ]);
      setPlan(p);
      setPackages(wp.error ? [] : wp.data || []);
      setNeedsMigration(Boolean(pr.error && /location_id|organization_work_package_id/.test(pr.error.message || '')));
      setProgress(pr.error ? [] : pr.data || []);
    } catch (e) {
      setError(e?.message || String(e));
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void reload(); }, [reload]);

  const value = useMemo(() => {
    const byId = new Map(packages.map((w) => [w.organization_work_package_id, w]));
    const idOfCode = (code) => {
      const c = String(code || '').trim().toUpperCase();
      return packages.find((w) => String(w.code || '').trim().toUpperCase() === c)?.organization_work_package_id || null;
    };
    const doneOf = plan ? progressIndex(plan, progress) : () => 1;
    const locationName = (id) => plan?.locations.find((l) => l.id === id)?.name || '—';
    const codeOf = (id) => byId.get(id)?.code || '—';
    /** Locations of one package: quantity from Tasks, done so far and what it still waits for. */
    const cache = new Map();
    const rowsFor = (wpId) => {
      if (!plan || !wpId) return [];
      if (cache.has(wpId)) return cache.get(wpId);
      const doneQty = new Map();
      for (const p of progress) {
        if (p.organization_work_package_id !== wpId || !p.location_id) continue;
        const q = p.actual_quantity != null ? Number(p.actual_quantity) : p.execution_result === 'completed' ? Number(p.planned_quantity || 0) : 0;
        doneQty.set(p.location_id, (doneQty.get(p.location_id) || 0) + (q > 0 ? q : 0));
      }
      const out = plan.rows
        .filter((r) => r.wpId === wpId && r.quantity > 0.005)
        .map((r) => {
          const done = Math.min(r.quantity, doneQty.get(r.locationId) || 0);
          return {
            ...r,
            locationName: locationName(r.locationId),
            locationPath: locationPath(plan.locations, r.locationId),
            done,
            remaining: Math.max(0, r.quantity - done),
            waits: waitsFor(plan, wpId, r.locationId, doneOf),
          };
        });
      cache.set(wpId, out);
      return out;
    };
    return { plan, packages, needsMigration, loading, error, reload, idOfCode, codeOf, locationName, rowsFor };
  }, [plan, packages, progress, needsMigration, loading, error, reload]);

  return value;
}
