// Lookahead › Koskela "Predecessor" auto-check for one sheet row (one work package): of the locations
// where the package still has work (RitsuScope Tasks), how many have their predecessors done — in the
// same location or in the room that carries their walls (progress from the Weekly plan).
// Returns null when Tasks has nothing for this package (the planner keeps judging by hand).
export function predecessorAuto(locationPlan, row) {
  if (!locationPlan?.plan || !row) return null;
  const wpId = row.organization_work_package_id || locationPlan.idOfCode(row.package_code);
  if (!wpId) return null;
  const open = locationPlan.rowsFor(wpId).filter((r) => r.remaining > 0.005);
  if (!open.length) return null;
  const blocked = open
    .filter((r) => r.waits.length)
    .map((r) => ({
      location: r.locationName,
      waits: r.waits.map((w) => ({ code: locationPlan.codeOf(w.wpId), location: locationPlan.locationName(w.locationId), done: Math.round(w.done * 100), readyOn: w.readyOn || null })),
    }));
  const total = new Set(open.map((r) => r.locationId)).size;
  const blockedCount = new Set(open.filter((r) => r.waits.length).map((r) => r.locationId)).size;
  const ready = total - blockedCount;
  return { total, ready, allReady: ready === total, blocked };
}
