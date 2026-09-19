'use client'

import { useState } from 'react'
import { pdf, Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { supabase } from '../../../lib/supabase'

const money=(v,c='USD')=>{if(v===null||v===undefined||v==='')return '—';try{return new Intl.NumberFormat('en-US',{style:'currency',currency:c}).format(Number(v)||0)}catch{return String(v)}}
const date=v=>{if(!v)return '—';const[y,m,d]=String(v).slice(0,10).split('-');return y&&m&&d?`${m}/${d}/${y}`:String(v)}
const billing={progress_percent_complete:'Progress / Percent Complete',milestone:'Milestone Based',unit_price:'Unit Price',time_materials:'Time & Materials',fixed_schedule:'Fixed Payment Schedule',other:'Other / Custom'}
const cycle={weekly:'Weekly',biweekly:'Biweekly',monthly:'Monthly',milestone:'By Milestone',custom:'Custom'}

export default function ProjectReportButton({project}){
 const[busy,setBusy]=useState(false)
 async function generate(){
  if(!project||busy)return
  setBusy(true)
  try{
   const [{data:team},{data:notes}]=await Promise.all([
    supabase.from('project_members').select('*').eq('project_id',project.id).order('created_at',{ascending:true}),
    supabase.from('project_notes').select('note,author_name,created_at').eq('project_id',project.id).order('created_at',{ascending:false}).limit(5)
   ])
   const imageUrl=project.project_image_path?supabase.storage.from('project-images').getPublicUrl(project.project_image_path).data.publicUrl:null
   const blob=await pdf(<ProjectReport project={project} team={team||[]} notes={notes||[]} imageUrl={imageUrl}/>).toBlob()
   const url=URL.createObjectURL(blob),a=document.createElement('a')
   a.href=url;a.download=`${project.project_id||'Project'}_Project_Report.pdf`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)
  }catch(e){console.error(e);window.alert(`Unable to generate report: ${e?.message||e}`)}finally{setBusy(false)}
 }
 return <button type="button" onClick={generate} disabled={busy} style={{...button,...(busy?disabled:{})}}>{busy?'Generating...':'▤ Generate Report'}</button>
}

