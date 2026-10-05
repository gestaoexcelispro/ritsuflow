'use client'

import { useState } from 'react'
import { pdf, Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { supabase } from '../../../lib/supabase'
import { useT } from '../../../lib/i18n/useT'
import { useLanguage } from '../../../lib/i18n/LanguageProvider'
import { ui } from '../../fieldop/ui'

const num=v=>Number(v||0)
const titleCase=v=>String(v||'—').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
const profileLabel=p=>p?.full_name?.trim()||p?.display_name?.trim()||p?.email?.trim()||''

/** Translation + number/date formatting for the PDF, in the user's language. */
function makeFormat(t,language,numberFormat=language){
 const tr=(key,fallback,vars)=>{const out=t(key,vars);return out===key?fallback:out}
 return{
  t,language,
  money:(v,c='USD')=>{if(v===null||v===undefined||v==='')return '—';try{return new Intl.NumberFormat(numberFormat,{style:'currency',currency:c,maximumFractionDigits:2}).format(num(v))}catch{return String(v)}},
  qty:v=>v===null||v===undefined||v===''?'—':new Intl.NumberFormat(numberFormat,{maximumFractionDigits:2}).format(num(v)),
  date:v=>{if(!v)return'—';const d=new Date(`${String(v).slice(0,10)}T12:00:00`);return Number.isNaN(d.getTime())?String(v):new Intl.DateTimeFormat(language,{month:'short',day:'numeric',year:'numeric'}).format(d)},
  stamp:v=>new Intl.DateTimeFormat(language,{dateStyle:'medium',timeStyle:'short'}).format(v),
  status:v=>tr(`status.${v||'planning'}`,titleCase(v)),
  billing:v=>v?tr(`billing.${v}`,titleCase(v)):'—',
  cycle:v=>v?tr(`cycle.${v}`,titleCase(v)):'—',
  role:v=>tr(`team.role.${v}`,titleCase(v)),
  type:v=>tr(`scope.type.${v}`,titleCase(v)),
  scopeStatus:v=>tr(`scope.status.${v||'defined'}`,titleCase(v||'defined')),
 }
}

export default function ProjectReportButton({project}){
 const t=useT('projects')
 const{language,numberFormat}=useLanguage()
 const[busy,setBusy]=useState(false)
 async function generate(){
  if(!project||busy)return
  setBusy(true)
  try{
   const[{data:memberRows,error:memberError},{data:scopeRows,error:scopeError}]=await Promise.all([
    supabase.from('project_members').select('project_id,user_id,role,joined_at').eq('project_id',project.id).order('joined_at',{ascending:true}),
    supabase.from('project_scopes').select('*').eq('project_id',project.id).order('scope_code').order('created_at')
   ])
   if(memberError)throw memberError;if(scopeError)throw scopeError
   const members=memberRows||[],ids=[...new Set(members.map(x=>x.user_id).filter(Boolean))]
   let profiles=[]
   if(ids.length){const{data,error}=await supabase.from('user_profiles').select('user_id,email,full_name,display_name,job_title,status').in('user_id',ids);if(error)throw error;profiles=data||[]}
   const byId=Object.fromEntries(profiles.map(p=>[p.user_id,p])),team=members.map(m=>({...m,profile:byId[m.user_id]||null}))
   const imageUrl=project.project_image_path?supabase.storage.from('project-images').getPublicUrl(project.project_image_path).data.publicUrl:null
   const logoUrl=`${window.location.origin}/logo.png`,generated=new Date()
   const f=makeFormat(t,language,numberFormat)
   const blob=await pdf(<ProjectReport f={f} project={project} team={team} scopes={scopeRows||[]} imageUrl={imageUrl} logoUrl={logoUrl} generated={generated}/>).toBlob()
   const{data:{user},error:userError}=await supabase.auth.getUser();if(userError||!user)throw userError||new Error(t('report.errUser'))
   const{data:actor}=await supabase.from('user_profiles').select('full_name,display_name,email').eq('user_id',user.id).maybeSingle()
   const fileName=`${t('report.fileName',{id:project.project_id||t('report.project')})}.pdf`
   const{error:historyError}=await supabase.from('project_history').insert({project_id:project.id,action_type:'report_generated',action_label:'Project report generated',description:fileName,entity_type:'report',entity_id:project.project_id||project.id,performed_by:user.id,performed_by_name:profileLabel(actor)||user.email||'RitsuFlow User',metadata:{report_type:'Project Report',file_name:fileName,generated_at:generated.toISOString(),scope_items:(scopeRows||[]).length}});if(historyError)throw historyError
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)
  }catch(e){console.error(e);window.alert(t('report.errGenerate',{message:e?.message||e}))}finally{setBusy(false)}
 }
 return <button type="button" className={ui.btn} onClick={generate} disabled={busy}>{busy?t('report.generating'):t('report.generate')}</button>
}

