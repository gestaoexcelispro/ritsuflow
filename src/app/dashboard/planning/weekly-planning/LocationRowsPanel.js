'use client';

// Weekly plan › Add activity: the locations of the chosen work package with their real quantities from
// RitsuScope Tasks (face / carrier allocation), what is already done and what each still waits for
// (Koskela "Predecessor"). The planner ticks locations and adds one row per location × package.
import { useEffect, useMemo, useState } from 'react';

const fmt = (v, nf) => new Intl.NumberFormat(nf || 'en-US', { maximumFractionDigits: 2 }).format(Number(v) || 0);

export default function LocationRowsPanel({ locationPlan, packageCode, existingItems, disabled, busy, numberFormat, tr, onAdd }) {
  const wpId = locationPlan.idOfCode(packageCode);
  const rows = useMemo(() => locationPlan.rowsFor(wpId), [locationPlan, wpId]);
  // Locations of this package already in this week.
  const inWeek = useMemo(() => new Set((existingItems || []).filter((i) => i.organization_work_package_id === wpId && i.location_id).map((i) => i.location_id)), [existingItems, wpId]);
  const [picked, setPicked] = useState(() => new Set());
  useEffect(() => {
    // Default pick: what is left, released by its predecessors and not yet in this week.
    setPicked(new Set(rows.filter((r) => r.remaining > 0.005 && !r.waits.length && !inWeek.has(r.locationId)).map((r) => r.locationId)));
  }, [rows, inWeek]);

  if (!packageCode) return null;
  const box = { margin: '4px 0 12px', padding: 10, border: '1px solid #d7e6ea', borderRadius: 10, background: '#f7fbfc', display: 'grid', gap: 8 };
  const head = { fontSize: '0.72rem', fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: '#476572' };
  const small = { fontSize: '0.78rem', color: '#5c7380' };

  if (locationPlan.loading) return <div style={box}><span style={small}>{tr('loc.loading')}</span></div>;
  if (!wpId || !rows.length) {
    return (
      <div style={box}>
        <span style={head}>{tr('loc.title')}</span>
        <span style={small}>{tr('loc.none', { code: packageCode })}</span>
      </div>
    );
  }

  const chosen = rows.filter((r) => picked.has(r.locationId));
  const waitText = (r) => r.waits.map((w) => tr('loc.waitsItem', { code: locationPlan.codeOf(w.wpId), location: locationPlan.locationName(w.locationId), done: Math.round(w.done * 100) })).join(' · ');

  return (
    <div style={box}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ ...head, flex: 1 }}>{tr('loc.title')}</span>
        <span style={small}>{tr('loc.source')}</span>
      </div>
      {locationPlan.needsMigration && <span style={{ ...small, color: '#b45309' }}>{tr('loc.needsMigration')}</span>}
      <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid #e2ecef', borderRadius: 8, background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ background: '#f1f6f8', color: '#476572', textAlign: 'left' }}>
              <th style={{ padding: '6px 8px', width: 26 }} />
              <th style={{ padding: '6px 8px' }}>{tr('colLocation')}</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>{tr('loc.colTasks')}</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>{tr('loc.colDone')}</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>{tr('loc.colLeft')}</th>
              <th style={{ padding: '6px 8px' }}>{tr('loc.colPredecessor')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const finished = r.remaining <= 0.005;
              return (
                <tr key={`${r.locationId}|${r.unit}`} style={{ borderTop: '1px solid #eef3f5', opacity: finished ? 0.55 : 1 }}>
                  <td style={{ padding: '5px 8px' }}>
                    <input type="checkbox" disabled={disabled || finished} checked={picked.has(r.locationId)}
                      onChange={(e) => setPicked((prev) => { const next = new Set(prev); if (e.target.checked) next.add(r.locationId); else next.delete(r.locationId); return next; })} />
                  </td>
                  <td style={{ padding: '5px 8px' }} title={r.locationPath}>
                    {r.locationName}
                    {inWeek.has(r.locationId) && <span style={{ marginLeft: 6, fontSize: '0.7rem', color: '#0f766e', fontWeight: 700 }}>{tr('loc.inWeek')}</span>}
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(r.quantity, numberFormat)} {r.unit}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(r.done, numberFormat)}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>{fmt(r.remaining, numberFormat)}</td>
                  <td style={{ padding: '5px 8px' }}>
                    {finished ? <span style={{ color: '#64748b' }}>{tr('loc.finished')}</span>
                      : r.waits.length ? <span style={{ color: '#b91c1c' }} title={waitText(r)}>{tr('loc.waits', { list: waitText(r) })}</span>
                        : <span style={{ color: '#15803d', fontWeight: 700 }}>{tr('loc.ready')}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ ...small, flex: 1 }}>{tr('loc.hint')}</span>
        <button type="button" disabled={disabled || busy || !chosen.length || locationPlan.needsMigration}
          onClick={() => onAdd(chosen.map((r) => ({ locationId: r.locationId, locationName: r.locationName, locationPath: r.locationPath, wpId, unit: r.unit, quantity: Math.round(r.remaining * 100) / 100 })))}
          style={{ padding: '8px 12px', border: 0, borderRadius: 8, background: chosen.length && !disabled ? '#0f766e' : '#94a3b8', color: '#fff', fontWeight: 700, cursor: chosen.length && !disabled ? 'pointer' : 'not-allowed' }}>
          {tr('loc.add', { count: chosen.length })}
        </button>
      </div>
    </div>
  );
}
