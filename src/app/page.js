import Image from 'next/image'
import styles from './landing.module.css'

export const metadata = {
  title: 'RitsuFlow™ | Construction Planning & Flow Control',
  description:
    'RitsuFlow is a construction planning and flow control platform connecting Master Planning, Lookahead Planning, constraint management, and weekly production control.',
}

const workflowSteps = [
  {
    number: '01',
    title: 'Master Plan',
    description:
      'Build the long-term plan by location and visualize the production sequence through the Line of Balance.',
    image: '/masterplan.png',
    imageAlt:
      'RitsuFlow Master Plan showing the physical schedule and Line of Balance.',
    highlights: [
      'Plan by location',
      'Sequence work',
      'Visualize production flow',
    ],
  },
  {
    number: '02',
    title: 'Lookahead Planning',
    description:
      'Translate the Master Plan into a reliable medium-term horizon and assess whether upcoming work is ready for execution.',
    image: '/lookahead.png',
    imageAlt:
      'RitsuFlow Lookahead Planning showing the medium-term plan and Koskela readiness matrix.',
    highlights: [
      'Prepare upcoming work',
      'Assess readiness',
      'Expose constraints early',
    ],
  },
  {
    number: '03',
    title: 'Constraint Management',
    description:
      'Turn readiness issues into visible, assigned, and traceable constraints before they interrupt production.',
    image: '/constraint.png',
    imageAlt:
      'RitsuFlow Constraint Log showing active constraints, priorities, responsibilities, and resolution status.',
    highlights: [
      'Capture restrictions',
      'Assign responsibility',
      'Track resolution',
    ],
  },
]

const capabilities = [
  {
    icon: 'LB',
    title: 'Location-Based Planning',
    description:
      'Organize the project around physical locations, production zones, and work packages.',
  },
  {
    icon: 'FL',
    title: 'Flow-Based Planning',
    description:
      'Connect work through sequence, continuity, rhythm, and reliable handoffs.',
  },
  {
    icon: 'CM',
    title: 'Constraint Management',
    description:
      'Identify and remove restrictions before they interrupt production.',
  },
  {
    icon: 'WP',
    title: 'Weekly Commitments',
    description:
      'Transform ready work into executable weekly production commitments.',
  },
  {
    icon: 'PC',
    title: 'Planning Control',
    description:
      'Compare planning and execution to expose deviations and protect flow.',
  },
  {
    icon: 'CI',
    title: 'Continuous Improvement',
    description:
      'Turn production information into learning for the next planning cycle.',
  },
]

