// RitsuScope standard library for the United States: wall (PT01…PT12), ceiling (CL01…CL06) and floor (FL01…FL10)
// types, each with a recipe holding its complete material list. Everything is stored in metres (the app's unit);
// recipe coefficients are per m² of wall face / area, per m of wall length / perimeter, in US purchase units
// (gal, ft, sf, ea, tube). Consumption rates are common estimating values (net), not a manufacturer's listing:
// fire ratings, UL designs, STC and stud limiting heights must be checked against the current listings.
// Run: node scripts/standard-library/generate.mjs  (writes the SQL in supabase/migrations).

import { readFileSync } from 'node:fs'

/** One colour per type, picked so no two in a country are easy to confuse (see colors.json). */
const COLORS = JSON.parse(readFileSync(new URL('./colors.json', import.meta.url), 'utf8')).US
export const IN = 0.0254
export const FT = 0.3048
const SF = 10.7639 // sf per m²
const LF = 3.28084 // ft per m
const r = (v, d = 4) => Math.round(v * 10 ** d) / 10 ** d

// --- Consumption basis (per finished face, per board layer…) ------------------------------------------------
const JOINT_COMPOUND_GAL_M2 = r(0.0094 * SF) // ≈ 9,4 gal ready-mix per 1000 sf of finished board (level 4)
const JOINT_TAPE_FT_M2 = r(0.37 * SF) // ≈ 370 ft of paper tape per 1000 sf of finished board
const BOARD_SCREWS_M2 = r(1.0 * SF) // ≈ 1 screw per sf per board layer (12" o.c. field)
const SEALANT_TUBE_M = r(1 / 26) // 1/4" bead: one 28 oz tube ≈ 26 m (85 ft)
const PAF_PER_M_TRACK = r(1 / 0.6096) // track fasteners at 24" o.c.

const STUD_BARS = [10, 12, 14, 16].map(f => r(f * FT)) // stud and track lengths sold: 10' … 16'

