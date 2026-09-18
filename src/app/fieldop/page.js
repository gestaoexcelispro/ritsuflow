'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function FieldOpPage() {
  return (
    <main style={{minHeight:'100vh',background:'#071c28',color:'#fff',fontFamily:'Arial, sans-serif',padding:'32px clamp(22px,5vw,72px)'}}>
      <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:20}}>
        <Image src="/logo-white.png" alt="RitsuFlow" width={190} height={70} style={{width:190,height:'auto'}} priority />
        <Link href="/workspaces" style={{color:'#9fe5d3',textDecoration:'none',fontWeight:700}}>← Workspaces</Link>
      </header>

      <section style={{maxWidth:900,margin:'110px auto 0'}}>
        <div style={{fontSize:12,letterSpacing:'.28em',color:'#58d9ad',fontWeight:800}}>RITSUFLOW · FIELD OPERATIONS</div>
        <h1 style={{fontSize:'clamp(52px,8vw,92px)',letterSpacing:'-.055em',lineHeight:.95,margin:'18px 0'}}>FieldOp</h1>
        <p style={{fontSize:24,color:'#b9ccd4',margin:'0 0 42px'}}>Execute. Capture. Measure.</p>

        <div style={{padding:'28px 30px',border:'1px solid rgba(255,255,255,.12)',borderRadius:18,background:'rgba(255,255,255,.045)'}}>
          <strong style={{fontSize:18}}>Standalone environment created.</strong>
          <p style={{color:'#aebfc8',lineHeight:1.65,marginBottom:0}}>This is the new home for Daily Scrum, field operations, production tracking, workforce, location tracking, materials, equipment, occurrences, safety, quality, photos, and Daily Reports. We will migrate the existing field capabilities here progressively without breaking the current system.</p>
        </div>
      </section>
    </main>
  )
}
