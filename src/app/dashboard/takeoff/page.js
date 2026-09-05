'use client'

import {
  useMemo,
  useState,
} from 'react'

import styles from './takeoff.module.css'


// ============================================================
// RitsuFlow™
// TAKEOFF MODULE
//
// CAD-style takeoff workspace.
//
// Architecture principle:
//
// Drawing geometry is handled independently from construction
// meaning.
//
// Geometry may later be mapped to:
//
// Project
// → Location
// → Work Package
// → Scope Item
// → Quantity
// → Productivity
// → Planning
// → Production Control
//
// This module is intentionally focused on construction takeoff,
// not general-purpose CAD authoring.
// ============================================================


// ============================================================
// ICON
// ============================================================

function ToolIcon({
  type,
  size = 18,
}) {

  const commonProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }


  switch (type) {

    case 'import':
      return (
        <svg {...commonProps}>
          <path d="M12 3v12" />
          <path d="M8 11l4 4 4-4" />
          <path d="M4 20h16" />
        </svg>
      )


    case 'select':
      return (
        <svg {...commonProps}>
          <path d="M5 3l13 8-6 2-3 6z" />
        </svg>
      )


    case 'pan':
      return (
        <svg {...commonProps}>
          <path d="M8 11V6a1.5 1.5 0 0 1 3 0v4" />
          <path d="M11 10V4.5a1.5 1.5 0 0 1 3 0V10" />
          <path d="M14 10V6a1.5 1.5 0 0 1 3 0v5" />
          <path d="M17 11V8a1.5 1.5 0 0 1 3 0v6c0 4-2.8 7-7 7h-1c-2.5 0-4.5-1-6-3l-3-4a1.6 1.6 0 0 1 2.5-2l2.5 2z" />
        </svg>
      )


    case 'zoom':
      return (
        <svg {...commonProps}>
          <circle cx="10" cy="10" r="6" />
          <path d="M14.5 14.5L21 21" />
          <path d="M10 7v6" />
          <path d="M7 10h6" />
        </svg>
      )


    case 'fit':
      return (
        <svg {...commonProps}>
          <path d="M8 3H3v5" />
          <path d="M16 3h5v5" />
          <path d="M8 21H3v-5" />
          <path d="M16 21h5v-5" />
        </svg>
      )


    case 'distance':
      return (
        <svg {...commonProps}>
          <path d="M5 18L18 5" />
          <path d="M4 14v5h5" />
          <path d="M15 4h5v5" />
        </svg>
      )


    case 'line':
      return (
        <svg {...commonProps}>
          <circle cx="5" cy="18" r="1.5" />
          <circle cx="19" cy="6" r="1.5" />
          <path d="M6.2 17L17.8 7" />
        </svg>
      )


    case 'polyline':
      return (
        <svg {...commonProps}>
          <circle cx="4" cy="17" r="1.4" />
          <circle cx="10" cy="8" r="1.4" />
          <circle cx="16" cy="13" r="1.4" />
          <circle cx="21" cy="5" r="1.4" />
          <path d="M5 16l4-7" />
          <path d="M11 9l4 3" />
          <path d="M17 12l3-6" />
        </svg>
      )


    case 'rectangle':
      return (
        <svg {...commonProps}>
          <rect x="4" y="6" width="16" height="12" />
        </svg>
      )


    case 'area':
      return (
        <svg {...commonProps}>
          <path d="M5 18L4 8l7-5 8 5-2 11z" />
          <circle cx="5" cy="18" r="1" />
          <circle cx="4" cy="8" r="1" />
          <circle cx="11" cy="3" r="1" />
          <circle cx="19" cy="8" r="1" />
          <circle cx="17" cy="19" r="1" />
        </svg>
      )


    case 'count':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v8" />
          <path d="M8 12h8" />
        </svg>
      )


    case 'calibrate':
      return (
        <svg {...commonProps}>
          <path d="M4 17L17 4l3 3L7 20z" />
          <path d="M10 14l-2-2" />
          <path d="M13 11l-2-2" />
          <path d="M16 8l-2-2" />
        </svg>
      )


    case 'undo':
      return (
        <svg {...commonProps}>
          <path d="M9 7L4 12l5 5" />
          <path d="M4 12h9a6 6 0 0 1 6 6" />
        </svg>
      )


    case 'redo':
      return (
        <svg {...commonProps}>
          <path d="M15 7l5 5-5 5" />
          <path d="M20 12h-9a6 6 0 0 0-6 6" />
        </svg>
      )


    case 'delete':
      return (
        <svg {...commonProps}>
          <path d="M4 7h16" />
          <path d="M9 3h6l1 4H8z" />
          <path d="M7 7l1 14h8l1-14" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      )


    case 'snap':
      return (
        <svg {...commonProps}>
          <path d="M4 4h6v6H4z" />
          <path d="M14 14h6v6h-6z" />
          <path d="M10 7h4" />
          <path d="M17 10v4" />
        </svg>
      )


    default:
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      )

  }

}


