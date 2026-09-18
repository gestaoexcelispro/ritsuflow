'use client'

import Image from 'next/image'
import Link from 'next/link'
import styles from './projects.module.css'

const projects = [
 {name:'Sunrise Residential',code:'PRJ-001',location:'Orlando, FL',phase:'Structure',manager:'Michael Carter',workers:48,planned:60,ops:7,progress:62,issues:2,status:'On Track',update:'14:32'},
 {name:'Lakeside Apartments',code:'PRJ-002',location:'Tampa, FL',phase:'Finishes',manager:'Sarah Mitchell',workers:36,planned:50,ops:5,progress:48,issues:1,status:'Attention',update:'13:15'},
 {name:'Riverside Commercial',code:'PRJ-003',location:'Austin, TX',phase:'MEP',manager:'Daniel Brooks',workers:22,planned:40,ops:4,progress:71,issues:0,status:'On Track',update:'12:47'},
 {name:'West Industrial Facility',code:'PRJ-004',location:'Houston, TX',phase:'Mechanical',manager:'James Wilson',workers:31,planned:45,ops:4,progress:38,issues:3,status:'Attention',update:'11:20'},
 {name:'Mountain View Villas',code:'PRJ-005',location:'Phoenix, AZ',phase:'Structure',manager:'Amanda Reed',workers:18,planned:30,ops:3,progress:55,issues:1,status:'On Track',update:'10:05'},
 {name:'Harbor Office Center',code:'PRJ-006',location:'Miami, FL',phase:'Interiors',manager:'Robert Hayes',workers:39,planned:48,ops:5,progress:67,issues:0,status:'On Track',update:'09:42'},
 {name:'Northgate Logistics',code:'PRJ-007',location:'Dallas, TX',phase:'Envelope',manager:'Laura Bennett',workers:29,planned:35,ops:4,progress:44,issues:0,status:'On Track',update:'09:18'},
 {name:'Central Medical Pavilion',code:'PRJ-008',location:'Charlotte, NC',phase:'MEP',manager:'Kevin Morgan',workers:25,planned:32,ops:3,progress:51,issues:2,status:'Attention',update:'08:54'}
]

const nav=[['⌂','Portfolio Overview','/fieldop'],['□','Projects','/fieldop/projects'],['♙','Workforce','#'],['⌖','Operations','#'],['△','Occurrences','#'],['▥','Reports','#'],['⚙','Settings','#']]

export default function FieldOpProjectsPage(){
 return <main className={styles.shell}>
  <aside className={styles.sidebar}>
   <div className={styles.brand}><Image src="/logo-white.png" alt="RitsuFlow" width={160} height={58} priority/></div>
   <div className={styles.navTitle}>FIELD OPERATIONS</div>
   <nav>{nav.map(([icon,label,href])=><Link key={label} href={href} className={label==='Projects'?styles.active:''}><i>{icon}</i>{label}</Link>)}</nav>
   <Link href="/workspaces" className={styles.workspaceReturn}>← <span>Workspaces</span></Link>
  </aside>

  <section className={styles.main}>
   <header className={styles.topbar}>
    <div className={styles.search}>⌕ <span>Search projects, locations, or people...</span><kbd>Ctrl K</kbd></div>
    <div className={styles.user}><button>♧<em>3</em></button><b>EF</b><div><strong>Eduardo Freitas</strong><span>Operations Manager</span></div><span>⌄</span></div>
   </header>

   <div className={styles.content}>
    <section className={styles.heading}>
     <div><span>FIELD OPERATIONS</span><h1>Projects</h1><p>Select a project to enter its field operations environment.</p></div>
     <div className={styles.headingActions}><button>＋ New Project</button></div>
    </section>

    <section className={styles.kpis}>
     <div><span>Active Projects</span><strong>8</strong><small>Across 6 locations</small></div>
     <div><span>On Track</span><strong className={styles.green}>5</strong><small>63% of active projects</small></div>
     <div><span>Need Attention</span><strong className={styles.amber}>3</strong><small>Projects requiring action</small></div>
     <div><span>Workers On Site</span><strong>248</strong><small>of 340 planned today</small></div>
    </section>

    <section className={styles.projectsPanel}>
     <div className={styles.panelHead}>
      <div><h2>All Projects</h2><p>Live operational status across the company portfolio.</p></div>
      <div className={styles.filters}><span>⌕ Search projects...</span><button>All Statuses⌄</button><button>All Phases⌄</button></div>
     </div>

     <div className={styles.tableWrap}>
      <table><thead><tr><th>Project</th><th>Location</th><th>Project Manager</th><th>Phase</th><th>Workers</th><th>Operations</th><th>Today’s Progress</th><th>Open Issues</th><th>Status</th><th>Last Update</th><th></th></tr></thead>
       <tbody>{projects.map(p=><tr key={p.code}>
        <td><div className={styles.projectName}><i>{p.name.charAt(0)}</i><span><b>{p.name}</b><small>{p.code}</small></span></div></td>
        <td>⌖ {p.location}</td><td>{p.manager}</td><td><span className={styles.phase}>{p.phase}</span></td>
        <td><b>{p.workers}</b><small> of {p.planned}</small></td><td><b>{p.ops}</b> underway</td>
        <td><b>{p.progress}%</b><div className={styles.progress}><span style={{width:`${p.progress}%`}}/></div></td>
        <td className={p.issues?styles.issue:''}>{p.issues}</td><td><span className={p.status==='On Track'?styles.ok:styles.attention}>{p.status}</span></td>
        <td>18 Sep · {p.update}</td><td><Link className={styles.openProject} href={`/fieldop/projects/${p.code.toLowerCase()}`}>Open Project →</Link></td>
       </tr>)}</tbody>
      </table>
     </div>
     <footer className={styles.tableFooter}><span>Showing 8 active projects</span><span>Portfolio field data updated continuously</span></footer>
    </section>
   </div>
  </section>
 </main>
}