function scopeModel(rows){const children={};rows.forEach(r=>{const k=r.parent_scope_id||'root';(children[k]||(children[k]=[])).push(r)});const rollup=(id,seen=new Set())=>{if(seen.has(id))return 0;seen.add(id);const kids=children[id]||[];if(kids.length)return kids.reduce((s,k)=>s+rollup(k.id,new Set(seen)),0);const r=rows.find(x=>x.id===id);return num(r?.quantity)*num(r?.unit_price)};const depth=r=>{let d=0,p=r.parent_scope_id,g=0;while(p&&g++<12){d++;p=rows.find(x=>x.id===p)?.parent_scope_id}return d};const flat=[];const walk=k=>(children[k]||[]).forEach(r=>{flat.push({...r,_depth:depth(r),_total:rollup(r.id)});walk(r.id)});walk('root');return{flat,allocated:(children.root||[]).reduce((s,r)=>s+rollup(r.id),0)}}

function ReportHeader({f,logoUrl,title,generated}){return <><View style={s.topbar}><View style={s.brandBlock}><Image src={logoUrl} style={s.logo}/><Text style={s.tagline}>BUILD SMARTER. DELIVER TOGETHER.</Text></View><View style={s.reportHead}><Text style={s.reportTitle}>{title}</Text><Text style={s.generated}>{f.t('report.generatedOn',{date:f.stamp(generated)})}</Text><Text style={s.motto}>PEOPLE   |   PROCESS   |   PROGRESS</Text></View></View><View style={s.rule}/></>}
function Footer({f,p}){return <View style={s.footer} fixed><Text>{p.project_id||f.t('report.project')}  |  {p.name||f.t('report.untitled')}</Text><Text render={({pageNumber,totalPages})=>f.t('report.page',{page:pageNumber,total:totalPages})}/></View>}

