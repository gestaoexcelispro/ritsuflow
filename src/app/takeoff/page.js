'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import Link from 'next/link'

import styles from './takeoff.module.css'


// ============================================================
// RITSUFLOW™
// TAKEOFF APPLICATION
//
// Standalone CAD-style PDF takeoff workspace.
//
// Design principle:
//
// THE DRAWING CANVAS IS THE PRODUCT.
//
// Secondary information should remain accessible without
// permanently consuming drawing space.
//
// PDF Drawing
// ↓
// Takeoff Geometry
// ↓
// Location
// ↓
// Work Package
// ↓
// Scope Item
// ↓
// Quantity
// ↓
// Productivity
// ↓
// Planning
// ↓
// Production Control
// ============================================================


// ============================================================
// CONSTANTS
// ============================================================

const MIN_ZOOM = 0.1
const MAX_ZOOM = 12
const ZOOM_FACTOR = 1.15
const VIEWPORT_MARGIN = 36


// ============================================================
// ICONS
// ============================================================

function Icon({
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

    case 'back':
      return (
        <svg {...commonProps}>
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
      )


    case 'takeoff':
      return (
        <svg {...commonProps}>
          <path d="M5 3h10l4 4v14H5z" />
          <path d="M15 3v5h4" />
          <path d="M8 17l3-4 2 2 4-6" />
        </svg>
      )


    case 'import':
      return (
        <svg {...commonProps}>
          <path d="M12 3v12" />
          <path d="M8 11l4 4 4-4" />
          <path d="M4 20h16" />
        </svg>
      )


    case 'drawings':
      return (
        <svg {...commonProps}>
          <path d="M5 3h10l4 4v14H5z" />
          <path d="M15 3v5h4" />
          <path d="M8 12h8" />
          <path d="M8 16h6" />
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


    case 'area':
      return (
        <svg {...commonProps}>
          <path d="M5 18L4 8l7-5 8 5-2 11z" />
        </svg>
      )


    case 'rectangle':
      return (
        <svg {...commonProps}>
          <rect x="4" y="6" width="16" height="12" />
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


    case 'properties':
      return (
        <svg {...commonProps}>
          <path d="M5 3h14v18H5z" />
          <path d="M9 8h6" />
          <path d="M9 12h6" />
          <path d="M9 16h4" />
        </svg>
      )


    case 'layers':
      return (
        <svg {...commonProps}>
          <path d="M12 3l8 5-8 5-8-5z" />
          <path d="M4 12l8 5 8-5" />
          <path d="M4 16l8 5 8-5" />
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


    case 'ortho':
      return (
        <svg {...commonProps}>
          <path d="M5 5v14h14" />
          <path d="M5 15h4v4" />
        </svg>
      )


    case 'grid':
      return (
        <svg {...commonProps}>
          <path d="M4 4h16v16H4z" />
          <path d="M9 4v16" />
          <path d="M15 4v16" />
          <path d="M4 9h16" />
          <path d="M4 15h16" />
        </svg>
      )


    case 'delete':
      return (
        <svg {...commonProps}>
          <path d="M4 7h16" />
          <path d="M9 3h6l1 4H8z" />
          <path d="M7 7l1 14h8l1-14" />
        </svg>
      )


    case 'close':
      return (
        <svg {...commonProps}>
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
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
// CAD TOOL DEFINITIONS
// ============================================================

const navigationTools = [
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
]


const measurementTools = [
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
]


const allTools = [
  ...navigationTools,
  ...measurementTools,
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
    pdfPage,
    setPdfPage,
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
  // VIEW
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
    fitReference,
    setFitReference,
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
  // CAD MODES
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


  const [
    orthoEnabled,
    setOrthoEnabled,
  ] =
    useState(false)


  const [
    gridEnabled,
    setGridEnabled,
  ] =
    useState(true)


  // ==========================================================
  // PANELS
  // ==========================================================

  const [
    drawingDrawerOpen,
    setDrawingDrawerOpen,
  ] =
    useState(false)


  const [
    inspectorOpen,
    setInspectorOpen,
  ] =
    useState(true)


  const [
    inspectorTab,
    setInspectorTab,
  ] =
    useState('properties')


  // ==========================================================
  // DERIVED STATE
  // ==========================================================

  const currentTool =
    useMemo(
      () =>
        allTools.find(
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


  const effectiveScale =
    baseScale *
    zoom


  const viewMode =
    zoom === 1
      ? (
          fitReference ===
          'width'
            ? 'Fit Width'
            : 'Fit Page'
        )
      : 'Custom'


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
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`

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

      setPdfPage(
        null
      )

      setFitReference(
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

      setPdfPage(
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
    [
      inspectorOpen,
    ]
  )


  // ==========================================================
  // LOAD PAGE
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


          const viewport =
            page.getViewport({
              scale: 1,
            })


          setPdfPage(
            page
          )


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
        fitReference ===
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
      fitReference,
    ]
  )


  // ==========================================================
  // PDF RENDER
  // ==========================================================

  useEffect(
    () => {

      let cancelled =
        false


      async function renderPage() {

        const canvas =
          canvasRef.current


        if (
          !pdfPage ||
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
          pdfPage.getViewport({
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
          pdfPage.render({
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
      pdfPage,
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


        setFitReference(
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


        setFitReference(
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
  // PDF COORDINATES
  // ==========================================================

  const clientToPdfPoint =
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
          return null
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
          return null
        }


        return {
          x:
            localX /
            effectiveScale,

          y:
            localY /
            effectiveScale,
        }

      },
      [
        pdfDocument,
        renderedSize,
        effectiveScale,
        pan,
      ]
    )


  // ==========================================================
  // POINTER
  // ==========================================================

  function handlePointerMove(
    event
  ) {

    const point =
      clientToPdfPoint(
        event.clientX,
        event.clientY
      )


    setCursorPosition(
      point || {
        x: null,
        y: null,
      }
    )


    const session =
      panSessionRef.current


    if (!session) {
      return
    }


    setPan({
      x:
        session.panX +
        event.clientX -
        session.startX,

      y:
        session.panY +
        event.clientY -
        session.startY,
    })

  }


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


  function handlePointerUp(
    event
  ) {

    if (
      !panSessionRef.current
    ) {
      return
    }


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
  // PANEL COMMANDS
  // ==========================================================

  function openInspector(
    tab
  ) {

    if (
      inspectorOpen &&
      inspectorTab ===
        tab
    ) {

      setInspectorOpen(
        false
      )

      return

    }


    setInspectorTab(
      tab
    )

    setInspectorOpen(
      true
    )

  }


  // ==========================================================
  // KEYBOARD
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

          setDrawingDrawerOpen(
            false
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
          'd'
        ) {

          setActiveTool(
            'distance'
          )

        } else if (
          key ===
          'l'
        ) {

          setActiveTool(
            'line'
          )

        } else if (
          key ===
          'a'
        ) {

          setActiveTool(
            'area'
          )

        } else if (
          key ===
          'r'
        ) {

          setActiveTool(
            'rectangle'
          )

        } else if (
          key ===
          'c'
        ) {

          setActiveTool(
            'count'
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


  if (
    isPanning
  ) {

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
        styles.application
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
        className={
          styles.hiddenInput
        }
      />


      {/* ======================================================
          APPLICATION HEADER
      ====================================================== */}

      <header
        className={
          styles.applicationHeader
        }
      >

        <div
          className={
            styles.headerLeft
          }
        >

          <Link
            href="/dashboard"
            className={
              styles.backButton
            }
            title="Return to RitsuFlow"
          >
            <Icon
              type="back"
            />

            <span>
              RitsuFlow
            </span>
          </Link>


          <span
            className={
              styles.headerDivider
            }
          />


          <div
            className={
              styles.productIdentity
            }
          >

            <span
              className={
                styles.productIcon
              }
            >
              <Icon
                type="takeoff"
                size={19}
              />
            </span>


            <div
              className={
                styles.productText
              }
            >
              <strong>
                Takeoff
              </strong>

              <span>
                Drawing Workspace
              </span>
            </div>

          </div>

        </div>


        <div
          className={
            styles.headerCenter
          }
        >

          <span
            className={
              styles.headerDrawingName
            }
            title={
              pdfFileName ||
              'No drawing loaded'
            }
          >
            {
              pdfFileName ||
              'No drawing loaded'
            }
          </span>

        </div>


        <div
          className={
            styles.headerRight
          }
        >

          {pdfDocument && (

            <div
              className={
                styles.pageControl
              }
            >

              <button
                type="button"
                onClick={
                  previousPage
                }
                disabled={
                  pageNumber <= 1
                }
                title="Previous page"
              >
                <Icon
                  type="previous"
                  size={16}
                />
              </button>


              <strong>
                {pageNumber}/{pageCount}
              </strong>


              <button
                type="button"
                onClick={
                  nextPage
                }
                disabled={
                  pageNumber >=
                  pageCount
                }
                title="Next page"
              >
                <Icon
                  type="next"
                  size={16}
                />
              </button>

            </div>

          )}


          <span
            className={
              styles.headerMetric
            }
          >
            Scale
            <strong>
              Not calibrated
            </strong>
          </span>


          <span
            className={
              styles.headerMetric
            }
          >
            Zoom
            <strong>
              {
                Math.round(
                  zoom *
                  100
                )
              }%
            </strong>
          </span>

        </div>

      </header>


      {/* ======================================================
          CAD TOOLBAR
      ====================================================== */}

      <div
        className={
          styles.cadToolbar
        }
      >

        <div
          className={
            styles.toolbarSection
          }
        >

          <button
            type="button"
            className={
              styles.importButton
            }
            onClick={
              openFilePicker
            }
            disabled={
              loadingPdf
            }
          >
            <Icon
              type="import"
            />

            <span>
              {
                loadingPdf
                  ? 'Loading...'
                  : 'Import PDF'
              }
            </span>
          </button>


          <button
            type="button"
            className={[
              styles.toolbarButton,
              drawingDrawerOpen
                ? styles.toolbarButtonActive
                : '',
            ]
              .filter(
                Boolean
              )
              .join(
                ' '
              )}
            onClick={() =>
              setDrawingDrawerOpen(
                (
                  current
                ) =>
                  !current
              )
            }
            title="Drawings"
          >
            <Icon
              type="drawings"
            />

            <span>
              Drawings
            </span>
          </button>

        </div>


        <span
          className={
            styles.toolbarDivider
          }
        />


        <div
          className={
            styles.toolbarSection
          }
        >

          {navigationTools.map(
            (
              tool
            ) => (

              <button
                key={
                  tool.id
                }
                type="button"
                className={[
                  styles.toolbarButton,
                  activeTool ===
                    tool.id
                    ? styles.toolbarButtonActive
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
                disabled={
                  !pdfDocument &&
                  tool.id !==
                    'select'
                }
                title={`${tool.label} (${tool.shortcut})`}
              >
                <Icon
                  type={
                    tool.icon
                  }
                />

                <span>
                  {
                    tool.label
                  }
                </span>
              </button>

            )
          )}


          <button
            type="button"
            className={
              styles.toolbarButton
            }
            onClick={
              fitPage
            }
            disabled={
              !pdfDocument
            }
            title="Fit Page (F)"
          >
            <Icon
              type="fit"
            />

            <span>
              Fit Page
            </span>
          </button>


          <button
            type="button"
            className={
              styles.toolbarButton
            }
            onClick={
              fitWidth
            }
            disabled={
              !pdfDocument
            }
            title="Fit Width (W)"
          >
            <Icon
              type="fitWidth"
            />

            <span>
              Fit Width
            </span>
          </button>

        </div>


        <span
          className={
            styles.toolbarDivider
          }
        />


        <div
          className={
            styles.toolbarSection
          }
        >

          {measurementTools.map(
            (
              tool
            ) => (

              <button
                key={
                  tool.id
                }
                type="button"
                className={[
                  styles.toolbarButton,
                  activeTool ===
                    tool.id
                    ? styles.toolbarButtonActive
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
                disabled={
                  !pdfDocument
                }
                title={`${tool.label} (${tool.shortcut})`}
              >
                <Icon
                  type={
                    tool.icon
                  }
                />

                <span>
                  {
                    tool.label
                  }
                </span>
              </button>

            )
          )}

        </div>


        <span
          className={
            styles.toolbarDivider
          }
        />


        <div
          className={
            styles.toolbarSection
          }
        >

          <button
            type="button"
            className={
              styles.toolbarButtonWide
            }
            disabled={
              !pdfDocument
            }
            title="Calibrate Scale"
          >
            <Icon
              type="calibrate"
            />

            <span>
              Calibrate
            </span>
          </button>


          <button
            type="button"
            className={
              styles.toolbarIconButton
            }
            disabled
            title="Undo"
          >
            <Icon
              type="undo"
            />
          </button>


          <button
            type="button"
            className={
              styles.toolbarIconButton
            }
            disabled
            title="Redo"
          >
            <Icon
              type="redo"
            />
          </button>

        </div>

      </div>


      {/* ======================================================
          MAIN CAD AREA
      ====================================================== */}

      <div
        className={
          styles.cadArea
        }
      >

        {/* ====================================================
            VIEWPORT
        ==================================================== */}

        <main
          ref={
            viewportRef
          }
          className={[
            styles.viewport,
            gridEnabled
              ? styles.viewportGrid
              : '',
          ]
            .filter(
              Boolean
            )
            .join(
              ' '
            )}
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
          }}
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
              >
                <Icon
                  type="drawings"
                  size={44}
                />
              </div>


              <h2>
                Import a drawing
              </h2>


              <p>
                Load a PDF drawing to start CAD navigation,
                scale calibration, and takeoff.
              </p>


              {pdfError && (

                <span
                  className={
                    styles.errorMessage
                  }
                >
                  {
                    pdfError
                  }
                </span>

              )}


              <button
                type="button"
                className={
                  styles.emptyImportButton
                }
                onClick={
                  openFilePicker
                }
                disabled={
                  loadingPdf
                }
              >
                <Icon
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
              className={
                styles.documentContainer
              }
              style={{
                width:
                  `${renderedSize.width}px`,

                height:
                  `${renderedSize.height}px`,

                transform:
                  `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)`,
              }}
            >

              <canvas
                ref={
                  canvasRef
                }
                className={
                  styles.pdfCanvas
                }
                style={{
                  width:
                    `${renderedSize.width}px`,

                  height:
                    `${renderedSize.height}px`,
                }}
              />


              <svg
                className={
                  styles.geometryLayer
                }
                viewBox={`0 0 ${
                  pageBaseSize
                    ?.width ||
                  1
                } ${
                  pageBaseSize
                    ?.height ||
                  1
                }`}
                preserveAspectRatio="none"
              />


              <div
                className={
                  styles.interactionLayer
                }
              />

            </div>

          )}


          {/* ==================================================
              DRAWING DRAWER
          ================================================== */}

          {drawingDrawerOpen && (

            <aside
              className={
                styles.drawingDrawer
              }
            >

              <div
                className={
                  styles.drawerHeader
                }
              >

                <div>
                  <strong>
                    Drawings
                  </strong>

                  <span>
                    Pages & files
                  </span>
                </div>


                <button
                  type="button"
                  onClick={() =>
                    setDrawingDrawerOpen(
                      false
                    )
                  }
                  title="Close drawings"
                >
                  <Icon
                    type="close"
                    size={16}
                  />
                </button>

              </div>


              <div
                className={
                  styles.drawerContent
                }
              >

                {!pdfDocument && (

                  <div
                    className={
                      styles.drawerEmpty
                    }
                  >
                    No PDF loaded.
                  </div>

                )}


                {pdfDocument && (

                  <>

                    <div
                      className={
                        styles.drawingCard
                      }
                    >

                      <Icon
                        type="drawings"
                      />

                      <div>
                        <strong>
                          {
                            pdfFileName
                          }
                        </strong>

                        <span>
                          {pageCount} {
                            pageCount === 1
                              ? 'page'
                              : 'pages'
                          }
                        </span>
                      </div>

                    </div>


                    <div
                      className={
                        styles.pageList
                      }
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


                          return (

                            <button
                              key={
                                number
                              }
                              type="button"
                              className={
                                number ===
                                  pageNumber
                                  ? styles.pageItemActive
                                  : styles.pageItem
                              }
                              onClick={() => {

                                setPageNumber(
                                  number
                                )

                                setDrawingDrawerOpen(
                                  false
                                )

                              }}
                            >
                              <span>
                                Page {number}
                              </span>

                              {
                                number ===
                                  pageNumber &&
                                <strong>
                                  Current
                                </strong>
                              }
                            </button>

                          )

                        }
                      )}

                    </div>

                  </>

                )}

              </div>

            </aside>

          )}

        </main>


        {/* ====================================================
            INSPECTOR
        ==================================================== */}

        {inspectorOpen && (

          <aside
            className={
              styles.inspector
            }
          >

            <div
              className={
                styles.inspectorTabs
              }
            >

              <button
                type="button"
                className={
                  inspectorTab ===
                    'properties'
                    ? styles.inspectorTabActive
                    : styles.inspectorTab
                }
                onClick={() =>
                  setInspectorTab(
                    'properties'
                  )
                }
              >
                <Icon
                  type="properties"
                  size={16}
                />

                Properties
              </button>


              <button
                type="button"
                className={
                  inspectorTab ===
                    'layers'
                    ? styles.inspectorTabActive
                    : styles.inspectorTab
                }
                onClick={() =>
                  setInspectorTab(
                    'layers'
                  )
                }
              >
                <Icon
                  type="layers"
                  size={16}
                />

                Layers
              </button>


              <button
                type="button"
                className={
                  styles.inspectorClose
                }
                onClick={() =>
                  setInspectorOpen(
                    false
                  )
                }
                title="Close panel"
              >
                <Icon
                  type="close"
                  size={16}
                />
              </button>

            </div>


            <div
              className={
                styles.inspectorContent
              }
            >

              {inspectorTab ===
                'properties' && (

                <>

                  <section
                    className={
                      styles.propertySection
                    }
                  >

                    <h3>
                      Drawing
                    </h3>


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

                  </section>


                  <section
                    className={
                      styles.propertySection
                    }
                  >

                    <h3>
                      View
                    </h3>


                    <div
                      className={
                        styles.propertyRow
                      }
                    >
                      <span>
                        Mode
                      </span>

                      <strong>
                        {
                          viewMode
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
                          Math.round(
                            zoom *
                            100
                          )
                        }%
                      </strong>
                    </div>

                  </section>


                  <section
                    className={
                      styles.propertySection
                    }
                  >

                    <h3>
                      Scale
                    </h3>


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

                  </section>


                  <section
                    className={
                      styles.propertySection
                    }
                  >

                    <h3>
                      Selection
                    </h3>


                    <div
                      className={
                        styles.selectionEmpty
                      }
                    >
                      Select takeoff geometry to inspect
                      and edit its properties.
                    </div>

                  </section>

                </>

              )}


              {inspectorTab ===
                'layers' && (

                <>

                  <section
                    className={
                      styles.propertySection
                    }
                  >

                    <h3>
                      Layers
                    </h3>


                    <div
                      className={
                        styles.selectionEmpty
                      }
                    >
                      Takeoff layers will appear here as
                      geometry is created.
                    </div>

                  </section>


                  <section
                    className={
                      styles.propertySection
                    }
                  >

                    <h3>
                      Drawing
                    </h3>


                    <div
                      className={
                        styles.layerRow
                      }
                    >
                      <span
                        className={
                          styles.layerDot
                        }
                      />

                      <span>
                        PDF Drawing
                      </span>

                      <strong>
                        Visible
                      </strong>
                    </div>

                  </section>

                </>

              )}

            </div>

          </aside>

        )}


        {/* ====================================================
            RIGHT TOOL RAIL
        ==================================================== */}

        <aside
          className={
            styles.toolRail
          }
        >

          <button
            type="button"
            className={
              inspectorOpen &&
              inspectorTab ===
                'properties'
                ? styles.railButtonActive
                : styles.railButton
            }
            onClick={() =>
              openInspector(
                'properties'
              )
            }
            title="Properties"
          >
            <Icon
              type="properties"
            />

            <span>
              Properties
            </span>
          </button>


          <button
            type="button"
            className={
              inspectorOpen &&
              inspectorTab ===
                'layers'
                ? styles.railButtonActive
                : styles.railButton
            }
            onClick={() =>
              openInspector(
                'layers'
              )
            }
            title="Layers"
          >
            <Icon
              type="layers"
            />

            <span>
              Layers
            </span>
          </button>


          <button
            type="button"
            className={
              drawingDrawerOpen
                ? styles.railButtonActive
                : styles.railButton
            }
            onClick={() =>
              setDrawingDrawerOpen(
                (
                  current
                ) =>
                  !current
              )
            }
            title="Drawings"
          >
            <Icon
              type="drawings"
            />

            <span>
              Drawings
            </span>
          </button>


          <span
            className={
              styles.railDivider
            }
          />


          <button
            type="button"
            className={
              snapEnabled
                ? styles.railButtonActive
                : styles.railButton
            }
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
            <Icon
              type="snap"
            />

            <span>
              Snap
            </span>
          </button>


          <button
            type="button"
            className={
              orthoEnabled
                ? styles.railButtonActive
                : styles.railButton
            }
            onClick={() =>
              setOrthoEnabled(
                (
                  current
                ) =>
                  !current
              )
            }
            title="Ortho"
          >
            <Icon
              type="ortho"
            />

            <span>
              Ortho
            </span>
          </button>


          <button
            type="button"
            className={
              gridEnabled
                ? styles.railButtonActive
                : styles.railButton
            }
            onClick={() =>
              setGridEnabled(
                (
                  current
                ) =>
                  !current
              )
            }
            title="Grid"
          >
            <Icon
              type="grid"
            />

            <span>
              Grid
            </span>
          </button>


          <span
            className={
              styles.railDivider
            }
          />


          <button
            type="button"
            className={
              styles.railButton
            }
            disabled
            title="Delete selected geometry"
          >
            <Icon
              type="delete"
            />

            <span>
              Delete
            </span>
          </button>

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

          <span>
            Tool
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
              styles.statusDivider
            }
          />


          <span>
            X
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


          <span>
            Y
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

        </div>


        <div
          className={
            styles.statusRight
          }
        >

          <button
            type="button"
            className={
              snapEnabled
                ? styles.statusModeActive
                : styles.statusMode
            }
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


          <button
            type="button"
            className={
              orthoEnabled
                ? styles.statusModeActive
                : styles.statusMode
            }
            onClick={() =>
              setOrthoEnabled(
                (
                  current
                ) =>
                  !current
              )
            }
          >
            ORTHO
          </button>


          <button
            type="button"
            className={
              gridEnabled
                ? styles.statusModeActive
                : styles.statusMode
            }
            onClick={() =>
              setGridEnabled(
                (
                  current
                ) =>
                  !current
              )
            }
          >
            GRID
          </button>


          <span
            className={
              styles.statusMetric
            }
          >
            Page
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
              styles.statusMetric
            }
          >
            Scale
            <strong>
              Not calibrated
            </strong>
          </span>


          <span
            className={
              styles.statusMetric
            }
          >
            Zoom
            <strong>
              {
                Math.round(
                  zoom *
                  100
                )
              }%
            </strong>
          </span>

        </div>

      </footer>

    </div>

  )

}