function ProjectReport({project:p,team,notes,imageUrl}){
 const currency=p.currency_code||'USD'
 const location=[p.address_line,p.address_number,p.neighborhood,p.city,p.state_region,p.postal_code,p.country_code].filter(Boolean).join(', ')
 return <Document title={`${p.project_id||''} ${p.name||'Project'} Report`} author="RitsuFlow">
  <Page size="LETTER" style={s.page}>
   <View style={s.header}><View><Text style={s.brand}>RitsuFlow</Text><Text style={s.kicker}>PROJECT REPORT</Text></View><View style={s.headerRight}><Text style={s.projectId}>{p.project_id||'PROJECT'}</Text><Text style={s.generated}>Generated {new Date().toLocaleDateString('en-US')}</Text></View></View>
   <View style={s.hero}><View style={s.heroText}><Text style={s.title}>{p.name||'Untitled Project'}</Text><Text style={s.client}>{p.client_name||'Client not defined'}</Text><Text style={s.location}>{location||'Location not defined'}</Text><View style={s.status}><Text style={s.statusText}>{String(p.status||'Planning').toUpperCase()}</Text></View></View>{imageUrl?<Image src={imageUrl} style={s.heroImage}/>:<View style={s.imageEmpty}><Text>PROJECT IMAGE</Text></View>}</View>
   <Section title="PROJECT INFORMATION"><Grid rows={[[['Project ID',p.project_id],['Contract Number',p.contract_number]],[['Client',p.client_name],['Status',p.status]],[['Planned Start',date(p.planned_start_date)],['Planned Finish',date(p.planned_finish_date)]],[['Contractual Term',p.contractual_term_days?`${p.contractual_term_days} days`:'—'],['Currency',currency]]]}/></Section>
   <Section title="CONTRACT & BILLING"><Grid rows={[[['Contract Value',money(p.contract_value,currency)],['Material Value',p.material_included?money(p.material_value,currency):'Not included']],[['Billing Method',billing[p.billing_method]||p.billing_method||'—'],['Billing Cycle',cycle[p.billing_cycle]||p.billing_cycle||'—']],[['Billing Cutoff',p.billing_cutoff_day?`Day ${p.billing_cutoff_day}`:'—'],['Payment Terms',p.payment_terms_days!==null&&p.payment_terms_days!==undefined?`Net ${p.payment_terms_days}`:'—']],[['Retainage',p.has_retainage?`${p.retainage_percent??'—'}% · ${money(p.retainage_value,currency)}`:'No'],['Retainage Release',p.retainage_release_criteria||'—']]]}/></Section>
   <Section title="SUCCESS CRITERIA"><Text style={s.paragraph}>{p.success_criteria||'Success criteria not defined.'}</Text></Section>
   <Section title="PROJECT TEAM">{team.length?<View style={s.table}><View style={s.tableHead}><Text style={s.colA}>NAME</Text><Text style={s.colB}>PROJECT ROLE</Text></View>{team.map((m,i)=><View key={m.id||i} style={s.tableRow}><Text style={s.colA}>{m.member_name||m.full_name||m.email||m.user_id||'Team member'}</Text><Text style={s.colB}>{String(m.role||'—').replaceAll('_',' ')}</Text></View>)}</View>:<Text style={s.muted}>No project team members assigned.</Text>}</Section>
   {notes.length>0&&<Section title="RECENT PROJECT NOTES">{notes.map((n,i)=><View key={i} style={s.note}><Text style={s.noteMeta}>{n.author_name||'RitsuFlow User'} · {date(n.created_at)}</Text><Text style={s.noteText}>{n.note}</Text></View>)}</Section>}
   <View style={s.footer} fixed><Text>RitsuFlow™ · Shared Project Record</Text><Text render={({pageNumber,totalPages})=>`Page ${pageNumber} of ${totalPages}`}/></View>
  </Page>
 </Document>
}
function Section({title,children}){return <View style={s.section} wrap={false}><Text style={s.sectionTitle}>{title}</Text>{children}</View>}
function Grid({rows}){return <View>{rows.map((r,i)=><View key={i} style={s.gridRow}>{r.map(([label,value],j)=><View key={j} style={s.cell}><Text style={s.label}>{label}</Text><Text style={s.value}>{value===null||value===undefined||value===''?'—':String(value)}</Text></View>)}</View>)}</View>}
const button={border:'1px solid #b9d0da',background:'#fff',color:'#234f62',borderRadius:8,padding:'10px 14px',fontWeight:800,fontSize:13,whiteSpace:'nowrap',cursor:'pointer'}
const disabled={opacity:.55,cursor:'not-allowed'}
const s=StyleSheet.create({page:{paddingTop:34,paddingHorizontal:38,paddingBottom:42,fontFamily:'Helvetica',fontSize:9,color:'#173b4b',backgroundColor:'#fff'},header:{backgroundColor:'#07364a',marginHorizontal:-38,marginTop:-34,paddingHorizontal:38,paddingVertical:20,display:'flex',flexDirection:'row',justifyContent:'space-between',alignItems:'center'},brand:{fontSize:22,fontFamily:'Helvetica-Bold',color:'#fff'},kicker:{fontSize:8,letterSpacing:2,color:'#56d7d2',marginTop:4},headerRight:{alignItems:'flex-end'},projectId:{fontSize:13,fontFamily:'Helvetica-Bold',color:'#fff'},generated:{fontSize:7,color:'#bdd1d9',marginTop:4},hero:{display:'flex',flexDirection:'row',gap:18,paddingVertical:22,borderBottomWidth:1,borderBottomColor:'#d8e5e9'},heroText:{flex:1,justifyContent:'center'},title:{fontSize:24,fontFamily:'Helvetica-Bold',color:'#082f43'},client:{fontSize:11,fontFamily:'Helvetica-Bold',color:'#148f8e',marginTop:7},location:{fontSize:8,color:'#627d89',marginTop:5,lineHeight:1.4},status:{alignSelf:'flex-start',marginTop:10,backgroundColor:'#dff5e9',borderRadius:10,paddingVertical:4,paddingHorizontal:9},statusText:{fontSize:7,fontFamily:'Helvetica-Bold',color:'#137346'},heroImage:{width:170,height:104,objectFit:'cover',borderRadius:5},imageEmpty:{width:170,height:104,backgroundColor:'#eef5f6',alignItems:'center',justifyContent:'center',color:'#78909a',fontSize:8},section:{marginTop:17},sectionTitle:{fontSize:9,fontFamily:'Helvetica-Bold',color:'#079c9a',letterSpacing:1.2,borderBottomWidth:1.5,borderBottomColor:'#079c9a',paddingBottom:5,marginBottom:6},gridRow:{display:'flex',flexDirection:'row'},cell:{width:'50%',paddingVertical:7,paddingRight:10,borderBottomWidth:.6,borderBottomColor:'#e4ecef'},label:{fontSize:7,color:'#78909a',textTransform:'uppercase'},value:{fontSize:9,fontFamily:'Helvetica-Bold',color:'#173b4b',marginTop:3},paragraph:{fontSize:9,lineHeight:1.5,color:'#365967',paddingVertical:5},table:{borderWidth:.7,borderColor:'#dbe7eb',borderRadius:3},tableHead:{display:'flex',flexDirection:'row',backgroundColor:'#eef5f6',padding:6},tableRow:{display:'flex',flexDirection:'row',padding:6,borderTopWidth:.5,borderTopColor:'#e2ebee'},colA:{width:'65%',fontSize:8},colB:{width:'35%',fontSize:8,textTransform:'capitalize'},muted:{fontSize:8,color:'#78909a',paddingVertical:5},note:{paddingVertical:6,borderBottomWidth:.5,borderBottomColor:'#e2ebee'},noteMeta:{fontSize:7,fontFamily:'Helvetica-Bold',color:'#64808b'},noteText:{fontSize:8.5,color:'#365967',marginTop:3,lineHeight:1.4},footer:{position:'absolute',bottom:18,left:38,right:38,borderTopWidth:.7,borderTopColor:'#d8e5e9',paddingTop:7,display:'flex',flexDirection:'row',justifyContent:'space-between',fontSize:7,color:'#78909a'}})
