import fs from 'node:fs'

const path = 'src/app/dashboard/planning/lookahead/page.js'
let source = fs.readFileSync(path, 'utf8')

function required(from, to) {
  if (!source.includes(from)) throw new Error(`Expected fragment not found: ${from.slice(0, 120)}`)
  source = source.replace(from, to)
}

required("import { supabase } from '../../../../lib/supabase';", "import { supabase } from '../../../../lib/supabase';\nimport { getLookaheadCopy, getKoskelaColumns } from '../../../../i18n/lookahead';")

const koskelaStart = source.indexOf('const KOSKELA_COLUMNS = [')
if (koskelaStart < 0) throw new Error('Static Koskela columns were not found.')
const koskelaEnd = source.indexOf('\n];', koskelaStart)
if (koskelaEnd < 0) throw new Error('Static Koskela columns end was not found.')
source = source.slice(0, koskelaStart) + source.slice(koskelaEnd + 3)

source = source.replace('function formatShortDate(\n  date\n) {', 'function formatShortDate(\n  date,\n  locale = \'en-US\'\n) {')
source = source.replace("    'en-US',\n    {\n      month: '2-digit',", "    locale,\n    {\n      month: '2-digit',")
source = source.replace('function getDayLabel(\n  date\n) {', 'function getDayLabel(\n  date,\n  locale = \'en-US\'\n) {')
source = source.replace("    'en-US',\n    {\n      weekday: 'short',", "    locale,\n    {\n      weekday: 'short',")
source = source.replace('function getLocationName(\n  item\n) {', "function getLocationName(\n  item,\n  fallback = 'Unassigned Location'\n) {")
source = source.replace("    'Unassigned Location'\n  );", '    fallback\n  );')
source = source.replace('function getLocationPath(\n  item\n) {', "function getLocationPath(\n  item,\n  fallback = 'Unassigned Location'\n) {")
source = source.replace('    getLocationName(item)\n  );', '    getLocationName(item, fallback)\n  );')

required('export default function LookaheadPage() {', "export default function LookaheadPage() {\n\n  const [locale, setLocale] = useState('en-US');\n  const t = useMemo(() => getLookaheadCopy(locale), [locale]);\n  const KOSKELA_COLUMNS = useMemo(() => getKoskelaColumns(locale), [locale]);")

required('  const [\n    projects,\n    setProjects,\n  ] = useState([]);', `  const [
    projects,
    setProjects,
  ] = useState([]);

  useEffect(() => {
    let active = true;
    async function loadOrganizationLocale() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: membership } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).limit(1).maybeSingle();
        if (!membership?.organization_id) return;
        const { data: organization } = await supabase.from('organizations').select('locale').eq('id', membership.organization_id).maybeSingle();
        const nextLocale = organization?.locale;
        if (active && ['en-US', 'pt-BR', 'es'].includes(nextLocale)) setLocale(nextLocale);
      } catch (error) {
        console.warn('Lookahead locale fallback to en-US.', error);
      }
    }
    loadOrganizationLocale();
    return () => { active = false; };
  }, []);`)