// ============================================================
// TOOL DEFINITIONS
// ============================================================

const toolGroups = [

  {
    id: 'navigation',
    label: 'Navigation',

    tools: [

      {
        id: 'select',
        label: 'Select',
        icon: 'select',
        shortcut: 'V',
      },

      {
        id: 'pan',
        label: 'Pan',
        icon: 'pan',
        shortcut: 'H',
      },

      {
        id: 'zoom',
        label: 'Zoom',
        icon: 'zoom',
        shortcut: 'Z',
      },

      {
        id: 'fit',
        label: 'Fit Page',
        icon: 'fit',
        shortcut: 'F',
      },

    ],
  },


  {
    id: 'measurement',
    label: 'Measurement',

    tools: [

      {
        id: 'distance',
        label: 'Distance',
        icon: 'distance',
        shortcut: 'D',
      },

      {
        id: 'line',
        label: 'Linear',
        icon: 'line',
        shortcut: 'L',
      },

      {
        id: 'polyline',
        label: 'Polyline',
        icon: 'polyline',
        shortcut: 'PL',
      },

      {
        id: 'area',
        label: 'Area',
        icon: 'area',
        shortcut: 'A',
      },

      {
        id: 'rectangle',
        label: 'Rectangle',
        icon: 'rectangle',
        shortcut: 'R',
      },

      {
        id: 'count',
        label: 'Count',
        icon: 'count',
        shortcut: 'C',
      },

    ],
  },

]


// ============================================================
// TAKEOFF PAGE
// ============================================================

