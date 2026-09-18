'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import styles from './workspaces.module.css'

const supabase = createClient()

const workspaces = [
  {
    key: 'precon',
    eyebrow: 'PLAN · PREPARE · CONTROL',
    name: 'PreCon',
    subtitle: 'Plan & Prepare',
    description: 'Structure the project, prepare executable work, manage constraints, and control production flow.',
    features: ['Project Setup & Locations', 'Pre-Planning & Master Plan', 'Lookahead & Constraints', 'Weekly Planning', 'Planning Reports'],
    href: '/dashboard',
    action: 'Enter PreCon',
  },
  {
    key: 'fieldop',
    eyebrow: 'EXECUTE · CAPTURE · MEASURE',
    name: 'FieldOp',
    subtitle: 'Execute & Measure',
    description: 'Bring the plan to the field. Coordinate operations, capture production, and measure actual performance.',
    features: ['Daily Scrum', 'Operations & Production', 'Workforce Management', 'Location Tracking', 'Daily Reports & Field Data'],
    href: '/fieldop',
    action: 'Enter FieldOp',
  },
  {
    key: 'ritsucad',
    eyebrow: 'DRAW · QUANTIFY · CONNECT',
    name: 'RitsuCAD',
    subtitle: 'Draw & Quantify',
    description: 'Work with drawings, takeoffs, and quantities that connect planning and field execution.',
    features: ['Drawing Workspace', 'Measurements & Takeoffs', 'Quantities', 'Location-Based Data', 'Planning & Field Integration'],
    href: '/ritsucad',
    action: 'Enter RitsuCAD',
  },
]

export default function WorkspacesPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true

    async function checkSession() {
      const { data } = await supabase.auth.getUser()
      if (!active) return

      if (!data?.user) {
        router.replace('/login')
        return
      }

      setChecking(false)
    }

    checkSession()
    return () => { active = false }
  }, [router])

  if (checking) {
    return <main className={styles.loading}>Loading RitsuFlow™...</main>
  }

  return (
    <main className={styles.page}>
      <div className={styles.glow} />

      <header className={styles.header}>
        <Image src="/logo-white.png" alt="RitsuFlow" width={220} height={82} priority className={styles.logo} />
        <div className={styles.platformLabel}>CONSTRUCTION PRODUCTION SYSTEM</div>
      </header>

      <section className={styles.hero}>
        <div className={styles.kicker}>WELCOME TO RITSUFLOW</div>
        <h1>Choose your workspace</h1>
        <p>Different perspectives. One connected production system.</p>
      </section>

      <section className={styles.grid} aria-label="RitsuFlow workspaces">
        {workspaces.map((workspace) => (
          <article key={workspace.key} className={`${styles.card} ${styles[workspace.key]}`}>
            <div className={styles.cardTop}>
              <span className={styles.eyebrow}>{workspace.eyebrow}</span>
              <div className={styles.mark}>{workspace.name.slice(0, 1)}</div>
            </div>

            <div className={styles.cardBody}>
              <h2>{workspace.name}</h2>
              <h3>{workspace.subtitle}</h3>
              <p>{workspace.description}</p>

              <div className={styles.rule} />

              <ul>
                {workspace.features.map((feature) => (
                  <li key={feature}><span>✓</span>{feature}</li>
                ))}
              </ul>

              <Link href={workspace.href} className={styles.enterButton}>
                {workspace.action}<span aria-hidden="true">→</span>
              </Link>
            </div>
          </article>
        ))}
      </section>

      <footer className={styles.footer}>
        <span>One Project</span><i />
        <span>One Team</span><i />
        <span>One Source of Truth</span>
        <strong>BUILT FOR A HIGHER STANDARD.</strong>
      </footer>
    </main>
  )
}
