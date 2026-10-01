import fs from 'node:fs'

const file='src/app/fieldop/workforce/page.js'
let s=fs.readFileSync(file,'utf8')
const req=(a,b)=>{if(!s.includes(a))throw new Error(`FieldOp Workforce fragment missing: ${a.slice(0,120)}`);s=s.replace(a,b)}

if(!s.includes("useLanguage } from '../../../contexts/LanguageContext'")){
  req("import { supabase } from '../../../lib/supabase'", "import { supabase } from '../../../lib/supabase'\nimport { useLanguage } from '../../../contexts/LanguageContext'\nimport { getFieldopWorkforceMessages } from '../../../i18n/fieldopWorkforce'")
  req("export default function FieldOpWorkforcePage(){", "export default function FieldOpWorkforcePage(){\n  const {locale}=useLanguage()\n  const copy=getFieldopWorkforceMessages(locale)\n  const s=copy.shell")
}

const js=[
["setError('Live attendance could not be loaded.')","setError(s.errorLive)"],["setRegistryError('Unable to determine the active organization for FieldOp Workforce.')","setRegistryError(s.errorOrganization)"],["setRegistryError(e?.message||'Unable to load the workforce registry.')","setRegistryError(e?.message||s.errorRegistry)"],["setAssignmentError(e?.message||'Unable to load project assignments.')","setAssignmentError(e?.message||s.errorAssignments)"],
["setFormError('The active organization could not be determined.')","setFormError(s.errorOrganization)"],["setFormError('First Name is required.')","setFormError(s.errorFirstName)"],["setFormError('Last Name is required.')","setFormError(s.errorLastName)"],["setFormError('Company is required.')","setFormError(s.errorCompany)"],["setFormError('Trade is required.')","setFormError(s.errorTrade)"],["setFormError('Role is required.')","setFormError(s.errorRole)"],["setFormError(err?.message||'Unable to register the worker.')","setFormError(err?.message||s.errorRegister)"],
["setFormError('Worker is required.')","setFormError(s.errorWorker)"],["setFormError('Project is required.')","setFormError(s.errorProject)"],["setFormError('Start Date is required.')","setFormError(s.errorStartDate)"],["setFormError('End Date cannot be earlier than Start Date.')","setFormError(s.errorDateOrder)"],["setFormError('Unable to determine the selected Worker or Project.')","setFormError(s.errorSelection)"],["setFormError('Worker and Project must belong to the same organization.')","setFormError(s.errorOrganizationMismatch)"],["setFormError('This worker already has an active or scheduled assignment for the selected project.')","setFormError(s.errorDuplicateAssignment)"],["setFormError(err?.message||'Unable to create the project assignment.')","setFormError(err?.message||s.errorCreateAssignment)"],
["new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'})","new Intl.DateTimeFormat(locale,{hour:'2-digit',minute:'2-digit'})"],
["function formatDate(v){if(!v)return '—';const [y,m,d]=v.split('-');return `${m}/${d}/${y}`}","function formatDate(v){if(!v)return '—';const [y,m,d]=v.split('-');return new Intl.DateTimeFormat(locale).format(new Date(Number(y),Number(m)-1,Number(d)))}"]
]
for(const [a,b] of js) if(s.includes(a)) s=s.replaceAll(a,b)

