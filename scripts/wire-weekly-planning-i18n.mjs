import fs from 'node:fs'

const path='src/app/dashboard/planning/weekly-planning/page.js'
let source=fs.readFileSync(path,'utf8')
function required(from,to){if(!source.includes(from))throw new Error(`Expected fragment not found: ${from.slice(0,100)}`);source=source.replace(from,to)}

required("import { supabase } from '../../../../lib/supabase';", "import { supabase } from '../../../../lib/supabase';\nimport { getWeeklyPlanningCopy, getWeeklyVarianceReasons, getWeeklyMakeReadyCategories } from '../../../../i18n/weeklyPlanning';")

for (const name of ['VARIANCE_REASONS','MAKE_READY_CATEGORIES']) {
  const start=source.indexOf(`const ${name} = [`)
  if(start<0) throw new Error(`${name} not found`)
  const end=source.indexOf('\n];',start)
  if(end<0) throw new Error(`${name} end not found`)
  source=source.slice(0,start)+source.slice(end+3)
}

source=source.replace("function formatDate(value) {", "function formatDate(value, locale = 'en-US') {")
source=source.replace("function formatShortDate(value) {", "function formatShortDate(value, locale = 'en-US') {")
source=source.replaceAll("    'en-US',\n    {", "    locale,\n    {")

required('export default function WeeklyPlanningPage() {', "export default function WeeklyPlanningPage() {\n  const [locale,setLocale]=useState('en-US');\n  const t=useMemo(()=>getWeeklyPlanningCopy(locale),[locale]);\n  const VARIANCE_REASONS=useMemo(()=>getWeeklyVarianceReasons(locale),[locale]);\n  const MAKE_READY_CATEGORIES=useMemo(()=>getWeeklyMakeReadyCategories(locale),[locale]);")

required('  const [\n    projects,\n    setProjects,\n  ] = useState([]);', `  const [
    projects,
    setProjects,
  ] = useState([]);

  useEffect(()=>{
    let active=true;
    async function loadOrganizationLocale(){
      try{
        const {data:{user}}=await supabase.auth.getUser();
        if(!user)return;
        const {data:membership}=await supabase.from('organization_members').select('organization_id').eq('user_id',user.id).limit(1).maybeSingle();
        if(!membership?.organization_id)return;
        const {data:organization}=await supabase.from('organizations').select('locale').eq('id',membership.organization_id).maybeSingle();
        const nextLocale=organization?.locale;
        if(active&&['en-US','pt-BR','es'].includes(nextLocale))setLocale(nextLocale);
      }catch(error){console.warn('Weekly Planning locale fallback to en-US.',error)}
    }
    loadOrganizationLocale();
    return()=>{active=false};
  },[]);`)

source=source.replace("      'Unexpected error.',", '      t.unexpectedError,')
source=source.replace("          'Select a project first.',", '          t.selectProjectFirst,')
source=source.replace("            'This project does not have an active Lookahead Plan.',", '            t.noActiveLookahead,')
source=source.replace("          'Weekly Plan created.',", '          t.weeklyPlanCreated,')
source=source.replace("          'Activities can only be added while the Weekly Plan is Draft.',", '          t.activitiesDraftOnly,')
source=source.replace("          'Activity description is required.',", '          t.activityDescriptionRequired,')
source=source.replace("          'Select a Work Package.',", '          t.selectWorkPackage,')
source=source.replace('`Week ${weekInfo.week} · ${weekInfo.year}`','t.weekName(weekInfo.week, weekInfo.year)')
source=source.replaceAll('formatDate(', 'formatDate(').replaceAll('formatShortDate(', 'formatShortDate(')

if(source.includes('const VARIANCE_REASONS = ['))throw new Error('Static variance reasons remain')
if(source.includes('const MAKE_READY_CATEGORIES = ['))throw new Error('Static Make Ready categories remain')
if(!source.includes('loadOrganizationLocale'))throw new Error('Locale loader missing')
if(!source.includes('getWeeklyVarianceReasons(locale)'))throw new Error('Variance localization missing')
if(!source.includes('getWeeklyMakeReadyCategories(locale)'))throw new Error('Make Ready localization missing')
fs.writeFileSync(path,source)
console.log(`Wired Weekly Planning locale catalogs: ${path}`)
