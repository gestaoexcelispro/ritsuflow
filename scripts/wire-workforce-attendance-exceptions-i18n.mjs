import fs from 'node:fs'
const path='src/app/dashboard/field-management/workforce/attendance/exceptions/page.js'
let s=fs.readFileSync(path,'utf8')
function req(a,b){if(!s.includes(a))throw new Error(`Exceptions fragment missing: ${a.slice(0,100)}`);s=s.replace(a,b)}
req("import { createClient } from '../../../../../../lib/supabase/client'", "import { createClient } from '../../../../../../lib/supabase/client'\nimport { getAttendanceExceptionsCopy, getAttendanceExceptionCodeLabel, getAttendanceExceptionSeverityLabel, getAttendanceExceptionQueueLabel, formatAttendanceExceptionTime, formatAttendanceExceptionDateTime } from '../../../../../../i18n/workforceAttendanceExceptions'")
req('export default function AttendanceExceptionsPage() {',"export default function AttendanceExceptionsPage() {\n  const [locale,setLocale]=useState('en-US')\n  const t=useMemo(()=>getAttendanceExceptionsCopy(locale),[locale])")
req("  const [projects, setProjects] =\n    useState([])",`  const [projects, setProjects] =
    useState([])

  useEffect(() => {
    let active=true
    async function loadOrganizationLocale(){
      try{
        const {data:{user}}=await supabase.auth.getUser()
        if(!user)return
        const {data:membership}=await supabase.from('organization_members').select('organization_id').eq('user_id',user.id).limit(1).maybeSingle()
        if(!membership?.organization_id)return
        const {data:organization}=await supabase.from('organizations').select('locale').eq('id',membership.organization_id).maybeSingle()
        if(active&&['en-US','pt-BR','es'].includes(organization?.locale))setLocale(organization.locale)
      }catch(error){console.warn('Attendance Exceptions locale fallback to en-US.',error)}
    }
    loadOrganizationLocale()
    return()=>{active=false}
  },[])`)
// Locale-aware presentation helpers.
s=s.replace(/function formatTime\(value\) \{[\s\S]*?\n\}/,"function formatTime(value, locale) { return formatAttendanceExceptionTime(value, locale) }")
s=s.replace(/function formatDateTime\(value\) \{[\s\S]*?\n\}/,"function formatDateTime(value, locale) { return formatAttendanceExceptionDateTime(value, locale) }")
s=s.replace(/function formatExceptionCode\(code\) \{[\s\S]*?\n\}/,"function formatExceptionCode(code, locale) { return getAttendanceExceptionCodeLabel(code, locale) }")
// Dynamic exception taxonomy.
s=s.replaceAll("title:\n                  'Over Allowed Hours'","title: t.overAllowedHours").replaceAll("description:\n                  'Worker has exceeded the standard daily working allowance.'","description: t.overAllowedDescription")
s=s.replace("? 'Long Open Session'\n                      : 'Open Session'","? t.longOpenSession\n                      : t.openSession").replace("? 'Worker has remained checked in for an unusually long period.'\n                      : 'Worker currently has an open attendance session.'","? t.longOpenDescription\n                      : t.openDescription")
s=s.replaceAll('title: formatExceptionCode(\n                    session.exception_code\n                  )','title: formatExceptionCode(\n                    session.exception_code, locale\n                  )')
// Errors and resolution feedback.
s=s.replaceAll("'Unable to load Attendance Exceptions.'",'t.unableLoad').replaceAll("'Unable to initialize Attendance Exceptions.'",'t.unableInitialize').replaceAll("'Exception resolver identity could not be loaded.'",'t.resolverLoadWarning').replaceAll("'Unable to load geofence evidence for this exception.'",'t.evidenceLoadWarning').replaceAll("'Resolution notes are required before resolving an exception.'",'t.resolutionRequired').replaceAll("'Unable to resolve the attendance exception.'",'t.unableResolve')
// Core page UI.
const jsx=[['Field Management','{t.fieldManagement}'],['Attendance Exceptions','{t.title}'],['Project','{t.project}'],['No projects available','{t.noProjects}'],['Queue','{t.queue}'],['Critical','{t.critical}'],['Severity','{t.severity}'],['Worker','{t.worker}'],['Exception','{t.exception}'],['Value','{t.value}'],['Resolution','{t.resolution}']]
for(const [a,b] of jsx)s=s.replaceAll(`>${a}<`,`>${b}<`)
s=s.replace(/Monitor operational alerts,\s+review recorded attendance\s+exceptions, and document\s+supervisor resolution decisions\./g,'{t.description}')
s=s.replace("{refreshing\n              ? 'Refreshing...'\n              : 'Refresh'}","{refreshing ? t.refreshing : t.refresh}")
s=s.replaceAll('label="Project"','label={t.project}').replaceAll('label="Queue"','label={t.queue}')
s=s.replaceAll('>Resolved<','>{t.resolved}<').replaceAll('>All<','>{t.all}<')
// Date/time and taxonomy call sites.
s=s.replace(/formatTime\(\s*exception\.session\.check_in_at\s*\)/g,'formatTime(exception.session.check_in_at, locale)').replace(/formatTime\(\s*exception\.session\.check_out_at\s*\)/g,'formatTime(exception.session.check_out_at, locale)').replace(/formatDateTime\(\s*selectedException\.session\.exception_resolved_at\s*\)/g,'formatDateTime(selectedException.session.exception_resolved_at, locale)')
// Guards ensure machine keys survive while English presentation is removed from primary workflow.
if(!s.includes('getAttendanceExceptionsCopy(locale)'))throw new Error('Exceptions catalog wiring missing')
if(!s.includes('loadOrganizationLocale'))throw new Error('Exceptions locale loader missing')
if(!s.includes('getAttendanceExceptionCodeLabel(code, locale)'))throw new Error('Exception taxonomy localization missing')
for(const x of ['>Attendance Exceptions<','>No projects available<',"'Over Allowed Hours'","'Long Open Session'"])if(s.includes(x))throw new Error(`Exceptions runtime literal remains: ${x}`)
fs.writeFileSync(path,s)
console.log(`Wired Attendance Exceptions taxonomy and supervisory workflow: ${path}`)