const replacements = [
  ["'Projects could not be loaded.'", 't.projectsLoadError'],
  ["'Lookahead plans could not be loaded.'", 't.plansLoadError'],
  ["'Master Plan reference data could not be loaded.'", 't.masterPlanReferenceLoadError'],
  ["'The company Work Package Library could not be loaded.'", 't.workPackageLibraryLoadError'],
  ["'The Lookahead workspace could not be loaded.'", 't.workspaceLoadError'],
  ["'The Lookahead could not be saved.'", 't.lookaheadSaveError'],
  ["'The Work Package could not be assigned to this Lookahead row.'", 't.rowAssignError'],
  ["'The row could not be inserted.'", 't.rowInsertError'],
  ["'The Lookahead package could not be inserted.'", 't.packageInsertError'],
  ["'The user-created Lookahead row could not be deleted.'", 't.rowDeleteError'],
  ["'The Lookahead timeline cell could not be saved.'", 't.timelineCellSaveError'],
  ["'The Koskela assessment could not be saved.'", 't.assessmentSaveError'],
  ["'Start of Week 1 is required.'", 't.startWeekRequired'],
  ["'Horizon must be at least 1 week.'", 't.horizonMinimum'],
  ["'Line ID must be a valid row number.'", 't.invalidLineId'],
  ["'Duration must be at least 1 working day.'", 't.durationMinimum'],
  ["'Delete this user-created Lookahead row? Its grouped Koskela assessments will also be removed.'", 't.deleteRowConfirm'],
  ["'This Koskela criterion is managed by Constraint Management and cannot be changed directly from the Matrix.'", 't.criterionGoverned'],
  ["'The Koskela assessment was saved, but the Constraint Log could not be synchronized.'", 't.constraintSyncError'],
  ["'Please try again.'", 't.tryAgain'],
  ["'this Work Package'", 't.thisWorkPackage'],
  ['>Lookahead Planning<', '>{t.title}<'],
  ['>Show Weekends<', '>{t.showWeekends}<'],
  ['>Hide Weekends<', '>{t.hideWeekends}<'],
  ['>Insert Package<', '>{t.insertPackage}<'],
  ['>Save Lookahead<', '>{t.saveLookahead}<'],
  ['>Loading Lookahead...<', '>{t.loadingLookahead}<'],
  ['>Lookahead & Koskela Sheet<', '>{t.sheetTab}<'],
  ['>Location Sequence<', '>{t.locationSequence}<'],
  ['>Constraints Details<', '>{t.constraintDetails}<'],
  ['>No Project Selected<', '>{t.noProject}<'],
  ['>Select a project to open the Lookahead.<', '>{t.selectProjectHelp}<'],
  ['>PACKAGE<', '>{t.packageHeader}<'],
  ['>DESCRIPTION<', '>{t.descriptionHeader}<'],
  ['>KOSKELA FLOW MATRIX<', '>{t.koskelaMatrix}<'],
  ['>Insert Row Above<', '>{t.insertAbove}<'],
  ['>Insert Row Below<', '>{t.insertBelow}<'],
  ['>Deleting...<', '>{t.deleting}<'],
  ['>Delete Row<', '>{t.deleteRow}<'],
  ['>Select Work Package<', '>{t.selectWorkPackage}<'],
  ['>Select...<', '>{t.select}<'],
  ['>Clear cell<', '>{t.clearCell}<'],
  ['>LEGEND:<', '>{t.legend}<'],
  ['>🟢 Yes - Ready Directly<', '>{t.legendReadyDirect}<'],
  ['>🔵 Yes - Ready After Constraint Cleared<', '>{t.legendReadyCleared}<'],
  ['>🔴 No - Active Constraint<', '>{t.legendActiveConstraint}<'],
  ['>🔒 Managed in Constraint Log<', '>{t.legendManaged}<'],
  ['>🟥 HOL - Master Plan Holiday<', '>{t.legendHoliday}<'],
  ['>Each row = one Work Package<', '>{t.legendRow}<'],
  ['>Manual row timeline ▼ = select Work Package<', '>{t.legendManual}<'],
  ['title="Row actions"', 'title={t.rowActions}'],
  ['title="Weekend - non-working day"', 'title={t.weekendNonWorking}']
]
for (const [from, to] of replacements) source = source.replaceAll(from, to)

source = source.replaceAll('formatShortDate(date)', 'formatShortDate(date, locale)')
source = source.replaceAll('getDayLabel(date)', 'getDayLabel(date, locale)')
source = source.replaceAll('getLocationName(item)', 'getLocationName(item, t.unassignedLocation)')
source = source.replaceAll('getLocationPath(item)', 'getLocationPath(item, t.unassignedLocation)')
source = source.replaceAll("'HOL'", 't.holidayShort')
source = source.replaceAll("'OFF'", 't.weekendOff')

source = source.replace(/`Selected Work Package: \$\{([^}]+)\}`/g, 't.selectedWorkPackage($1)')
source = source.replace(/`Ready after Constraint Log verification · \$\{([^}]+)\}\. Click to open the Constraint Log\.`/g, 't.readyAfterConstraint($1)')
source = source.replace(/`Managed in Constraint Log · \$\{([^}]+)\}\. Click to open the Constraint Log\.`/g, 't.managedConstraint($1)')

for (const token of ['get{t.', 'set{t.', 'locale{t.', 'project{t.']) if (source.includes(token)) throw new Error(`Unsafe i18n mutation detected: ${token}`)
if (source.includes('const KOSKELA_COLUMNS = [')) throw new Error('Static English Koskela columns still exist.')
if (!source.includes('getKoskelaColumns(locale)')) throw new Error('Localized Koskela columns are not wired.')
if (!source.includes('loadOrganizationLocale')) throw new Error('Organization locale loader is missing.')
if (source.includes("'Lookahead plans could not be loaded.'")) throw new Error('Lookahead runtime error literals still exist.')
if (source.includes('>KOSKELA FLOW MATRIX<')) throw new Error('Lookahead rendered matrix title is still hard-coded.')

fs.writeFileSync(path, source)
console.log(`Wired expanded Lookahead locale catalog: ${path}`)
