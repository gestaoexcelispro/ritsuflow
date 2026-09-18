'use client'

import Image from 'next/image'
import Link from 'next/link'
import styles from './fieldop.module.css'

const projects=[
 {name:'Sunrise Residential',code:'PRJ-001',location:'Orlando, FL',phase:'Structure',workers:'48',capacity:'60',ops:7,progress:62,issues:2,status:'On Track',update:'18 Sep 2026 · 14:32'},
 {name:'Lakeside Apartments',code:'PRJ-002',location:'Tampa, FL',phase:'Finishes',workers:'36',capacity:'50',ops:5,progress:48,issues:1,status:'Attention',update:'18 Sep 2026 · 13:15'},
 {name:'Riverside Commercial',code:'PRJ-003',location:'Austin, TX',phase:'MEP',workers:'22',capacity:'40',ops:4,progress:71,issues:0,status:'On Track',update:'18 Sep 2026 · 12:47'},
 {name:'West Industrial Facility',code:'PRJ-004',location:'Houston, TX',phase:'Mechanical',workers:'31',capacity:'45',ops:4,progress:38,issues:3,status:'Attention',update:'18 Sep 2026 · 11:20'},
 {name:'Mountain View Villas',code:'PRJ-005',location:'Phoenix, AZ',phase:'Structure',workers:'18',capacity:'30',ops:3,progress:55,issues:1,status:'On Track',update:'18 Sep 2026 · 10:05'}
]
const nav=[['⌂','Portfolio Overview'],['□','Projects'],['♙','Workforce'],['⌖','Operations'],['△','Occurrences'],['▥','Reports'],['⚙','Settings']]
const activity=[['14:32','♙','Worker check-in','Sunrise Residential | Building A – L2'],['13:15','▤','Daily report submitted','Lakeside Apartments'],['11:48','△','Occurrence reported','West Industrial Facility | Equipment'],['10:05','▣','New photo uploaded','Mountain View Villas'],['08:21','✓','Operation completed','Riverside Commercial | MEP Room 2']]

export default function FieldOpPage(){
 return <main className={styles.shell}>
  <aside className={styles.sidebar}>
   <div className={styles.brand}><Image src="/logo-white.png" alt="RitsuFlow" width={160} height={58} priority/><div><b>FieldOp</b><span>Execute. Capture. Measure.</span></div></div>
   <div className={styles.navTitle}>FIELD OPERATIONS</div>
   <nav>{nav.map(([icon,label],i)=><a key={label} className={i===0?styles.active:''} href="#"><i>{icon}</i>{label}</a>)}</nav>
   <div className={styles.sideFooter}><span>One Project</span><span>One Team</span><span>One Source of Truth</span><hr/><small>BUILT FOR A HIGHER STANDARD.</small></div>
  </aside>
  <section className={styles.main}>
   <header className={styles.topbar}><div className={styles.search}>⌕ <span>Search projects, locations, or people...</span><kbd>Ctrl K</kbd></div><div className={styles.user}><button>♧<em>3</em></button><b>EF</b><div><strong>Eduardo Freitas</strong><span>Operations Manager</span></div><span>⌄</span></div></header>
   <div className={styles.content}>
    <section className={styles.hero}><div><h1>Field Operations<br/><strong>Across All Projects</strong></h1><p>Real field data. Real progress. A connected construction production system.</p></div><div className={styles.heroWords}>Plan<br/>the work.<br/>Build<br/>a better tomorrow.</div></section>
    <section className={styles.kpis}>
     <div><i>▥</i><span>Active Projects<strong>8</strong><small>5 on track | 3 attention</small></span></div>
     <div><i>♙</i><span>Workers On Site<strong>248 <em>↑ 12%</em></strong><small>of 320 planned</small></span></div>
     <div><i>♟</i><span>Operations in Progress<strong>24 <em>↑ 20%</em></strong><small>work packages</small></span></div>
     <div><i className={styles.red}>!</i><span>Open Occurrences<strong>7</strong><small className={styles.danger}>3 critical</small></span></div>
     <div><i>▤</i><span>Today’s Daily Reports<strong>6</strong><small>of 8 projects</small></span></div>
    </section>
    <section className={styles.dashboard}>
     <div className={styles.projectsPanel}><div className={styles.panelHead}><div><h2>Active Projects</h2><p>Live overview of field operations across all your projects.</p></div><div className={styles.filters}>⌕ Search projects... <button>All Statuses⌄</button></div></div>
      <div className={styles.tableWrap}><table><thead><tr><th>Project</th><th>Location</th><th>Phase</th><th>Workers<br/>On Site</th><th>Operations<br/>Underway</th><th>Today’s<br/>Progress</th><th>Open<br/>Issues</th><th>Status</th><th>Last Update</th></tr></thead><tbody>{projects.map(p=><tr key={p.code}><td><b>{p.name}</b><small>{p.code}</small></td><td>⌖ {p.location}</td><td><span className={styles.phase}>{p.phase}</span></td><td><b>{p.workers}</b><small>of {p.capacity}</small></td><td>{p.ops}</td><td><b>{p.progress}%</b><div className={styles.progress}><span style={{width:`${p.progress}%`}}/></div></td><td className={p.issues?styles.issue:''}>{p.issues}</td><td><span className={p.status==='On Track'?styles.ok:styles.attention}>{p.status}</span></td><td>{p.update}</td></tr>)}</tbody></table></div>
      <Link href="/dashboard/projects" className={styles.viewAll}>View All Projects →</Link>
     </div>
     <aside className={styles.rightCol}><div className={styles.statusCard}><h2>Projects by Status</h2><div className={styles.statusBody}><div className={styles.donut}><strong>8</strong><span>Projects</span></div><ul><li><i/>On Track <b>5</b><span>63%</span></li><li><i/>Attention <b>3</b><span>37%</span></li><li><i/>At Risk <b>0</b><span>0%</span></li><li><i/>Completed <b>0</b><span>0%</span></li></ul></div></div>
      <div className={styles.activity}><div className={styles.activityHead}><h2>Field Activity <small>(Last 24 Hours)</small></h2><a href="#">View All →</a></div>{activity.map(([time,icon,title,sub])=><div className={styles.activityRow} key={time}><time>{time}</time><i>{icon}</i><span><b>{title}</b><small>{sub}</small></span></div>)}</div>
     </aside>
    </section>
    <section className={styles.callout}><i>◯</i><div><b>Safer sites. Higher productivity. Stronger projects.</b><span>Field reality connected to planning. That’s RitsuFlow.</span></div><button>▤ &nbsp; Create Daily Report</button></section>
   </div>
  </section>
 </main>
}
