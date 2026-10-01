import fs from 'node:fs'
const path='src/app/dashboard/field-management/workforce/attendance/audit/page.js'
let s=fs.readFileSync(path,'utf8')
function req(a,b){if(!s.includes(a))throw new Error(`Audit fragment missing: ${a.slice(0,120)}`);s=s.replace(a,b)}
req("import { createClient } from '../../../../../../lib/supabase/client'", "import { createClient } from '../../../../../../lib/supabase/client'\nimport { getAttendanceAuditCopy, getAttendanceAuditEventLabel, getAttendanceAuditResolutionLabel, formatAttendanceAuditDateTime, formatAttendanceAuditMetadataValue, humanizeAuditValue } from '../../../../../../i18n/workforceAttendanceAudit'")
req('export default function AttendanceAuditPage() {',"export default function AttendanceAuditPage() {\n  const [locale,setLocale]=useState('en-US')\n  const t=useMemo(()=>getAttendanceAuditCopy(locale),[locale])")
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
      }catch(error){console.warn('Attendance Audit locale fallback to en-US.',error)}
    }
    loadOrganizationLocale()
    return()=>{active=false}
  },[])`)
s=s.replace(/function formatDateTime\(value\) \{[\s\S]*?\n\}/,"function formatDateTime(value,locale='en-US'){return formatAttendanceAuditDateTime(value,locale)}")
s=s.replace(/function formatMethod\(value\) \{[\s\S]*?\n\}/,"function formatMethod(value){return value ? humanizeAuditValue(value) : '—'}")
s=s.replace(/function formatResolutionAction\(value\) \{[\s\S]*?\n\}/,"function formatResolutionAction(value,locale='en-US'){return value ? getAttendanceAuditResolutionLabel(value,locale) : null}")
s=s.replace(/function getEventPresentation\(event\) \{[\s\S]*?\n\}/,`function getEventPresentation(event,locale='en-US'){
  const auditAction=getAuditAction(event)
  return {label:getAttendanceAuditEventLabel(event,locale),tone:auditAction==='exception_reviewed'?'review':auditAction==='exception_resolved'?'resolution':event?.event_type||'default'}
}`)
s=s.replace(/function renderMetadataValue\(value\) \{[\s\S]*?\n\}/,"function renderMetadataValue(value,locale='en-US'){return formatAttendanceAuditMetadataValue(value,locale)}")
s=s.replaceAll("'Unknown user'",'t.unknownUser').replaceAll("'Unable to load attendance audit trail.'",'t.unableLoad').replaceAll("'Unable to initialize Attendance Audit Trail.'",'t.unableInitialize')
const pairs=[['Field Management','{t.fieldManagement}'],['Attendance Audit Trail','{t.title}'],['No projects available','{t.noProjects}'],['All Events','{t.allEvents}'],['Check-In','{t.checkIn}'],['Check-Out','{t.checkOut}'],['Manual Adjustment','{t.manualAdjustment}'],['Exception Reviewed','{t.exceptionReviewed}'],['Exception Resolved','{t.exceptionResolved}'],['Session Cancelled','{t.sessionCancelled}'],['Audit Events','{t.auditEvents}'],['Time','{t.time}'],['Field ID','{t.fieldId}'],['Worker','{t.worker}'],['Recorded By','{t.recordedBy}'],['Method','{t.method}'],['Source','{t.source}'],['Notes','{t.notes}'],['Details','{t.details}']]
for(const [a,b] of pairs)s=s.replaceAll(`>${a}<`,`>${b}<`)
s=s.replace(/Review original attendance\s+events, supervisor corrections,\s+exception reviews, and final\s+resolution decisions in one\s+immutable timeline\./g,'{t.description}')
s=s.replace("{refreshing\n              ? 'Refreshing...'\n              : 'Refresh'}","{refreshing ? t.refreshing : t.refresh}")
s=s.replaceAll('label="Project"','label={t.project}').replaceAll('label="Work Date"','label={t.workDate}').replaceAll('label="Event"','label={t.event}')
s=s.replaceAll('label="Total Events"','label={t.totalEvents}').replaceAll('label="Check-Ins"','label={t.checkIns}').replaceAll('label="Check-Outs"','label={t.checkOuts}').replaceAll('label="Corrections"','label={t.corrections}').replaceAll('label="Exception Decisions"','label={t.exceptionDecisions}')
s=s.replace(/Loading Audit Trail\.\.\./g,'{t.loading}').replace(/No attendance events\s+were found for the\s+selected filters\./g,'{t.noEvents}')
s=s.replace('onToggle={() =>\n                          toggleEvent(\n                            event.id\n                          )\n                        }','onToggle={() =>\n                          toggleEvent(\n                            event.id\n                          )\n                        }\n                        locale={locale}\n                        t={t}')
s=s.replace('function AuditRows({\n  event,\n  worker,\n  actor,\n  isExpanded,\n  onToggle,\n})','function AuditRows({\n  event,\n  worker,\n  actor,\n  isExpanded,\n  onToggle,\n  locale,\n  t,\n})')
s=s.replace('getEventPresentation(\n      event\n    )','getEventPresentation(\n      event, locale\n    )').replace('formatDateTime(\n            event.event_at\n          )','formatDateTime(\n            event.event_at, locale\n          )')
s=s.replace("? 'Hide Details'\n              : 'View Details'","? t.hideDetails\n              : t.viewDetails")
s=s.replace('actor={actor}\n            recordedBy={\n              event.recorded_by\n            }','actor={actor}\n            recordedBy={\n              event.recorded_by\n            }\n            t={t}')
s=s.replace('event={event}\n              actor={actor}\n            />','event={event}\n              actor={actor}\n              locale={locale}\n              t={t}\n            />')
s=s.replace('function ActorIdentity({\n  actor,\n  recordedBy,\n})','function ActorIdentity({\n  actor,\n  recordedBy,\n  t,\n})').replaceAll('System / Unknown','{t.systemUnknown}').replaceAll('Unknown user','{t.unknownUser}').replaceAll('Identity unavailable','{t.identityUnavailable}')
s=s.replace('function EventDetails({\n  event,\n  actor,\n})','function EventDetails({\n  event,\n  actor,\n  locale,\n  t,\n})')
s=s.replaceAll('title="Before"','title={t.before}').replaceAll('title="After"','title={t.after}').replaceAll('>Correction Reason<','>{t.correctionReason}<')
s=s.replace('event={event}\n        actor={actor}\n        before={before}\n        after={after}','event={event}\n        actor={actor}\n        before={before}\n        after={after}\n        locale={locale}\n        t={t}')
s=s.replace('event={event}\n          actor={actor}\n        />','event={event}\n          actor={actor}\n          locale={locale}\n          t={t}\n        />')
s=s.replace('event={event}\n            />','event={event}\n              locale={locale}\n              t={t}\n            />')
s=s.replace('function ExceptionAuditDetails({\n  event,\n  actor,\n  before,\n  after,\n})','function ExceptionAuditDetails({\n  event,\n  actor,\n  before,\n  after,\n  locale,\n  t,\n})').replace('formatResolutionAction(\n      event.metadata\n        ?.resolution_action\n    )','formatResolutionAction(\n      event.metadata\n        ?.resolution_action, locale\n    )')
s=s.replace("? 'Exception Review'\n                : 'Exception Resolution'","? t.exceptionReview\n                : t.exceptionResolution").replaceAll('label="Exception Code"','label={t.exceptionCode}').replaceAll('label="Decision"','label={t.decision}').replaceAll('label="Exception Notes"','label={t.exceptionNotes}').replaceAll('label="Action Notes"','label={t.actionNotes}').replace("? 'Under Review'",'? t.underReview')
s=s.replace('function AccountabilityPanel({\n  event,\n  actor,\n})','function AccountabilityPanel({\n  event,\n  actor,\n  locale,\n  t,\n})')
s=s.replaceAll('label="Distance to Project"','label={t.distanceToProject}').replaceAll('label="GPS Accuracy"','label={t.gpsAccuracy}').replaceAll('label="Coordinates"','label={t.coordinates}')
s=s.replace('function ResolutionStatePanel({\n  title,\n  data,\n  tone = \'before\',\n})','function ResolutionStatePanel({\n  title,\n  data,\n  tone = \'before\',\n  locale = \'en-US\',\n  t = getAttendanceAuditCopy(locale),\n})').replaceAll('>No values available.<','>{t.noValues}<').replaceAll('label="Resolution Status"','label={t.resolutionStatus}').replaceAll('label="Resolution Action"','label={t.resolutionAction}').replaceAll('label="Resolution Notes"','label={t.resolutionNotes}').replaceAll('label="Resolved At"','label={t.resolvedAt}')
s=s.replaceAll('renderMetadataValue(\n              data.resolution_status\n            )','renderMetadataValue(\n              data.resolution_status, locale\n            )').replaceAll('renderMetadataValue(\n              data.resolution_notes\n            )','renderMetadataValue(\n              data.resolution_notes, locale\n            )').replaceAll('renderMetadataValue(\n              data.resolved_at\n            )','renderMetadataValue(\n              data.resolved_at, locale\n            )').replace('formatResolutionAction(\n                data.resolution_action\n              )','formatResolutionAction(\n                data.resolution_action, locale\n              )')
s=s.replace('function AuditPanel({\n  title,\n  data,\n  tone = \'before\',\n})','function AuditPanel({\n  title,\n  data,\n  tone = \'before\',\n  locale = \'en-US\',\n  t = getAttendanceAuditCopy(locale),\n})').replaceAll('label="Worked Minutes"','label={t.workedMinutes}').replaceAll('label="Status"','label={t.status}')
s=s.replaceAll('formatDateTime(\n              data.check_in_at\n            )','formatDateTime(\n              data.check_in_at, locale\n            )').replaceAll('formatDateTime(\n              data.check_out_at\n            )','formatDateTime(\n              data.check_out_at, locale\n            )')
if(!s.includes('getAttendanceAuditCopy(locale)'))throw new Error('Audit catalog wiring missing')
if(!s.includes('loadOrganizationLocale'))throw new Error('Audit locale loader missing')
if(!s.includes('getAttendanceAuditEventLabel(event,locale)'))throw new Error('Audit event taxonomy localization missing')
for(const x of ['>Attendance Audit Trail<','>All Events<','Loading Audit Trail...','System / Unknown','>View Details<'])if(s.includes(x))throw new Error(`Audit runtime literal remains: ${x}`)
fs.writeFileSync(path,s)
console.log(`Wired Attendance Audit Trail locale, taxonomy, filters and detail workflow: ${path}`)