// --- Walls ------------------------------------------------------------------------------------------------
const X58 = '5/8" Type X gypsum board 4\'×12\''
const X58_8 = '5/8" Type X gypsum board 4\'×8\''
const walls = [
  { code: 'PT01', name: '3-5/8" 25 ga @ 16" · 1× 5/8" Type X each side', category: 'non_rated', stc: [38, 40],
    stud: '3-5/8" 25 ga (18 mil) stud', track: '3-5/8" 25 ga (18 mil) track', studIn: 3.625, spacingIn: 16, a: [X58, 0.625, 1], b: [X58, 0.625, 1], faces: 2,
    notes: 'Standard interior partition. Check stud limiting height for the wall height and deflection criteria.' },
  { code: 'PT02', name: '3-5/8" 25 ga @ 16" · 1× 5/8" Type X each side · 3" mineral wool', category: 'non_rated', stc: [45, 47],
    stud: '3-5/8" 25 ga (18 mil) stud', track: '3-5/8" 25 ga (18 mil) track', studIn: 3.625, spacingIn: 16, a: [X58, 0.625, 1], b: [X58, 0.625, 1], faces: 2,
    insulation: '3" mineral wool batt (sound attenuation)', acoustic: true,
    notes: 'Acoustic partition: offices, exam rooms. Seal top and bottom with acoustical sealant.' },
  { code: 'PT03', name: '3-5/8" 20 ga EQ @ 16" · 1× 5/8" Type X each side · 3" mineral wool · 1 hr', category: 'rated', fire: 1, rated: 'UL U419', stc: [45, 49],
    stud: '3-5/8" 20 ga EQ (30 mil) stud', track: '3-5/8" 20 ga EQ (30 mil) track', studIn: 3.625, spacingIn: 16, a: [X58, 0.625, 1], b: [X58, 0.625, 1], faces: 2,
    insulation: '3" mineral wool batt (sound attenuation)', acoustic: true, headJoint: true,
    notes: '1-hour fire partition (corridors, demising). Verify the UL design and the listed head-of-wall joint system.' },
  { code: 'PT04', name: '3-5/8" 20 ga EQ @ 16" · 2× 5/8" Type X each side · 3" mineral wool · 2 hr', category: 'rated', fire: 2, rated: 'UL U419', stc: [54, 57],
    stud: '3-5/8" 20 ga EQ (30 mil) stud', track: '3-5/8" 20 ga EQ (30 mil) track', studIn: 3.625, spacingIn: 16, a: [X58, 0.625, 2], b: [X58, 0.625, 2], faces: 2,
    insulation: '3" mineral wool batt (sound attenuation)', acoustic: true, headJoint: true, longScrews: true,
    notes: '2-hour fire partition (exit stairs, fire barriers). Base layers screwed, face layer finished.' },
  { code: 'PT05', name: '6" 20 ga EQ @ 16" · 1× 5/8" Type X each side · 3-1/2" mineral wool · 1 hr', category: 'rated', fire: 1, rated: 'UL U419', stc: [46, 50],
    stud: '6" 20 ga EQ (30 mil) stud', track: '6" 20 ga EQ (30 mil) track', studIn: 6, spacingIn: 16, a: [X58, 0.625, 1], b: [X58, 0.625, 1], faces: 2,
    insulation: '3-1/2" mineral wool batt', acoustic: true, headJoint: true,
    notes: 'Tall 1-hour partition (lobbies, high floor-to-floor). Check limiting height for the actual height.' },
  { code: 'PT06', name: '3-5/8" 20 ga EQ @ 16" · 5/8" Type X moisture-resistant (wet side) + 5/8" Type X · 1 hr', category: 'rated', fire: 1, rated: 'UL U419', stc: [45, 49],
    stud: '3-5/8" 20 ga EQ (30 mil) stud', track: '3-5/8" 20 ga EQ (30 mil) track', studIn: 3.625, spacingIn: 16,
    a: ['5/8" Type X mold & moisture-resistant gypsum board 4\'×12\'', 0.625, 1], b: [X58, 0.625, 1], faces: 2,
    insulation: '3" mineral wool batt (sound attenuation)', acoustic: true, headJoint: true,
    notes: 'Restrooms, janitor closets, kitchens (side A wet). Not a tile backer in showers.' },
  { code: 'PT07', name: '3-5/8" 20 ga EQ @ 16" · 1/2" cement board (tile side) + 5/8" Type X', category: 'non_rated', stc: [36, 40],
    stud: '3-5/8" 20 ga EQ (30 mil) stud', track: '3-5/8" 20 ga EQ (30 mil) track', studIn: 3.625, spacingIn: 16,
    a: ['1/2" cement backer board 4\'×8\'', 0.5, 1], b: [X58_8, 0.625, 1], faces: 1, cementSide: true, sheetFt: 8,
    notes: 'Showers and tiled wet walls: side A cement board for tile, side B finished gypsum.' },
  { code: 'PT08', name: '3-5/8" 20 ga EQ @ 16" · 5/8" abuse-resistant Type X each side · 3" mineral wool · 1 hr', category: 'rated', fire: 1, rated: 'UL U419', stc: [45, 49],
    stud: '3-5/8" 20 ga EQ (30 mil) stud', track: '3-5/8" 20 ga EQ (30 mil) track', studIn: 3.625, spacingIn: 16,
    a: ['5/8" abuse-resistant Type X gypsum board 4\'×12\'', 0.625, 1], b: ['5/8" abuse-resistant Type X gypsum board 4\'×12\'', 0.625, 1], faces: 2,
    insulation: '3" mineral wool batt (sound attenuation)', acoustic: true, headJoint: true,
    notes: 'High-traffic corridors (hospitals, schools): abuse-resistant board both sides.' },
  { code: 'PT09', name: '7/8" hat channel @ 16" on masonry · 1× 5/8" Type X', category: 'furring',
    stud: '7/8" 25 ga hat channel (furring stud)', track: '7/8" 25 ga J-track', studIn: 0.875, spacingIn: 16, a: [X58, 0.625, 1], faces: 1, furring: true,
    notes: 'Furring on concrete or CMU. Check moisture: use a moisture-resistant board on exterior walls.' },
  { code: 'PT10', name: 'Shaft wall 2-1/2" CH stud @ 24" · 1" shaftliner + 2× 5/8" Type X · 2 hr', category: 'shaft', fire: 2, rated: 'UL U415', stc: [39, 41],
    stud: '2-1/2" 25 ga CH stud', track: '2-1/2" 25 ga J-track', studIn: 2.5, spacingIn: 24,
    a: [X58, 0.625, 2], faces: 1, headJoint: true, shaftliner: true,
    notes: 'Elevator and duct shafts, built from the corridor side. The 1" shaftliner panels between the CH studs are in the material list.' },
  { code: 'PT11', name: 'Exterior 6" 18 ga @ 16" · 5/8" exterior sheathing + 5/8" Type X · R-19', category: 'exterior',
    stud: '6" 18 ga (43 mil) stud', track: '6" 18 ga (43 mil) track', studIn: 6, spacingIn: 16,
    a: ['5/8" exterior gypsum sheathing board 4\'×8\'', 0.625, 1], b: [X58_8, 0.625, 1], faces: 1,
    insulation: '6" fiberglass batt R-19', exterior: true, sheetFt: 8,
    notes: 'Exterior steel-stud wall behind the cladding. Studs per the structural design (wind load); add continuous insulation per energy code.' },
  { code: 'PT12', name: 'Chase wall double 2-1/2" 25 ga @ 16" · 1× 5/8" Type X each side', category: 'chase', stc: [42, 46],
    stud: '2-1/2" 25 ga (18 mil) stud', track: '2-1/2" 25 ga (18 mil) track', studIn: 2.5, spacingIn: 16, a: [X58, 0.625, 1], b: [X58, 0.625, 1], faces: 2,
    double: true, thicknessIn: 8,
    notes: 'Plumbing chase between restrooms: two rows of studs, cavity sized for the pipes (8" overall by default).' },
]

