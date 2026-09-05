'use client'

import styles from './takeoff.module.css'


export default function TakeoffPage() {

  return (

    <section
      className={
        styles.page
      }
    >

      <div
        className={
          styles.workspace
        }
      >

        <header
          className={
            styles.header
          }
        >

          <div>

            <p
              className={
                styles.eyebrow
              }
            >
              RitsuFlow Takeoff
            </p>

            <h2
              className={
                styles.title
              }
            >
              Drawing Takeoff
            </h2>

            <p
              className={
                styles.description
              }
            >
              Import a PDF drawing and create Lean takeoff geometry
              that can later connect to project scope, locations,
              work packages, quantities, planning, and production control.
            </p>

          </div>


          <button
            type="button"
            className={
              styles.primaryButton
            }
            disabled
          >
            Import PDF
          </button>

        </header>


        <div
          className={
            styles.content
          }
        >

          <aside
            className={
              styles.toolbar
            }
            aria-label="Takeoff tools"
          >

            <button
              type="button"
              className={
                styles.toolButton
              }
              disabled
            >
              Select
            </button>

            <button
              type="button"
              className={
                styles.toolButton
              }
              disabled
            >
              Distance
            </button>

            <button
              type="button"
              className={
                styles.toolButton
              }
              disabled
            >
              Polyline
            </button>

            <button
              type="button"
              className={
                styles.toolButton
              }
              disabled
            >
              Area
            </button>

            <button
              type="button"
              className={
                styles.toolButton
              }
              disabled
            >
              Rectangle
            </button>

            <button
              type="button"
              className={
                styles.toolButton
              }
              disabled
            >
              Count
            </button>

          </aside>


          <main
            className={
              styles.viewer
            }
          >

            <div
              className={
                styles.emptyState
              }
            >

              <div
                className={
                  styles.emptyIcon
                }
                aria-hidden="true"
              >
                +
              </div>

              <h3
                className={
                  styles.emptyTitle
                }
              >
                No drawing loaded
              </h3>

              <p
                className={
                  styles.emptyText
                }
              >
                The first prototype step will add PDF import,
                rendering, zoom, pan, and fit-page navigation.
              </p>

            </div>

          </main>


          <aside
            className={
              styles.properties
            }
          >

            <div
              className={
                styles.panelSection
              }
            >

              <p
                className={
                  styles.panelLabel
                }
              >
                Drawing
              </p>

              <p
                className={
                  styles.panelValue
                }
              >
                None
              </p>

            </div>


            <div
              className={
                styles.panelSection
              }
            >

              <p
                className={
                  styles.panelLabel
                }
              >
                Scale
              </p>

              <p
                className={
                  styles.panelValue
                }
              >
                Not calibrated
              </p>

            </div>


            <div
              className={
                styles.panelSection
              }
            >

              <p
                className={
                  styles.panelLabel
                }
              >
                Geometry
              </p>

              <p
                className={
                  styles.panelValue
                }
              >
                No selection
              </p>

            </div>

          </aside>

        </div>

      </div>

    </section>

  )

}
