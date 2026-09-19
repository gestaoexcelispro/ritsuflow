'use client'

export default function DeleteProjectModal({project,open,deleting,onCancel,onConfirm}){
 if(!open||!project)return null
 const projectLabel=[project.project_id,project.name].filter(Boolean).join(' – ')
 return <div style={overlay} role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!deleting)onCancel?.()}}>
  <section style={modal} role="dialog" aria-modal="true" aria-labelledby="delete-project-title">
   <div style={header}>
    <div style={iconBox}>▢</div>
    <div style={{minWidth:0,flex:1}}>
     <h2 id="delete-project-title" style={title}>Delete Project</h2>
     <div style={projectName}>{projectLabel||'Project'}</div>
    </div>
    <button type="button" onClick={onCancel} disabled={deleting} aria-label="Close" style={close}>×</button>
   </div>
   <div style={warningBox}>
    <div style={warningIcon}>!</div>
    <div>
     <div style={warningTitle}>This action cannot be undone.</div>
     <p style={question}>Are you sure you want to delete this project?</p>
     <p style={description}>This will permanently remove the project and all related data, including locations, plans, lookaheads, constraints, weekly plans, reports, and files.</p>
    </div>
   </div>
   <div style={footer}>
    <button type="button" onClick={onCancel} disabled={deleting} style={cancelButton}>Cancel</button>
    <button type="button" onClick={onConfirm} disabled={deleting} style={{...deleteButton,...(deleting?disabled:{})}}>{deleting?'Deleting...':'▢ Delete Project'}</button>
   </div>
  </section>
 </div>
}

const overlay={position:'fixed',inset:0,zIndex:5000,background:'rgba(3,35,50,.68)',display:'grid',placeItems:'center',padding:20,boxSizing:'border-box',backdropFilter:'blur(1px)'}
const modal={width:'min(590px,calc(100vw - 40px))',background:'#fff',border:'1px solid #cbdce3',borderRadius:12,boxShadow:'0 24px 70px rgba(3,35,50,.28)',overflow:'hidden',color:'#082f43',fontFamily:'Arial,sans-serif'}
const header={display:'flex',alignItems:'center',gap:14,padding:'20px 24px 16px'}
const iconBox={width:52,height:52,borderRadius:9,background:'#ffe7e7',color:'#e12727',display:'grid',placeItems:'center',fontSize:27,fontWeight:900}
const title={margin:0,fontSize:24,lineHeight:1.1,fontWeight:800}
const projectName={marginTop:6,fontSize:14,color:'#597789',fontWeight:700}
const close={width:36,height:36,border:0,background:'transparent',color:'#355667',fontSize:30,lineHeight:1,cursor:'pointer',borderRadius:7}
const warningBox={margin:'0 24px 18px',padding:'18px 20px',display:'grid',gridTemplateColumns:'46px minmax(0,1fr)',gap:14,border:'1px solid #ffcaca',borderRadius:9,background:'#fff3f3'}
const warningIcon={width:38,height:38,border:'3px solid #df2e2e',color:'#df2e2e',borderRadius:'50%',display:'grid',placeItems:'center',fontWeight:900,fontSize:22}
const warningTitle={fontSize:15,fontWeight:800,color:'#cf2626',marginTop:1}
const question={margin:'13px 0 0',fontSize:14,lineHeight:1.45,color:'#294b5c'}
const description={margin:'14px 0 0',fontSize:13.5,lineHeight:1.5,color:'#294b5c'}
const footer={display:'flex',justifyContent:'flex-end',gap:10,padding:'16px 24px',borderTop:'1px solid #dce7eb',background:'#fbfdfe'}
const cancelButton={height:40,padding:'0 20px',border:'1px solid #b8cbd4',borderRadius:7,background:'#fff',color:'#486879',fontWeight:800,fontSize:13,cursor:'pointer'}
const deleteButton={height:40,padding:'0 20px',border:'1px solid #df2e2e',borderRadius:7,background:'#df2e2e',color:'#fff',fontWeight:800,fontSize:13,cursor:'pointer'}
const disabled={opacity:.6,cursor:'not-allowed'}