/** Complete material list of a wall type: framing, boards and screws (counted by the layout when framing is on) plus finishing and accessories. */
function wallRecipe(w) {
  const sp = w.spacingIn * IN
  const k = w.double ? 2 : 1
  const layers = (w.a ? w.a[2] : 0) + (w.b ? w.b[2] : 0)
  const lines = [
    { mat: w.stud, unit: 'm', coef: r(k / sp), base: 'm2', waste: 5, note: 'Counted by the framing layout when framing is on.' },
    { mat: w.track, unit: 'm', coef: 2 * k, base: 'm', waste: 5, note: 'Top and bottom; counted by the framing layout.' },
  ]
  for (const [side, b] of [['A', w.a], ['B', w.b]]) if (b) lines.push({ mat: b[0], unit: 'm²', coef: b[2], base: 'm2', waste: 10, note: `Side ${side}; counted by the framing layout.` })
  lines.push({ mat: `Drywall screw ${w.longScrews ? '1-5/8"' : '1-1/4"'} Type S`, unit: 'ea', coef: r(BOARD_SCREWS_M2 * layers), base: 'm2', waste: 5, packSize: 1000, packName: 'box' })
  if (w.cementSide) lines.push({ mat: 'Cement board screw 1-1/4"', unit: 'ea', coef: r(BOARD_SCREWS_M2 * 1.2), base: 'm2', waste: 5, note: 'Counted by the framing layout when framing is on (screws).' })
  lines.push({ mat: 'Framing screw #8 × 1/2" pan head', unit: 'ea', coef: r((4 * k) / sp), base: 'm', waste: 5, packSize: 1000, packName: 'box', note: '2 per stud end.' })
  // Shaftliner panels (1" × 2' × 10') fill the shaft side between CH studs: not a face the layout counts.
  if (w.shaftliner) lines.push({ mat: '1" gypsum shaftliner panel 2\'×10\'', unit: 'ea', coef: r(1 / (2 * FT * 10 * FT)), base: 'm2', waste: 5 })
  if (w.furring) lines.push({ mat: 'Masonry anchor 1/4" × 1-1/4" (hat channel @ 24")', unit: 'ea', coef: r(1 / sp / 0.6096), base: 'm2', waste: 5, packSize: 100, packName: 'box' })
  lines.push({ mat: 'Powder-actuated fastener for runners @ 24" (floor and deck)', unit: 'ea', coef: r(2 * k * PAF_PER_M_TRACK), base: 'm', waste: 5, packSize: 100, packName: 'box' })
  lines.push({ mat: 'Joint compound, all-purpose ready-mix', unit: 'gal', coef: r(JOINT_COMPOUND_GAL_M2 * w.faces), base: 'm2', waste: 10, packSize: 4.5, packName: 'pail', note: 'Level 4 finish on the finished faces.' })
  lines.push({ mat: 'Paper joint tape 2-1/16"', unit: 'ft', coef: r(JOINT_TAPE_FT_M2 * w.faces), base: 'm2', waste: 5, packSize: 500, packName: 'roll' })
  if (w.cementSide) {
    lines.push({ mat: 'Alkali-resistant mesh tape 2"', unit: 'ft', coef: JOINT_TAPE_FT_M2, base: 'm2', waste: 5, packSize: 150, packName: 'roll' })
    lines.push({ mat: 'Thin-set mortar for cement backer joints', unit: 'lb', coef: r(0.05 * SF), base: 'm2', waste: 10, packSize: 50, packName: 'bag' })
  }
  if (w.insulation) lines.push({ mat: w.insulation, unit: 'sf', coef: r(SF), base: 'm2', waste: 5 })
  if (w.acoustic) lines.push({ mat: 'Acoustical sealant, 28 oz tube (top and bottom, both sides)', unit: 'tube', coef: r(4 * SEALANT_TUBE_M), base: 'm', waste: 10 })
  if (w.headJoint) lines.push({ mat: 'Fire-rated head-of-wall joint (listed system), both sides', unit: 'ft', coef: r(2 * LF), base: 'm', waste: 5 })
  if (w.exterior) {
    lines.push({ mat: 'Weather-resistive barrier', unit: 'sf', coef: r(SF), base: 'm2', waste: 15 })
    lines.push({ mat: 'Sheathing joint tape', unit: 'ft', coef: r(0.375 * SF), base: 'm2', waste: 5 })
    lines.push({ mat: 'Polyethylene vapor retarder 6 mil (where required)', unit: 'sf', coef: r(SF), base: 'm2', waste: 10 })
  }
  return { name: `${w.code} – material list (US)`, kind: 'linear', system: 'Steel stud partition', lines }
}