export default function TakeoffPage() {

  const [
    activeTool,
    setActiveTool,
  ] =
    useState('select')


  const [
    snapEnabled,
    setSnapEnabled,
  ] =
    useState(true)


  const currentTool =
    useMemo(
      () =>
        toolGroups
          .flatMap(
            (
              group
            ) =>
              group.tools
          )
          .find(
            (
              tool
            ) =>
              tool.id ===
              activeTool
          ),
      [
        activeTool,
      ]
    )


  return (

    <div
      className={
        styles.takeoffShell
      }
    >

      {/* ======================================================
          COMMAND BAR
      ====================================================== */}

      <div
        className={
          styles.commandBar
        }
      >

        <div
          className={
            styles.commandBarLeft
          }
        >

          <button
            type="button"
            className={
              styles.primaryAction
            }
            disabled
            title="PDF import will be enabled in the next prototype step."
          >

            <ToolIcon
              type="import"
            />

            <span>
              Import PDF
            </span>

          </button>


          <div
            className={
              styles.commandDivider
            }
          />


          <div
            className={
              styles.drawingIdentity
            }
          >

            <span
              className={
                styles.drawingName
              }
            >
              No drawing loaded
            </span>

            <span
              className={
                styles.drawingMeta
              }
            >
              PDF Takeoff Workspace
            </span>

          </div>

        </div>


        <div
          className={
            styles.commandBarRight
          }
        >

          <button
            type="button"
            className={
              styles.commandButton
            }
            disabled
            title="Calibrate drawing scale"
          >

            <ToolIcon
              type="calibrate"
            />

            <span>
              Calibrate Scale
            </span>

          </button>


          <button
            type="button"
            className={
              styles.iconButton
            }
            disabled
            title="Undo"
            aria-label="Undo"
          >
            <ToolIcon
              type="undo"
            />
          </button>


          <button
            type="button"
            className={
              styles.iconButton
            }
            disabled
            title="Redo"
            aria-label="Redo"
          >
            <ToolIcon
              type="redo"
            />
          </button>

        </div>

      </div>


      {/* ======================================================
          TOOL RIBBON
      ====================================================== */}

      <div
        className={
          styles.toolRibbon
        }
      >

        {toolGroups.map(
          (
            group
          ) => (

            <div
              key={
                group.id
              }
              className={
                styles.toolGroup
              }
            >

              <div
                className={
                  styles.toolGroupButtons
                }
              >

                {group.tools.map(
                  (
                    tool
                  ) => {

                    const active =
                      activeTool ===
                      tool.id


                    return (

                      <button
                        key={
                          tool.id
                        }
                        type="button"
                        className={[
                          styles.toolButton,
                          active
                            ? styles.toolButtonActive
                            : '',
                        ]
                          .filter(
                            Boolean
                          )
                          .join(
                            ' '
                          )}
                        onClick={() =>
                          setActiveTool(
                            tool.id
                          )
                        }
                        title={`${tool.label} (${tool.shortcut})`}
                      >

                        <ToolIcon
                          type={
                            tool.icon
                          }
                        />

                        <span
                          className={
                            styles.toolButtonLabel
                          }
                        >
                          {
                            tool.label
                          }
                        </span>

                      </button>

                    )

                  }
                )}

              </div>


              <span
                className={
                  styles.toolGroupLabel
                }
              >
                {
                  group.label
                }
              </span>

            </div>

          )
        )}


        <div
          className={
            styles.toolGroup
          }
        >

          <div
            className={
              styles.toolGroupButtons
            }
          >

            <button
              type="button"
              className={[
                styles.toolButton,
                snapEnabled
                  ? styles.toolButtonActive
                  : '',
              ]
                .filter(
                  Boolean
                )
                .join(
                  ' '
                )}
              onClick={() =>
                setSnapEnabled(
                  (
                    current
                  ) =>
                    !current
                )
              }
              title="Object Snap"
            >

              <ToolIcon
                type="snap"
              />

              <span
                className={
                  styles.toolButtonLabel
                }
              >
                Snap
              </span>

            </button>


            <button
              type="button"
              className={
                styles.toolButton
              }
              disabled
              title="Delete selected geometry"
            >

              <ToolIcon
                type="delete"
              />

              <span
                className={
                  styles.toolButtonLabel
                }
              >
                Delete
              </span>

            </button>

          </div>


          <span
            className={
              styles.toolGroupLabel
            }
          >
            Edit
          </span>

        </div>

      </div>


      {/* ======================================================
          MAIN CAD WORKSPACE
      ====================================================== */}

      <div
        className={
          styles.workspace
        }
      >

        {/* ====================================================
            DRAWING TREE
        ==================================================== */}

        <aside
          className={
            styles.leftPanel
          }
        >

          <div
            className={
              styles.panelHeader
            }
          >
            Drawing
          </div>


          <div
            className={
              styles.panelContent
            }
          >

            <div
              className={
                styles.emptyPanelState
              }
            >

              <span
                className={
                  styles.emptyPanelTitle
                }
              >
                No PDF loaded
              </span>

              <span
                className={
                  styles.emptyPanelText
                }
              >
                Drawing pages and takeoff layers will appear here.
              </span>

            </div>

          </div>

        </aside>


        {/* ====================================================
            VIEWPORT
        ==================================================== */}

        <main
          className={
            styles.viewport
          }
        >

          <div
            className={
              styles.viewportCanvas
            }
          >

            <div
              className={
                styles.emptyViewport
              }
            >

              <div
                className={
                  styles.emptyViewportIcon
                }
                aria-hidden="true"
              >
                <svg
                  width="52"
                  height="52"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 2h9l5 5v15H6z" />
                  <path d="M15 2v6h5" />
                  <path d="M9 13h6" />
                  <path d="M12 10v6" />
                </svg>
              </div>


              <h2
                className={
                  styles.emptyViewportTitle
                }
              >
                Import a drawing
              </h2>


              <p
                className={
                  styles.emptyViewportDescription
                }
              >
                PDF rendering, vector detection, CAD navigation,
                scale calibration, snapping, and measurement geometry
                will operate inside this viewport.
              </p>


              <button
                type="button"
                className={
                  styles.viewportImportButton
                }
                disabled
              >
                <ToolIcon
                  type="import"
                />

                Import PDF
              </button>

            </div>

          </div>

        </main>


        {/* ====================================================
            PROPERTIES
        ==================================================== */}

        <aside
          className={
            styles.rightPanel
          }
        >

          <div
            className={
              styles.panelHeader
            }
          >
            Properties
          </div>


          <div
            className={
              styles.panelContent
            }
          >

            <div
              className={
                styles.propertySection
              }
            >

              <span
                className={
                  styles.propertySectionTitle
                }
              >
                Drawing
              </span>


              <div
                className={
                  styles.propertyRow
                }
              >

                <span>
                  Type
                </span>

                <strong>
                  —
                </strong>

              </div>


              <div
                className={
                  styles.propertyRow
                }
              >

                <span>
                  Page
                </span>

                <strong>
                  —
                </strong>

              </div>


              <div
                className={
                  styles.propertyRow
                }
              >

                <span>
                  Geometry
                </span>

                <strong>
                  —
                </strong>

              </div>

            </div>


            <div
              className={
                styles.propertySection
              }
            >

              <span
                className={
                  styles.propertySectionTitle
                }
              >
                Scale
              </span>


              <div
                className={
                  styles.propertyRow
                }
              >

                <span>
                  Status
                </span>

                <strong>
                  Not calibrated
                </strong>

              </div>


              <div
                className={
                  styles.propertyRow
                }
              >

                <span>
                  Unit
                </span>

                <strong>
                  —
                </strong>

              </div>

            </div>


            <div
              className={
                styles.propertySection
              }
            >

              <span
                className={
                  styles.propertySectionTitle
                }
              >
                Selection
              </span>


              <div
                className={
                  styles.emptyProperties
                }
              >
                Select takeoff geometry to inspect and edit its properties.
              </div>

            </div>

          </div>

        </aside>

      </div>


      {/* ======================================================
          STATUS BAR
      ====================================================== */}

      <footer
        className={
          styles.statusBar
        }
      >

        <div
          className={
            styles.statusLeft
          }
        >

          <span
            className={
              styles.statusItem
            }
          >
            Tool:
            <strong>
              {
                currentTool
                  ?.label ||
                'Select'
              }
            </strong>
          </span>


          <span
            className={
              styles.statusSeparator
            }
          />


          <span
            className={
              styles.statusItem
            }
          >
            X:
            <strong>
              —
            </strong>
          </span>


          <span
            className={
              styles.statusItem
            }
          >
            Y:
            <strong>
              —
            </strong>
          </span>

        </div>


        <div
          className={
            styles.statusRight
          }
        >

          <button
            type="button"
            className={[
              styles.statusToggle,
              snapEnabled
                ? styles.statusToggleActive
                : '',
            ]
              .filter(
                Boolean
              )
              .join(
                ' '
              )}
            onClick={() =>
              setSnapEnabled(
                (
                  current
                ) =>
                  !current
              )
            }
          >
            SNAP
          </button>


          <span
            className={
              styles.statusItem
            }
          >
            Scale:
            <strong>
              Not calibrated
            </strong>
          </span>


          <span
            className={
              styles.statusItem
            }
          >
            Zoom:
            <strong>
              100%
            </strong>
          </span>

        </div>

      </footer>

    </div>

  )

}
