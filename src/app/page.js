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
    date: 'H1 2027',
    title: 'Commercial Launch & Evolution',
    description:
      'Refine the product, prepare commercial deployment, and continue expanding the RitsuFlow platform.',
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
                RitsuFlow™ is being developed through a
                structured sequence of planning,
                integration, validation, and field-testing
                milestones.
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


============================================================
FILE: app/landing.module.css
============================================================

.page {
  --navy-950: #061b2f;
  --navy-900: #082a4a;
  --navy-800: #0b3b66;

  --blue-600: #1677d2;
  --blue-100: #dceeff;

  --teal-600: #079785;
  --teal-500: #08aa96;
  --teal-400: #16b8a4;
  --teal-200: #a8ebe2;
  --teal-100: #d9f6f1;
  --teal-50: #f1fcfa;

  --slate-800: #1e293b;
  --slate-700: #334155;
  --slate-600: #475569;
  --slate-500: #64748b;
  --slate-400: #94a3b8;
  --slate-300: #cbd5e1;
  --slate-200: #e2e8f0;
  --slate-100: #f1f5f9;
  --slate-50: #f8fafc;

  --white: #ffffff;

  min-height: 100vh;
  overflow-x: hidden;

  color: var(--navy-950);

  background:
    radial-gradient(
      circle at 90% 4%,
      rgba(8, 170, 150, 0.08),
      transparent 28rem
    ),
    radial-gradient(
      circle at 5% 40%,
      rgba(22, 119, 210, 0.04),
      transparent 32rem
    ),
    #ffffff;
}


/* ============================================================
   NAVIGATION
============================================================ */

