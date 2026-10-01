import fs from 'node:fs'

const path='src/app/dashboard/planning/weekly-planning/page.js'
let source=fs.readFileSync(path,'utf8')
function required(from,to){if(!source.includes(from))throw new Error(`Expected fragment not found: ${from.slice(0,100)}`);source=source.replace(from,to)}

required("import { supabase } from '../../../../lib/supabase';", "import { supabase } from '../../../../lib/supabase';\nimport { getWeeklyPlanningCopy, getWeeklyVarianceReasons, getWeeklyMakeReadyCategories } from '../../../../i18n/weeklyPlanning';")
for(const name of ['VARIANCE_REASONS','MAKE_READY_CATEGORIES']){const start=source.indexOf(`const ${name} = [`);if(start<0)throw new Error(`${name} not found`);const end=source.indexOf('\n];',start);if(end<0)throw new Error(`${name} end not found`);source=source.slice(0,start)+source.slice(end+3)}
source=source.replace("function formatDate(value) {","function formatDate(value, locale = 'en-US') {")
source=source.replace("function formatShortDate(value) {","function formatShortDate(value, locale = 'en-US') {")
source=source.replaceAll("    'en-US',\n    {","    locale,\n    {")
required('export default function WeeklyPlanningPage() {',"export default function WeeklyPlanningPage() {\n  const [locale,setLocale]=useState('en-US');\n  const t=useMemo(()=>getWeeklyPlanningCopy(locale),[locale]);\n  const VARIANCE_REASONS=useMemo(()=>getWeeklyVarianceReasons(locale),[locale]);\n  const MAKE_READY_CATEGORIES=useMemo(()=>getWeeklyMakeReadyCategories(locale),[locale]);")
required('  const [\n    projects,\n    setProjects,\n  ] = useState([]);',`  const [
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

const replacements=[
["      'Unexpected error.',",'      t.unexpectedError,'],["          'Select a project first.',",'          t.selectProjectFirst,'],["            'This project does not have an active Lookahead Plan.',",'            t.noActiveLookahead,'],["          'Weekly Plan created.',",'          t.weeklyPlanCreated,'],["          'Activities can only be added while the Weekly Plan is Draft.',",'          t.activitiesDraftOnly,'],["          'Activity description is required.',",'          t.activityDescriptionRequired,'],["          'Select a Work Package.',",'          t.selectWorkPackage,'],["          'Weekly Activity added.',",'          t.weeklyActivityAdded,'],["        'Activity removed from the Weekly Plan.',",'        t.activityRemoved,'],["          'Cancel this Draft Weekly Plan? The week will not move forward and its draft activities will be cancelled. This action cannot be used after commitment.',",'          t.cancelDraftConfirm,'],["          'Draft Weekly Plan cancelled. You can create a new Weekly Plan for this week.',",'          t.draftCancelled,'],["          'Add at least one Make Ready activity before committing the week.',",'          t.makeReadyRequired,'],["          'Commit this Weekly Plan? RitsuFlow will revalidate Make Ready before freezing the commitment baseline used for PPC.',",'          t.commitConfirm,'],["          'Weekly Plan committed. Make Ready was validated and the PPC baseline is now frozen.',",'          t.weeklyPlanCommitted,'],["          'This commitment cannot be marked Completed because Actual Qty. is lower than Planned Qty. Mark it as Missed and record the Reason for Variance.',",'          t.completedQuantityError,'],["          'Reason for Variance is required for a missed commitment.',",'          t.varianceRequired,'],["          'Missed commitment recorded with its Reason for Variance.',",'          t.missedRecorded,'],["          'Weekly execution information updated. PPC and Reasons for Variance were recalculated.',",'          t.executionUpdated,'],
['>Final PPC<','>{t.finalPpc}<'],['>Live PPC<','>{t.livePpc}<'],['>Available after commitment<','>{t.availableAfterCommitment}<'],['>Completed<','>{t.completed}<'],['>Missed<','>{t.missed}<'],['>Pending<','>{t.pending}<'],['>Unplanned<','>{t.unplanned}<'],['>Excluded from PPC<','>{t.excludedFromPpc}<'],['>PPC Target<','>{t.ppcTarget}<'],['>Previous Week PPC<','>{t.previousWeekPpc}<'],['>Change vs Previous<','>{t.changeVsPrevious}<'],['>Rolling 4-Week PPC<','>{t.rolling4WeekPpc}<'],['>Create Weekly Plan<','>{t.createWeeklyPlan}<'],['>Weekly Commitments<','>{t.weeklyCommitments}<'],['>Edit Results<','>{t.editResults}<'],['>Cancel Changes<','>{t.cancelChanges}<'],['>Save Changes<','>{t.saveChanges}<'],['>Type<','>{t.type}<'],['>Work Package<','>{t.workPackage}<'],['>Activity<','>{t.activity}<'],['>Location<','>{t.location}<'],['>Week<','>{t.week}<'],['>Responsible<','>{t.responsible}<'],['>Planned Qty.<','>{t.plannedQty}<'],['>Actual Qty.<','>{t.actualQty}<'],['>Unit<','>{t.unit}<'],['>Commitment<','>{t.commitment}<'],['>Result<','>{t.result}<'],['>Variance<','>{t.variance}<'],['>Actions<','>{t.actions}<'],['>READY TO COMMIT<','>{t.readyToCommit}<'],['>NOT READY TO COMMIT<','>{t.notReadyToCommit}<'],['>Outstanding Make Ready conditions:<','>{t.outstandingConditions}<'],['>Cancel<','>{t.cancel}<'],['>Add Activity<','>{t.addActivity}<'],['>Add Unplanned Work<','>{t.addUnplannedWork}<']]
for(const [from,to] of replacements)source=source.replaceAll(from,to)
source=source.replace('`Week ${weekInfo.week} · ${weekInfo.year}`','t.weekName(weekInfo.week, weekInfo.year)')
source=source.replace(/`Remove \\\"\$\{item\.activity_description\}\\\" from this Weekly Plan\?`/g,'t.removeActivityConfirm(item.activity_description)')
source=source.replace(/`"\$\{item\.activity_description\}" marked Completed\.`/g,'t.markedCompleted(item.activity_description)')
source=source.replace(/`"\$\{item\.activity_description\}" cannot be Completed because Actual Qty\. is lower than Planned Qty\. Select Missed and record the Reason for Variance\.`/g,'t.itemCompletedQuantityError(item.activity_description)')
source=source.replace(/`Reason for Variance is required for "\$\{item\.activity_description\}"\.`/g,'t.itemVarianceRequired(item.activity_description)')
source=source.replace(/`No Weekly Plan for Week \$\{weekInfo\.week\}`/g,'t.noWeeklyPlan(weekInfo.week)')
source=source.replace(/`\$\{makeReadySummary\.readyCount\} of 7 Make Ready conditions satisfied\.`/g,'t.conditionsSatisfied(makeReadySummary.readyCount)')
source=source.replace(/`\$\{makeReadySummary\.readyCount\} of 7 Make Ready conditions satisfied\. This Work Package can move to Weekly Planning\.`/g,'t.readyConditionsSatisfied(makeReadySummary.readyCount)')
source=source.replaceAll('placeholder="Example: Install drywall"','placeholder={t.activityExample}')
source=source.replaceAll('placeholder="Example: LEVEL 1 ZONE 1"','placeholder={t.locationExample}')
source=source.replaceAll('placeholder="Responsible person or crew"','placeholder={t.responsiblePersonCrew}')
source=source.replaceAll('placeholder="Describe the unplanned activity"','placeholder={t.describeUnplanned}')
source=source.replaceAll('formatDate(', 'formatDate(').replaceAll('formatShortDate(', 'formatShortDate(')

if(source.includes('const VARIANCE_REASONS = ['))throw new Error('Static variance reasons remain')
if(source.includes('const MAKE_READY_CATEGORIES = ['))throw new Error('Static Make Ready categories remain')
if(!source.includes('loadOrganizationLocale'))throw new Error('Locale loader missing')
if(!source.includes('getWeeklyVarianceReasons(locale)'))throw new Error('Variance localization missing')
if(!source.includes('getWeeklyMakeReadyCategories(locale)'))throw new Error('Make Ready localization missing')
for(const literal of ['Weekly Activity added.','Cancel this Draft Weekly Plan?','Weekly Plan committed. Make Ready was validated','Weekly execution information updated. PPC','>Final PPC<','>Weekly Commitments<','>READY TO COMMIT<','>Add Unplanned Work<'])if(source.includes(literal))throw new Error(`Weekly runtime literal remains: ${literal}`)
fs.writeFileSync(path,source)
console.log(`Wired Weekly Planning final UI and workflow translations: ${path}`)
