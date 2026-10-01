import fs from 'node:fs'

const path='src/app/dashboard/field-management/workforce/page.js'
let source=fs.readFileSync(path,'utf8')
function required(from,to){if(!source.includes(from))throw new Error(`Expected Workforce fragment not found: ${from.slice(0,100)}`);source=source.replace(from,to)}
function escapeRegex(value){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function replaceJsxText(literal,expr){source=source.replace(new RegExp(`>\\s*${escapeRegex(literal)}\\s*<`,'g'),`>\n                  ${expr}\n                <`)}

required("import { supabase } from '../../../../lib/supabase'", "import { supabase } from '../../../../lib/supabase'\nimport { getWorkforceCopy, getWorkforceStatusLabel } from '../../../../i18n/workforce'")
required('export default function WorkforcePage() {',"export default function WorkforcePage() {\n  const [locale,setLocale]=useState('en-US')\n  const t=useMemo(()=>getWorkforceCopy(locale),[locale])")
required("  const [organizationId, setOrganizationId] =\n    useState(null)",`  const [organizationId, setOrganizationId] =
    useState(null)

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
        console.warn('Workforce locale fallback to en-US.', error)
      }
    }
    loadOrganizationLocale()
    return () => { active = false }
  }, [])`)

const pairs=[['Unable to determine the active organization for Field Management.','t.unableDetermineOrganization'],['Unable to load the workforce registry.','t.unableLoadRegistry'],['The active organization could not be determined.','t.activeOrganizationMissing'],['First Name is required.','t.firstNameRequired'],['Last Name is required.','t.lastNameRequired'],['Company is required.','t.companyRequired'],['Trade is required.','t.tradeRequired'],['Role is required.','t.roleRequired'],['Unable to register the worker.','t.unableRegisterWorker']]
for(const [literal,expr] of pairs)source=source.replaceAll(`'${literal}'`,expr)
source=source.replace('`Worker registered successfully. Field ID: ${data.field_id}`','t.workerRegistered(data.field_id)')
source=source.replace(/  function formatStatus\(status\) \{[\s\S]*?\n  \}\n\n  function openAddWorker/,"  function formatStatus(status) {\n    return getWorkforceStatusLabel(status, locale)\n  }\n\n  function openAddWorker")

const jsx=[['Field Management','{t.fieldManagement}'],['Workforce Registry','{t.title}'],['+ Add Worker','{t.addWorker}'],['Total Workers','{t.totalWorkers}'],['Loading workforce...','{t.loadingWorkforce}'],['No workers registered','{t.noWorkers}'],['Field ID','{t.fieldId}'],['Employee No.','{t.employeeNumber}'],['Worker','{t.worker}'],['Company','{t.company}'],['Trade','{t.trade}'],['Role','{t.role}'],['Status','{t.status}'],['Add Worker','{t.addWorkerTitle}'],['Identity','{t.identity}'],['Employment','{t.employment}'],['Company Employee Number','{t.companyEmployeeNumber}'],['First Name','{t.firstName}'],['Middle Name','{t.middleName}'],['Last Name','{t.lastName}'],['Cancel','{t.cancel}'],['Saving...','{t.saving}'],['Register Worker','{t.registerWorker}']]
for(const [literal,expr] of jsx)replaceJsxText(literal,expr)
source=source.replaceAll('label="Total Workers"','label={t.totalWorkers}').replaceAll('label="Active"','label={t.active}').replaceAll('label="Inactive"','label={t.inactive}')
source=source.replace(/Manage the master worker\s+records available for project\s+assignments, attendance and\s+workforce reporting\./g,'{t.description}')
source=source.replace(/Add the first worker\s+to start the Field\s+Management registry\./g,'{t.noWorkersHelp}')
source=source.replaceAll('aria-label="Close"','aria-label={t.close}')
source=source.replace(/>\s*Select company\s*</g,'>{t.selectCompany}<').replace(/>\s*Select trade\s*</g,'>{t.selectTrade}<').replace(/>\s*Select role\s*</g,'>{t.selectRole}<')

if(!source.includes('getWorkforceCopy(locale)'))throw new Error('Workforce catalog wiring missing')
if(!source.includes('loadOrganizationLocale'))throw new Error('Workforce locale loader missing')
if(!source.includes('getWorkforceStatusLabel(status, locale)'))throw new Error('Workforce status localization missing')
for(const literal of [/?>\s*Workforce Registry\s*</,/>\s*\+ Add Worker\s*</,/>\s*Loading workforce\.\.\.\s*</,/>\s*No workers registered\s*</,/>\s*Cancel\s*</,/aria-label="Close"/])if(literal.test(source))throw new Error(`Workforce runtime literal remains: ${literal}`)
fs.writeFileSync(path,source)
console.log(`Wired Workforce Core registry and Add Worker translations: ${path}`)
