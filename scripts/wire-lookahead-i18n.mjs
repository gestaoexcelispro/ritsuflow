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

source = source.replace("            'Projects could not be loaded.'", '            t.projectsLoadError')
source = source.replaceAll('formatShortDate(date)', 'formatShortDate(date, locale)')
source = source.replaceAll('getDayLabel(date)', 'getDayLabel(date, locale)')

for (const token of ['get{t.', 'set{t.', 'locale{t.', 'project{t.']) if (source.includes(token)) throw new Error(`Unsafe i18n mutation detected: ${token}`)
if (source.includes('const KOSKELA_COLUMNS = [')) throw new Error('Static English Koskela columns still exist.')
if (!source.includes('getKoskelaColumns(locale)')) throw new Error('Localized Koskela columns are not wired.')
if (!source.includes('loadOrganizationLocale')) throw new Error('Organization locale loader is missing.')

fs.writeFileSync(path, source)
console.log(`Wired Lookahead locale and Koskela catalog: ${path}`)
