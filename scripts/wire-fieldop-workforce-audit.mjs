import fs from 'node:fs'

const path='src/app/fieldop/workforce/page.js'
let source=fs.readFileSync(path,'utf8')

function required(from,to){
  if(!source.includes(from))throw new Error(`Expected FieldOp Workforce fragment not found: ${from.slice(0,120)}`)
  source=source.replace(from,to)
}

if(!source.includes("import AuditTrailPanel from './AuditTrailPanel'")){
  required("import TimecardsPanel from './TimecardsPanel'","import TimecardsPanel from './TimecardsPanel'\nimport AuditTrailPanel from './AuditTrailPanel'")
}

if(!source.includes("'Audit Trail'")){
  required("const tabs=['Live Attendance','Worker Registry','Project Assignments','Timecards']","const tabs=['Live Attendance','Worker Registry','Project Assignments','Timecards','Audit Trail']")
}

if(!source.includes("activeTab==='Audit Trail'")){
  required("    {activeTab==='Timecards'&&<TimecardsPanel projects={projects} workers={workers} query={query}/>} ","    {activeTab==='Timecards'&&<TimecardsPanel projects={projects} workers={workers} query={query}/>}\n    {activeTab==='Audit Trail'&&<AuditTrailPanel projects={projects} workers={workers} query={query}/>} ")
}

for(const fragment of ["import AuditTrailPanel from './AuditTrailPanel'","'Audit Trail'","activeTab==='Audit Trail'&&<AuditTrailPanel"]){
  if(!source.includes(fragment))throw new Error(`FieldOp Audit Trail wiring missing: ${fragment}`)
}

fs.writeFileSync(path,source)
console.log(`Wired native FieldOp Workforce Audit Trail: ${path}`)