function ProjectReport({f,project:p,team,scopes,imageUrl,logoUrl,generated}){
 const{t,money,qty,date}=f
 const currency=p.currency_code||'USD',manager=team.find(m=>m.role==='manager'),managerName=manager?profileLabel(manager.profile)||t('team.noProfile'):'—',criteria=String(p.success_criteria||'').split(/\n|;/).map(x=>x.trim()).filter(Boolean),address1=[p.address_line,p.address_number].filter(Boolean).join(', '),address2=[p.city,p.state_region,p.postal_code].filter(Boolean).join(', '),model=scopeModel(scopes),unallocated=num(p.contract_value)-model.allocated
 const size=f.language==='en-US'?'LETTER':'A4'
 const country=p.country_code?(t(`country.${p.country_code}`)===`country.${p.country_code}`?p.country_code:t(`country.${p.country_code}`)):''
 return <Document title={`${p.project_id||''} ${p.name||t('report.project')} — ${t('report.title')}`} author="RitsuFlow" language={f.language}>
  <Page size={size} style={s.page}>
   <ReportHeader f={f} logoUrl={logoUrl} title={t('report.title')} generated={generated}/>
   <View style={s.hero}><View style={s.heroLeft}><Text style={s.projectId}>{p.project_id||t('report.project').toUpperCase()}</Text><Text style={s.projectName}>{p.name||t('report.untitled')}</Text><Text style={s.projectSub}>{p.client_name||t('report.sharedRecord')}</Text><Card n="1." title={t('report.secInfo')}><Row l={t('form.name')} v={p.name}/><Row l={t('field.projectId')} v={p.project_id}/><Row l={t('field.client')} v={p.client_name}/><Row l={t('field.status')} v={f.status(p.status)}/><Row l={t('field.plannedStart')} v={date(p.planned_start_date)}/><Row l={t('field.plannedFinish')} v={date(p.planned_finish_date)}/><Row l={t('report.manager')} v={managerName}/><Row l={t('field.contractNumber')} v={p.contract_number}/></Card></View><View style={s.heroRight}><Text style={s.status}>{f.status(p.status).toUpperCase()}</Text>{imageUrl?<Image src={imageUrl} style={s.projectImage}/>:<View style={s.imagePlaceholder}><Text>{t('image.title').toUpperCase()}</Text></View>}<View style={s.location}><Text style={s.locationTitle}>{t('report.location')}</Text><Text style={s.addressStrong}>{address1||t('report.noAddress')}</Text><Text>{address2}</Text><Text>{country}</Text></View></View></View>
   <View style={s.twoCol}><Card n="2." title={t('report.secContract')} half><Row l={t('field.contractValue')} v={money(p.contract_value,currency)}/><Row l={t('field.materialValue')} v={p.material_included?money(p.material_value,currency):t('detail.notIncluded')}/><Row l={t('form.billingMethod')} v={f.billing(p.billing_method)}/><Row l={t('form.billingCycle')} v={f.cycle(p.billing_cycle)}/><Row l={t('report.paymentTerms')} v={p.payment_terms_days!=null?t('form.net',{days:p.payment_terms_days}):'—'}/><Row l={t('field.retainage')} v={p.has_retainage?`${p.retainage_percent??'—'}%`:t('detail.no')}/></Card><Card n="3." title={t('report.secSchedule')} half><Row l={t('field.plannedStart')} v={date(p.planned_start_date)}/><Row l={t('field.plannedFinish')} v={date(p.planned_finish_date)}/><Row l={t('field.term')} v={p.contractual_term_days?t('detail.days',{count:p.contractual_term_days}):'—'}/><Row l={t('field.status')} v={f.status(p.status)}/><Row l={t('form.billingCycle')} v={f.cycle(p.billing_cycle)}/></Card></View>
   <View style={s.twoCol}><Card n="4." title={t('report.secSuccess')} half>{criteria.length?criteria.slice(0,5).map((x,i)=><Text key={i} style={s.bullet}>•  {x}</Text>):<Text style={s.empty}>{t('detail.successEmpty')}</Text>}</Card><Card n="5." title={t('report.secTeam')} half>{team.length?team.slice(0,5).map((m,i)=><View key={m.user_id||i} style={s.member}><Text style={s.memberName}>{profileLabel(m.profile)||t('team.noProfile')}</Text><Text>{m.profile?.job_title?`${m.profile.job_title} · `:''}{f.role(m.role)}</Text></View>):<Text style={s.empty}>{t('team.empty')}</Text>}</Card></View>
   <View style={s.scopeSummary}><Text style={s.scopeSummaryTitle}>6. {t('report.secScope')}</Text><View style={s.summaryRow}><Summary l={t('scope.statContract')} v={money(p.contract_value,currency)}/><Summary l={t('scope.statAllocated')} v={money(model.allocated,currency)}/><Summary l={unallocated<0?t('scope.statOver'):t('scope.statRemaining')} v={money(Math.abs(unallocated),currency)}/><Summary l={t('scope.statItems')} v={String(scopes.length)}/></View><Text style={s.scopeHint}>{t('report.scopeNext')}</Text></View>
   <Footer f={f} p={p}/>
  </Page>
  <Page size={size} style={s.page}>
   <ReportHeader f={f} logoUrl={logoUrl} title={t('report.scopeTitle')} generated={generated}/>
   <View style={s.scopeProject}><View><Text style={s.scopeProjectId}>{p.project_id||t('report.project').toUpperCase()} · {p.name||t('report.untitled')}</Text><Text style={s.scopeProjectSub}>{t('report.scopeSub')}</Text></View><View style={s.scopeTotals}><Text>{t('report.allocated',{value:money(model.allocated,currency)})}</Text><Text>{t('report.contract',{value:money(p.contract_value,currency)})}</Text></View></View>
   <View style={s.table}><View style={s.th} fixed><Cell w="8%" t={t('scope.colId')}/><Cell w="32%" t={t('scope.colDescription')}/><Cell w="9%" t={t('scope.colType')}/><Cell w="7%" t={t('scope.colUnit')}/><Cell w="9%" t={t('scope.colQuantity')} right/><Cell w="12%" t={t('scope.colUnitPrice')} right/><Cell w="14%" t={t('scope.colTotal')} right/><Cell w="9%" t={t('scope.colStatus')}/></View>{model.flat.length?model.flat.map(r=><View key={r.id} style={[s.tr,r.item_type==='scope'?s.scopeRow:r.item_type==='group'?s.groupRow:null]} wrap={false}><Cell w="8%" t={r.scope_code||'—'} bold={r.item_type!=='item'}/><View style={[s.cell,{width:'32%',paddingLeft:5+(r._depth*10)}]}><Text style={r.item_type!=='item'?s.bold:null}>{r.scope_name||'—'}</Text></View><Cell w="9%" t={f.type(r.item_type)} bold={r.item_type==='scope'}/><Cell w="7%" t={r.item_type==='item'?(r.unit||'—'):'—'}/><Cell w="9%" t={r.item_type==='item'?qty(r.quantity):'—'} right/><Cell w="12%" t={r.item_type==='item'?money(r.unit_price,currency):'—'} right/><Cell w="14%" t={money(r._total,currency)} right bold/><Cell w="9%" t={f.scopeStatus(r.status)}/></View>):<View style={s.noScope}><Text>{t('report.noScope')}</Text></View>}</View>
   <View style={s.scopeBottom}><View><Text style={s.scopeBottomLabel}>{t('scope.statContract').toUpperCase()}</Text><Text style={s.scopeBottomValue}>{money(p.contract_value,currency)}</Text></View><View><Text style={s.scopeBottomLabel}>{t('scope.statAllocated').toUpperCase()}</Text><Text style={s.scopeBottomValue}>{money(model.allocated,currency)}</Text></View><View><Text style={s.scopeBottomLabel}>{(unallocated<0?t('scope.statOver'):t('scope.statRemaining')).toUpperCase()}</Text><Text style={s.scopeBottomValue}>{money(Math.abs(unallocated),currency)}</Text></View></View>
   <Footer f={f} p={p}/>
  </Page>
 </Document>
}