.navigation {
  position: sticky;
  top: 0;
  z-index: 100;

  border-bottom: 1px solid rgba(203, 213, 225, 0.62);

  background: rgba(255, 255, 255, 0.9);

  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.navigationInner {
  display: flex;
  align-items: center;
  justify-content: space-between;

  width: 100%;
  max-width: 1280px;
  min-height: 76px;

  margin: 0 auto;
  padding: 0 32px;
}

.brand {
  display: inline-flex;
  align-items: center;

  flex-shrink: 0;

  text-decoration: none;
}

.navigationLinks {
  display: flex;
  align-items: center;
  gap: 30px;
}

.navigationLinks a {
  position: relative;

  color: var(--slate-700);

  text-decoration: none;

  font-size: 0.92rem;
  font-weight: 700;

  transition:
    color 160ms ease;
}

.navigationLinks a::after {
  position: absolute;

  left: 0;
  right: 0;
  bottom: -8px;

  height: 2px;

  content: '';

  border-radius: 99px;

  background: var(--teal-500);

  transform: scaleX(0);

  transform-origin: center;

  transition:
    transform 180ms ease;
}

.navigationLinks a:hover {
  color: var(--navy-900);
}

.navigationLinks a:hover::after {
  transform: scaleX(1);
}

.navigationActions {
  display: flex;
  align-items: center;
  gap: 10px;
}


/* ============================================================
   BUTTONS
============================================================ */

.secondaryButton,
.primaryButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  min-height: 46px;

  padding: 0 20px;

  border-radius: 10px;

  text-decoration: none;

  font-size: 0.92rem;
  font-weight: 800;

  transition:
    transform 160ms ease,
    background-color 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.secondaryButton {
  color: var(--navy-900);

  border: 1px solid var(--slate-300);

  background: rgba(255, 255, 255, 0.9);
}

.primaryButton {
  color: var(--white);

  border: 1px solid var(--teal-600);

  background:
    linear-gradient(
      135deg,
      var(--teal-600),
      var(--teal-500)
    );

  box-shadow:
    0 12px 30px rgba(8, 170, 150, 0.2);
}

.secondaryButton:hover,
.primaryButton:hover {
  transform: translateY(-2px);
}

.secondaryButton:hover {
  border-color: var(--teal-500);

  box-shadow:
    0 10px 26px rgba(6, 27, 47, 0.08);
}

.primaryButton:hover {
  background:
    linear-gradient(
      135deg,
      #078c7c,
      #0cb8a3
    );

  box-shadow:
    0 16px 34px rgba(8, 170, 150, 0.26);
}


/* ============================================================
   HERO
============================================================ */

.hero {
  position: relative;

  display: flex;
  align-items: center;

  min-height: 720px;

  overflow: hidden;

  border-bottom: 1px solid rgba(226, 232, 240, 0.85);

  background:
    radial-gradient(
      circle at 82% 46%,
      rgba(8, 170, 150, 0.08),
      transparent 30rem
    ),
    linear-gradient(
      180deg,
      #ffffff 0%,
      #fbfefe 100%
    );
}

.heroContent {
  position: relative;
  z-index: 5;

  width: 100%;
  max-width: 1280px;

  margin: 0 auto;

  padding:
    100px
    32px
    100px;
}


/* ============================================================
   DEVELOPMENT STATUS
============================================================ */

.developmentStatus {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 9px;

  margin-bottom: 18px;

  padding: 9px 14px;

  color: var(--navy-900);

  border:
    1px solid
    rgba(8, 170, 150, 0.22);

  border-radius: 999px;

  background:
    linear-gradient(
      135deg,
      rgba(241, 252, 250, 0.95),
      rgba(255, 255, 255, 0.95)
    );

  box-shadow:
    0 8px 26px
    rgba(6, 27, 47, 0.06);

  font-size: 0.78rem;
  font-weight: 800;
}

.developmentStatus strong {
  padding-left: 9px;

  color: var(--teal-600);

  border-left:
    1px solid
    rgba(8, 170, 150, 0.24);

  font-size: 0.72rem;
  font-weight: 900;

  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.developmentStatusDot {
  width: 8px;
  height: 8px;

  flex-shrink: 0;

  border-radius: 50%;

  background: var(--teal-500);

  box-shadow:
    0 0 0 5px
    rgba(8, 170, 150, 0.09);

  animation:
    statusPulse
    2.2s
    ease-in-out
    infinite;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;

  margin: 0 0 22px;

  padding: 7px 12px;

  color: var(--teal-600);

  border: 1px solid rgba(8, 170, 150, 0.2);
  border-radius: 999px;

  background: rgba(217, 246, 241, 0.52);

  font-size: 0.74rem;
  font-weight: 900;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.eyebrowDot {
  width: 7px;
  height: 7px;

  flex-shrink: 0;

  border-radius: 50%;

  background: var(--teal-500);

  box-shadow:
    0 0 0 5px rgba(8, 170, 150, 0.09);
}

.hero h1 {
  max-width: 780px;

  margin: 0;

  color: var(--navy-950);

  font-size: clamp(
    3.8rem,
    6vw,
    6.4rem
  );

  line-height: 0.95;

  letter-spacing: -0.07em;
}

.hero h1 span {
  color: var(--teal-500);
}

.heroDescription {
  max-width: 660px;

  margin: 32px 0 0;

  color: var(--slate-600);

  font-size: 1.18rem;
  line-height: 1.75;
}

.heroActions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;

  margin-top: 36px;
}


/* ============================================================
   HERO PRINCIPLES
============================================================ */

.heroPrinciples {
  display: grid;

  grid-template-columns:
    repeat(3, minmax(0, 1fr));

  gap: 36px;

  max-width: 820px;

  margin-top: 62px;
}

.heroPrinciples > div {
  position: relative;

  display: flex;
  flex-direction: column;
  gap: 8px;

  padding-left: 20px;
}

.heroPrinciples > div::before {
  position: absolute;

  top: 3px;
  bottom: 3px;
  left: 0;

  width: 3px;

  content: '';

  border-radius: 999px;

  background:
    linear-gradient(
      180deg,
      var(--teal-500),
      rgba(8, 170, 150, 0.15)
    );
}

.heroPrinciples strong {
  color: var(--navy-900);

  font-size: 0.93rem;
}

.heroPrinciples span {
  color: var(--slate-500);

  font-size: 0.83rem;
  line-height: 1.55;
}


/* ============================================================
   ORGANIC HERO FLOW
============================================================ */

.heroFlowBackground {
  position: absolute;

  z-index: 1;

  top: 0;
  right: -4%;
  bottom: 0;

  width: 66%;

  overflow: hidden;

  pointer-events: none;

  opacity: 0.9;
}

.heroFlowBackground::before {
  position: absolute;

  top: 50%;
  right: 2%;

  width: 680px;
  height: 680px;

  content: '';

  border-radius: 50%;

  background:
    radial-gradient(
      circle,
      rgba(8, 170, 150, 0.09),
      rgba(8, 170, 150, 0.025) 42%,
      transparent 70%
    );

  transform:
    translateY(-50%);

  animation:
    flowPulse
    8s
    ease-in-out
    infinite alternate;
}

.flowLineOne,
.flowLineTwo,
.flowLineThree,
.flowLineFour,
.flowLineFive {
  position: absolute;

  right: -9%;

  width: 110%;
  height: 150px;

  border-top:
    1px
    solid
    rgba(8, 170, 150, 0.26);

  border-radius:
    50% 46% 52% 48%;

  transform-origin: right center;

  will-change: transform;
}

.flowLineOne {
  top: 18%;

  animation:
    organicFlowOne
    13s
    ease-in-out
    infinite alternate;
}

.flowLineTwo {
  top: 31%;

  border-color:
    rgba(22, 119, 210, 0.15);

  animation:
    organicFlowTwo
    17s
    ease-in-out
    infinite alternate;
}

.flowLineThree {
  top: 44%;

  border-width: 2px;

  border-color:
    rgba(8, 170, 150, 0.46);

  animation:
    organicFlowThree
    11s
    ease-in-out
    infinite alternate;
}

.flowLineFour {
  top: 57%;

  border-color:
    rgba(8, 170, 150, 0.2);

  animation:
    organicFlowTwo
    15s
    ease-in-out
    infinite alternate-reverse;
}

.flowLineFive {
  top: 69%;

  border-color:
    rgba(22, 119, 210, 0.12);

  animation:
    organicFlowOne
    19s
    ease-in-out
    infinite alternate-reverse;
}

.heroFlowBackground::after {
  position: absolute;

  top: 47%;
  right: 5%;

  width: 52%;
  height: 2px;

  content: '';

  border-radius: 999px;

  background:
    linear-gradient(
      90deg,
      transparent,
      rgba(8, 170, 150, 0.18),
      var(--teal-500),
      transparent
    );

  box-shadow:
    0 0 22px
    rgba(8, 170, 150, 0.28);

  animation:
    horizontalFlow
    6s
    ease-in-out
    infinite alternate;
}


/* ============================================================
   PRODUCT WORKFLOW
============================================================ */

.productWorkflow {
  position: relative;

  padding:
    110px
    32px
    120px;

  background:
    linear-gradient(
      180deg,
      #f8fbfc 0%,
      #ffffff 18%,
      #ffffff 100%
    );
}

.sectionInner {
  width: 100%;
  max-width: 1280px;

  margin: 0 auto;
}

.sectionHeader {
  max-width: 790px;

  margin-bottom: 74px;
}

.sectionHeader h2 {
  margin: 0;

  color: var(--navy-950);

  font-size:
    clamp(
      2.5rem,
      4vw,
      4.1rem
    );

  line-height: 1.04;

  letter-spacing: -0.055em;
}

.sectionHeader > p:not(.eyebrow) {
  margin: 22px 0 0;

  color: var(--slate-500);

  font-size: 1.08rem;
  line-height: 1.75;
}


/* ============================================================
   PRODUCT STORY
============================================================ */

.productStory {
  display: flex;
  flex-direction: column;

  gap: 120px;
}

.productStep {
  display: grid;

  grid-template-columns:
    minmax(210px, 0.25fr)
    minmax(0, 1fr);

  align-items: center;

  gap: 50px;
}

.productStep:nth-child(even) {
  grid-template-columns:
    minmax(0, 1fr)
    minmax(210px, 0.25fr);
}

.productStep:nth-child(even)
.productStepCopy {
  order: 2;
}

.productStep:nth-child(even)
.productScreenshot {
  order: 1;
}

.productStepCopy {
  position: relative;
}

.productStepNumber {
  display: block;

  margin-bottom: 14px;

  color: var(--teal-500);

  font-size: 2.3rem;
  font-weight: 900;
  letter-spacing: -0.04em;
}

.productStepCopy h3 {
  margin: 0;

  color: var(--navy-950);

  font-size: 1.55rem;
  line-height: 1.15;
}

.productStepCopy p {
  margin: 18px 0 0;

  color: var(--slate-600);

  font-size: 0.98rem;
  line-height: 1.75;
}

.productHighlights {
  display: flex;
  flex-direction: column;

  gap: 9px;

  margin-top: 24px;
}

.productHighlights span {
  position: relative;

  padding-left: 20px;

  color: var(--slate-700);

  font-size: 0.84rem;
  font-weight: 700;
}

.productHighlights span::before {
  position: absolute;

  top: 50%;
  left: 0;

  width: 8px;
  height: 8px;

  content: '';

  border-radius: 50%;

  background: var(--teal-500);

  transform:
    translateY(-50%);
}


/* ============================================================
   REAL PRODUCT SCREENSHOTS
============================================================ */

.productScreenshot {
  position: relative;

  overflow: hidden;

  border:
    1px solid
    rgba(203, 213, 225, 0.85);

  border-radius: 18px;

  background: #ffffff;

  box-shadow:
    0 30px 70px rgba(6, 27, 47, 0.12),
    0 8px 24px rgba(6, 27, 47, 0.05);

  transition:
    transform 320ms ease,
    box-shadow 320ms ease;
}

.productScreenshot::before {
  position: absolute;

  z-index: 2;

  inset: 0;

  content: '';

  pointer-events: none;

  border-radius: inherit;

  box-shadow:
    inset 0 1px 0
    rgba(255, 255, 255, 0.8);
}

.productScreenshot:hover {
  transform:
    translateY(-5px);

  box-shadow:
    0 38px 84px rgba(6, 27, 47, 0.15),
    0 10px 30px rgba(6, 27, 47, 0.06);
}


/* ============================================================
   WEEKLY PLANNING
============================================================ */

.weeklyPlanning {
  position: relative;

  padding:
    58px
    0
    0;

  border-top:
    1px solid
    rgba(203, 213, 225, 0.72);
}

.weeklyPlanning::before {
  position: absolute;

  top: -1px;
  left: 0;

  width: 150px;
  height: 2px;

  content: '';

  border-radius: 999px;

  background:
    linear-gradient(
      90deg,
      var(--teal-500),
      transparent
    );
}

.weeklyPlanningHeader {
  max-width: 780px;

  margin-bottom: 52px;
}

.weeklyPlanningLabel {
  margin:
    0
    0
    10px;

  color: var(--teal-600);

  font-size: 0.76rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.weeklyPlanningHeader h3 {
  margin: 0;

  color: var(--navy-950);

  font-size:
    clamp(
      2.1rem,
      3.7vw,
      3.6rem
    );

  line-height: 1.04;

  letter-spacing: -0.055em;
}

.weeklyPlanningDescription {
  max-width: 760px;

  margin:
    22px
    0
    0;

  color: var(--slate-600);

  font-size: 1.02rem;
  line-height: 1.75;
}


/* ============================================================
   WEEKLY PLANNING SEQUENCE
============================================================ */

.weeklySequence {
  display: grid;

  grid-template-columns:
    minmax(0, 1fr)
    120px
    minmax(0, 1fr);

  align-items: center;

  gap: 24px;
}

.weeklyState {
  min-width: 0;
}

.weeklyStateBadge {
  display: inline-flex;
  align-items: center;
  gap: 8px;

  margin-bottom: 14px;

  padding:
    7px
    11px;

  border-radius: 999px;

  font-size: 0.69rem;
  font-weight: 900;

  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.weeklyStateBadge span {
  width: 7px;
  height: 7px;

  flex-shrink: 0;

  border-radius: 50%;
}

.weeklyStateBadgeBlocked {
  color: var(--slate-700);

  border:
    1px solid
    rgba(100, 116, 139, 0.2);

  background:
    rgba(241, 245, 249, 0.85);
}

.weeklyStateBadgeBlocked span {
  background: var(--slate-400);
}

.weeklyStateBadgeReady {
  color: var(--teal-600);

  border:
    1px solid
    rgba(8, 170, 150, 0.2);

  background:
    rgba(217, 246, 241, 0.54);
}

.weeklyStateBadgeReady span {
  background: var(--teal-500);

  box-shadow:
    0 0 0 5px
    rgba(8, 170, 150, 0.08);
}

.weeklyScreenshot {
  position: relative;

  overflow: hidden;

  border:
    1px solid
    rgba(203, 213, 225, 0.86);

  border-radius: 16px;

  background: #ffffff;

  box-shadow:
    0 24px 56px
    rgba(6, 27, 47, 0.11),
    0 6px 18px
    rgba(6, 27, 47, 0.045);

  transition:
    transform 280ms ease,
    border-color 280ms ease,
    box-shadow 280ms ease;
}

.weeklyScreenshot::before {
  position: absolute;

  z-index: 2;

  inset: 0;

  content: '';

  pointer-events: none;

  border-radius: inherit;

  box-shadow:
    inset 0 1px 0
    rgba(255, 255, 255, 0.78);
}

.weeklyScreenshot:hover {
  transform:
    translateY(-4px);

  border-color:
    rgba(8, 170, 150, 0.26);

  box-shadow:
    0 30px 68px
    rgba(6, 27, 47, 0.13),
    0 8px 22px
    rgba(6, 27, 47, 0.055);
}

.weeklyStateCopy {
  padding:
    22px
    4px
    0;
}

.weeklyStateCopy h4 {
  margin: 0;

  color: var(--navy-950);

  font-size: 1.14rem;
  line-height: 1.3;
}

.weeklyStateCopy p {
  margin:
    9px
    0
    0;

  color: var(--slate-500);

  font-size: 0.88rem;
  line-height: 1.65;
}


/* ============================================================
   WEEKLY TRANSITION
============================================================ */

.weeklyTransition {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  min-width: 0;

  text-align: center;
}

.weeklyTransitionTrack {
  position: relative;

  width: 100%;
  height: 30px;
}

.weeklyTransitionTrack::before {
  position: absolute;

  top: 50%;
  left: 0;
  right: 12px;

  height: 2px;

  content: '';

  border-radius: 999px;

  background:
    linear-gradient(
      90deg,
      rgba(148, 163, 184, 0.55),
      rgba(8, 170, 150, 0.85)
    );

  transform:
    translateY(-50%);
}

.weeklyTransitionStart {
  position: absolute;

  z-index: 2;

  top: 50%;
  left: -1px;

  width: 10px;
  height: 10px;

  border-radius: 50%;

  background: var(--slate-400);

  box-shadow:
    0 0 0 5px
    rgba(148, 163, 184, 0.1);

  transform:
    translateY(-50%);
}

.weeklyTransitionPulse {
  position: absolute;

  z-index: 3;

  top: 50%;
  left: 10%;

  width: 9px;
  height: 9px;

  border-radius: 50%;

  background: var(--teal-500);

  box-shadow:
    0 0 0 5px
    rgba(8, 170, 150, 0.09);

  transform:
    translateY(-50%);

  animation:
    weeklyFlow
    3.2s
    ease-in-out
    infinite;
}

.weeklyTransitionArrow {
  position: absolute;

  z-index: 4;

  top: 50%;
  right: 0;

  color: var(--teal-500);

  font-size: 1.25rem;
  font-weight: 900;

  transform:
    translateY(-54%);
}

.weeklyTransitionLabel {
  display: flex;
  flex-direction: column;
  align-items: center;

  gap: 5px;

  margin-top: 8px;
}

.weeklyTransitionLabel span {
  color: var(--navy-900);

  font-size: 0.76rem;
  font-weight: 900;
}

.weeklyTransitionLabel small {
  color: var(--slate-400);

  font-size: 0.68rem;
  line-height: 1.4;
}


/* ============================================================
   WEEKLY DECISION RULE
============================================================ */

.weeklyDecisionRule {
  display: flex;
  align-items: flex-start;
  gap: 18px;

  max-width: 790px;

  margin:
    54px
    auto
    0;

  padding:
    24px
    26px;

  border:
    1px solid
    rgba(8, 170, 150, 0.16);

  border-radius: 16px;

  background:
    linear-gradient(
      135deg,
      rgba(241, 252, 250, 0.85),
      rgba(255, 255, 255, 0.96)
    );
}

.weeklyDecisionRuleIcon {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  width: 44px;
  height: 44px;

  flex-shrink: 0;

  color: var(--teal-600);

  border:
    1px solid
    rgba(8, 170, 150, 0.17);

  border-radius: 12px;

  background: var(--teal-100);

  font-size: 0.72rem;
  font-weight: 900;
}

.weeklyDecisionRule strong {
  display: block;

  color: var(--navy-900);

  font-size: 0.94rem;
}

.weeklyDecisionRule p {
  margin:
    7px
    0
    0;

  color: var(--slate-500);

  font-size: 0.84rem;
  line-height: 1.6;
}


/* ============================================================
   FLOW BRIDGE
============================================================ */

.flowBridge {
  position: relative;

  overflow: hidden;

  padding:
    54px
    32px;

  border-top:
    1px solid
    rgba(226, 232, 240, 0.9);

  border-bottom:
    1px solid
    rgba(226, 232, 240, 0.9);

  background:
    linear-gradient(
      90deg,
      #f5fcfb,
      #ffffff,
      #f5fcfb
    );
}

.flowBridge::before,
.flowBridge::after {
  position: absolute;

  top: 50%;

  width: 25%;
  height: 1px;

  content: '';

  background:
    linear-gradient(
      90deg,
      transparent,
      rgba(8, 170, 150, 0.3)
    );
}

.flowBridge::before {
  left: 0;
}

.flowBridge::after {
  right: 0;

  transform:
    rotate(180deg);
}

.flowBridgeLine {
  position: relative;
  z-index: 2;

  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;

  color: var(--navy-900);

  text-align: center;

  font-size: 0.91rem;
  font-weight: 800;
}

.flowBridgeLine strong {
  color: var(--teal-500);

  font-size: 1.25rem;
}


/* ============================================================
   CAPABILITIES
============================================================ */

.section {
  padding:
    110px
    32px;
}

.capabilityGrid {
  display: grid;

  grid-template-columns:
    repeat(3, minmax(0, 1fr));

  gap: 18px;
}

.capabilityCard {
  position: relative;

  min-height: 210px;

  padding: 30px;

  overflow: hidden;

  border:
    1px solid
    var(--slate-200);

  border-radius: 18px;

  background:
    linear-gradient(
      145deg,
      #ffffff,
      #fbfdfd
    );

  transition:
    transform 200ms ease,
    border-color 200ms ease,
    box-shadow 200ms ease;
}

.capabilityCard::after {
  position: absolute;

  right: -35px;
  bottom: -55px;

  width: 130px;
  height: 130px;

  content: '';

  border-radius: 50%;

  background:
    radial-gradient(
      circle,
      rgba(8, 170, 150, 0.09),
      transparent 70%
    );
}

.capabilityCard:hover {
  transform:
    translateY(-4px);

  border-color:
    rgba(8, 170, 150, 0.32);

  box-shadow:
    0 20px 44px
    rgba(6, 27, 47, 0.08);
}

.capabilityIcon {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  width: 46px;
  height: 46px;

  color: var(--teal-600);

  border:
    1px solid
    rgba(8, 170, 150, 0.15);

  border-radius: 13px;

  background: var(--teal-100);

  font-size: 0.78rem;
  font-weight: 900;
}

.capabilityCard h3 {
  margin:
    22px
    0
    10px;

  color: var(--navy-950);

  font-size: 1.08rem;
}

.capabilityCard p {
  margin: 0;

  color: var(--slate-500);

  font-size: 0.92rem;
  line-height: 1.68;
}


/* ============================================================
   DEVELOPMENT ROADMAP
============================================================ */

.roadmapSection {
  position: relative;

  overflow: hidden;

  margin:
    20px
    32px
    110px;

  padding:
    110px
    32px
    80px;

  border:
    1px solid
    rgba(22, 184, 164, 0.18);

  border-radius: 30px;

  background:
    radial-gradient(
      circle at 82% 16%,
      rgba(8, 170, 150, 0.14),
      transparent 25rem
    ),
    radial-gradient(
      circle at 8% 86%,
      rgba(22, 119, 210, 0.11),
      transparent 28rem
    ),
    linear-gradient(
      145deg,
      #041728,
      #061f35 52%,
      #082a42
    );

  box-shadow:
    0 34px 80px
    rgba(6, 27, 47, 0.18);
}

.roadmapInner {
  position: relative;
  z-index: 3;

  width: 100%;
  max-width: 1216px;

  margin: 0 auto;
}

.roadmapGlowOne,
.roadmapGlowTwo {
  position: absolute;

  border-radius: 50%;

  pointer-events: none;

  filter: blur(10px);
}

.roadmapGlowOne {
  top: -180px;
  right: -160px;

  width: 520px;
  height: 520px;

  background:
    radial-gradient(
      circle,
      rgba(8, 170, 150, 0.13),
      transparent 70%
    );
}

.roadmapGlowTwo {
  left: -190px;
  bottom: -220px;

  width: 560px;
  height: 560px;

  background:
    radial-gradient(
      circle,
      rgba(22, 119, 210, 0.11),
      transparent 70%
    );
}

.roadmapHeader {
  max-width: 830px;

  margin-bottom: 76px;
}

.roadmapEyebrow {
  display: inline-flex;
  align-items: center;
  gap: 9px;

  margin:
    0
    0
    20px;

  padding:
    8px
    13px;

  color: var(--teal-200);

  border:
    1px solid
    rgba(22, 184, 164, 0.22);

  border-radius: 999px;

  background:
    rgba(8, 170, 150, 0.08);

  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.roadmapEyebrow span {
  width: 7px;
  height: 7px;

  border-radius: 50%;

  background: var(--teal-400);

  box-shadow:
    0 0 0 5px
    rgba(22, 184, 164, 0.09);
}

.roadmapHeader h2 {
  margin: 0;

  color: #ffffff;

  font-size:
    clamp(
      2.6rem,
      4.5vw,
      4.6rem
    );

  line-height: 1.02;

  letter-spacing: -0.06em;
}

.roadmapHeader > p:not(.roadmapEyebrow) {
  max-width: 720px;

  margin:
    24px
    0
    0;

  color: rgba(226, 232, 240, 0.76);

  font-size: 1.06rem;
  line-height: 1.75;
}


/* ============================================================
   ROADMAP GRID
============================================================ */

.roadmapGrid {
  display: grid;

  grid-template-columns:
    repeat(4, minmax(0, 1fr));

  gap: 18px;
}

.roadmapCard {
  position: relative;

  display: flex;
  flex-direction: column;

  min-height: 300px;

  padding: 26px;

  overflow: hidden;

  border:
    1px solid
    rgba(148, 163, 184, 0.17);

  border-radius: 18px;

  background:
    linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.055),
      rgba(255, 255, 255, 0.025)
    );

  box-shadow:
    inset 0 1px 0
    rgba(255, 255, 255, 0.04);

  transition:
    transform 200ms ease,
    border-color 200ms ease,
    background 200ms ease;
}

.roadmapCard:hover {
  transform:
    translateY(-4px);

  border-color:
    rgba(22, 184, 164, 0.34);

  background:
    linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.072),
      rgba(8, 170, 150, 0.035)
    );
}

.roadmapCardFeatured {
  border:
    1px solid
    rgba(22, 184, 164, 0.62);

  background:
    radial-gradient(
      circle at 50% 0%,
      rgba(22, 184, 164, 0.16),
      transparent 62%
    ),
    linear-gradient(
      145deg,
      rgba(8, 170, 150, 0.11),
      rgba(255, 255, 255, 0.035)
    );

  box-shadow:
    0 0 0 1px
    rgba(22, 184, 164, 0.08),
    0 0 35px
    rgba(8, 170, 150, 0.12);
}

.roadmapCardTop {
  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 12px;
}

.roadmapNumber {
  color: var(--teal-400);

  font-size: 1.8rem;
  font-weight: 900;

  letter-spacing: -0.04em;
}

.roadmapDate {
  color: var(--teal-200);

  font-size: 0.7rem;
  font-weight: 900;

  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.roadmapNode {
  position: relative;

  height: 30px;

  margin:
    17px
    0
    12px;
}

.roadmapNode::before {
  position: absolute;

  top: 50%;
  left: 0;
  right: -26px;

  height: 1px;

  content: '';

  background:
    linear-gradient(
      90deg,
      rgba(22, 184, 164, 0.5),
      rgba(148, 163, 184, 0.12)
    );
}

.roadmapNode span {
  position: absolute;

  z-index: 2;

  top: 50%;
  left: 0;

  width: 12px;
  height: 12px;

  border:
    2px solid
    #061f35;

  border-radius: 50%;

  background: var(--teal-400);

  box-shadow:
    0 0 0 5px
    rgba(22, 184, 164, 0.1);

  transform:
    translateY(-50%);
}

.roadmapCard h3 {
  margin: 0;

  color: #ffffff;

  font-size: 1.08rem;
  line-height: 1.3;
}

.roadmapCard p {
  margin:
    14px
    0
    0;

  color:
    rgba(203, 213, 225, 0.72);

  font-size: 0.86rem;
  line-height: 1.65;
}

.roadmapFeaturedBadge {
  display: inline-flex;

  align-self: flex-start;

  margin-top: auto;
  padding:
    7px
    10px;

  color: var(--teal-200);

  border:
    1px solid
    rgba(22, 184, 164, 0.24);

  border-radius: 999px;

  background:
    rgba(8, 170, 150, 0.08);

  font-size: 0.67rem;
  font-weight: 900;

  letter-spacing: 0.05em;
  text-transform: uppercase;
}


/* ============================================================
   TRIAL RELEASE
============================================================ */

.trialRelease {
  position: relative;

  margin-top: 54px;

  padding:
    40px
    32px;

  overflow: hidden;

  text-align: center;

  border-top:
    1px solid
    rgba(22, 184, 164, 0.2);

  border-bottom:
    1px solid
    rgba(22, 184, 164, 0.2);

  background:
    linear-gradient(
      90deg,
      transparent,
      rgba(8, 170, 150, 0.065),
      transparent
    );
}

.trialRelease::before {
  position: absolute;

  top: 0;
  left: 50%;

  width: 280px;
  height: 100%;

  content: '';

  background:
    radial-gradient(
      circle,
      rgba(22, 184, 164, 0.11),
      transparent 70%
    );

  transform:
    translateX(-50%);
}

.trialReleaseLabel,
.trialRelease strong,
.trialRelease p {
  position: relative;
  z-index: 2;
}

.trialReleaseLabel {
  color: var(--teal-300, #8ee5da);

  font-size: 0.8rem;
  font-weight: 900;

  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.trialRelease strong {
  display: block;

  margin-top: 11px;

  color: #ffffff;

  font-size:
    clamp(
      2rem,
      4vw,
      3.7rem
    );

  letter-spacing: -0.04em;
  text-transform: uppercase;

  text-shadow:
    0 0 25px
    rgba(22, 184, 164, 0.22);
}

.trialRelease p {
  margin:
    10px
    0
    0;

  color:
    rgba(226, 232, 240, 0.7);

  font-size: 0.96rem;
}


/* ============================================================
   ROADMAP PRINCIPLES
============================================================ */

.roadmapPrinciples {
  display: grid;

  grid-template-columns:
    repeat(4, minmax(0, 1fr));

  gap: 18px;

  margin-top: 42px;
}

.roadmapPrinciple {
  display: flex;

  gap: 15px;

  padding:
    22px
    18px;

  border:
    1px solid
    rgba(148, 163, 184, 0.12);

  border-radius: 15px;

  background:
    rgba(255, 255, 255, 0.025);
}

.roadmapPrincipleIcon {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  width: 40px;
  height: 40px;

  flex-shrink: 0;

  color: var(--teal-200);

  border:
    1px solid
    rgba(22, 184, 164, 0.18);

  border-radius: 11px;

  background:
    rgba(8, 170, 150, 0.08);

  font-size: 0.7rem;
  font-weight: 900;
}

.roadmapPrinciple h3 {
  margin: 0;

  color: #ffffff;

  font-size: 0.88rem;
}

.roadmapPrinciple p {
  margin:
    7px
    0
    0;

  color:
    rgba(203, 213, 225, 0.64);

  font-size: 0.76rem;
  line-height: 1.55;
}


/* ============================================================
   CLOSING
============================================================ */

.closing {
  position: relative;

  max-width: 1280px;

  margin:
    0
    auto
    90px;

  overflow: hidden;

  border:
    1px solid
    rgba(8, 170, 150, 0.16);

  border-radius: 28px;

  background:
    linear-gradient(
      135deg,
      #f6fcfb 0%,
      #ffffff 50%,
      #f1fbf9 100%
    );
}

.closingContent {
  position: relative;
  z-index: 3;

  max-width: 760px;

  padding:
    78px
    72px;
}

.closing h2 {
  margin: 0;

  color: var(--navy-950);

  font-size:
    clamp(
      2.6rem,
      4vw,
      4.2rem
    );

  line-height: 1.02;

  letter-spacing: -0.055em;
}

.closing p {
  max-width: 680px;

  margin:
    24px
    0
    32px;

  color: var(--slate-600);

  font-size: 1.05rem;
  line-height: 1.75;
}


/* ============================================================
   CLOSING ORGANIC FLOW
============================================================ */

.closingFlowBackground {
  position: absolute;

  top: 0;
  right: 0;
  bottom: 0;

  width: 56%;

  pointer-events: none;
}

.closingFlowBackground span {
  position: absolute;

  right: -10%;

  width: 105%;
  height: 150px;

  border-top:
    1px solid
    rgba(8, 170, 150, 0.22);

  border-radius: 50%;
}

.closingFlowBackground span:nth-child(1) {
  top: 24%;

  animation:
    closingFlow
    14s
    ease-in-out
    infinite alternate;
}

.closingFlowBackground span:nth-child(2) {
  top: 46%;

  border-color:
    rgba(22, 119, 210, 0.12);

  animation:
    closingFlow
    18s
    ease-in-out
    infinite alternate-reverse;
}

.closingFlowBackground span:nth-child(3) {
  top: 66%;

  border-width: 2px;

  border-color:
    rgba(8, 170, 150, 0.3);

  animation:
    closingFlow
    11s
    ease-in-out
    infinite alternate;
}


/* ============================================================
   FOOTER
============================================================ */

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 24px;

  width: 100%;
  max-width: 1280px;

  margin: 0 auto;

  padding:
    32px
    32px
    44px;

  color: var(--slate-500);

  border-top:
    1px solid
    var(--slate-200);

  font-size: 0.82rem;
}


/* ============================================================
   ANIMATIONS
============================================================ */

@keyframes organicFlowOne {
  0% {
    transform:
      translate3d(0, -8px, 0)
      rotate(-1deg)
      scaleX(1);
  }

  100% {
    transform:
      translate3d(-28px, 14px, 0)
      rotate(1.8deg)
      scaleX(1.03);
  }
}

@keyframes organicFlowTwo {
  0% {
    transform:
      translate3d(8px, 9px, 0)
      rotate(1deg);
  }

  100% {
    transform:
      translate3d(-36px, -13px, 0)
      rotate(-2deg);
  }
}

@keyframes organicFlowThree {
  0% {
    transform:
      translate3d(-5px, -4px, 0)
      rotate(-0.5deg)
      scaleX(0.98);
  }

  100% {
    transform:
      translate3d(-42px, 15px, 0)
      rotate(2deg)
      scaleX(1.05);
  }
}

@keyframes horizontalFlow {
  0% {
    transform:
      translateX(8%);
    opacity: 0.35;
  }

  100% {
    transform:
      translateX(-12%);
    opacity: 0.82;
  }
}

@keyframes flowPulse {
  0% {
    transform:
      translateY(-50%)
      scale(0.94);

    opacity: 0.7;
  }

  100% {
    transform:
      translateY(-50%)
      scale(1.08);

    opacity: 1;
  }
}

@keyframes closingFlow {
  0% {
    transform:
      translate3d(0, -6px, 0)
      rotate(-1deg);
  }

  100% {
    transform:
      translate3d(-30px, 12px, 0)
      rotate(2deg);
  }
}

@keyframes statusPulse {
  0%,
  100% {
    transform: scale(1);

    box-shadow:
      0 0 0 5px
      rgba(8, 170, 150, 0.08);
  }

  50% {
    transform: scale(1.08);

    box-shadow:
      0 0 0 8px
      rgba(8, 170, 150, 0.035);
  }
}

@keyframes weeklyFlow {
  0% {
    left: 8%;
    opacity: 0;
  }

  18% {
    opacity: 1;
  }

  82% {
    opacity: 1;
  }

  100% {
    left: 82%;
    opacity: 0;
  }
}


/* ============================================================
   TABLET
============================================================ */

@media (max-width: 1050px) {

  .navigationInner {
    padding:
      0
      24px;
  }

  .navigationLinks {
    gap: 22px;
  }

  .heroContent {
    padding:
      90px
      24px;
  }

  .heroFlowBackground {
    width: 72%;

    opacity: 0.55;
  }

  .heroPrinciples {
    grid-template-columns:
      repeat(3, 1fr);

    max-width: 760px;
  }

  .productWorkflow,
  .section {
    padding-left: 24px;
    padding-right: 24px;
  }

  .productStep,
  .productStep:nth-child(even) {
    grid-template-columns: 1fr;

    gap: 36px;
  }

  .productStep:nth-child(even)
  .productStepCopy,
  .productStep:nth-child(even)
  .productScreenshot {
    order: initial;
  }

  .productStepCopy {
    max-width: 620px;
  }

  .weeklySequence {
    grid-template-columns:
      minmax(0, 1fr)
      92px
      minmax(0, 1fr);

    gap: 16px;
  }

  .weeklyTransitionLabel span {
    font-size: 0.7rem;
  }

  .weeklyTransitionLabel small {
    display: none;
  }

  .capabilityGrid {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }

  .roadmapSection {
    margin-left: 24px;
    margin-right: 24px;

    padding:
      90px
      28px
      70px;
  }

  .roadmapGrid {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }

  .roadmapPrinciples {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }

  .closing {
    margin-left: 24px;
    margin-right: 24px;
  }

  .closingContent {
    padding:
      64px
      54px;
  }

}


/* ============================================================
   MOBILE / SMALL TABLET
============================================================ */

@media (max-width: 760px) {

  .navigationInner {
    min-height: 68px;

    padding:
      0
      18px;
  }

  .navigationLinks {
    display: none;
  }

  .navigationActions
  .secondaryButton {
    display: none;
  }

  .hero {
    min-height: auto;
  }

  .heroContent {
    padding:
      70px
      20px
      72px;
  }

  .developmentStatus {
    max-width: 100%;

    border-radius: 14px;
  }

  .developmentStatus strong {
    width: 100%;

    padding:
      7px
      0
      0;

    border-left: 0;

    border-top:
      1px solid
      rgba(8, 170, 150, 0.16);
  }

  .heroFlowBackground {
    top: auto;
    right: -30%;
    bottom: 0;

    width: 120%;
    height: 52%;

    opacity: 0.38;
  }

  .hero h1 {
    font-size:
      clamp(
        3.3rem,
        13vw,
        4.6rem
      );
  }

  .heroDescription {
    font-size: 1rem;
  }

  .heroPrinciples {
    grid-template-columns: 1fr;

    gap: 24px;

    margin-top: 48px;
  }

  .productWorkflow {
    padding:
      82px
      18px
      90px;
  }

  .section {
    padding:
      84px
      18px;
  }

  .sectionHeader {
    margin-bottom: 52px;
  }

  .productStory {
    gap: 84px;
  }

  .productStep {
    gap: 28px;
  }

  .productStepNumber {
    font-size: 2rem;
  }

  .productStepCopy h3 {
    font-size: 1.35rem;
  }

  .productScreenshot {
    border-radius: 12px;

    box-shadow:
      0 18px 45px
      rgba(6, 27, 47, 0.11);
  }

  .weeklyPlanning {
    padding-top: 48px;
  }

  .weeklyPlanningHeader {
    margin-bottom: 40px;
  }

  .weeklyPlanningHeader h3 {
    font-size:
      clamp(
        2rem,
        10vw,
        3rem
      );
  }

  .weeklyPlanningDescription {
    font-size: 0.96rem;
  }

  .weeklySequence {
    grid-template-columns: 1fr;

    gap: 30px;
  }

  .weeklyStateBadge {
    margin-bottom: 12px;
  }

  .weeklyScreenshot {
    border-radius: 12px;
  }

  .weeklyStateCopy {
    padding:
      18px
      2px
      0;
  }

  .weeklyTransition {
    min-height: 150px;
  }

  .weeklyTransitionTrack {
    width: 32px;
    height: 92px;
  }

  .weeklyTransitionTrack::before {
    top: 0;
    bottom: 10px;
    left: 50%;
    right: auto;

    width: 2px;
    height: auto;

    background:
      linear-gradient(
        180deg,
        rgba(148, 163, 184, 0.5),
        rgba(8, 170, 150, 0.85)
      );

    transform:
      translateX(-50%);
  }

  .weeklyTransitionStart {
    top: 0;
    left: 50%;

    transform:
      translate(-50%, 0);
  }

  .weeklyTransitionPulse {
    top: 8%;
    left: 50%;

    transform:
      translate(-50%, 0);

    animation:
      weeklyFlowMobile
      3.2s
      ease-in-out
      infinite;
  }

  .weeklyTransitionArrow {
    top: auto;
    right: auto;
    bottom: -5px;
    left: 50%;

    transform:
      translateX(-50%)
      rotate(90deg);
  }

  .weeklyTransitionLabel {
    margin-top: 11px;
  }

  .weeklyTransitionLabel span {
    font-size: 0.75rem;
  }

  .weeklyTransitionLabel small {
    display: block;

    font-size: 0.68rem;
  }

  .weeklyDecisionRule {
    margin-top: 42px;

    padding:
      22px
      20px;
  }

  .flowBridge {
    padding:
      44px
      18px;
  }

  .flowBridgeLine {
    flex-wrap: wrap;

    gap:
      12px
      16px;

    font-size: 0.82rem;
  }

  .capabilityGrid {
    grid-template-columns: 1fr;
  }

  .roadmapSection {
    margin:
      0
      18px
      80px;

    padding:
      72px
      18px
      50px;

    border-radius: 22px;
  }

  .roadmapHeader {
    margin-bottom: 48px;
  }

  .roadmapHeader h2 {
    font-size:
      clamp(
        2.3rem,
        11vw,
        3.5rem
      );
  }

  .roadmapGrid {
    grid-template-columns: 1fr;
  }

  .roadmapCard {
    min-height: auto;
  }

  .roadmapNode::before {
    right: 0;
  }

  .trialRelease {
    margin-top: 38px;

    padding:
      34px
      16px;
  }

  .roadmapPrinciples {
    grid-template-columns: 1fr;
  }

  .closing {
    margin:
      0
      18px
      58px;

    border-radius: 20px;
  }

  .closingContent {
    padding:
      52px
      28px;
  }

  .closingFlowBackground {
    width: 100%;

    opacity: 0.45;
  }

  .footer {
    flex-direction: column;
    align-items: flex-start;

    padding:
      28px
      18px
      36px;
  }

}


/* ============================================================
   SMALL MOBILE
============================================================ */

@media (max-width: 480px) {

  .navigationActions
  .primaryButton {
    min-height: 40px;

    padding:
      0
      13px;

    font-size: 0.78rem;
  }

  .hero h1 {
    letter-spacing: -0.06em;
  }

  .heroActions {
    align-items: stretch;
    flex-direction: column;
  }

  .heroActions
  .primaryButton,
  .heroActions
  .secondaryButton {
    width: 100%;
  }

  .sectionHeader h2,
  .closing h2 {
    letter-spacing: -0.045em;
  }

  .productHighlights {
    gap: 12px;
  }

  .weeklyPlanning::before {
    width: 100px;
  }

  .weeklyDecisionRule {
    flex-direction: column;

    gap: 14px;
  }

  .roadmapCard {
    padding: 22px;
  }

  .roadmapPrinciple {
    align-items: flex-start;
  }

}


/* ============================================================
   MOBILE WEEKLY FLOW ANIMATION
============================================================ */

@keyframes weeklyFlowMobile {
  0% {
    top: 8%;
    opacity: 0;
  }

  18% {
    opacity: 1;
  }

  82% {
    opacity: 1;
  }

  100% {
    top: 76%;
    opacity: 0;
  }
}


/* ============================================================
   ACCESSIBILITY
============================================================ */

@media (prefers-reduced-motion: reduce) {

  .flowLineOne,
  .flowLineTwo,
  .flowLineThree,
  .flowLineFour,
  .flowLineFive,
  .heroFlowBackground::before,
  .heroFlowBackground::after,
  .closingFlowBackground span,
  .developmentStatusDot,
  .weeklyTransitionPulse {
    animation: none !important;
  }

  .primaryButton,
  .secondaryButton,
  .productScreenshot,
  .capabilityCard,
  .roadmapCard,
  .weeklyScreenshot {
    transition: none;
  }

}