export function usWalls() {
  return walls.map(w => {
    const boards = []
    if (w.a) boards.push({ side: 'A', product: w.a[0], thickness_m: r(w.a[1] * IN, 6), count: w.a[2] })
    if (w.b) boards.push({ side: 'B', product: w.b[0], thickness_m: r(w.b[1] * IN, 6), count: w.b[2] })
    const thicknessIn = w.thicknessIn || w.studIn + (w.a ? w.a[1] * w.a[2] : 0) + (w.b ? w.b[1] * w.b[2] : 0)
    return {
      code: w.code, name: w.name, category: w.category, fire: w.fire ?? null, stc: w.stc || null, rated: w.rated || null,
      thickness_m: r(thicknessIn * IN, 4), boards, notes: w.notes,
      framing: {
        spacing: r(w.spacingIn * IN), bars: STUD_BARS, studName: w.stud, trackName: w.track,
        boardW: r(4 * FT), boardH: r((w.sheetFt || 12) * FT), screwSpacing: r(12 * IN),
        taName: `Drywall screw ${w.longScrews ? '1-5/8"' : '1-1/4"'} Type S`, laName: 'Framing screw #8 × 1/2" pan head',
        // One-sided walls (furring, shaft): no side B, or the layout would add the default board there.
        ...(w.b ? {} : { layersB: 0 }),
        ...(w.double ? { doubleStuds: true } : {}), color: COLORS[w.code],
      },
      recipe: wallRecipe(w),
    }
  })
}

