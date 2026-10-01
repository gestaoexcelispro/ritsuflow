import fs from 'node:fs'

const path='src/app/dashboard/field-management/workforce/assignments/page.js'
let source=fs.readFileSync(path,'utf8')
function required(from,to){if(!source.includes(from))throw new Error(`Expected Assignments fragment not found: ${from.slice(0,100)}`);source=source.replace(from,to)}

required("import { supabase } from '../../../../../lib/supabase'", "import { supabase } from '../../../../../lib/supabase'\nimport { getWorkforceAssignmentsCopy, getAssignmentStatusLabel, formatAssignmentDate } from '../../../../../i18n/workforceAssignments'")
required('export default function WorkforceAssignmentsPage() {',"export default function WorkforceAssignmentsPage() {\n  const [locale,setLocale]=useState('en-US')\n  const t=useMemo(()=>getWorkforceAssignmentsCopy(locale),[locale])")

const localeAnchor=`  const [formData, setFormData] =
    useState(createInitialFormData())`
required(localeAnchor,`${localeAnchor}

  useEffect(() => {
    let active = true
    async function loadOrganizationLocale() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: membership } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).limit(1).maybeSingle()
        if (!membership?.organization_id) return
        const { data: organization } = await supabase.from('organizations').select('locale').eq('id', membership.organization_id).maybeSingle()
        const nextLocale = organization?.locale
        if (active && ['en-US','pt-BR','es'].includes(nextLocale)) setLocale(nextLocale)
      } catch (error) {
        console.warn('Workforce Assignments locale fallback to en-US.', error)
      }
    }
    loadOrganizationLocale()
    return () => { active = false }
  }, [])`)

source=source.replace(/  function formatDate\(dateValue\) \{[\s\S]*?\n  \}/,"  function formatDate(dateValue) {\n    return formatAssignmentDate(dateValue, locale)\n  }")
source=source.replace(/  function formatStatus\(status\) \{[\s\S]*?\n  \}/,"  function formatStatus(status) {\n    return getAssignmentStatusLabel(status, locale)\n  }")

const messages=[['Worker is required.','t.workerRequired'],['Project is required.','t.projectRequired'],['Company is required.','t.companyRequired'],['Start Date is required.','t.startDateRequired'],['End Date cannot be earlier than Start Date.','t.endBeforeStart'],['Unable to determine the selected Worker or Project.','t.unableDetermineSelection'],['Worker and Project must belong to the same organization.','t.organizationMismatch'],['This worker already has an active or scheduled assignment for the selected project.','t.duplicateAssignment'],['Assignment was created but no identifier was returned.','t.missingIdentifier'],['Project assignment created successfully.','t.created'],['Unable to load project assignments.','t.unableLoad'],['Unable to create the project assignment.','t.unableCreate']]
for(const [literal,expr] of messages)source=source.replaceAll(`'${literal}'`,expr)

const jsx=[['Field Management','{t.fieldManagement}'],['Project Assignments','{t.title}'],['+ New Assignment','{t.newAssignment}'],['Total Assignments','{t.totalAssignments}'],['Assignments','{t.assignments}'],['Loading assignments...','{t.loadingAssignments}'],['No project assignments found','{t.noAssignments}'],['Worker','{t.worker}'],['Project','{t.project}'],['Company','{t.company}'],['Trade','{t.trade}'],['Role','{t.role}'],['Crew','{t.crew}'],['Start Date','{t.startDate}'],['End Date','{t.endDate}'],['Status','{t.status}'],['New Project Assignment','{t.newAssignmentTitle}'],['Cancel','{t.cancel}'],['Saving...','{t.saving}'],['Create Assignment','{t.createAssignment}']]
for(const [literal,expr] of jsx)source=source.replaceAll(`>${literal}<`,`>${expr}<`)
source=source.replaceAll('label="Total Assignments"','label={t.totalAssignments}').replaceAll('label="Active"','label={t.active}').replaceAll('label="Scheduled"','label={t.scheduled}').replaceAll('label="Ended"','label={t.ended}')
source=source.replaceAll('>Select worker<','>{t.selectWorker}<').replaceAll('>Select project<','>{t.selectProject}<').replaceAll('>Select company<','>{t.selectCompany}<').replaceAll('>Select trade<','>{t.selectTrade}<').replaceAll('>Select role<','>{t.selectRole}<').replaceAll('>Select crew<','>{t.selectCrew}<')
source=source.replace(/Allocate workers to projects while preserving company, trade, role and crew context\./g,'{t.description}')

if(!source.includes('getWorkforceAssignmentsCopy(locale)'))throw new Error('Assignments catalog wiring missing')
if(!source.includes('loadOrganizationLocale'))throw new Error('Assignments locale loader missing')
if(!source.includes('formatAssignmentDate(dateValue, locale)'))throw new Error('Assignments locale date formatting missing')
if(!source.includes('getAssignmentStatusLabel(status, locale)'))throw new Error('Assignments status localization missing')
for(const literal of ['>Project Assignments<','>Loading assignments...<','>No project assignments found<','>New Project Assignment<','>Create Assignment<'])if(source.includes(literal))throw new Error(`Assignments runtime literal remains: ${literal}`)
fs.writeFileSync(path,source)
console.log(`Wired Workforce Assignments locale, statuses, dates and form: ${path}`)