function Card({n,title,children,half}){return <View style={[s.card,half?s.half:null]} wrap={false}><View style={s.cardHead}><Text style={s.cardTitle}>{n} {title}</Text></View><View style={s.cardBody}>{children}</View></View>}
function Row({l,v}){return <View style={s.dataRow}><Text style={s.dataLabel}>{l}</Text><Text style={s.dataValue}>{v===null||v===undefined||v===''?'—':String(v)}</Text></View>}
function Summary({l,v}){return <View style={s.summary}><Text style={s.summaryLabel}>{l}</Text><Text style={s.summaryValue}>{v}</Text></View>}
function Cell({w,t,right,bold}){return <View style={[s.cell,{width:w},right?s.right:null]}><Text style={bold?s.bold:null}>{t}</Text></View>}

const button={border:'1px solid #b9d0da',background:'#fff',color:'#234f62',borderRadius:8,padding:'10px 14px',fontWeight:800,fontSize:13,whiteSpace:'nowrap',cursor:'pointer'},disabled={opacity:.55,cursor:'not-allowed'},navy='#0b3554',ink='#0a2945',line='#d7e0e7',soft='#f5f8fa'
const s=StyleSheet.create({page:{paddingTop:24,paddingHorizontal:24,paddingBottom:34,fontFamily:'Helvetica',fontSize:7.4,color:ink,backgroundColor:'#fff'},topbar:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},brandBlock:{width:190},logo:{width:126,height:28,objectFit:'contain',objectPosition:'left center'},tagline:{fontSize:5.5,letterSpacing:.8,color:navy,marginTop:2},reportHead:{alignItems:'flex-end'},reportTitle:{fontFamily:'Helvetica-Bold',fontSize:16,color:navy},generated:{fontSize:6.5,color:'#526a7d',marginTop:3},motto:{fontSize:5.5,color:navy,marginTop:6,letterSpacing:.4},rule:{height:1.2,backgroundColor:navy,marginTop:6,marginBottom:10},hero:{flexDirection:'row',gap:9},heroLeft:{width:'52%'},heroRight:{width:'48%',alignItems:'flex-end'},projectId:{fontFamily:'Helvetica-Bold',fontSize:22,color:navy},projectName:{fontFamily:'Helvetica-Bold',fontSize:15,marginTop:3},projectSub:{fontSize:8,color:'#486174',marginTop:3,marginBottom:8},status:{backgroundColor:'#d8f0dc',color:'#21743a',fontFamily:'Helvetica-Bold',fontSize:7,paddingVertical:4,paddingHorizontal:16,borderRadius:4,marginBottom:5},projectImage:{width:'100%',height:139,objectFit:'cover',borderRadius:5},imagePlaceholder:{width:'100%',height:139,backgroundColor:'#e9eff3',alignItems:'center',justifyContent:'center'},location:{width:'100%',marginTop:7,padding:10,backgroundColor:soft,borderWidth:.7,borderColor:line,borderRadius:5},locationTitle:{fontFamily:'Helvetica-Bold',fontSize:6,color:navy,marginBottom:5},addressStrong:{fontFamily:'Helvetica-Bold',marginBottom:2},card:{borderWidth:.7,borderColor:line,borderRadius:5,overflow:'hidden',backgroundColor:'#fbfcfd'},half:{width:'50%'},cardHead:{backgroundColor:navy,paddingVertical:6,paddingHorizontal:8},cardTitle:{fontFamily:'Helvetica-Bold',fontSize:8.5,color:'#fff'},cardBody:{paddingHorizontal:8,paddingVertical:5},dataRow:{flexDirection:'row',paddingVertical:3.7,borderBottomWidth:.4,borderBottomColor:line},dataLabel:{width:'40%',fontFamily:'Helvetica-Bold',color:'#17324b'},dataValue:{width:'60%'},twoCol:{flexDirection:'row',gap:8,marginTop:8},bullet:{paddingVertical:4},empty:{paddingVertical:10,color:'#6b8190'},member:{paddingVertical:4,borderBottomWidth:.4,borderBottomColor:line},memberName:{fontFamily:'Helvetica-Bold',marginBottom:2},scopeSummary:{marginTop:8,borderWidth:.7,borderColor:line,borderRadius:5,overflow:'hidden'},scopeSummaryTitle:{backgroundColor:navy,color:'#fff',fontFamily:'Helvetica-Bold',fontSize:8.5,padding:7},summaryRow:{flexDirection:'row'},summary:{width:'25%',padding:8,borderRightWidth:.4,borderRightColor:line},summaryLabel:{fontSize:5.8,color:'#607987'},summaryValue:{fontFamily:'Helvetica-Bold',fontSize:8.5,marginTop:3},scopeHint:{fontSize:6.3,color:'#607987',paddingHorizontal:8,paddingBottom:7},scopeProject:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end',marginBottom:9},scopeProjectId:{fontFamily:'Helvetica-Bold',fontSize:13,color:navy},scopeProjectSub:{fontSize:6.8,color:'#607987',marginTop:2},scopeTotals:{alignItems:'flex-end',fontFamily:'Helvetica-Bold',fontSize:7},table:{borderWidth:.6,borderColor:line},th:{flexDirection:'row',backgroundColor:navy,color:'#fff',fontFamily:'Helvetica-Bold',fontSize:6.3},tr:{flexDirection:'row',borderTopWidth:.4,borderTopColor:line,minHeight:22,alignItems:'stretch'},scopeRow:{backgroundColor:'#eaf4fb'},groupRow:{backgroundColor:'#f3f6f8'},cell:{paddingVertical:6,paddingHorizontal:4,justifyContent:'center'},right:{alignItems:'flex-end'},bold:{fontFamily:'Helvetica-Bold'},noScope:{padding:20,alignItems:'center',color:'#6b8190'},scopeBottom:{marginTop:10,flexDirection:'row',justifyContent:'flex-end',gap:20},scopeBottomLabel:{fontSize:5.7,color:'#607987',textAlign:'right'},scopeBottomValue:{fontFamily:'Helvetica-Bold',fontSize:9,color:navy,textAlign:'right',marginTop:2},footer:{position:'absolute',left:24,right:24,bottom:16,paddingTop:5,borderTopWidth:.6,borderTopColor:navy,flexDirection:'row',justifyContent:'space-between',fontSize:6,color:'#526a7d'}})
