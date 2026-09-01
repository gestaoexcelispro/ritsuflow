import Image from 'next/image'
import styles from './landing.module.css'

export const metadata = {
  title: 'RitsuFlow™ | Construction Planning & Flow Control',
  description:
    'RitsuFlow is an upcoming construction planning and flow control platform connecting Master Planning, Lookahead Planning, constraint management, and weekly production control. Currently in development.',
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

const roadmapSteps = [
  {
    number: '01',
    date: 'AUG 2026',
    title: 'Planning Architecture',
    description:
      'Master Plan, Lookahead Planning, Make Ready logic, and Constraint Management architecture.',
  },
  {
    number: '02',
    date: 'SEP 2026',
    title: 'Production Control Integration',
    description:
      'Weekly planning, release logic, constraint verification, and integrated production-control workflows.',
  },
  {
    number: '03',
    date: 'SEP 2026',
    title: 'Field Execution Connection',
    description:
      'Connect Daily Reports, field production data, workforce information, and execution feedback.',
  },
  {
    number: '04',
    date: 'SEP 2026',
    title: 'Closed-Loop Planning & Control',
    description:
      'Use actual execution information to support planning decisions and continuously improve production flow.',
  },
  {
    number: '05',
    date: 'OCT 2026',
    title: 'V1 Integration & Testing',
    description:
      'Validate the complete work-package journey through end-to-end integration and internal testing.',
  },
  {
    number: '06',
    date: 'NOV 2026',
    title: 'RitsuFlow™ V1 Trial Release',
    description:
      'Release the first external trial version for real project environments and practitioner evaluation.',
    featured: true,
  },
  {
    number: '07',
    date: 'NOV–DEC 2026',
    title: 'Field Validation',
    description:
      'Collect practitioner feedback, evaluate workflows, and refine the platform from real project experience.',
  },
  {
    number: '08',
    date: '2027',
    title: 'Commercial Evolution',
    description:
      'Refine the product based on trial evidence and prepare the platform for broader rollout.',
  },
]

const roadmapPrinciples = [
  {
    icon: 'LB',
    title: 'Location-Based Planning',
    description:
      'Planning structured around project locations, production zones, and work packages.',
  },
  {
    icon: 'FR',
    title: 'Flow & Readiness Focus',
    description:
      'Make upcoming work ready while protecting production continuity and reliable handoffs.',
  },
  {
    icon: 'CM',
    title: 'Constraint Management',
    description:
      'Expose, assign, track, and remove restrictions before they interrupt production.',
  },
  {
    icon: 'CI',
    title: 'Continuous Improvement',
    description:
      'Turn planning and execution information into learning for the next production cycle.',
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

            <a href="#roadmap">
              Roadmap
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
            <div className={styles.developmentStatus}>
              <span className={styles.developmentStatusDot} />

              <span>
                RitsuFlow™ is coming soon
              </span>

              <strong>
                Currently in development
              </strong>
            </div>

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
                href="#roadmap"
                className={styles.secondaryButton}
              >
                View development roadmap
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

              {/* ===================================================
                  WEEKLY PLANNING
              =================================================== */}

              <article className={styles.weeklyPlanning}>
                <div className={styles.weeklyPlanningHeader}>
                  <span className={styles.productStepNumber}>
                    04
                  </span>

                  <p className={styles.weeklyPlanningLabel}>
                    Weekly Planning
                  </p>

                  <h3>
                    Commit only what is ready.
                  </h3>

                  <p className={styles.weeklyPlanningDescription}>
                    RitsuFlow™ verifies Make Ready conditions
                    before an activity enters the Weekly Plan.
                    Constrained work remains visible, but cannot
                    be committed until the required conditions
                    are cleared.
                  </p>
                </div>

                <div className={styles.weeklySequence}>
                  <article className={styles.weeklyState}>
                    <div
                      className={`${styles.weeklyStateBadge} ${styles.weeklyStateBadgeBlocked}`}
                    >
                      <span />
                      Not Ready
                    </div>

                    <div className={styles.weeklyScreenshot}>
                      <Image
                        src="/wp-not-ready.png"
                        alt="RitsuFlow Weekly Planning showing an activity that is not ready and cannot be committed because Make Ready conditions remain unresolved."
                        width={1772}
                        height={858}
                        sizes="(max-width: 760px) 100vw, 50vw"
                        style={{
                          width: '100%',
                          height: 'auto',
                          display: 'block',
                        }}
                      />
                    </div>

                    <div className={styles.weeklyStateCopy}>
                      <h4>
                        Not Ready, Not Committed
                      </h4>

                      <p>
                        Activities with unresolved constraints
                        remain blocked from the Weekly Plan.
                      </p>
                    </div>
                  </article>

                  <div
                    className={styles.weeklyTransition}
                    aria-label="Constraint resolution allows work to become ready to commit"
                  >
                    <div className={styles.weeklyTransitionTrack}>
                      <span className={styles.weeklyTransitionStart} />
                      <span className={styles.weeklyTransitionPulse} />

                      <span className={styles.weeklyTransitionArrow}>
                        →
                      </span>
                    </div>

                    <div className={styles.weeklyTransitionLabel}>
                      <span>
                        Constraint Resolution
                      </span>

                      <small>
                        Clear Make Ready conditions
                      </small>
                    </div>
                  </div>

                  <article className={styles.weeklyState}>
                    <div
                      className={`${styles.weeklyStateBadge} ${styles.weeklyStateBadgeReady}`}
                    >
                      <span />
                      Ready
                    </div>

                    <div className={styles.weeklyScreenshot}>
                      <Image
                        src="/wp-ready.png"
                        alt="RitsuFlow Weekly Planning showing an activity that is ready and eligible to become a weekly commitment after Make Ready conditions are cleared."
                        width={1772}
                        height={858}
                        sizes="(max-width: 760px) 100vw, 50vw"
                        style={{
                          width: '100%',
                          height: 'auto',
                          display: 'block',
                        }}
                      />
                    </div>

                    <div className={styles.weeklyStateCopy}>
                      <h4>
                        Ready to Commit
                      </h4>

                      <p>
                        Once all Make Ready conditions are
                        cleared, the activity can become a
                        reliable weekly commitment.
                      </p>
                    </div>
                  </article>
                </div>

                <div className={styles.weeklyDecisionRule}>
                  <span className={styles.weeklyDecisionRuleIcon}>
                    WP
                  </span>

                  <div>
                    <strong>
                      Make Ready protects the commitment.
                    </strong>

                    <p>
                      Work does not move into the Weekly Plan
                      simply because it is scheduled. It must
                      first satisfy the conditions required for
                      reliable execution.
                    </p>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* ===================================================
            FLOW BRIDGE
        =================================================== */}

        <section className={styles.flowBridge}>
          <div className={styles.sectionInner}>
            <div className={styles.flowBridgeLine}>
              <span>Master Plan</span>
              <strong>→</strong>
              <span>Lookahead</span>
              <strong>→</strong>
              <span>Make Ready</span>
              <strong>→</strong>
              <span>Weekly Plan</span>
              <strong>→</strong>
              <span>Production</span>
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
            DEVELOPMENT ROADMAP
        =================================================== */}

        <section
          className={styles.roadmapSection}
          id="roadmap"
        >
          <div className={styles.roadmapGlowOne} />
          <div className={styles.roadmapGlowTwo} />

          <div className={styles.roadmapInner}>
            <div className={styles.roadmapHeader}>
              <p className={styles.roadmapEyebrow}>
                <span />
                Development roadmap
              </p>

              <h2>
                Building the future of
                <br />
                construction production management.
              </h2>

              <p>
                From planning to execution. From readiness
                to results.
              </p>
            </div>

            <div className={styles.roadmapGrid}>
              {roadmapSteps.map((step) => (
                <article
                  key={step.number}
                  className={`${styles.roadmapCard} ${
                    step.featured
                      ? styles.roadmapCardFeatured
                      : ''
                  }`}
                >
                  <div className={styles.roadmapCardTop}>
                    <span className={styles.roadmapNumber}>
                      {step.number}
                    </span>

                    <span className={styles.roadmapDate}>
                      {step.date}
                    </span>
                  </div>

                  <div className={styles.roadmapNode}>
                    <span />
                  </div>

                  <h3>
                    {step.title}
                  </h3>

                  <p>
                    {step.description}
                  </p>

                  {step.featured && (
                    <span className={styles.roadmapFeaturedBadge}>
                      External trial milestone
                    </span>
                  )}
                </article>
              ))}
            </div>

            <div className={styles.trialRelease}>
              <div className={styles.trialReleaseLabel}>
                RitsuFlow™ V1 Trial Release
              </div>

              <strong>
                November 2026
              </strong>

              <p>
                Real projects. Real feedback. Real impact.
              </p>
            </div>

            <div className={styles.roadmapPrinciples}>
              {roadmapPrinciples.map((principle) => (
                <article
                  key={principle.title}
                  className={styles.roadmapPrinciple}
                >
                  <span className={styles.roadmapPrincipleIcon}>
                    {principle.icon}
                  </span>

                  <div>
                    <h3>
                      {principle.title}
                    </h3>

                    <p>
                      {principle.description}
                    </p>
                  </div>
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