// --- Ceilings -----------------------------------------------------------------------------------------------
const dwCeiling = (board, layers) => ({
  system: 'suspended', profile: '7/8" 25 ga furring channel', spacing_m: r(16 * IN), hanger_m: r(4 * FT),
  carrier_m: r(4 * FT), carrier_name: '1-1/2" 16 ga cold-rolled carrying channel', board, layers,
  sheet_w_m: r(4 * FT), sheet_l_m: r(12 * FT), imperial: true,
})
const grid = (tile, w, l) => ({
  system: 'grid', tile, tile_w_m: r(w * FT), tile_l_m: r(l * FT), hanger_m: r(4 * FT),
  main_spacing_m: r(4 * FT), main_len_m: r(12 * FT), cross_len_m: r(4 * FT), short_len_m: r(2 * FT),
  main_name: '15/16" main tee 12\' (heavy duty)', cross_name: '15/16" cross tee 4\'', short_name: '15/16" cross tee 2\'', imperial: true,
})
const HANGER_WIRE = { mat: '12 ga hanger wire (allow 4 ft per hanger)', unit: 'ft', coef: r(4 / (16 * 0.092903) ), base: 'm2', waste: 10, note: 'One hanger per 16 sf; adjust to the plenum depth.' }
const DW_FINISH = [
  { mat: 'Joint compound, all-purpose ready-mix', unit: 'gal', coef: JOINT_COMPOUND_GAL_M2, base: 'm2', waste: 10, packSize: 4.5, packName: 'pail' },
  { mat: 'Paper joint tape 2-1/16"', unit: 'ft', coef: JOINT_TAPE_FT_M2, base: 'm2', waste: 5, packSize: 500, packName: 'roll' },
  { mat: 'Tie wire 18 ga (furring to carrying channel)', unit: 'ft', coef: r((2 * 1.5) / (16 * IN * 48 * IN)), base: 'm2', waste: 10, note: 'Two 18" ties per crossing.' },
]
const ceilings = [
  { code: 'CL01', name: 'Suspended drywall · 7/8" furring @ 16" · 1× 5/8" Type X', thickness_m: r(0.625 * IN), spec: dwCeiling(X58, 1),
    extras: [HANGER_WIRE, ...DW_FINISH], notes: 'Gypsum board ceiling hung from 1-1/2" carrying channels @ 48" (offices, corridors).' },
  { code: 'CL02', name: 'Suspended drywall · 7/8" furring @ 16" · 1× 5/8" Type X moisture-resistant', thickness_m: r(0.625 * IN),
    spec: dwCeiling('5/8" Type X mold & moisture-resistant gypsum board 4\'×12\'', 1), extras: [HANGER_WIRE, ...DW_FINISH], notes: 'Restrooms, kitchens, humid rooms.' },
  { code: 'CL03', name: 'Suspended drywall · 7/8" furring @ 16" · 2× 5/8" Type X (fire-rated)', thickness_m: r(1.25 * IN), spec: dwCeiling(X58, 2),
    extras: [HANGER_WIRE, ...DW_FINISH], notes: 'Fire-rated ceiling membrane: verify the UL floor/ceiling or roof/ceiling design.' },
  { code: 'CL04', name: 'ACT 2\'×2\' mineral fiber · 15/16" exposed grid', thickness_m: r(0.625 * IN), spec: grid('Mineral fiber acoustical ceiling panel 2\'×2\'×5/8"', 2, 2),
    extras: [HANGER_WIRE], notes: 'Lay-in acoustical ceiling (offices, corridors). Seismic bracing per local code not included.' },
  { code: 'CL05', name: 'ACT 2\'×4\' mineral fiber · 15/16" exposed grid', thickness_m: r(0.625 * IN), spec: grid('Mineral fiber acoustical ceiling panel 2\'×4\'×5/8"', 2, 4),
    extras: [HANGER_WIRE], notes: 'Lay-in acoustical ceiling, economical module.' },
  { code: 'CL06', name: 'ACT 2\'×2\' vinyl-faced gypsum · 15/16" grid · hold-down clips', thickness_m: r(0.5 * IN), spec: grid('Vinyl-faced gypsum ceiling panel 2\'×2\'', 2, 2),
    extras: [HANGER_WIRE, { mat: 'Panel hold-down clip', unit: 'ea', coef: r(4 / (4 * 0.092903)), base: 'm2', waste: 5, packSize: 100, packName: 'box', note: '4 per panel.' }],
    notes: 'Washable, cleanable ceiling for healthcare and food areas.' },
]

