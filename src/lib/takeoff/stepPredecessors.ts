// Default predecessors of the wall steps of one RitsuScope item (project_scopes lines that share a
// takeoff_layer_id), in the order the work is done:
//   framing → Side A board → Side A joints
//   framing + Side A board → insulation → Side B board → Side B joints
// 'same_location' = the predecessor in the same location; 'carrier_location' = the predecessor in this
// room or in the rooms across its walls (where the framing and the other face are done). Framing is
// always linked 'carrier_location': on an asymmetric wall type Side A can face the neighbour room, which
// must still wait for the carrier's framing.
// The planner can replace them (project_scope_dependencies); these are used when there are none.

export type DepLink = 'same_location' | 'carrier_location'
export type StepDep = { predecessorId: string; link: DepLink; lagDays: number }
export type ScopeLine = { id: string; takeoff_layer_id?: string | null; takeoff_step?: string | null }

export function defaultPredecessors(line: ScopeLine, all: ScopeLine[]): StepDep[] {
  if (!line.takeoff_layer_id || !line.takeoff_step) return []
  const sib = (step: string) => all.find(s => s.takeoff_layer_id === line.takeoff_layer_id && s.takeoff_step === step && s.id !== line.id)
  const dep = (step: string, link: DepLink): StepDep[] => { const s = sib(step); return s ? [{ predecessorId: s.id, link, lagDays: 0 }] : [] }
  switch (line.takeoff_step) {
    case 'board_a': return dep('framing', 'carrier_location')
    case 'joints_a': return dep('board_a', 'same_location')
    case 'insulation': return [...dep('framing', 'carrier_location'), ...dep('board_a', 'carrier_location')]
    case 'board_b': return sib('insulation') ? dep('insulation', 'same_location') : [...dep('framing', 'carrier_location'), ...dep('board_a', 'carrier_location')]
    case 'joints_b': return dep('board_b', 'same_location')
    default: return []
  }
}