const text={
'FIELD OPERATIONS':'fieldOperations','Workspaces':'workspaces','Search workforce...':'search','Operations Manager':'managerRole','FIELDOP / WORKFORCE':'breadcrumb','People, assignments and live field presence in one operational workspace.':'subtitle','+ Add Worker':'addWorker','+ New Assignment':'newAssignment','Workers On Site':'workersOnSite','live attendance':'liveAttendance','Projects With Presence':'projectsWithPresence','active now':'activeNow','Active Locations':'activeLocations','field locations':'fieldLocations','Long Open Sessions':'longOpenSessions','over 10 hours':'overTenHours','Who is currently checked in across FieldOp projects.':'liveSubtitle','on site':'onSite','Loading live attendance...':'loadingLive','No workers are currently checked in.':'noLive','Live attendance will appear here when field check-ins begin.':'noLiveHelp','Work Package':'workPackage','Check-In':'checkIn','Hours On Site':'hoursOnSite','On Site':'onSiteStatus','Total Workers':'totalWorkers','organization registry':'organizationRegistry','available workforce':'availableWorkforce','Inactive':'inactive','inactive records':'inactiveRecords','Companies':'companies','active companies':'activeCompanies','Canonical organization workforce used by FieldOp projects and attendance.':'registrySubtitle','workers':'workers','Loading workforce...':'loadingWorkforce','No workers registered.':'noWorkers','Field ID':'fieldId','Employee No.':'employeeNo','Total Assignments':'totalAssignments','all records':'allRecords','current assignments':'currentAssignments','Scheduled':'scheduled','future assignments':'futureAssignments','Ended':'ended','completed assignments':'completedAssignments','Allocate workers to projects while preserving company, trade, role and crew context.':'assignmentsSubtitle','assignments':'assignments','Loading project assignments...':'loadingAssignments','No project assignments found.':'noAssignments','Trade / Role':'tradeRole','Crew':'crew','Dates':'dates','Open ended':'openEnded','FIELD EXECUTION FLOW':'flowTitle','LOCATION':'flowLocation','PEOPLE':'flowPeople','EXECUTION':'flowExecution','DAILY REPORT':'flowDailyReport','Add Worker':'addWorkerTitle','Create a worker directly in the canonical FieldOp registry.':'addWorkerHelp','Company Employee Number':'companyEmployeeNumber','First Name *':'firstName','Middle Name':'middleName','Last Name *':'lastName','Select company':'selectCompany','Select trade':'selectTrade','Select role':'selectRole','Cancel':'cancel','Saving...':'saving','Register Worker':'registerWorker','New Project Assignment':'newAssignmentTitle','Assign a worker to a FieldOp project.':'newAssignmentHelp','Worker *':'worker','Project *':'project','Company *':'company','Trade':'trade','Role':'role','Select worker':'selectWorker','Select project':'selectProject','No crew':'noCrew','Start Date *':'startDate','End Date':'endDate','Create Assignment':'createAssignment','Close':'close','Active':'active','Status':'status','Worker':'worker','Project':'project','Location':'location','Company':'company'
}
for(const [literal,key] of Object.entries(text)){
  const escaped=literal.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  s=s.replace(new RegExp(`>${escaped}<`,'g'),`>{s.${key}}<`)
  s=s.replace(new RegExp(`aria-label=\\"${escaped}\\"`,'g'),`aria-label={s.${key}}`)
  s=s.replace(new RegExp(`placeholder=\\"${escaped}\\"`,'g'),`placeholder={s.${key}}`)
}

// Localized navigation labels while keeping routes and active state stable.
req("const nav=[['⌂','Portfolio Overview','/fieldop'],['□','Projects','/fieldop/projects'],['♙','Workforce','/fieldop/workforce'],['⌖','Operations','#'],['△','Occurrences','#'],['▥','Reports','/fieldop/reports/daily'],['⚙','Settings','#']]", "const nav=[['⌂','portfolioOverview','/fieldop'],['□','projects','/fieldop/projects'],['♙','workforce','/fieldop/workforce'],['⌖','operations','#'],['△','occurrences','#'],['▥','reports','/fieldop/reports/daily'],['⚙','settings','#']]")
req("{nav.map(([icon,label,href])=><Link key={label} className={label==='Workforce'?styles.active:''} href={href}><i>{icon}</i>{label}</Link>)}", "{nav.map(([icon,key,href])=><Link key={key} className={key==='workforce'?styles.active:''} href={href}><i>{icon}</i>{s[key]}</Link>)}")

// Keep tab state keys stable; only render localized labels.
req("{tabs.map(tab=><button key={tab} className={activeTab===tab?styles.tabActive:''} onClick={()=>setActiveTab(tab)}>{tab}</button>)}", "{tabs.map(tab=><button key={tab} className={activeTab===tab?styles.tabActive:''} onClick={()=>setActiveTab(tab)}>{copy.tabs[{ 'Live Attendance':'liveAttendance','Worker Registry':'workerRegistry','Project Assignments':'projectAssignments','Timecards':'timecards','Audit Trail':'auditTrail' }[tab]]}</button>)}")

// Remaining dynamic/localized fragments.
s=s.replaceAll("{w.status==='active'?'Active':'Inactive'}","{w.status==='active'?s.active:s.inactive}")
s=s.replaceAll("{a.status?.charAt(0).toUpperCase()+a.status?.slice(1)||'—'}","{a.status==='active'?s.active:a.status==='scheduled'?s.scheduled:a.status==='ended'?s.ended:'—'}")
s=s.replaceAll("`to ${formatDate(a.end_date)}`","`${s.to} ${formatDate(a.end_date)}`")
s=s.replaceAll("'Open ended'","s.openEnded")
s=s.replaceAll("{saving?'Saving...':'Register Worker'}","{saving?s.saving:s.registerWorker}")
s=s.replaceAll("{saving?'Saving...':'Create Assignment'}","{saving?s.saving:s.createAssignment}")

fs.writeFileSync(file,s)
console.log(`Wired native FieldOp Workforce shell locale: ${file}`)