// --- Floors -------------------------------------------------------------------------------------------------
const COVE_ADH = { mat: 'Cove base adhesive, 30 oz cartridge', unit: 'cartridge', coef: r(1 / (20 * FT)), base: 'm', waste: 5, note: 'About 20 ft of base per cartridge.' }
const floors = [
  { code: 'FL01', name: 'VCT 12"×12"×1/8"', thickness_m: r(0.125 * IN),
    spec: { system: 'vinyl_tile', product: 'VCT 12"×12"×1/8"', tile_w_m: r(FT), tile_l_m: r(FT), adhesive: 'VCT clear thin-spread adhesive', adhesive_kg_m2: r(SF / 350), adhesive_unit: 'gal', skirting: '4" vinyl cove base', waste_pct: 5, imperial: true },
    extras: [COVE_ADH, { mat: 'Floor finish (3 coats)', unit: 'gal', coef: r((3 * SF) / 2000), base: 'm2', waste: 5, packSize: 5, packName: 'pail' }],
    notes: 'Back-of-house, corridors, storage. Adhesive ≈ 350 sf/gal.' },
  { code: 'FL02', name: 'Sheet vinyl homogeneous 2.0 mm · heat-welded · 6" flash cove', thickness_m: 0.002,
    spec: { system: 'vinyl_sheet', product: 'Homogeneous sheet vinyl 2.0 mm (6\'6" roll)', roll_w_m: r(6.5 * FT), adhesive: 'Sheet vinyl adhesive', adhesive_kg_m2: r(SF / 150), adhesive_unit: 'gal', skirting: '6" integral flash cove (sheet vinyl)', waste_pct: 10, imperial: true },
    extras: [{ mat: 'Cove cap strip', unit: 'ft', coef: r(LF), base: 'm', waste: 5 }, { mat: 'Cove fillet (former) strip', unit: 'ft', coef: r(LF), base: 'm', waste: 5 }],
    notes: 'Healthcare: patient rooms, ORs, clean areas. Seams heat-welded. Adhesive ≈ 150 sf/gal.' },
  { code: 'FL03', name: 'LVT plank 7"×48" · 2.5 mm · glue-down', thickness_m: 0.0025,
    spec: { system: 'vinyl_tile', product: 'LVT plank 7"×48" 2.5 mm', tile_w_m: r(7 * IN), tile_l_m: r(4 * FT), adhesive: 'LVT pressure-sensitive adhesive', adhesive_kg_m2: r(SF / 180), adhesive_unit: 'gal', skirting: '4" rubber wall base', waste_pct: 7, imperial: true },
    extras: [COVE_ADH], notes: 'Offices, patient rooms, retail. Adhesive ≈ 180 sf/gal.' },
  { code: 'FL04', name: 'Porcelain tile 24"×24" · large-format mortar', thickness_m: r(0.375 * IN),
    spec: { system: 'tile', product: 'Porcelain tile 24"×24"', tile_w_m: r(2 * FT), tile_l_m: r(2 * FT), joint_mm: 3, tile_mm: 9.5, adhesive: 'Large & heavy tile (LHT) mortar', adhesive_kg_m2: r((1.25 * SF) / 2.20462), skirting: '4" porcelain tile base', waste_pct: 10, imperial: true },
    extras: [], notes: 'Lobbies and public areas. Mortar ≈ 1,25 lb/sf (1/2" notch, back-buttered).' },
  { code: 'FL05', name: 'Ceramic tile 12"×12" · wet areas · waterproofing', thickness_m: r(0.3125 * IN),
    spec: { system: 'tile', product: 'Ceramic floor tile 12"×12"', tile_w_m: r(FT), tile_l_m: r(FT), joint_mm: 3, tile_mm: 8, adhesive: 'Modified thin-set mortar', adhesive_kg_m2: r((0.75 * SF) / 2.20462), waste_pct: 10, imperial: true },
    extras: [{ mat: 'Liquid-applied waterproofing membrane (2 coats)', unit: 'gal', coef: r(SF / 55), base: 'm2', waste: 10, note: 'About 55 sf/gal for 2 coats; add the 6" turn-up at walls.' }],
    notes: 'Restrooms and showers (wall base comes with the wall tile). Mortar ≈ 0,75 lb/sf.' },
  { code: 'FL06', name: 'Carpet tile 24"×24"', thickness_m: 0.006,
    spec: { system: 'carpet', product: 'Carpet tile 24"×24"', tile_w_m: r(2 * FT), tile_l_m: r(2 * FT), adhesive: 'Carpet tile pressure-sensitive adhesive', adhesive_kg_m2: r(SF / 600), adhesive_unit: 'gal', skirting: '4" rubber wall base', waste_pct: 5, imperial: true },
    extras: [COVE_ADH], notes: 'Offices, conference rooms. Adhesive ≈ 600 sf/gal.' },
  { code: 'FL07', name: 'Raised access floor 24"×24"', thickness_m: 0.032,
    spec: { system: 'raised', product: 'Raised access floor panel 24"×24"', tile_w_m: r(2 * FT), tile_l_m: r(2 * FT), waste_pct: 3, imperial: true },
    extras: [], notes: 'Data rooms and open offices with underfloor services; finished height set by the pedestals.' },
  { code: 'FL08', name: 'Epoxy resinous flooring 1/8" · 6" integral cove', thickness_m: 0.003,
    spec: { system: 'resin', product: 'Epoxy self-leveling resin system', thickness_mm: 3, kg_m2_mm: 1.6, skirting: '6" integral resinous cove base', waste_pct: 5, imperial: true },
    extras: [{ mat: 'Urethane topcoat', unit: 'gal', coef: r(SF / 400), base: 'm2', waste: 5 }],
    notes: 'Labs, kitchens, sterile processing.' },
  { code: 'FL09', name: 'Polished concrete (grind, densify, polish)', thickness_m: 0.001,
    spec: { system: 'other', product: 'Polished concrete (grind, densify, polish)', imperial: true },
    extras: [
      { mat: 'Lithium silicate densifier', unit: 'gal', coef: r(SF / 250), base: 'm2', waste: 5, packSize: 5, packName: 'pail' },
      { mat: 'Penetrating stain guard', unit: 'gal', coef: r(SF / 1000), base: 'm2', waste: 5 },
    ], notes: 'Back-of-house, warehouses, retail.' },
  { code: 'FL10', name: 'Engineered wood 1/2" · floating', thickness_m: r(0.5 * IN),
    spec: { system: 'laminate', product: 'Engineered wood flooring 1/2"', underlay: 'Foam underlayment 2 mm with vapor barrier', skirting: '3-1/4" wood base', waste_pct: 8, imperial: true },
    extras: [], notes: 'Lobbies, offices and residential areas.' },
]

const recipeOf = (t, kind, system) => (t.extras && t.extras.length ? { name: `${t.code} – material list (US)`, kind, system, lines: t.extras } : null)
export const usCeilings = () => ceilings.map(c => ({ ...c, framing: { ceiling: c.spec, color: COLORS[c.code] }, recipe: recipeOf(c, 'area', 'Ceiling') }))
export const usFloors = () => floors.map(f => ({ ...f, framing: { floor: f.spec, color: COLORS[f.code] }, recipe: recipeOf(f, 'area', 'Floor') }))
