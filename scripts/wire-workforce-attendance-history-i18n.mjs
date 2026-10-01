import fs from 'node:fs'
const path='src/app/dashboard/field-management/workforce/attendance/history/page.js'
let s=fs.readFileSync(path,'utf8')
function req(a,b){if(!s.includes(a))throw new Error(`History fragment missing: ${a.slice(0,100)}`);s=s.replace(a,b)}
req("import { createClient } from '../../../../../../lib/supabase/client'", "import { createClient } from '../../../../../../lib/supabase/client'\nimport { getAttendanceHistoryCopy, getAttendanceTimecardStatusLabel, getAttendanceSessionStatusLabel, formatAttendanceHistoryTime, formatAttendanceHistoryDateTime } from '../../../../../../i18n/workforceAttendanceHistory'")
req('export default function AttendanceHistoryPage() {',"export default function AttendanceHistoryPage() {\n  const [locale,setLocale]=useState('en-US')\n  const t=useMemo(()=>getAttendanceHistoryCopy(locale),[locale])")
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
      }catch(error){console.warn('Attendance History locale fallback to en-US.',error)}
    }
    loadOrganizationLocale()
    return()=>{active=false}
  },[])`)
req(`function formatTime(value) {
  if (!value) {
    return '—'
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      hour: '2-digit',
      minute: '2-digit',
    }
  ).format(new Date(value))
}`,"function formatTime(value, locale) { return formatAttendanceHistoryTime(value, locale) }")
req(`function formatDateTime(value) {
  if (!value) {
    return '—'
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    }
  ).format(new Date(value))
}`,"function formatDateTime(value, locale) { return formatAttendanceHistoryDateTime(value, locale) }")
req(`function getTimecardStatus({
  hasOpenSession,
  totalWorkedMinutes,
  allowedMinutes,
}) {
  if (hasOpenSession) {
    return {
      key: 'open',
      label: 'Open Session',
    }
  }

  if (
    allowedMinutes === null ||
    allowedMinutes === undefined
  ) {
    return {
      key: 'not_configured',
      label: 'Not Configured',
    }
  }

  if (
    totalWorkedMinutes >
    allowedMinutes
  ) {
    return {
      key: 'over',
      label: 'Over Allowed',
    }
  }

  return {
    key: 'normal',
    label: 'Within Allowance',
  }
}`,`function getTimecardStatus({hasOpenSession,totalWorkedMinutes,allowedMinutes,locale}) {
  if(hasOpenSession)return {key:'open',label:getAttendanceTimecardStatusLabel('open',locale)}
  if(allowedMinutes===null||allowedMinutes===undefined)return {key:'not_configured',label:getAttendanceTimecardStatusLabel('not_configured',locale)}
  if(totalWorkedMinutes>allowedMinutes)return {key:'over',label:getAttendanceTimecardStatusLabel('over',locale)}
  return {key:'normal',label:getAttendanceTimecardStatusLabel('normal',locale)}
}`)
req(`                allowedMinutes:
                  allowedMinutes ===
                  null
                    ? null
                    : Number(
                        allowedMinutes
                      ),
              })`,`                allowedMinutes:
                  allowedMinutes ===
                  null
                    ? null
                    : Number(
                        allowedMinutes
                      ),
                locale,
              })`)
s=s.replace(`      selectedProject,
    ])`,`      selectedProject,
      locale,
    ])`)
s=s.replaceAll("'Unable to load attendance history.'",'t.unableLoad').replaceAll("'Unable to initialize Attendance History.'",'t.unableInitialize').replaceAll("'Unable to correct the attendance session.'",'t.unableCorrect')
s=s.replaceAll("'Please enter a correction reason.'",'t.correctionReasonRequired').replaceAll("'Check-In time is required.'",'t.correctionCheckInRequired').replaceAll("'Check-Out cannot occur before Check-In.'",'t.checkOutBeforeCheckIn')
const pairs=[['Field Management','{t.fieldManagement}'],['Attendance History','{t.title}'],['No projects available','{t.noProjects}'],['Workers With Attendance','{t.workersWithAttendance}'],['Labor-Hours','{t.laborHours}'],['Over Allowed','{t.overAllowed}'],['Exceptions','{t.exceptions}'],['Daily Timecards','{t.dailyTimecards}'],['Field ID','{t.fieldId}'],['Worker','{t.worker}'],['First In','{t.firstIn}'],['Last Out','{t.lastOut}'],['Sessions','{t.sessions}'],['Worked','{t.worked}'],['Allowed','{t.allowed}'],['Variance','{t.variance}'],['Status','{t.status}'],['Details','{t.details}']]
for(const [a,b] of pairs)s=s.replaceAll(`>${a}<`,`>${b}<`)
s=s.replace(/Review daily\s+timecards, individual\s+attendance sessions,\s+worked time, allowed\s+hours, and audited\s+supervisor corrections\./g,'{t.description}')
s=s.replace("{refreshing\n              ? 'Refreshing...'\n              : 'Refresh'}","{refreshing ? t.refreshing : t.refresh}")
s=s.replaceAll('label="Project"','label={t.project}').replaceAll('label="Work Date"','label={t.workDate}').replaceAll('label="Allowed Today"','label={t.allowedToday}').replaceAll("? 'Not configured'",'? t.notConfiguredLower')
s=s.replace(/Loading Attendance\s+History\.\.\./g,'{t.loading}').replace(/No attendance records\s+were found for this\s+project and date\./g,'{t.noAttendance}')
s=s.replace('onCorrect={\n                          openCorrection\n                        }','onCorrect={\n                          openCorrection\n                        }\n                        locale={locale}\n                        t={t}')
s=s.replace('function TimecardRows({\n  timecard,\n  isExpanded,\n  onToggle,\n  onCorrect,\n})','function TimecardRows({\n  timecard,\n  isExpanded,\n  onToggle,\n  onCorrect,\n  locale,\n  t,\n})')
s=s.replaceAll('formatTime(\n            timecard.firstCheckIn\n          )','formatTime(\n            timecard.firstCheckIn, locale\n          )').replaceAll('formatTime(\n                timecard.lastCheckOut\n              )','formatTime(\n                timecard.lastCheckOut, locale\n              )')
s=s.replace("? 'Open'\n            : formatTime",'? t.sessionStatusOpen\n            : formatTime').replaceAll('Corrected record','{t.correctedRecord}').replace("? 'Hide Sessions'\n              : 'View Sessions'","? t.hideSessions\n              : t.viewSessions")
s=s.replace('onCorrect={\n                onCorrect\n              }','onCorrect={\n                onCorrect\n              }\n              locale={locale}\n              t={t}')
s=s.replace('function SessionDetails({\n  sessions,\n  worker,\n  onCorrect,\n})','function SessionDetails({\n  sessions,\n  worker,\n  onCorrect,\n  locale,\n  t,\n})')
s=s.replace('>\n          Attendance Sessions\n        </div>','>\n          {t.attendanceSessions}\n        </div>').replace(/Corrections create an\s+immutable audit event\./g,'{t.auditImmutable}')
s=s.replaceAll('label="Check-In"','label={t.checkIn}').replaceAll('label="Check-Out"','label={t.checkOut}').replaceAll('label="Worked"','label={t.worked}')
s=s.replaceAll('formatTime(\n                    session.check_in_at\n                  )','formatTime(\n                    session.check_in_at, locale\n                  )').replaceAll('formatTime(\n                          session.check_out_at\n                        )','formatTime(\n                          session.check_out_at, locale\n                        )')
s=s.replace("? 'Open'\n                  }",'? t.sessionStatusOpen\n                  }').replace("? formatMinutes(\n                          session.worked_minutes ||\n                            0\n                        )\n                      : 'In progress'","? formatMinutes(\n                          session.worked_minutes ||\n                            0\n                        )\n                      : t.inProgress")
s=s.replace('status={\n                    session.status\n                  }','status={\n                    session.status\n                  }\n                  locale={locale}').replaceAll('>Correct Session<','>{t.correctSession}<').replaceAll('>Add Check-Out<','>{t.addCheckOut}<')
s=s.replace('onSubmit={\n            handleCorrectionSubmit\n          }','onSubmit={\n            handleCorrectionSubmit\n          }\n          locale={locale}\n          t={t}')
s=s.replace(/function CorrectionModal\(\{([\s\S]*?)onSubmit,\n\}\)/,m=>m.replace('onSubmit,\n})','onSubmit,\n  locale,\n  t,\n})'))
s=s.replaceAll('placeholder="Example: Worker forgot to check out at the end of the shift."','placeholder={t.reasonPlaceholder}').replaceAll('>Cancel<','>{t.cancel}<')
s=s.replace(/The operational\s+timecard will be\s+corrected, but the\s+original Check-In and\s+Check-Out events will\s+remain unchanged\. A new\s+manual adjustment event\s+will record the reason\s+and the before\/after\s+values\./g,'{t.correctionAuditNotice}')
s=s.replace("? 'Saving Correction...'\n                : isOpen\n                  ? 'Add Check-Out'\n                  : 'Save Correction'","? t.savingCorrection\n                : isOpen\n                  ? t.addCheckOut\n                  : t.saveCorrection")
s=s.replace('function SessionStatus({\n  status,\n})','function SessionStatus({\n  status,\n  locale,\n})').replace("label: 'Open'","label: getAttendanceSessionStatusLabel('open',locale)").replace("label: 'Closed'","label: getAttendanceSessionStatusLabel('closed',locale)").replace("label: 'Corrected'","label: getAttendanceSessionStatusLabel('corrected',locale)").replace("label: 'Cancelled'","label: getAttendanceSessionStatusLabel('cancelled',locale)").replace("label: status || 'Unknown'","label: status || getAttendanceHistoryCopy(locale).unknown")
s=s.replace('>\n          Exception recorded\n        </span>','>\n          {getAttendanceHistoryCopy(locale).exceptionRecorded}\n        </span>')
if(!s.includes('getAttendanceHistoryCopy(locale)'))throw new Error('History catalog wiring missing')
if(!s.includes('loadOrganizationLocale'))throw new Error('History locale loader missing')
if(!s.includes("getAttendanceTimecardStatusLabel('open',locale)"))throw new Error('Timecard status localization missing')
for(const x of ['>Attendance History<','>Daily Timecards<','Corrected record','Corrections create an','Saving Correction...','>Add Check-Out<'])if(s.includes(x))throw new Error(`History runtime literal remains: ${x}`)
fs.writeFileSync(path,s)
console.log(`Wired Attendance History UI, sessions and correction workflow: ${path}`)
