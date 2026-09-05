'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import styles from './takeoff.module.css'


// ============================================================
// RITSUFLOW™
// TAKEOFF MODULE
//
// CAD-style PDF takeoff workspace.
//
// Current foundation:
//
// PDF layer
// + viewport/camera
// + navigation
// + drawing coordinates
//
// Future layers:
//
// PDF drawing
// ↓
// Takeoff geometry overlay
// ↓
// Snapping / selection / grips
// ↓
// Construction meaning
// ↓
// Quantity / productivity / planning / control
//
// IMPORTANT:
//
// Takeoff geometry must remain independent from the PDF canvas.
// Never burn takeoff entities directly into the rendered PDF.
// ============================================================


// ============================================================
// CONSTANTS
// ============================================================

const MIN_ZOOM =
  0.1

const MAX_ZOOM =
  12

const ZOOM_FACTOR =
  1.15

const VIEWPORT_MARGIN =
  44


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
          <path d="M17 11V8a1.5 1.5 0 0 1 3 0v6c0 4-2.8 7-7 7h-1c-2.5 0-4.5-1-6-3l-3-4a1.6 1.6 0 0 1 2.5-2l2.5 2.5" />
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


    case 'fitWidth':
      return (
        <svg {...commonProps}>
          <path d="M3 6v12" />
          <path d="M21 6v12" />
          <path d="M7 12h10" />
          <path d="M7 12l3-3" />
          <path d="M7 12l3 3" />
          <path d="M17 12l-3-3" />
          <path d="M17 12l-3 3" />
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


    case 'previous':
      return (
        <svg {...commonProps}>
          <path d="M15 6l-6 6 6 6" />
        </svg>
      )


    case 'next':
      return (
        <svg {...commonProps}>
          <path d="M9 6l6 6-6 6" />
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

      {
        id: 'fitWidth',
        label: 'Fit Width',
        icon: 'fitWidth',
        shortcut: 'W',
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
// UTILITY
// ============================================================

function clamp(
  value,
  minimum,
  maximum
) {

  return Math.min(
    maximum,
    Math.max(
      minimum,
      value
    )
  )

}


// ============================================================
// TAKEOFF PAGE
// ============================================================

export default function TakeoffPage() {

  // ==========================================================
  // REFERENCES
  // ==========================================================

  const fileInputRef =
    useRef(null)

  const viewportRef =
    useRef(null)

  const canvasRef =
    useRef(null)

  const renderTaskRef =
    useRef(null)

  const pdfDocumentRef =
    useRef(null)

  const pdfPageRef =
    useRef(null)

  const panSessionRef =
    useRef(null)


  // ==========================================================
  // PDF
  // ==========================================================

  const [
    pdfFileName,
    setPdfFileName,
  ] =
    useState(null)


  const [
    pdfDocument,
    setPdfDocument,
  ] =
    useState(null)


  const [
    pageNumber,
    setPageNumber,
  ] =
    useState(1)


  const [
    pageCount,
    setPageCount,
  ] =
    useState(0)


  const [
    pageBaseSize,
    setPageBaseSize,
  ] =
    useState(null)


  const [
    loadingPdf,
    setLoadingPdf,
  ] =
    useState(false)


  const [
    pdfError,
    setPdfError,
  ] =
    useState(null)


  // ==========================================================
  // VIEWPORT
  // ==========================================================

  const [
    viewportSize,
    setViewportSize,
  ] =
    useState({
      width: 0,
      height: 0,
    })


  const [
    fitMode,
    setFitMode,
  ] =
    useState('page')


  const [
    baseScale,
    setBaseScale,
  ] =
    useState(1)


  const [
    zoom,
    setZoom,
  ] =
    useState(1)


  const [
    pan,
    setPan,
  ] =
    useState({
      x: 0,
      y: 0,
    })


  const [
    renderedSize,
    setRenderedSize,
  ] =
    useState({
      width: 0,
      height: 0,
    })


  const [
    cursorPosition,
    setCursorPosition,
  ] =
    useState({
      x: null,
      y: null,
    })


  const [
    isPanning,
    setIsPanning,
  ] =
    useState(false)


  // ==========================================================
  // CAD STATE
  // ==========================================================

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


  // ==========================================================
  // CURRENT TOOL
  // ==========================================================

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


  // ==========================================================
  // EFFECTIVE SCALE
  // ==========================================================

  const effectiveScale =
    baseScale *
    zoom


  // ==========================================================
  // PDF.JS
  // ==========================================================

  async function getPdfJs() {

    const pdfjs =
      await import(
        'pdfjs-dist'
      )


    if (
      !pdfjs
        .GlobalWorkerOptions
        .workerSrc
    ) {

      pdfjs
        .GlobalWorkerOptions
        .workerSrc =
        new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString()

    }


    return pdfjs

  }


  // ==========================================================
  // IMPORT
  // ==========================================================

  function openFilePicker() {

    fileInputRef
      .current
      ?.click()

  }


  async function handleFileChange(
    event
  ) {

    const file =
      event
        .target
        .files
        ?.[0]


    event.target.value =
      ''


    if (!file) {
      return
    }


    if (
      file.type !==
        'application/pdf' &&
      !file.name
        .toLowerCase()
        .endsWith(
          '.pdf'
        )
    ) {

      setPdfError(
        'Please select a PDF drawing.'
      )

      return

    }


    setLoadingPdf(
      true
    )

    setPdfError(
      null
    )


    try {

      if (
        pdfDocumentRef
          .current
      ) {

        try {

          await pdfDocumentRef
            .current
            .destroy()

        } catch {

          // Ignore cleanup errors.

        }

      }


      const pdfjs =
        await getPdfJs()


      const bytes =
        new Uint8Array(
          await file.arrayBuffer()
        )


      const loadingTask =
        pdfjs.getDocument({
          data: bytes,
        })


      const document =
        await loadingTask.promise


      pdfDocumentRef.current =
        document


      setPdfDocument(
        document
      )

      setPdfFileName(
        file.name
      )

      setPageCount(
        document.numPages
      )

      setPageNumber(
        1
      )

      setFitMode(
        'page'
      )

      setZoom(
        1
      )

      setPan({
        x: 0,
        y: 0,
      })

      setCursorPosition({
        x: null,
        y: null,
      })

    } catch (error) {

      console.error(
        'PDF import failed.',
        error
      )


      setPdfDocument(
        null
      )

      setPdfFileName(
        null
      )

      setPageCount(
        0
      )

      setPageBaseSize(
        null
      )


      setPdfError(
        'The PDF could not be opened.'
      )

    } finally {

      setLoadingPdf(
        false
      )

    }

  }


  // ==========================================================
  // VIEWPORT SIZE
  // ==========================================================

  useEffect(
    () => {

      const element =
        viewportRef.current


      if (!element) {
        return
      }


      function updateSize() {

        const rect =
          element
            .getBoundingClientRect()


        setViewportSize({
          width:
            rect.width,

          height:
            rect.height,
        })

      }


      updateSize()


      const observer =
        new ResizeObserver(
          updateSize
        )


      observer.observe(
        element
      )


      return () => {

        observer.disconnect()

      }

    },
    []
  )


  // ==========================================================
  // LOAD PAGE METADATA
  // ==========================================================

  useEffect(
    () => {

      let cancelled =
        false


      async function loadPage() {

        if (
          !pdfDocument ||
          !pageNumber
        ) {
          return
        }


        try {

          const page =
            await pdfDocument
              .getPage(
                pageNumber
              )


          if (cancelled) {
            return
          }


          pdfPageRef.current =
            page


          const viewport =
            page.getViewport({
              scale: 1,
            })


          setPageBaseSize({
            width:
              viewport.width,

            height:
              viewport.height,
          })


          setZoom(
            1
          )

          setPan({
            x: 0,
            y: 0,
          })

        } catch (error) {

          console.error(
            'PDF page could not be loaded.',
            error
          )


          if (
            !cancelled
          ) {

            setPdfError(
              'The selected PDF page could not be rendered.'
            )

          }

        }

      }


      loadPage()


      return () => {

        cancelled =
          true

      }

    },
    [
      pdfDocument,
      pageNumber,
    ]
  )


  // ==========================================================
  // FIT SCALE
  // ==========================================================

  useEffect(
    () => {

      if (
        !pageBaseSize ||
        !viewportSize.width ||
        !viewportSize.height
      ) {
        return
      }


      const availableWidth =
        Math.max(
          1,
          viewportSize.width -
          VIEWPORT_MARGIN * 2
        )


      const availableHeight =
        Math.max(
          1,
          viewportSize.height -
          VIEWPORT_MARGIN * 2
        )


      const widthScale =
        availableWidth /
        pageBaseSize.width


      const heightScale =
        availableHeight /
        pageBaseSize.height


      const nextBaseScale =
        fitMode ===
          'width'
          ? widthScale
          : Math.min(
              widthScale,
              heightScale
            )


      setBaseScale(
        Math.max(
          0.01,
          nextBaseScale
        )
      )

    },
    [
      pageBaseSize,
      viewportSize,
      fitMode,
    ]
  )


  // ==========================================================
  // RENDER PDF
  // ==========================================================

  useEffect(
    () => {

      let cancelled =
        false


      async function renderPage() {

        const page =
          pdfPageRef.current

        const canvas =
          canvasRef.current


        if (
          !page ||
          !canvas ||
          !effectiveScale
        ) {
          return
        }


        if (
          renderTaskRef.current
        ) {

          try {

            renderTaskRef
              .current
              .cancel()

          } catch {

            // Ignore cancellation errors.

          }

        }


        const viewport =
          page.getViewport({
            scale:
              effectiveScale,
          })


        const outputScale =
          Math.min(
            window.devicePixelRatio ||
              1,
            2
          )


        const context =
          canvas.getContext(
            '2d',
            {
              alpha: false,
            }
          )


        if (!context) {
          return
        }


        canvas.width =
          Math.max(
            1,
            Math.floor(
              viewport.width *
              outputScale
            )
          )


        canvas.height =
          Math.max(
            1,
            Math.floor(
              viewport.height *
              outputScale
            )
          )


        canvas.style.width =
          `${viewport.width}px`

        canvas.style.height =
          `${viewport.height}px`


        setRenderedSize({
          width:
            viewport.width,

          height:
            viewport.height,
        })


        const transform =
          outputScale !== 1
            ? [
                outputScale,
                0,
                0,
                outputScale,
                0,
                0,
              ]
            : null


        const renderTask =
          page.render({
            canvasContext:
              context,

            viewport,

            transform,
          })


        renderTaskRef.current =
          renderTask


        try {

          await renderTask.promise

        } catch (error) {

          if (
            error?.name !==
              'RenderingCancelledException' &&
            !cancelled
          ) {

            console.error(
              'PDF render failed.',
              error
            )

          }

        } finally {

          if (
            renderTaskRef.current ===
            renderTask
          ) {

            renderTaskRef.current =
              null

          }

        }

      }


      renderPage()


      return () => {

        cancelled =
          true

      }

    },
    [
      pdfDocument,
      pageNumber,
      effectiveScale,
    ]
  )


  // ==========================================================
  // FIT COMMANDS
  // ==========================================================

  const fitPage =
    useCallback(
      () => {

        if (!pdfDocument) {
          return
        }


        setFitMode(
          'page'
        )

        setZoom(
          1
        )

        setPan({
          x: 0,
          y: 0,
        })

      },
      [
        pdfDocument,
      ]
    )


  const fitWidth =
    useCallback(
      () => {

        if (!pdfDocument) {
          return
        }


        setFitMode(
          'width'
        )

        setZoom(
          1
        )

        setPan({
          x: 0,
          y: 0,
        })

      },
      [
        pdfDocument,
      ]
    )


  // ==========================================================
  // TOOL COMMAND
  // ==========================================================

  function activateTool(
    toolId
  ) {

    if (
      toolId ===
      'fit'
    ) {

      fitPage()

      return

    }


    if (
      toolId ===
      'fitWidth'
    ) {

      fitWidth()

      return

    }


    setActiveTool(
      toolId
    )

  }


  // ==========================================================
  // PAGE NAVIGATION
  // ==========================================================

  function previousPage() {

    setPageNumber(
      (
        current
      ) =>
        Math.max(
          1,
          current - 1
        )
    )

  }


  function nextPage() {

    setPageNumber(
      (
        current
      ) =>
        Math.min(
          pageCount,
          current + 1
        )
    )

  }


  // ==========================================================
  // CURSOR COORDINATES
  // ==========================================================

  const updateCursorCoordinates =
    useCallback(
      (
        clientX,
        clientY
      ) => {

        const element =
          viewportRef.current


        if (
          !element ||
          !pdfDocument ||
          !renderedSize.width ||
          !renderedSize.height ||
          !effectiveScale
        ) {

          setCursorPosition({
            x: null,
            y: null,
          })

          return

        }


        const rect =
          element
            .getBoundingClientRect()


        const screenX =
          clientX -
          rect.left


        const screenY =
          clientY -
          rect.top


        const documentLeft =
          rect.width / 2 +
          pan.x -
          renderedSize.width / 2


        const documentTop =
          rect.height / 2 +
          pan.y -
          renderedSize.height / 2


        const localX =
          screenX -
          documentLeft


        const localY =
          screenY -
          documentTop


        if (
          localX < 0 ||
          localY < 0 ||
          localX >
            renderedSize.width ||
          localY >
            renderedSize.height
        ) {

          setCursorPosition({
            x: null,
            y: null,
          })

          return

        }


        setCursorPosition({
          x:
            localX /
            effectiveScale,

          y:
            localY /
            effectiveScale,
        })

      },
      [
        pdfDocument,
        renderedSize,
        pan,
        effectiveScale,
      ]
    )


  // ==========================================================
  // POINTER MOVE
  // ==========================================================

  function handlePointerMove(
    event
  ) {

    updateCursorCoordinates(
      event.clientX,
      event.clientY
    )


    const session =
      panSessionRef.current


    if (!session) {
      return
    }


    const deltaX =
      event.clientX -
      session.startX


    const deltaY =
      event.clientY -
      session.startY


    setPan({
      x:
        session.panX +
        deltaX,

      y:
        session.panY +
        deltaY,
    })

  }


  // ==========================================================
  // PAN START
  // ==========================================================

  function handlePointerDown(
    event
  ) {

    if (!pdfDocument) {
      return
    }


    const usingMiddleMouse =
      event.button ===
      1


    const usingPanTool =
      activeTool ===
        'pan' &&
      event.button ===
        0


    if (
      !usingMiddleMouse &&
      !usingPanTool
    ) {
      return
    }


    event.preventDefault()


    panSessionRef.current = {
      startX:
        event.clientX,

      startY:
        event.clientY,

      panX:
        pan.x,

      panY:
        pan.y,
    }


    setIsPanning(
      true
    )


    event.currentTarget
      .setPointerCapture(
        event.pointerId
      )

  }


  // ==========================================================
  // PAN END
  // ==========================================================

  function handlePointerUp(
    event
  ) {

    if (
      panSessionRef.current
    ) {

      panSessionRef.current =
        null


      setIsPanning(
        false
      )


      try {

        event.currentTarget
          .releasePointerCapture(
            event.pointerId
          )

      } catch {

        // Pointer may already be released.

      }

    }

  }


  // ==========================================================
  // WHEEL ZOOM
  // ==========================================================

  function handleWheel(
    event
  ) {

    if (!pdfDocument) {
      return
    }


    event.preventDefault()


    const viewport =
      viewportRef.current


    if (!viewport) {
      return
    }


    const rect =
      viewport
        .getBoundingClientRect()


    const cursorX =
      event.clientX -
      rect.left -
      rect.width / 2


    const cursorY =
      event.clientY -
      rect.top -
      rect.height / 2


    const multiplier =
      event.deltaY < 0
        ? ZOOM_FACTOR
        : 1 /
          ZOOM_FACTOR


    const nextZoom =
      clamp(
        zoom *
          multiplier,
        MIN_ZOOM,
        MAX_ZOOM
      )


    if (
      nextZoom ===
      zoom
    ) {
      return
    }


    const ratio =
      nextZoom /
      zoom


    setPan(
      (
        current
      ) => ({

        x:
          cursorX -
          (
            cursorX -
            current.x
          ) *
          ratio,

        y:
          cursorY -
          (
            cursorY -
            current.y
          ) *
          ratio,

      })
    )


    setZoom(
      nextZoom
    )

  }


  // ==========================================================
  // KEYBOARD COMMANDS
  // ==========================================================

  useEffect(
    () => {

      function handleKeyDown(
        event
      ) {

        const target =
          event.target


        const tagName =
          target
            ?.tagName
            ?.toLowerCase()


        if (
          tagName ===
            'input' ||
          tagName ===
            'textarea' ||
          target
            ?.isContentEditable
        ) {
          return
        }


        if (
          event.key ===
          'Escape'
        ) {

          setActiveTool(
            'select'
          )

          return

        }


        const key =
          event.key
            .toLowerCase()


        if (
          key ===
          'v'
        ) {

          setActiveTool(
            'select'
          )

        } else if (
          key ===
          'h'
        ) {

          setActiveTool(
            'pan'
          )

        } else if (
          key ===
          'z'
        ) {

          setActiveTool(
            'zoom'
          )

        } else if (
          key ===
          'f'
        ) {

          fitPage()

        } else if (
          key ===
          'w'
        ) {

          fitWidth()

        }

      }


      window.addEventListener(
        'keydown',
        handleKeyDown
      )


      return () => {

        window.removeEventListener(
          'keydown',
          handleKeyDown
        )

      }

    },
    [
      fitPage,
      fitWidth,
    ]
  )


  // ==========================================================
  // CLEANUP
  // ==========================================================

  useEffect(
    () => {

      return () => {

        if (
          renderTaskRef.current
        ) {

          try {

            renderTaskRef
              .current
              .cancel()

          } catch {

            // Ignore cleanup errors.

          }

        }


        if (
          pdfDocumentRef.current
        ) {

          try {

            pdfDocumentRef
              .current
              .destroy()

          } catch {

            // Ignore cleanup errors.

          }

        }

      }

    },
    []
  )


  // ==========================================================
  // CURSOR
  // ==========================================================

  let viewportCursor =
    'default'


  if (isPanning) {

    viewportCursor =
      'grabbing'

  } else if (
    activeTool ===
    'pan'
  ) {

    viewportCursor =
      'grab'

  } else if (
    activeTool ===
    'zoom'
  ) {

    viewportCursor =
      'zoom-in'

  } else if (
    pdfDocument
  ) {

    viewportCursor =
      'crosshair'

  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div
      className={
        styles.takeoffShell
      }
    >

      <input
        ref={
          fileInputRef
        }
        type="file"
        accept="application/pdf,.pdf"
        onChange={
          handleFileChange
        }
        style={{
          display:
            'none',
        }}
      />


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
            onClick={
              openFilePicker
            }
            disabled={
              loadingPdf
            }
          >

            <ToolIcon
              type="import"
            />

            <span>
              {
                loadingPdf
                  ? 'Loading PDF...'
                  : 'Import PDF'
              }
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
              {
                pdfFileName ||
                'No drawing loaded'
              }
            </span>


            <span
              className={
                styles.drawingMeta
              }
            >
              {
                pdfDocument
                  ? `${pageCount} ${
                      pageCount === 1
                        ? 'page'
                        : 'pages'
                    }`
                  : 'PDF Takeoff Workspace'
              }
            </span>

          </div>

        </div>


        <div
          className={
            styles.commandBarRight
          }
        >

          {pdfDocument && (

            <div
              style={{
                display:
                  'flex',

                alignItems:
                  'center',

                gap:
                  '4px',

                marginRight:
                  '4px',
              }}
            >

              <button
                type="button"
                className={
                  styles.iconButton
                }
                onClick={
                  previousPage
                }
                disabled={
                  pageNumber <= 1
                }
                title="Previous page"
                aria-label="Previous page"
              >
                <ToolIcon
                  type="previous"
                />
              </button>


              <span
                style={{
                  display:
                    'inline-flex',

                  alignItems:
                    'center',

                  justifyContent:
                    'center',

                  minWidth:
                    '72px',

                  color:
                    '#425a70',

                  fontSize:
                    '11px',

                  fontWeight:
                    800,

                  whiteSpace:
                    'nowrap',
                }}
              >
                {pageNumber} / {pageCount}
              </span>


              <button
                type="button"
                className={
                  styles.iconButton
                }
                onClick={
                  nextPage
                }
                disabled={
                  pageNumber >=
                  pageCount
                }
                title="Next page"
                aria-label="Next page"
              >
                <ToolIcon
                  type="next"
                />
              </button>

            </div>

          )}


          <button
            type="button"
            className={
              styles.commandButton
            }
            disabled={
              !pdfDocument
            }
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


                    const isFitCommand =
                      tool.id ===
                        'fit' ||
                      tool.id ===
                        'fitWidth'


                    return (

                      <button
                        key={
                          tool.id
                        }
                        type="button"
                        className={[
                          styles.toolButton,
                          active &&
                          !isFitCommand
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
                          activateTool(
                            tool.id
                          )
                        }
                        disabled={
                          !pdfDocument &&
                          tool.id !==
                            'select'
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
            DRAWING PANEL
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

            {!pdfDocument && (

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

            )}


            {pdfDocument && (

              <div
                style={{
                  display:
                    'flex',

                  flexDirection:
                    'column',

                  gap:
                    '10px',
                }}
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
                    style={{
                      overflow:
                        'hidden',

                      textOverflow:
                        'ellipsis',

                      whiteSpace:
                        'nowrap',
                    }}
                    title={
                      pdfFileName ||
                      ''
                    }
                  >
                    {
                      pdfFileName
                    }
                  </span>

                  <span
                    className={
                      styles.emptyPanelText
                    }
                  >
                    {pageCount} drawing {
                      pageCount === 1
                        ? 'page'
                        : 'pages'
                    }
                  </span>

                </div>


                <div
                  style={{
                    display:
                      'flex',

                    flexDirection:
                      'column',

                    gap:
                      '4px',
                  }}
                >

                  {Array.from(
                    {
                      length:
                        pageCount,
                    },
                    (
                      _,
                      index
                    ) => {

                      const number =
                        index + 1


                      const active =
                        number ===
                        pageNumber


                      return (

                        <button
                          key={
                            number
                          }
                          type="button"
                          onClick={() =>
                            setPageNumber(
                              number
                            )
                          }
                          style={{
                            display:
                              'flex',

                            alignItems:
                              'center',

                            justifyContent:
                              'space-between',

                            width:
                              '100%',

                            minHeight:
                              '34px',

                            padding:
                              '0 9px',

                            border:
                              active
                                ? '1px solid #99e6dc'
                                : '1px solid transparent',

                            borderRadius:
                              '6px',

                            background:
                              active
                                ? '#eafaf7'
                                : 'transparent',

                            color:
                              active
                                ? '#087f73'
                                : '#52677d',

                            font:
                              'inherit',

                            fontSize:
                              '11px',

                            fontWeight:
                              800,

                            cursor:
                              'pointer',
                          }}
                        >

                          <span>
                            Page {number}
                          </span>

                          {active && (
                            <span>
                              ●
                            </span>
                          )}

                        </button>

                      )

                    }
                  )}

                </div>

              </div>

            )}

          </div>

        </aside>


        {/* ====================================================
            VIEWPORT
        ==================================================== */}

        <main
          ref={
            viewportRef
          }
          className={
            styles.viewport
          }
          onPointerDown={
            handlePointerDown
          }
          onPointerMove={
            handlePointerMove
          }
          onPointerUp={
            handlePointerUp
          }
          onPointerCancel={
            handlePointerUp
          }
          onPointerLeave={() => {

            if (
              !panSessionRef.current
            ) {

              setCursorPosition({
                x: null,
                y: null,
              })

            }

          }}
          onWheel={
            handleWheel
          }
          onContextMenu={(
            event
          ) =>
            event.preventDefault()
          }
          style={{
            cursor:
              viewportCursor,

            touchAction:
              'none',
          }}
        >

          <div
            className={
              styles.viewportCanvas
            }
          >


            {!pdfDocument && (

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
                  {
                    loadingPdf
                      ? 'Loading drawing...'
                      : 'Import a drawing'
                  }
                </h2>


                <p
                  className={
                    styles.emptyViewportDescription
                  }
                >
                  PDF rendering, CAD navigation, scale calibration,
                  snapping, and takeoff geometry operate inside this viewport.
                </p>


                {pdfError && (

                  <p
                    style={{
                      margin:
                        '0 0 14px',

                      color:
                        '#b42318',

                      fontSize:
                        '11px',

                      fontWeight:
                        800,
                    }}
                  >
                    {
                      pdfError
                    }
                  </p>

                )}


                <button
                  type="button"
                  className={
                    styles.viewportImportButton
                  }
                  onClick={
                    openFilePicker
                  }
                  disabled={
                    loadingPdf
                  }
                >

                  <ToolIcon
                    type="import"
                  />

                  {
                    loadingPdf
                      ? 'Loading PDF...'
                      : 'Import PDF'
                  }

                </button>

              </div>

            )}


            {pdfDocument && (

              <div
                style={{
                  position:
                    'absolute',

                  left:
                    '50%',

                  top:
                    '50%',

                  width:
                    `${renderedSize.width}px`,

                  height:
                    `${renderedSize.height}px`,

                  transform:
                    `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)`,

                  transformOrigin:
                    'center center',

                  boxShadow:
                    '0 8px 28px rgba(15, 23, 42, 0.24)',

                  background:
                    '#ffffff',

                  pointerEvents:
                    'none',

                  userSelect:
                    'none',
                }}
              >

                {/* ============================================
                    PDF RENDER LAYER
                ============================================ */}

                <canvas
                  ref={
                    canvasRef
                  }
                  style={{
                    display:
                      'block',

                    width:
                      `${renderedSize.width}px`,

                    height:
                      `${renderedSize.height}px`,
                  }}
                />


                {/* ============================================
                    TAKEOFF GEOMETRY LAYER
                    Reserved for SVG geometry.
                ============================================ */}

                <svg
                  viewBox={`0 0 ${Math.max(
                    1,
                    renderedSize.width
                  )} ${Math.max(
                    1,
                    renderedSize.height
                  )}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  style={{
                    position:
                      'absolute',

                    inset:
                      0,

                    width:
                      '100%',

                    height:
                      '100%',

                    overflow:
                      'visible',

                    pointerEvents:
                      'none',
                  }}
                />


                {/* ============================================
                    INTERACTION LAYER
                    Future snaps / grips / hover feedback.
                ============================================ */}

                <div
                  aria-hidden="true"
                  style={{
                    position:
                      'absolute',

                    inset:
                      0,

                    pointerEvents:
                      'none',
                  }}
                />

              </div>

            )}

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
                  {
                    pdfDocument
                      ? 'PDF'
                      : '—'
                  }
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
                  {
                    pdfDocument
                      ? `${pageNumber} / ${pageCount}`
                      : '—'
                  }
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
                  {
                    pdfDocument
                      ? 'Analyzing later'
                      : '—'
                  }
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
                View
              </span>


              <div
                className={
                  styles.propertyRow
                }
              >

                <span>
                  Fit Mode
                </span>

                <strong>
                  {
                    fitMode ===
                    'width'
                      ? 'Width'
                      : 'Page'
                  }
                </strong>

              </div>


              <div
                className={
                  styles.propertyRow
                }
              >

                <span>
                  Zoom
                </span>

                <strong>
                  {
                    `${Math.round(
                      zoom *
                      100
                    )}%`
                  }
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
              {
                cursorPosition.x !==
                null
                  ? cursorPosition.x
                      .toFixed(
                        2
                      )
                  : '—'
              }
            </strong>
          </span>


          <span
            className={
              styles.statusItem
            }
          >
            Y:
            <strong>
              {
                cursorPosition.y !==
                null
                  ? cursorPosition.y
                      .toFixed(
                        2
                      )
                  : '—'
              }
            </strong>
          </span>


          {pdfDocument && (

            <span
              className={
                styles.statusItem
              }
            >
              PDF pt
            </span>

          )}

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
            Page:
            <strong>
              {
                pdfDocument
                  ? `${pageNumber}/${pageCount}`
                  : '—'
              }
            </strong>
          </span>


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
              {
                `${Math.round(
                  zoom *
                  100
                )}%`
              }
            </strong>
          </span>

        </div>

      </footer>

    </div>

  )

}