export default function HomePage() {
  return (
    <div className={styles.page}>
      <header className={styles.navigation}>
        <div className={styles.navigationInner}>
          <a
            href="/"
            className={styles.brand}
            aria-label="RitsuFlow home"
          >
            <Image
              src="/logo.png"
              alt="RitsuFlow"
              width={220}
              height={90}
              priority
              style={{
                width: '150px',
                height: 'auto',
                objectFit: 'contain',
              }}
            />
          </a>

          <nav
            className={styles.navigationLinks}
            aria-label="Primary navigation"
          >
            <a href="#workflow">
              Workflow
            </a>

            <a href="#capabilities">
              Capabilities
            </a>

            <a href="#about">
              About
            </a>
          </nav>

          <div className={styles.navigationActions}>
            <a
              href="/login"
              className={styles.secondaryButton}
            >
              Sign in
            </a>

            <a
              href="/login"
              className={styles.primaryButton}
            >
              Private access
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* ===================================================
            HERO
        =================================================== */}

        <section className={styles.hero}>
          <div className={styles.heroFlowBackground}>
            <span className={styles.flowLineOne} />
            <span className={styles.flowLineTwo} />
            <span className={styles.flowLineThree} />
            <span className={styles.flowLineFour} />
            <span className={styles.flowLineFive} />
          </div>

          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>
              <span className={styles.eyebrowDot} />

              Construction planning & flow control
            </p>

            <h1>
              Plan the <span>flow.</span>
              <br />
              Control the work.
            </h1>

            <p className={styles.heroDescription}>
              RitsuFlow™ connects Master Planning,
              Lookahead Planning, constraint management,
              and Weekly Production Control into one
              continuous construction workflow.
            </p>

            <div className={styles.heroActions}>
              <a
                href="#workflow"
                className={styles.primaryButton}
              >
                See the workflow
              </a>

              <a
                href="/login"
                className={styles.secondaryButton}
              >
                Private access
              </a>
            </div>

            <div className={styles.heroPrinciples}>
              <div>
                <strong>
                  Flow-Based Planning
                </strong>

                <span>
                  Align locations, sequence, and production.
                </span>
              </div>

              <div>
                <strong>
                  Reliable Execution
                </strong>

                <span>
                  Make work ready before commitment.
                </span>
              </div>

              <div>
                <strong>
                  Continuous Control
                </strong>

                <span>
                  Connect planning decisions to execution.
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================
            PRODUCT WORKFLOW
        =================================================== */}

        <section
          className={styles.productWorkflow}
          id="workflow"
        >
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeader}>
              <p className={styles.eyebrow}>
                <span className={styles.eyebrowDot} />

                The RitsuFlow™ workflow
              </p>

              <h2>
                From strategy to executable work.
              </h2>

              <p>
                Each planning level prepares the conditions
                required by the next, creating a continuous
                flow from long-term strategy to reliable
                production commitments.
              </p>
            </div>

            <div className={styles.productStory}>
              {workflowSteps.map((step) => (
                <article
                  className={styles.productStep}
                  key={step.number}
                >
                  <div className={styles.productStepCopy}>
                    <span className={styles.productStepNumber}>
                      {step.number}
                    </span>

                    <h3>
                      {step.title}
                    </h3>

                    <p>
                      {step.description}
                    </p>

                    <div className={styles.productHighlights}>
                      {step.highlights.map((highlight) => (
                        <span key={highlight}>
                          {highlight}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className={styles.productScreenshot}>
                    <Image
                      src={step.image}
                      alt={step.imageAlt}
                      width={1772}
                      height={858}
                      sizes="(max-width: 900px) 100vw, 78vw"
                      style={{
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                      }}
                    />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ===================================================
            FLOW BRIDGE
        =================================================== */}

        <section className={styles.flowBridge}>
          <div className={styles.sectionInner}>
            <div className={styles.flowBridgeLine}>
              <span>
                Master Plan
              </span>

              <strong>
                →
              </strong>

              <span>
                Lookahead
              </span>

              <strong>
                →
              </strong>

              <span>
                Make Ready
              </span>

              <strong>
                →
              </strong>

              <span>
                Weekly Plan
              </span>

              <strong>
                →
              </strong>

              <span>
                Production
              </span>
            </div>
          </div>
        </section>

        {/* ===================================================
            CAPABILITIES
        =================================================== */}

        <section
          className={styles.section}
          id="capabilities"
        >
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeader}>
              <p className={styles.eyebrow}>
                <span className={styles.eyebrowDot} />

                Built around production flow
              </p>

              <h2>
                Planning designed for execution.
              </h2>

              <p>
                RitsuFlow brings locations, work packages,
                readiness, constraints, commitments, and
                production control into the same planning
                environment.
              </p>
            </div>

            <div className={styles.capabilityGrid}>
              {capabilities.map((capability) => (
                <article
                  className={styles.capabilityCard}
                  key={capability.title}
                >
                  <span className={styles.capabilityIcon}>
                    {capability.icon}
                  </span>

                  <h3>
                    {capability.title}
                  </h3>

                  <p>
                    {capability.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ===================================================
            ABOUT / CLOSING
        =================================================== */}

        <section
          className={styles.closing}
          id="about"
        >
          <div className={styles.closingFlowBackground}>
            <span />
            <span />
            <span />
          </div>

          <div className={styles.closingContent}>
            <p className={styles.eyebrow}>
              <span className={styles.eyebrowDot} />

              RitsuFlow™
            </p>

            <h2>
              One continuous flow.
              <br />
              Better projects.
            </h2>

            <p>
              RitsuFlow™ is being developed to help
              construction teams plan better, make ready
              what matters, and create more predictable
              production flow.
            </p>

            <a
              href="/login"
              className={styles.primaryButton}
            >
              Private access
            </a>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>
          © {new Date().getFullYear()}{' '}
          Eduardo Fernandes de Freitas.
          All rights reserved.
        </span>

        <span>
          Construction planning & flow control.
        </span>
      </footer>
    </div>
  )
}
