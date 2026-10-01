import fs from 'node:fs'
const path='src/app/dashboard/field-management/workforce/attendance/page.js'
let s=fs.readFileSync(path,'utf8')
function req(a,b){if(!s.includes(a))throw new Error(`Attendance fragment missing: ${a.slice(0,90)}`);s=s.replace(a,b)}
req("import { createClient } from '../../../../../lib/supabase/client'", "import { createClient } from '../../../../../lib/supabase/client'\nimport { getWorkforceAttendanceCopy, getHoursControlLabel, formatAttendanceTime, formatAttendanceDate } from '../../../../../i18n/workforceAttendance'")
req('export default function AttendancePage() {',"export default function AttendancePage() {\n  const [locale,setLocale]=useState('en-US')\n  const t=useMemo(()=>getWorkforceAttendanceCopy(locale),[locale])")
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
      }catch(error){console.warn('Attendance locale fallback to en-US.',error)}
    }
    loadOrganizationLocale()
    return()=>{active=false}
  },[])`)
// Make helper functions locale-aware without changing stored operational keys.
s=s.replaceAll('formatWorkerName(\n', 'formatWorkerName(\n')
s=s.replace("function formatTime(value) {\n  if (!value) {\n    return '—'\n  }\n\n  return new Intl.DateTimeFormat(\n    undefined,\n    {\n      hour: '2-digit',\n      minute: '2-digit',\n    }\n  ).format(new Date(value))\n}","function formatTime(value, locale) { return formatAttendanceTime(value, locale) }")
s=s.replaceAll('formatTime(\n                            currentSession?.check_in_at\n                          )','formatTime(\n                            currentSession?.check_in_at, locale\n                          )')
// Runtime messages and check-in/out feedback.
const reps=[["'Unable to load attendance data.'",'t.unableLoadData'],["'Unable to load Attendance.'",'t.unableLoadAttendance'],["'Requesting device location...'",'t.requestingLocation'],["'Unable to check worker in.'",'t.unableCheckIn'],["'Unable to check worker out.'",'t.unableCheckOut']]
for(const [a,b] of reps)s=s.replaceAll(a,b)
s=s.replaceAll('`Location captured · GPS accuracy approximately ${Math.round(\n            location.accuracy || 0\n          )} m.`','t.locationCaptured(Math.round(location.accuracy || 0))')
s=s.replaceAll('`${location.message} Attendance will still be recorded and marked as location unavailable when geofence evaluation is required.`','t.locationUnavailableNotice(location.message)')
s=s.replace(/`\$\{formatWorkerName\(\s*worker\s*\)\} checked in successfully\.\$\{formatGeofenceResult\(\s*attendanceEvent\s*\)\}\$\{formatGpsPolicyResult\(\s*attendanceEvent\s*\)\}`/g,"`${t.checkInSuccess(formatWorkerName(worker))}${formatGeofenceResult(attendanceEvent)}${formatGpsPolicyResult(attendanceEvent)}`")
s=s.replace(/`\$\{formatWorkerName\(\s*worker\s*\)\} checked out successfully\.\$\{formatGeofenceResult\(\s*attendanceEvent\s*\)\}\$\{formatGpsPolicyResult\(\s*attendanceEvent\s*\)\}`/g,"`${t.checkOutSuccess(formatWorkerName(worker))}${formatGeofenceResult(attendanceEvent)}${formatGpsPolicyResult(attendanceEvent)}`")
// Visible core UI.
const jsx=[['Field Management','{t.fieldManagement}'],['Attendance','{t.title}'],['Project','{t.project}'],['No projects available','{t.noProjects}'],['On Site','{t.onSite}'],['Approaching Limit','{t.approachingLimit}'],['Over Allowed Hours','{t.overAllowedHours}'],['Checked Out Today','{t.checkedOutToday}'],['Supervisor Attendance','{t.supervisorAttendance}'],['Loading Attendance...','{t.loading}'],['Field ID','{t.fieldId}'],['Worker','{t.worker}'],['Company','{t.company}'],['Trade','{t.trade}'],['Status','{t.status}'],['Check-In','{t.checkIn}'],['Current Session','{t.currentSession}'],['Worked Today','{t.workedToday}'],['Allowed Today','{t.allowedToday}'],['Balance','{t.balance}'],['Action','{t.action}']]
for(const [a,b] of jsx)s=s.replaceAll(`>${a}<`,`>${b}<`)
s=s.replace(/Monitor check-in,\s+check-out, daily worked\s+time, and workers\s+approaching or exceeding\s+their allowed hours\./g,'{t.description}')
s=s.replace("{refreshing\n              ? 'Refreshing...'\n              : 'Refresh'}","{refreshing ? t.refreshing : t.refresh}")
s=s.replace(/No active workers are\s+assigned to this project\./g,'{t.noAssignments}')
s=s.replace("? 'Checking Out...'\n                                : 'Check Out'","? t.checkingOut\n                                : t.checkOut")
s=s.replace("? 'Checking In...'\n                                : 'Check In'","? t.checkingIn\n                                : t.checkIn")
// Info fields and locale-aware current date.
s=s.replaceAll('label="Attendance Date"','label={t.attendanceDate}').replaceAll('label="Standard Daily Hours"','label={t.standardDailyHours}').replaceAll('label="Attendance Geofence"','label={t.attendanceGeofence}').replaceAll('label="Maximum GPS Accuracy"','label={t.maximumGpsAccuracy}')
s=s.replace("value={new Intl.DateTimeFormat(\n            undefined,\n            {\n              dateStyle: 'medium',\n            }\n          ).format(new Date())}","value={formatAttendanceDate(new Date(), locale)}")
s=s.replaceAll("? 'Not configured'",'? t.notConfiguredLower').replaceAll(": 'Enabled'",': t.enabled').replaceAll(": 'Disabled'",': t.disabled')
s=s.replace(/\? `Enabled · \$\{selectedProject\.geofence_radius_m\} m`/g,'? t.enabledRadius(selectedProject.geofence_radius_m)')
// Guards.
if(!s.includes('getWorkforceAttendanceCopy(locale)'))throw new Error('Attendance catalog wiring missing')
if(!s.includes('loadOrganizationLocale'))throw new Error('Attendance locale loader missing')
if(!s.includes('formatAttendanceDate(new Date(), locale)'))throw new Error('Attendance date localization missing')
for(const x of ['>Supervisor Attendance<','>Loading Attendance...<','>Over Allowed Hours<'])if(s.includes(x))throw new Error(`Attendance literal remains: ${x}`)
fs.writeFileSync(path,s)
console.log(`Wired Attendance Core locale and supervisor workflow: ${path}`)
