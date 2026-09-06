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
// RITSUCAD APPLICATION
//
// Standalone construction CAD, markup, measurement, and takeoff workspace.
//
// Geometry is stored in native PDF page coordinates.
//
// PDF Drawing
// ↓
// Page Calibration
// ↓
// RitsuCAD Geometry
// ↓
// Markup / Annotation
// ↓
// Measurement / Takeoff
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
const PDF_VECTOR_CURVE_STEPS = 8
const PDF_VECTOR_MAX_SEGMENTS = 50000
const PDF_VECTOR_MIN_SEGMENT_LENGTH = 0.15

const UNIT_TO_METERS = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  in: 0.0254,
  ft: 0.3048,
}

const UNIT_LABELS = {
  mm: 'Millimeters',
  cm: 'Centimeters',
  m: 'Meters',
  in: 'Inches',
  ft: 'Feet',
}


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

    case 'cad':
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

const drawingTools = [
  {
    id: 'draw-line',
    label: 'Line',
    icon: 'line',
    shortcut: '1',
  },
  {
    id: 'draw-polyline',
    label: 'Polyline',
    icon: 'polyline',
    shortcut: '2',
  },
  {
    id: 'draw-rectangle',
    label: 'Rectangle',
    icon: 'rectangle',
    shortcut: '3',
  },
  {
    id: 'draw-polygon',
    label: 'Polygon',
    icon: 'area',
    shortcut: '4',
  },
  {
    id: 'draw-circle',
    label: 'Circle',
    icon: 'count',
    shortcut: '5',
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
    shortcut: 'P',
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
  ...drawingTools,
  ...measurementTools,
  {
    id: 'calibrate',
    label: 'Calibrate',
    icon: 'calibrate',
    shortcut: null,
  },
]


const DEFAULT_NATIVE_PAGE_SIZE = {
  width: 1200,
  height: 800,
}


// ============================================================
// GEOMETRY UTILITIES
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


function pointDistance(
  point1,
  point2
) {
  if (
    !point1 ||
    !point2
  ) {
    return 0
  }

  return Math.hypot(
    point2.x - point1.x,
    point2.y - point1.y
  )
}


function formatNumber(
  value,
  decimals = 2
) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(value)
  ) {
    return '—'
  }

  return Number(value).toFixed(
    decimals
  )
}


function realDistanceFromPoints(
  point1,
  point2,
  calibration
) {
  if (
    !point1 ||
    !point2 ||
    !calibration
  ) {
    return null
  }

  const pdfDistance =
    pointDistance(
      point1,
      point2
    )

  const meters =
    pdfDistance *
    calibration.metersPerPdfPoint

  const unitFactor =
    UNIT_TO_METERS[
      calibration.displayUnit
    ]

  if (!unitFactor) {
    return null
  }

  return meters /
    unitFactor
}


function polylinePdfLength(
  points
) {
  if (
    !Array.isArray(points) ||
    points.length < 2
  ) {
    return 0
  }

  let total =
    0

  for (
    let index = 1;
    index < points.length;
    index += 1
  ) {
    total +=
      pointDistance(
        points[index - 1],
        points[index]
      )
  }

  return total
}


function realPolylineLength(
  points,
  calibration
) {
  if (
    !calibration ||
    !Array.isArray(points) ||
    points.length < 2
  ) {
    return null
  }

  const pdfLength =
    polylinePdfLength(
      points
    )

  const meters =
    pdfLength *
    calibration.metersPerPdfPoint

  const unitFactor =
    UNIT_TO_METERS[
      calibration.displayUnit
    ]

  if (!unitFactor) {
    return null
  }

  return meters /
    unitFactor
}


function polygonPdfArea(
  points
) {
  if (
    !Array.isArray(points) ||
    points.length < 3
  ) {
    return 0
  }

  let total =
    0

  for (
    let index = 0;
    index < points.length;
    index += 1
  ) {
    const current =
      points[index]

    const next =
      points[
        (
          index + 1
        ) %
        points.length
      ]

    total +=
      current.x *
        next.y -
      next.x *
        current.y
  }

  return Math.abs(
    total
  ) / 2
}


function realAreaFromPdfArea(
  pdfArea,
  calibration
) {
  if (
    !calibration ||
    !Number.isFinite(
      pdfArea
    )
  ) {
    return null
  }

  const squareMeters =
    pdfArea *
    calibration.metersPerPdfPoint *
    calibration.metersPerPdfPoint

  const unitFactor =
    UNIT_TO_METERS[
      calibration.displayUnit
    ]

  if (!unitFactor) {
    return null
  }

  return squareMeters /
    (
      unitFactor *
      unitFactor
    )
}


function realPolygonArea(
  points,
  calibration
) {
  return realAreaFromPdfArea(
    polygonPdfArea(
      points
    ),
    calibration
  )
}


function rectanglePdfArea(
  point1,
  point2
) {
  if (
    !point1 ||
    !point2
  ) {
    return 0
  }

  return Math.abs(
    point2.x -
    point1.x
  ) *
    Math.abs(
      point2.y -
      point1.y
    )
}


function realRectangleArea(
  point1,
  point2,
  calibration
) {
  return realAreaFromPdfArea(
    rectanglePdfArea(
      point1,
      point2
    ),
    calibration
  )
}


function rectangleDimensions(
  point1,
  point2,
  calibration
) {
  if (
    !point1 ||
    !point2 ||
    !calibration
  ) {
    return null
  }

  const widthPoint = {
    x:
      point2.x,

    y:
      point1.y,
  }

  const heightPoint = {
    x:
      point1.x,

    y:
      point2.y,
  }

  return {
    width:
      realDistanceFromPoints(
        point1,
        widthPoint,
        calibration
      ),

    height:
      realDistanceFromPoints(
        point1,
        heightPoint,
        calibration
      ),
  }
}


function polygonCentroid(
  points
) {
  if (
    !Array.isArray(points) ||
    !points.length
  ) {
    return {
      x: 0,
      y: 0,
    }
  }

  const totals =
    points.reduce(
      (
        accumulator,
        point
      ) => ({
        x:
          accumulator.x +
          point.x,

        y:
          accumulator.y +
          point.y,
      }),
      {
        x: 0,
        y: 0,
      }
    )

  return {
    x:
      totals.x /
      points.length,

    y:
      totals.y /
      points.length,
  }
}


function removeConsecutiveDuplicatePoints(
  points
) {
  if (
    !Array.isArray(points) ||
    !points.length
  ) {
    return []
  }

  const result = [
    points[0],
  ]

  for (
    let index = 1;
    index < points.length;
    index += 1
  ) {
    const previous =
      result[
        result.length - 1
      ]

    const current =
      points[index]

    if (
      pointDistance(
        previous,
        current
      ) >
      0.0001
    ) {
      result.push(
        current
      )
    }
  }

  return result
}


function distancePointToSegment(
  point,
  point1,
  point2
) {
  if (
    !point ||
    !point1 ||
    !point2
  ) {
    return Infinity
  }

  const dx =
    point2.x -
    point1.x

  const dy =
    point2.y -
    point1.y

  const lengthSquared =
    dx * dx +
    dy * dy

  if (
    lengthSquared <=
    0.0000001
  ) {
    return pointDistance(
      point,
      point1
    )
  }

  const projection =
    (
      (
        point.x -
        point1.x
      ) *
      dx +
      (
        point.y -
        point1.y
      ) *
      dy
    ) /
    lengthSquared

  const clampedProjection =
    clamp(
      projection,
      0,
      1
    )

  const nearestPoint = {
    x:
      point1.x +
      dx *
      clampedProjection,

    y:
      point1.y +
      dy *
      clampedProjection,
  }

  return pointDistance(
    point,
    nearestPoint
  )
}


function pointInPolygon(
  point,
  polygon
) {
  if (
    !point ||
    !Array.isArray(
      polygon
    ) ||
    polygon.length <
      3
  ) {
    return false
  }

  let inside =
    false

  for (
    let index = 0,
      previousIndex =
        polygon.length -
        1;
    index <
      polygon.length;
    previousIndex =
      index,
    index += 1
  ) {
    const current =
      polygon[index]

    const previous =
      polygon[
        previousIndex
      ]

    const intersects =
      (
        current.y >
          point.y
      ) !==
        (
          previous.y >
            point.y
        ) &&
      point.x <
        (
          (
            previous.x -
            current.x
          ) *
            (
              point.y -
              current.y
            )
        ) /
          (
            previous.y -
              current.y ||
            Number.EPSILON
          ) +
        current.x

    if (
      intersects
    ) {
      inside =
        !inside
    }
  }

  return inside
}


function hitTestEntity(
  entity,
  point,
  tolerance
) {
  if (
    !entity ||
    !point ||
    !Array.isArray(
      entity.points
    )
  ) {
    return false
  }

  if (
    entity.type ===
      'distance' ||
    entity.type ===
      'linear' ||
    entity.type ===
      'cad-line'
  ) {
    if (
      entity.points.length <
      2
    ) {
      return false
    }

    return (
      distancePointToSegment(
        point,
        entity.points[0],
        entity.points[1]
      ) <=
      tolerance
    )
  }

  if (
    (
      entity.type ===
        'polyline' ||
      entity.type ===
        'cad-polyline'
    )
  ) {
    for (
      let index = 1;
      index <
        entity.points.length;
      index += 1
    ) {
      if (
        distancePointToSegment(
          point,
          entity.points[
            index - 1
          ],
          entity.points[
            index
          ]
        ) <=
        tolerance
      ) {
        return true
      }
    }

    return false
  }

  if (
    (
      entity.type ===
        'rectangle' ||
      entity.type ===
        'cad-rectangle'
    )
  ) {
    if (
      entity.points.length <
      2
    ) {
      return false
    }

    const point1 =
      entity.points[0]

    const point2 =
      entity.points[1]

    const minimumX =
      Math.min(
        point1.x,
        point2.x
      ) -
      tolerance

    const maximumX =
      Math.max(
        point1.x,
        point2.x
      ) +
      tolerance

    const minimumY =
      Math.min(
        point1.y,
        point2.y
      ) -
      tolerance

    const maximumY =
      Math.max(
        point1.y,
        point2.y
      ) +
      tolerance

    return (
      point.x >=
        minimumX &&
      point.x <=
        maximumX &&
      point.y >=
        minimumY &&
      point.y <=
        maximumY
    )
  }

  if (
    (
      entity.type ===
        'area' ||
      entity.type ===
        'cad-polygon'
    )
  ) {
    if (
      pointInPolygon(
        point,
        entity.points
      )
    ) {
      return true
    }

    for (
      let index = 0;
      index <
        entity.points.length;
      index += 1
    ) {
      const current =
        entity.points[
          index
        ]

      const next =
        entity.points[
          (
            index + 1
          ) %
          entity.points.length
        ]

      if (
        distancePointToSegment(
          point,
          current,
          next
        ) <=
        tolerance
      ) {
        return true
      }
    }

    return false
  }

  if (
    entity.type ===
      'cad-circle'
  ) {
    if (
      entity.points.length <
      2
    ) {
      return false
    }

    const center =
      entity.points[0]

    const edge =
      entity.points[1]

    const radius =
      pointDistance(
        center,
        edge
      )

    const distance =
      pointDistance(
        center,
        point
      )

    return (
      Math.abs(
        distance -
        radius
      ) <=
        tolerance ||
      distance <=
        radius
    )
  }

  if (
    entity.type ===
    'count'
  ) {
    return entity.points.some(
      (countPoint) =>
        pointDistance(
          point,
          countPoint
        ) <=
        tolerance *
          1.35
    )
  }

  return false
}


function entityGripPoints(
  entity
) {
  if (
    !entity ||
    !Array.isArray(
      entity.points
    )
  ) {
    return []
  }

  if (
    (
      entity.type ===
        'rectangle' ||
      entity.type ===
        'cad-rectangle'
    ) &&
    entity.points.length >=
      2
  ) {
    const point1 =
      entity.points[0]

    const point2 =
      entity.points[1]

    const minimumX =
      Math.min(
        point1.x,
        point2.x
      )

    const maximumX =
      Math.max(
        point1.x,
        point2.x
      )

    const minimumY =
      Math.min(
        point1.y,
        point2.y
      )

    const maximumY =
      Math.max(
        point1.y,
        point2.y
      )

    return [
      {
        id: 'top-left',
        point: {
          x: minimumX,
          y: minimumY,
        },
      },
      {
        id: 'top-right',
        point: {
          x: maximumX,
          y: minimumY,
        },
      },
      {
        id: 'bottom-right',
        point: {
          x: maximumX,
          y: maximumY,
        },
      },
      {
        id: 'bottom-left',
        point: {
          x: minimumX,
          y: maximumY,
        },
      },
    ]
  }

  if (
    entity.type ===
      'cad-circle' &&
    entity.points.length >=
      2
  ) {
    return [
      {
        id: 'center',
        point: entity.points[0],
      },
      {
        id: 'radius',
        point: entity.points[1],
      },
    ]
  }

  return entity.points.map(
    (
      point,
      index
    ) => ({
      id: index,
      point,
    })
  )
}


function updateEntityGrip(
  entity,
  gripId,
  nextPoint
) {
  if (
    !entity ||
    !nextPoint
  ) {
    return entity
  }

  if (
    (
      entity.type ===
        'rectangle' ||
      entity.type ===
        'cad-rectangle'
    ) &&
    entity.points.length >=
      2
  ) {
    const point1 =
      entity.points[0]

    const point2 =
      entity.points[1]

    let minimumX =
      Math.min(
        point1.x,
        point2.x
      )

    let maximumX =
      Math.max(
        point1.x,
        point2.x
      )

    let minimumY =
      Math.min(
        point1.y,
        point2.y
      )

    let maximumY =
      Math.max(
        point1.y,
        point2.y
      )

    if (
      gripId ===
      'top-left'
    ) {
      minimumX =
        nextPoint.x
      minimumY =
        nextPoint.y

    } else if (
      gripId ===
      'top-right'
    ) {
      maximumX =
        nextPoint.x
      minimumY =
        nextPoint.y

    } else if (
      gripId ===
      'bottom-right'
    ) {
      maximumX =
        nextPoint.x
      maximumY =
        nextPoint.y

    } else if (
      gripId ===
      'bottom-left'
    ) {
      minimumX =
        nextPoint.x
      maximumY =
        nextPoint.y
    }

    const normalizedMinimumX =
      Math.min(
        minimumX,
        maximumX
      )

    const normalizedMaximumX =
      Math.max(
        minimumX,
        maximumX
      )

    const normalizedMinimumY =
      Math.min(
        minimumY,
        maximumY
      )

    const normalizedMaximumY =
      Math.max(
        minimumY,
        maximumY
      )

    return {
      ...entity,

      points: [
        {
          x:
            normalizedMinimumX,
          y:
            normalizedMinimumY,
        },
        {
          x:
            normalizedMaximumX,
          y:
            normalizedMaximumY,
        },
      ],
    }
  }

  const gripIndex =
    Number(
      gripId
    )

  if (
    !Number.isInteger(
      gripIndex
    ) ||
    gripIndex < 0 ||
    gripIndex >=
      entity.points.length
  ) {
    return entity
  }

  return {
    ...entity,

    points:
      entity.points.map(
        (
          point,
          index
        ) =>
          index ===
            gripIndex
            ? {
                ...nextPoint,
              }
            : point
      ),
  }
}


function translateEntity(
  entity,
  deltaX,
  deltaY
) {
  if (
    !entity ||
    !Array.isArray(
      entity.points
    )
  ) {
    return entity
  }

  return {
    ...entity,

    points:
      entity.points.map(
        (point) => ({
          x:
            point.x +
            deltaX,

          y:
            point.y +
            deltaY,
        })
      ),
  }
}


function entityGeometryChanged(
  entity1,
  entity2
) {
  if (
    !entity1 ||
    !entity2 ||
    entity1.id !==
      entity2.id ||
    entity1.points.length !==
      entity2.points.length
  ) {
    return false
  }

  return entity1.points.some(
    (
      point,
      index
    ) =>
      pointDistance(
        point,
        entity2.points[
          index
        ]
      ) >
      0.0001
  )
}


function nearestPointOnSegment(
  point,
  point1,
  point2
) {
  if (
    !point ||
    !point1 ||
    !point2
  ) {
    return null
  }

  const dx =
    point2.x -
    point1.x

  const dy =
    point2.y -
    point1.y

  const lengthSquared =
    dx * dx +
    dy * dy

  if (
    lengthSquared <=
    0.0000001
  ) {
    return {
      point: {
        ...point1,
      },

      distance:
        pointDistance(
          point,
          point1
        ),
    }
  }

  const projection =
    clamp(
      (
        (
          point.x -
          point1.x
        ) *
          dx +
        (
          point.y -
          point1.y
        ) *
          dy
      ) /
        lengthSquared,
      0,
      1
    )

  const nearestPoint = {
    x:
      point1.x +
      dx *
      projection,

    y:
      point1.y +
      dy *
      projection,
  }

  return {
    point:
      nearestPoint,

    distance:
      pointDistance(
        point,
        nearestPoint
      ),
  }
}


function segmentIntersection(
  segment1,
  segment2
) {
  if (
    !segment1 ||
    !segment2
  ) {
    return null
  }

  const x1 =
    segment1.point1.x

  const y1 =
    segment1.point1.y

  const x2 =
    segment1.point2.x

  const y2 =
    segment1.point2.y

  const x3 =
    segment2.point1.x

  const y3 =
    segment2.point1.y

  const x4 =
    segment2.point2.x

  const y4 =
    segment2.point2.y

  const denominator =
    (
      x1 - x2
    ) *
      (
        y3 - y4
      ) -
    (
      y1 - y2
    ) *
      (
        x3 - x4
      )

  if (
    Math.abs(
      denominator
    ) <
    0.0000001
  ) {
    return null
  }

  const t =
    (
      (
        x1 - x3
      ) *
        (
          y3 - y4
        ) -
      (
        y1 - y3
      ) *
        (
          x3 - x4
        )
    ) /
    denominator

  const u =
    -(
      (
        x1 - x2
      ) *
        (
          y1 - y3
        ) -
      (
        y1 - y2
      ) *
        (
          x1 - x3
        )
    ) /
    denominator

  if (
    t <
      -0.000001 ||
    t >
      1.000001 ||
    u <
      -0.000001 ||
    u >
      1.000001
  ) {
    return null
  }

  return {
    x:
      x1 +
      t *
      (
        x2 - x1
      ),

    y:
      y1 +
      t *
      (
        y2 - y1
      ),
  }
}


function entitySegments(
  entity
) {
  if (
    !entity ||
    !Array.isArray(
      entity.points
    )
  ) {
    return []
  }

  if (
    entity.type ===
      'distance' ||
    entity.type ===
      'linear' ||
    entity.type ===
      'cad-line'
  ) {
    if (
      entity.points.length <
      2
    ) {
      return []
    }

    return [
      {
        entityId:
          entity.id,

        point1:
          entity.points[0],

        point2:
          entity.points[1],
      },
    ]
  }

  if (
    entity.type ===
      'polyline' ||
    entity.type ===
      'cad-polyline'
  ) {
    const segments =
      []

    for (
      let index = 1;
      index <
        entity.points.length;
      index += 1
    ) {
      segments.push({
        entityId:
          entity.id,

        point1:
          entity.points[
            index - 1
          ],

        point2:
          entity.points[
            index
          ],
      })
    }

    return segments
  }

  if (
    entity.type ===
      'area' ||
    entity.type ===
      'cad-polygon'
  ) {
    const segments =
      []

    for (
      let index = 0;
      index <
        entity.points.length;
      index += 1
    ) {
      segments.push({
        entityId:
          entity.id,

        point1:
          entity.points[
            index
          ],

        point2:
          entity.points[
            (
              index + 1
            ) %
            entity.points.length
          ],
      })
    }

    return segments
  }

  if (
    (
      entity.type ===
        'rectangle' ||
      entity.type ===
        'cad-rectangle'
    ) &&
    entity.points.length >=
      2
  ) {
    const point1 =
      entity.points[0]

    const point2 =
      entity.points[1]

    const corners = [
      {
        x:
          Math.min(
            point1.x,
            point2.x
          ),
        y:
          Math.min(
            point1.y,
            point2.y
          ),
      },
      {
        x:
          Math.max(
            point1.x,
            point2.x
          ),
        y:
          Math.min(
            point1.y,
            point2.y
          ),
      },
      {
        x:
          Math.max(
            point1.x,
            point2.x
          ),
        y:
          Math.max(
            point1.y,
            point2.y
          ),
      },
      {
        x:
          Math.min(
            point1.x,
            point2.x
          ),
        y:
          Math.max(
            point1.y,
            point2.y
          ),
      },
    ]

    return corners.map(
      (
        corner,
        index
      ) => ({
        entityId:
          entity.id,

        point1:
          corner,

        point2:
          corners[
            (
              index + 1
            ) %
            corners.length
          ],
      })
    )
  }

  return []
}


function entitySnapVertices(
  entity
) {
  if (
    !entity ||
    !Array.isArray(
      entity.points
    )
  ) {
    return []
  }

  if (
    (
      entity.type ===
        'rectangle' ||
      entity.type ===
        'cad-rectangle'
    ) &&
    entity.points.length >=
      2
  ) {
    return entityGripPoints(
      entity
    ).map(
      (grip) => ({
        entityId:
          entity.id,

        point:
          grip.point,
      })
    )
  }

  return entity.points.map(
    (point) => ({
      entityId:
        entity.id,

      point,
    })
  )
}


function constrainOrthoPoint(
  anchorPoint,
  targetPoint
) {
  if (
    !anchorPoint ||
    !targetPoint
  ) {
    return {
      point:
        targetPoint,

      axis:
        null,
    }
  }

  const deltaX =
    targetPoint.x -
    anchorPoint.x

  const deltaY =
    targetPoint.y -
    anchorPoint.y

  if (
    Math.abs(
      deltaX
    ) >=
    Math.abs(
      deltaY
    )
  ) {
    return {
      point: {
        x:
          targetPoint.x,

        y:
          anchorPoint.y,
      },

      axis:
        'Horizontal',
    }
  }

  return {
    point: {
      x:
        anchorPoint.x,

      y:
        targetPoint.y,
    },

    axis:
      'Vertical',
  }
}


function multiplyPdfMatrices(
  matrix1,
  matrix2
) {
  return [
    matrix1[0] *
      matrix2[0] +
    matrix1[2] *
      matrix2[1],

    matrix1[1] *
      matrix2[0] +
    matrix1[3] *
      matrix2[1],

    matrix1[0] *
      matrix2[2] +
    matrix1[2] *
      matrix2[3],

    matrix1[1] *
      matrix2[2] +
    matrix1[3] *
      matrix2[3],

    matrix1[0] *
      matrix2[4] +
    matrix1[2] *
      matrix2[5] +
    matrix1[4],

    matrix1[1] *
      matrix2[4] +
    matrix1[3] *
      matrix2[5] +
    matrix1[5],
  ]
}


function applyPdfMatrix(
  point,
  matrix
) {
  return {
    x:
      matrix[0] *
        point.x +
      matrix[2] *
        point.y +
      matrix[4],

    y:
      matrix[1] *
        point.x +
      matrix[3] *
        point.y +
      matrix[5],
  }
}


function cubicBezierPoint(
  point0,
  point1,
  point2,
  point3,
  t
) {
  const oneMinusT =
    1 - t

  const oneMinusTSquared =
    oneMinusT *
    oneMinusT

  const tSquared =
    t * t

  return {
    x:
      oneMinusTSquared *
        oneMinusT *
        point0.x +
      3 *
        oneMinusTSquared *
        t *
        point1.x +
      3 *
        oneMinusT *
        tSquared *
        point2.x +
      tSquared *
        t *
        point3.x,

    y:
      oneMinusTSquared *
        oneMinusT *
        point0.y +
      3 *
        oneMinusTSquared *
        t *
        point1.y +
      3 *
        oneMinusT *
        tSquared *
        point2.y +
      tSquared *
        t *
        point3.y,
  }
}


function pdfSegmentKey(
  point1,
  point2
) {
  const precision =
    100

  const first = {
    x:
      Math.round(
        point1.x *
          precision
      ),

    y:
      Math.round(
        point1.y *
          precision
      ),
  }

  const second = {
    x:
      Math.round(
        point2.x *
          precision
      ),

    y:
      Math.round(
        point2.y *
          precision
      ),
  }

  const forward =
    `${first.x},${first.y}|${second.x},${second.y}`

  const reverse =
    `${second.x},${second.y}|${first.x},${first.y}`

  return forward <
    reverse
    ? forward
    : reverse
}


function segmentBoundingBox(
  segment,
  padding = 0
) {
  return {
    minimumX:
      Math.min(
        segment.point1.x,
        segment.point2.x
      ) -
      padding,

    maximumX:
      Math.max(
        segment.point1.x,
        segment.point2.x
      ) +
      padding,

    minimumY:
      Math.min(
        segment.point1.y,
        segment.point2.y
      ) -
      padding,

    maximumY:
      Math.max(
        segment.point1.y,
        segment.point2.y
      ) +
      padding,
  }
}


function pointInsideBoundingBox(
  point,
  boundingBox
) {
  return (
    point.x >=
      boundingBox.minimumX &&
    point.x <=
      boundingBox.maximumX &&
    point.y >=
      boundingBox.minimumY &&
    point.y <=
      boundingBox.maximumY
  )
}


function extractPdfVectorGeometry(
  page,
  pdfjs,
  viewport,
  operatorList
) {
  const segments =
    []

  const segmentKeys =
    new Set()

  let currentTransform = [
    1,
    0,
    0,
    1,
    0,
    0,
  ]

  const transformStack =
    []

  let currentPathSegments =
    []

  let currentPoint =
    null

  let subpathStart =
    null

  let hasRasterImage =
    false

  let truncated =
    false


  function toViewportPoint(
    x,
    y
  ) {
    const transformed =
      applyPdfMatrix(
        {
          x,
          y,
        },
        currentTransform
      )

    const [
      viewportX,
      viewportY,
    ] =
      viewport
        .convertToViewportPoint(
          transformed.x,
          transformed.y
        )

    return {
      x:
        viewportX,

      y:
        viewportY,
    }
  }


  function addPathSegment(
    point1,
    point2
  ) {
    if (
      !point1 ||
      !point2
    ) {
      return
    }

    if (
      pointDistance(
        point1,
        point2
      ) <
      PDF_VECTOR_MIN_SEGMENT_LENGTH
    ) {
      return
    }

    currentPathSegments.push({
      point1: {
        ...point1,
      },

      point2: {
        ...point2,
      },
    })
  }


  function commitCurrentPath() {
    for (
      const segment of
      currentPathSegments
    ) {
      if (
        segments.length >=
        PDF_VECTOR_MAX_SEGMENTS
      ) {
        truncated =
          true

        break
      }

      const key =
        pdfSegmentKey(
          segment.point1,
          segment.point2
        )

      if (
        segmentKeys.has(
          key
        )
      ) {
        continue
      }

      segmentKeys.add(
        key
      )

      segments.push({
        id:
          `pdf-${segments.length + 1}`,

        source:
          'pdf',

        point1:
          segment.point1,

        point2:
          segment.point2,
      })
    }

    currentPathSegments =
      []

    currentPoint =
      null

    subpathStart =
      null
  }


  function discardCurrentPath() {
    currentPathSegments =
      []

    currentPoint =
      null

    subpathStart =
      null
  }


  function addBezierSegments(
    startPoint,
    controlPoint1,
    controlPoint2,
    endPoint
  ) {
    let previousPoint =
      startPoint

    for (
      let step = 1;
      step <=
        PDF_VECTOR_CURVE_STEPS;
      step += 1
    ) {
      const point =
        cubicBezierPoint(
          startPoint,
          controlPoint1,
          controlPoint2,
          endPoint,
          step /
            PDF_VECTOR_CURVE_STEPS
        )

      addPathSegment(
        previousPoint,
        point
      )

      previousPoint =
        point
    }
  }


  function parseConstructPath(
    args
  ) {
    const rawOperations =
      args?.[0]

    const rawCoordinates =
      args?.[1]

    if (
      rawOperations ===
        null ||
      rawOperations ===
        undefined ||
      !rawCoordinates
    ) {
      return
    }

    const operations =
      ArrayBuffer.isView(
        rawOperations
      ) ||
      Array.isArray(
        rawOperations
      )
        ? Array.from(
            rawOperations
          )
        : [
            rawOperations,
          ]

    const coordinates =
      Array.from(
        rawCoordinates
      )

    let coordinateIndex =
      0

    for (
      const operation of
      operations
    ) {
      if (
        operation ===
        pdfjs.OPS.moveTo
      ) {
        const point =
          toViewportPoint(
            coordinates[
              coordinateIndex
            ],
            coordinates[
              coordinateIndex +
              1
            ]
          )

        coordinateIndex +=
          2

        currentPoint =
          point

        subpathStart =
          point

      } else if (
        operation ===
        pdfjs.OPS.lineTo
      ) {
        const point =
          toViewportPoint(
            coordinates[
              coordinateIndex
            ],
            coordinates[
              coordinateIndex +
              1
            ]
          )

        coordinateIndex +=
          2

        if (
          currentPoint
        ) {
          addPathSegment(
            currentPoint,
            point
          )
        }

        currentPoint =
          point

      } else if (
        operation ===
        pdfjs.OPS.curveTo
      ) {
        const controlPoint1 =
          toViewportPoint(
            coordinates[
              coordinateIndex
            ],
            coordinates[
              coordinateIndex +
              1
            ]
          )

        const controlPoint2 =
          toViewportPoint(
            coordinates[
              coordinateIndex +
              2
            ],
            coordinates[
              coordinateIndex +
              3
            ]
          )

        const endPoint =
          toViewportPoint(
            coordinates[
              coordinateIndex +
              4
            ],
            coordinates[
              coordinateIndex +
              5
            ]
          )

        coordinateIndex +=
          6

        if (
          currentPoint
        ) {
          addBezierSegments(
            currentPoint,
            controlPoint1,
            controlPoint2,
            endPoint
          )
        }

        currentPoint =
          endPoint

      } else if (
        operation ===
        pdfjs.OPS.curveTo2
      ) {
        const controlPoint2 =
          toViewportPoint(
            coordinates[
              coordinateIndex
            ],
            coordinates[
              coordinateIndex +
              1
            ]
          )

        const endPoint =
          toViewportPoint(
            coordinates[
              coordinateIndex +
              2
            ],
            coordinates[
              coordinateIndex +
              3
            ]
          )

        coordinateIndex +=
          4

        if (
          currentPoint
        ) {
          addBezierSegments(
            currentPoint,
            currentPoint,
            controlPoint2,
            endPoint
          )
        }

        currentPoint =
          endPoint

      } else if (
        operation ===
        pdfjs.OPS.curveTo3
      ) {
        const controlPoint1 =
          toViewportPoint(
            coordinates[
              coordinateIndex
            ],
            coordinates[
              coordinateIndex +
              1
            ]
          )

        const endPoint =
          toViewportPoint(
            coordinates[
              coordinateIndex +
              2
            ],
            coordinates[
              coordinateIndex +
              3
            ]
          )

        coordinateIndex +=
          4

        if (
          currentPoint
        ) {
          addBezierSegments(
            currentPoint,
            controlPoint1,
            endPoint,
            endPoint
          )
        }

        currentPoint =
          endPoint

      } else if (
        operation ===
        pdfjs.OPS.closePath
      ) {
        if (
          currentPoint &&
          subpathStart
        ) {
          addPathSegment(
            currentPoint,
            subpathStart
          )

          currentPoint =
            subpathStart
        }

      } else if (
        operation ===
        pdfjs.OPS.rectangle
      ) {
        const x =
          coordinates[
            coordinateIndex
          ]

        const y =
          coordinates[
            coordinateIndex +
            1
          ]

        const width =
          coordinates[
            coordinateIndex +
            2
          ]

        const height =
          coordinates[
            coordinateIndex +
            3
          ]

        coordinateIndex +=
          4

        const corner1 =
          toViewportPoint(
            x,
            y
          )

        const corner2 =
          toViewportPoint(
            x + width,
            y
          )

        const corner3 =
          toViewportPoint(
            x + width,
            y + height
          )

        const corner4 =
          toViewportPoint(
            x,
            y + height
          )

        addPathSegment(
          corner1,
          corner2
        )

        addPathSegment(
          corner2,
          corner3
        )

        addPathSegment(
          corner3,
          corner4
        )

        addPathSegment(
          corner4,
          corner1
        )

        currentPoint =
          corner1

        subpathStart =
          corner1
      }
    }
  }


  for (
    let index = 0;
    index <
      operatorList.fnArray.length;
    index += 1
  ) {
    const operation =
      operatorList.fnArray[
        index
      ]

    const args =
      operatorList.argsArray[
        index
      ]


    if (
      operation ===
      pdfjs.OPS.save
    ) {
      transformStack.push(
        [
          ...currentTransform,
        ]
      )

      continue
    }


    if (
      operation ===
      pdfjs.OPS.restore
    ) {
      currentTransform =
        transformStack.pop() ||
        [
          1,
          0,
          0,
          1,
          0,
          0,
        ]

      continue
    }


    if (
      operation ===
      pdfjs.OPS.transform
    ) {
      const transformArgs =
        ArrayBuffer.isView(
          args
        ) ||
        Array.isArray(
          args
        )
          ? Array.from(
              args
            )
          : []

      if (
        transformArgs.length >=
        6
      ) {
        currentTransform =
          multiplyPdfMatrices(
            currentTransform,
            transformArgs
          )
      }

      continue
    }


    if (
      operation ===
      pdfjs.OPS.constructPath
    ) {
      parseConstructPath(
        args
      )

      continue
    }


    if (
      operation ===
        pdfjs.OPS.stroke ||
      operation ===
        pdfjs.OPS.closeStroke ||
      operation ===
        pdfjs.OPS.fillStroke ||
      operation ===
        pdfjs.OPS.eoFillStroke ||
      operation ===
        pdfjs.OPS.closeFillStroke ||
      operation ===
        pdfjs.OPS.closeEOFillStroke
    ) {
      commitCurrentPath()

      if (
        truncated
      ) {
        break
      }

      continue
    }


    if (
      operation ===
        pdfjs.OPS.fill ||
      operation ===
        pdfjs.OPS.eoFill ||
      operation ===
        pdfjs.OPS.endPath ||
      operation ===
        pdfjs.OPS.clip ||
      operation ===
        pdfjs.OPS.eoClip
    ) {
      discardCurrentPath()

      continue
    }


    if (
      operation ===
        pdfjs.OPS.paintImageXObject ||
      operation ===
        pdfjs.OPS.paintInlineImageXObject ||
      operation ===
        pdfjs.OPS.paintImageMaskXObject ||
      operation ===
        pdfjs.OPS.paintSolidColorImageMask
    ) {
      hasRasterImage =
        true
    }
  }


  if (
    currentPathSegments.length
  ) {
    discardCurrentPath()
  }


  const vertices =
    []

  const midpoints =
    []

  for (
    const segment of
    segments
  ) {
    vertices.push(
      {
        source:
          'pdf',

        segmentId:
          segment.id,

        point: {
          ...segment.point1,
        },
      },
      {
        source:
          'pdf',

        segmentId:
          segment.id,

        point: {
          ...segment.point2,
        },
      }
    )

    midpoints.push({
      source:
        'pdf',

      segmentId:
        segment.id,

      point: {
        x:
          (
            segment.point1.x +
            segment.point2.x
          ) / 2,

        y:
          (
            segment.point1.y +
            segment.point2.y
          ) / 2,
      },
    })
  }


  return {
    pageNumber:
      page.pageNumber,

    status:
      segments.length
        ? 'vector'
        : hasRasterImage
          ? 'raster'
          : 'empty',

    segments,
    vertices,
    midpoints,
    segmentCount:
      segments.length,

    hasRasterImage,
    truncated,

    analyzedAt:
      new Date()
        .toISOString(),
  }
}


function drawingGeometryStatusLabel(
  geometry
) {
  if (
    !geometry
  ) {
    return 'Not analyzed'
  }

  if (
    geometry.status ===
    'loading'
  ) {
    return 'Analyzing drawing geometry…'
  }

  if (
    geometry.status ===
    'vector'
  ) {
    return `Vector · ${geometry.segmentCount.toLocaleString()}${
      geometry.truncated
        ? '+'
        : ''
    } segments indexed`
  }

  if (
    geometry.status ===
    'raster'
  ) {
    return 'Raster · Native drawing snap unavailable'
  }

  if (
    geometry.status ===
    'error'
  ) {
    return 'Geometry analysis failed'
  }

  return 'No native vector linework detected'
}




function createEntityId() {
  if (
    typeof crypto !==
      'undefined' &&
    typeof crypto.randomUUID ===
      'function'
  ) {
    return crypto.randomUUID()
  }

  return `ritsucad-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`
}


// ============================================================
// RITSUCAD PAGE
// ============================================================

export default function RitsuCadPage() {

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

  const undoStackRef =
    useRef([])

  const redoStackRef =
    useRef([])

  const editSessionRef =
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

  const [
    drawingGeometryByPage,
    setDrawingGeometryByPage,
  ] =
    useState({})

  const [
    nativeDrawingName,
    setNativeDrawingName,
  ] =
    useState(null)

  const [
    documentMode,
    setDocumentMode,
  ] =
    useState('empty')


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
    snapMarker,
    setSnapMarker,
  ] =
    useState(null)

  const [
    orthoTracking,
    setOrthoTracking,
  ] =
    useState(null)

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
  // SCALE CALIBRATION
  // ==========================================================

  const [
    calibrationsByPage,
    setCalibrationsByPage,
  ] =
    useState({})

  const [
    calibrationDraft,
    setCalibrationDraft,
  ] =
    useState({
      point1: null,
      point2: null,
      previewPoint: null,
    })

  const [
    calibrationDistance,
    setCalibrationDistance,
  ] =
    useState('')

  const [
    calibrationUnit,
    setCalibrationUnit,
  ] =
    useState('ft')

  const [
    calibrationError,
    setCalibrationError,
  ] =
    useState(null)


  // ==========================================================
  // RITSUCAD ENTITIES
  // ==========================================================

  const [
    cadEntities,
    setCadEntities,
  ] =
    useState([])

  const [
    selectedEntityId,
    setSelectedEntityId,
  ] =
    useState(null)

  const [
    editPreviewEntity,
    setEditPreviewEntity,
  ] =
    useState(null)

  const [
    undoCount,
    setUndoCount,
  ] =
    useState(0)

  const [
    redoCount,
    setRedoCount,
  ] =
    useState(0)


  // ==========================================================
  // DISTANCE DRAFT
  // ==========================================================

  const [
    distanceDraft,
    setDistanceDraft,
  ] =
    useState({
      point1: null,
      previewPoint: null,
    })


  // ==========================================================
  // LINEAR DRAFT
  // ==========================================================

  const [
    lineDraft,
    setLineDraft,
  ] =
    useState({
      point1: null,
      previewPoint: null,
    })


  // ==========================================================
  // POLYLINE DRAFT
  // ==========================================================

  const [
    polylineDraft,
    setPolylineDraft,
  ] =
    useState({
      points: [],
      previewPoint: null,
    })


  // ==========================================================
  // AREA DRAFT
  // ==========================================================

  const [
    areaDraft,
    setAreaDraft,
  ] =
    useState({
      points: [],
      previewPoint: null,
    })


  // ==========================================================
  // RECTANGLE DRAFT
  // ==========================================================

  const [
    rectangleDraft,
    setRectangleDraft,
  ] =
    useState({
      point1: null,
      previewPoint: null,
    })


  // ==========================================================
  // CIRCLE DRAFT
  // ==========================================================

  const [
    circleDraft,
    setCircleDraft,
  ] =
    useState({
      center: null,
      previewPoint: null,
    })


  // ==========================================================
  // COUNT DRAFT
  // ==========================================================

  const [
    countDraft,
    setCountDraft,
  ] =
    useState({
      points: [],
    })


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

  const workspaceReady =
    Boolean(
      pageBaseSize
    )

  const currentPageNativeEntities =
    useMemo(
      () =>
        cadEntities.filter(
          (entity) =>
            entity.pageNumber ===
              pageNumber &&
            String(
              entity.type || ''
            ).startsWith(
              'cad-'
            )
        ),
      [
        cadEntities,
        pageNumber,
      ]
    )

  const currentTool =
    useMemo(
      () =>
        allTools.find(
          (tool) =>
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

  const currentCalibration =
    calibrationsByPage[
      pageNumber
    ] || null

  const calibrationPreviewEnd =
    calibrationDraft.point2 ||
    calibrationDraft.previewPoint

  const calibrationWaitingForDistance =
    activeTool ===
      'calibrate' &&
    Boolean(
      calibrationDraft.point1 &&
      calibrationDraft.point2
    )


  const currentPageDistances =
    useMemo(
      () =>
        cadEntities.filter(
          (entity) =>
            entity.pageNumber ===
              pageNumber &&
            entity.type ===
              'distance'
        ),
      [
        cadEntities,
        pageNumber,
      ]
    )


  const currentPageLinears =
    useMemo(
      () =>
        cadEntities.filter(
          (entity) =>
            entity.pageNumber ===
              pageNumber &&
            entity.type ===
              'linear'
        ),
      [
        cadEntities,
        pageNumber,
      ]
    )


  const currentPagePolylines =
    useMemo(
      () =>
        cadEntities.filter(
          (entity) =>
            entity.pageNumber ===
              pageNumber &&
            entity.type ===
              'polyline'
        ),
      [
        cadEntities,
        pageNumber,
      ]
    )


  const currentPageAreas =
    useMemo(
      () =>
        cadEntities.filter(
          (entity) =>
            entity.pageNumber ===
              pageNumber &&
            entity.type ===
              'area'
        ),
      [
        cadEntities,
        pageNumber,
      ]
    )


  const currentPageRectangles =
    useMemo(
      () =>
        cadEntities.filter(
          (entity) =>
            entity.pageNumber ===
              pageNumber &&
            entity.type ===
              'rectangle'
        ),
      [
        cadEntities,
        pageNumber,
      ]
    )


  const currentPageCounts =
    useMemo(
      () =>
        cadEntities.filter(
          (entity) =>
            entity.pageNumber ===
              pageNumber &&
            entity.type ===
              'count'
        ),
      [
        cadEntities,
        pageNumber,
      ]
    )


  const currentDrawingGeometry =
    drawingGeometryByPage[
      pageNumber
    ] || null


  const currentPageSnapData =
    useMemo(
      () => {
        const pageEntities =
          cadEntities.filter(
            (entity) =>
              entity.pageNumber ===
              pageNumber
          )

        const vertices =
          pageEntities.flatMap(
            (entity) =>
              entitySnapVertices(
                entity
              ).map(
                (candidate) => ({
                  ...candidate,

                  source:
                    'cad',
                })
              )
          )

        const segments =
          pageEntities.flatMap(
            (entity) =>
              entitySegments(
                entity
              ).map(
                (segment) => ({
                  ...segment,

                  source:
                    'cad',
                })
              )
          )

        const midpoints =
          segments.map(
            (segment) => ({
              entityId:
                segment.entityId,

              source:
                'cad',

              point: {
                x:
                  (
                    segment.point1.x +
                    segment.point2.x
                  ) / 2,

                y:
                  (
                    segment.point1.y +
                    segment.point2.y
                  ) / 2,
              },
            })
          )

        const intersections =
          []

        for (
          let firstIndex = 0;
          firstIndex <
            segments.length;
          firstIndex += 1
        ) {
          for (
            let secondIndex =
              firstIndex + 1;
            secondIndex <
              segments.length;
            secondIndex += 1
          ) {
            const firstSegment =
              segments[
                firstIndex
              ]

            const secondSegment =
              segments[
                secondIndex
              ]

            if (
              firstSegment.entityId ===
              secondSegment.entityId
            ) {
              continue
            }

            const intersection =
              segmentIntersection(
                firstSegment,
                secondSegment
              )

            if (
              intersection
            ) {
              intersections.push({
                entityIds: [
                  firstSegment.entityId,
                  secondSegment.entityId,
                ],

                source:
                  'cad',

                point:
                  intersection,
              })
            }
          }
        }

        return {
          vertices,
          midpoints,
          intersections,
          segments,
        }
      },
      [
        cadEntities,
        pageNumber,
      ]
    )


  const pageCountQuantity =
    useMemo(
      () =>
        currentPageCounts.reduce(
          (
            total,
            entity
          ) =>
            total +
            entity.points.length,
          0
        ),
      [
        currentPageCounts,
      ]
    )


  const latestDistance =
    currentPageDistances.at(-1) ||
    null

  const latestLinear =
    currentPageLinears.at(-1) ||
    null

  const latestPolyline =
    currentPagePolylines.at(-1) ||
    null

  const latestArea =
    currentPageAreas.at(-1) ||
    null

  const latestRectangle =
    currentPageRectangles.at(-1) ||
    null

  const latestCount =
    currentPageCounts.at(-1) ||
    null


  const selectedEntity =
    useMemo(
      () =>
        cadEntities.find(
          (entity) =>
            entity.id ===
            selectedEntityId
        ) || null,
      [
        cadEntities,
        selectedEntityId,
      ]
    )



  const selectedRenderEntity =
    editPreviewEntity &&
    editPreviewEntity.id ===
      selectedEntityId
      ? editPreviewEntity
      : selectedEntity

  const selectedEntityQuantity =
    useMemo(
      () => {
        if (
          !selectedEntity
        ) {
          return null
        }

        if (
          selectedEntity.type ===
            'distance' ||
          selectedEntity.type ===
            'linear'
        ) {
          return realDistanceFromPoints(
            selectedEntity.points[0],
            selectedEntity.points[1],
            currentCalibration
          )
        }

        if (
          selectedEntity.type ===
          'polyline'
        ) {
          return realPolylineLength(
            selectedEntity.points,
            currentCalibration
          )
        }

        if (
          selectedEntity.type ===
          'area'
        ) {
          return realPolygonArea(
            selectedEntity.points,
            currentCalibration
          )
        }

        if (
          selectedEntity.type ===
          'rectangle'
        ) {
          return realRectangleArea(
            selectedEntity.points[0],
            selectedEntity.points[1],
            currentCalibration
          )
        }

        if (
          selectedEntity.type ===
          'count'
        ) {
          return selectedEntity.points.length
        }

        return null
      },
      [
        selectedEntity,
        currentCalibration,
      ]
    )


  const selectedEntityLabel =
    selectedEntity
      ? (
          selectedEntity.type ===
            'distance'
            ? 'Distance'
            : selectedEntity.type ===
                'linear'
              ? 'Linear'
              : selectedEntity.type ===
                  'polyline'
                ? 'Polyline'
                : selectedEntity.type ===
                    'area'
                  ? 'Area'
                  : selectedEntity.type ===
                      'rectangle'
                    ? 'Rectangle'
                    : selectedEntity.type ===
                        'count'
                      ? 'Count'
                      : selectedEntity.type ===
                          'cad-line'
                        ? 'CAD Line'
                        : selectedEntity.type ===
                            'cad-polyline'
                          ? 'CAD Polyline'
                          : selectedEntity.type ===
                              'cad-rectangle'
                            ? 'CAD Rectangle'
                            : selectedEntity.type ===
                                'cad-polygon'
                              ? 'CAD Polygon'
                              : selectedEntity.type ===
                                  'cad-circle'
                                ? 'CAD Circle'
                                : 'CAD Entity'
        )
      : null


  const selectedEntityUnit =
    selectedEntity
      ? (
          selectedEntity.type ===
              'area' ||
          selectedEntity.type ===
              'rectangle'
            ? (
                currentCalibration
                  ? `${currentCalibration.displayUnit}²`
                  : '—'
              )
            : selectedEntity.type ===
                'count'
              ? 'ea'
              : currentCalibration
                ?.displayUnit ||
                '—'
        )
      : '—'


  const previewDistance =
    activeTool ===
      'distance' &&
    distanceDraft.point1 &&
    distanceDraft.previewPoint &&
    currentCalibration
      ? realDistanceFromPoints(
          distanceDraft.point1,
          distanceDraft.previewPoint,
          currentCalibration
        )
      : null


  const previewLinear =
    activeTool ===
      'line' &&
    lineDraft.point1 &&
    lineDraft.previewPoint &&
    currentCalibration
      ? realDistanceFromPoints(
          lineDraft.point1,
          lineDraft.previewPoint,
          currentCalibration
        )
      : null


  const previewPolylinePoints =
    useMemo(
      () => {
        if (
          activeTool !==
            'polyline' ||
          !polylineDraft.points.length
        ) {
          return []
        }

        if (
          polylineDraft.previewPoint
        ) {
          return [
            ...polylineDraft.points,
            polylineDraft.previewPoint,
          ]
        }

        return [
          ...polylineDraft.points,
        ]
      },
      [
        activeTool,
        polylineDraft,
      ]
    )


  const previewPolyline =
    currentCalibration &&
    previewPolylinePoints.length >= 2
      ? realPolylineLength(
          previewPolylinePoints,
          currentCalibration
        )
      : null


  const previewAreaPoints =
    useMemo(
      () => {
        if (
          activeTool !==
            'area' ||
          !areaDraft.points.length
        ) {
          return []
        }

        if (
          areaDraft.previewPoint
        ) {
          return [
            ...areaDraft.points,
            areaDraft.previewPoint,
          ]
        }

        return [
          ...areaDraft.points,
        ]
      },
      [
        activeTool,
        areaDraft,
      ]
    )


  const previewArea =
    currentCalibration &&
    previewAreaPoints.length >= 3
      ? realPolygonArea(
          previewAreaPoints,
          currentCalibration
        )
      : null


  const previewRectangleArea =
    activeTool ===
      'rectangle' &&
    rectangleDraft.point1 &&
    rectangleDraft.previewPoint &&
    currentCalibration
      ? realRectangleArea(
          rectangleDraft.point1,
          rectangleDraft.previewPoint,
          currentCalibration
        )
      : null


  const previewRectangleDimensions =
    activeTool ===
      'rectangle' &&
    rectangleDraft.point1 &&
    rectangleDraft.previewPoint &&
    currentCalibration
      ? rectangleDimensions(
          rectangleDraft.point1,
          rectangleDraft.previewPoint,
          currentCalibration
        )
      : null


  useEffect(
    () => {
      if (
        !snapEnabled
      ) {
        setSnapMarker(
          null
        )
      }
    },
    [
      snapEnabled,
    ]
  )


  useEffect(
    () => {
      if (
        !orthoEnabled
      ) {
        setOrthoTracking(
          null
        )
      }
    },
    [
      orthoEnabled,
    ]
  )


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
  // RITSUCAD ENTITY HISTORY
  // ==========================================================

  const commitCadEntities =
    useCallback(
      (
        updater
      ) => {
        setCadEntities(
          (current) => {
            const next =
              typeof updater ===
                'function'
                ? updater(
                    current
                  )
                : updater

            if (
              next ===
              current
            ) {
              return current
            }

            undoStackRef.current = [
              ...undoStackRef.current,
              current,
            ]

            redoStackRef.current =
              []

            setUndoCount(
              undoStackRef.current.length
            )

            setRedoCount(
              0
            )

            return next
          }
        )
      },
      []
    )


  const resetCadHistory =
    useCallback(
      (
        entities = []
      ) => {
        undoStackRef.current =
          []

        redoStackRef.current =
          []

        setUndoCount(
          0
        )

        setRedoCount(
          0
        )

        setCadEntities(
          entities
        )

        setSelectedEntityId(
          null
        )

        editSessionRef.current =
          null

        setEditPreviewEntity(
          null
        )
      },
      []
    )


  const undoCad =
    useCallback(
      () => {
        if (
          !undoStackRef.current.length
        ) {
          return
        }

        setCadEntities(
          (current) => {
            const previous =
              undoStackRef.current[
                undoStackRef.current.length -
                1
              ]

            undoStackRef.current =
              undoStackRef.current.slice(
                0,
                -1
              )

            redoStackRef.current = [
              current,
              ...redoStackRef.current,
            ]

            setUndoCount(
              undoStackRef.current.length
            )

            setRedoCount(
              redoStackRef.current.length
            )

            return previous
          }
        )

        setSelectedEntityId(
          null
        )
      },
      []
    )


  const redoCad =
    useCallback(
      () => {
        if (
          !redoStackRef.current.length
        ) {
          return
        }

        setCadEntities(
          (current) => {
            const next =
              redoStackRef.current[0]

            redoStackRef.current =
              redoStackRef.current.slice(
                1
              )

            undoStackRef.current = [
              ...undoStackRef.current,
              current,
            ]

            setUndoCount(
              undoStackRef.current.length
            )

            setRedoCount(
              redoStackRef.current.length
            )

            return next
          }
        )

        setSelectedEntityId(
          null
        )
      },
      []
    )


  const deleteSelectedEntity =
    useCallback(
      () => {
        if (
          !selectedEntityId
        ) {
          return
        }

        commitCadEntities(
          (current) =>
            current.filter(
              (entity) =>
                entity.id !==
                selectedEntityId
            )
        )

        setSelectedEntityId(
          null
        )
      },
      [
        selectedEntityId,
        commitCadEntities,
      ]
    )


  // ==========================================================
  // DRAFT RESET
  // ==========================================================

  const resetCalibrationDraft =
    useCallback(
      () => {
        setCalibrationDraft({
          point1: null,
          point2: null,
          previewPoint: null,
        })

        setCalibrationDistance(
          ''
        )

        setCalibrationError(
          null
        )
      },
      []
    )


  const resetDistanceDraft =
    useCallback(
      () => {
        setDistanceDraft({
          point1: null,
          previewPoint: null,
        })
      },
      []
    )


  const resetLineDraft =
    useCallback(
      () => {
        setLineDraft({
          point1: null,
          previewPoint: null,
        })
      },
      []
    )


  const resetPolylineDraft =
    useCallback(
      () => {
        setPolylineDraft({
          points: [],
          previewPoint: null,
        })
      },
      []
    )


  const resetAreaDraft =
    useCallback(
      () => {
        setAreaDraft({
          points: [],
          previewPoint: null,
        })
      },
      []
    )


  const resetRectangleDraft =
    useCallback(
      () => {
        setRectangleDraft({
          point1: null,
          previewPoint: null,
        })
      },
      []
    )


  const resetCircleDraft =
    useCallback(
      () => {
        setCircleDraft({
          center: null,
          previewPoint: null,
        })
      },
      []
    )


  const resetCountDraft =
    useCallback(
      () => {
        setCountDraft({
          points: [],
        })
      },
      []
    )


  const resetAllGeometryDrafts =
    useCallback(
      () => {
        resetDistanceDraft()
        resetLineDraft()
        resetPolylineDraft()
        resetAreaDraft()
        resetRectangleDraft()
        resetCircleDraft()
        resetCountDraft()
      },
      [
        resetDistanceDraft,
        resetLineDraft,
        resetPolylineDraft,
        resetAreaDraft,
        resetRectangleDraft,
        resetCircleDraft,
        resetCountDraft,
      ]
    )


  // ==========================================================
  // TOOL ACTIVATION
  // ==========================================================

  const activateTool =
    useCallback(
      (
        toolId
      ) => {
        if (
          activeTool ===
          'calibrate' &&
          toolId !==
          'calibrate'
        ) {
          resetCalibrationDraft()
        }

        if (
          activeTool !==
          toolId
        ) {
          resetAllGeometryDrafts()
        }

        if (
          toolId !==
          'select'
        ) {
          setSelectedEntityId(
            null
          )
        }

        editSessionRef.current =
          null

        setEditPreviewEntity(
          null
        )

        setSnapMarker(
          null
        )

        setOrthoTracking(
          null
        )

        setActiveTool(
          toolId
        )
      },
      [
        activeTool,
        resetCalibrationDraft,
        resetAllGeometryDrafts,
      ]
    )


  // ==========================================================
  // CALIBRATION COMMANDS
  // ==========================================================

  const cancelCalibration =
    useCallback(
      () => {
        resetCalibrationDraft()

        setActiveTool(
          'select'
        )
      },
      [
        resetCalibrationDraft,
      ]
    )


  function startCalibration() {
    if (!workspaceReady) {
      return
    }

    resetAllGeometryDrafts()
    resetCalibrationDraft()

    if (
      currentCalibration
    ) {
      setCalibrationUnit(
        currentCalibration.displayUnit
      )
    }

    setInspectorTab(
      'properties'
    )

    setInspectorOpen(
      true
    )

    setActiveTool(
      'calibrate'
    )
  }


  function saveCalibration() {
    if (
      !calibrationDraft.point1 ||
      !calibrationDraft.point2
    ) {
      setCalibrationError(
        'Select two points on the drawing first.'
      )

      return
    }

    const realDistance =
      Number(
        calibrationDistance
      )

    if (
      !Number.isFinite(
        realDistance
      ) ||
      realDistance <= 0
    ) {
      setCalibrationError(
        'Enter a valid distance greater than zero.'
      )

      return
    }

    const pdfDistance =
      pointDistance(
        calibrationDraft.point1,
        calibrationDraft.point2
      )

    if (
      !pdfDistance ||
      pdfDistance <= 0
    ) {
      setCalibrationError(
        'The calibration points must be different.'
      )

      return
    }

    const unitFactor =
      UNIT_TO_METERS[
        calibrationUnit
      ]

    if (!unitFactor) {
      setCalibrationError(
        'Select a valid unit.'
      )

      return
    }

    const realDistanceMeters =
      realDistance *
      unitFactor

    const metersPerPdfPoint =
      realDistanceMeters /
      pdfDistance

    const calibration = {
      pageNumber,

      point1: {
        ...calibrationDraft.point1,
      },

      point2: {
        ...calibrationDraft.point2,
      },

      pdfDistance,

      referenceDistance:
        realDistance,

      displayUnit:
        calibrationUnit,

      metersPerPdfPoint,

      createdAt:
        new Date()
          .toISOString(),
    }

    setCalibrationsByPage(
      (current) => ({
        ...current,

        [pageNumber]:
          calibration,
      })
    )

    resetCalibrationDraft()

    setActiveTool(
      'select'
    )

    setInspectorTab(
      'properties'
    )

    setInspectorOpen(
      true
    )
  }


  // ==========================================================
  // POLYLINE COMMANDS
  // ==========================================================

  const finishPolyline =
    useCallback(
      () => {
        if (
          activeTool !==
          'polyline'
        ) {
          return
        }

        const cleanedPoints =
          removeConsecutiveDuplicatePoints(
            polylineDraft.points
          )

        if (
          cleanedPoints.length <
          2
        ) {
          return
        }

        const entity = {
          id:
            createEntityId(),

          type:
            'polyline',

          pageNumber,

          points:
            cleanedPoints.map(
              (point) => ({
                ...point,
              })
            ),

          createdAt:
            new Date()
              .toISOString(),
        }

        commitCadEntities(
          (current) => [
            ...current,
            entity,
          ]
        )

        resetPolylineDraft()

        setInspectorTab(
          'properties'
        )
      },
      [
        activeTool,
        pageNumber,
        polylineDraft.points,
        resetPolylineDraft,
        commitCadEntities,
      ]
    )


  // ==========================================================
  // AREA COMMANDS
  // ==========================================================

  const finishArea =
    useCallback(
      () => {
        if (
          activeTool !==
          'area'
        ) {
          return
        }

        const cleanedPoints =
          removeConsecutiveDuplicatePoints(
            areaDraft.points
          )

        if (
          cleanedPoints.length <
          3
        ) {
          return
        }

        const pdfArea =
          polygonPdfArea(
            cleanedPoints
          )

        if (
          pdfArea <=
          0.0001
        ) {
          return
        }

        const entity = {
          id:
            createEntityId(),

          type:
            'area',

          pageNumber,

          points:
            cleanedPoints.map(
              (point) => ({
                ...point,
              })
            ),

          createdAt:
            new Date()
              .toISOString(),
        }

        commitCadEntities(
          (current) => [
            ...current,
            entity,
          ]
        )

        resetAreaDraft()

        setInspectorTab(
          'properties'
        )
      },
      [
        activeTool,
        areaDraft.points,
        pageNumber,
        resetAreaDraft,
        commitCadEntities,
      ]
    )


  // ==========================================================
  // NATIVE DRAWING COMMANDS
  // ==========================================================

  const finishNativePolyline =
    useCallback(
      () => {
        if (
          activeTool !==
          'draw-polyline'
        ) {
          return
        }

        const cleanedPoints =
          removeConsecutiveDuplicatePoints(
            polylineDraft.points
          )

        if (
          cleanedPoints.length <
          2
        ) {
          return
        }

        commitCadEntities(
          (current) => [
            ...current,
            {
              id:
                createEntityId(),

              type:
                'cad-polyline',

              category:
                'drawing',

              pageNumber,

              points:
                cleanedPoints.map(
                  (point) => ({
                    ...point,
                  })
                ),

              createdAt:
                new Date()
                  .toISOString(),
            },
          ]
        )

        resetPolylineDraft()

        setInspectorTab(
          'properties'
        )
      },
      [
        activeTool,
        pageNumber,
        polylineDraft.points,
        resetPolylineDraft,
        commitCadEntities,
      ]
    )


  const finishNativePolygon =
    useCallback(
      () => {
        if (
          activeTool !==
          'draw-polygon'
        ) {
          return
        }

        const cleanedPoints =
          removeConsecutiveDuplicatePoints(
            areaDraft.points
          )

        if (
          cleanedPoints.length <
          3
        ) {
          return
        }

        commitCadEntities(
          (current) => [
            ...current,
            {
              id:
                createEntityId(),

              type:
                'cad-polygon',

              category:
                'drawing',

              pageNumber,

              points:
                cleanedPoints.map(
                  (point) => ({
                    ...point,
                  })
                ),

              createdAt:
                new Date()
                  .toISOString(),
            },
          ]
        )

        resetAreaDraft()

        setInspectorTab(
          'properties'
        )
      },
      [
        activeTool,
        pageNumber,
        areaDraft.points,
        resetAreaDraft,
        commitCadEntities,
      ]
    )


  // ==========================================================
  // COUNT COMMANDS
  // ==========================================================

  const finishCount =
    useCallback(
      () => {
        if (
          activeTool !==
          'count' ||
          !countDraft.points.length
        ) {
          return
        }

        const entity = {
          id:
            createEntityId(),

          type:
            'count',

          pageNumber,

          points:
            countDraft.points.map(
              (point) => ({
                ...point,
              })
            ),

          quantity:
            countDraft.points.length,

          createdAt:
            new Date()
              .toISOString(),
        }

        commitCadEntities(
          (current) => [
            ...current,
            entity,
          ]
        )

        resetCountDraft()

        setInspectorTab(
          'properties'
        )
      },
      [
        activeTool,
        countDraft.points,
        pageNumber,
        resetCountDraft,
        commitCadEntities,
      ]
    )


  // ==========================================================
  // NEW DRAWING
  // ==========================================================

  function createNewDrawing() {
    if (
      pdfDocumentRef.current
    ) {
      try {
        pdfDocumentRef.current.destroy()
      } catch {
        // Ignore cleanup errors.
      }
    }

    pdfDocumentRef.current =
      null

    setPdfDocument(
      null
    )

    setPdfPage(
      null
    )

    setPdfFileName(
      null
    )

    setDocumentMode(
      'native'
    )

    setNativeDrawingName(
      'Untitled Drawing'
    )

    setPageCount(
      1
    )

    setPageNumber(
      1
    )

    setPageBaseSize({
      ...DEFAULT_NATIVE_PAGE_SIZE,
    })

    setRenderedSize({
      width:
        DEFAULT_NATIVE_PAGE_SIZE.width,
      height:
        DEFAULT_NATIVE_PAGE_SIZE.height,
    })

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

    setCalibrationsByPage(
      {}
    )

    setDrawingGeometryByPage(
      {}
    )

    resetCadHistory(
      []
    )

    resetCalibrationDraft()
    resetAllGeometryDrafts()

    setActiveTool(
      'draw-line'
    )

    setInspectorTab(
      'properties'
    )

    setInspectorOpen(
      true
    )
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

      setDocumentMode(
        'pdf'
      )

      setNativeDrawingName(
        null
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

      setCalibrationsByPage(
        {}
      )

      setDrawingGeometryByPage(
        {}
      )

      resetCadHistory(
        []
      )

      resetCalibrationDraft()
      resetAllGeometryDrafts()

      setActiveTool(
        'select'
      )

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

      setDocumentMode(
        'empty'
      )

      setNativeDrawingName(
        null
      )

      setPageCount(
        0
      )

      setPageBaseSize(
        null
      )

      setCalibrationsByPage(
        {}
      )

      setDrawingGeometryByPage(
        {}
      )

      resetCadHistory(
        []
      )

      resetCalibrationDraft()
      resetAllGeometryDrafts()

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

          resetCalibrationDraft()
          resetAllGeometryDrafts()

          setSelectedEntityId(
            null
          )

          setActiveTool(
            'select'
          )

          setDrawingGeometryByPage(
            (current) => ({
              ...current,

              [pageNumber]: {
                pageNumber,

                status:
                  'loading',

                segments: [],
                vertices: [],
                midpoints: [],
                segmentCount:
                  0,

                hasRasterImage:
                  false,

                truncated:
                  false,
              },
            })
          )

          try {
            const [
              pdfjs,
              operatorList,
            ] =
              await Promise.all([
                getPdfJs(),
                page.getOperatorList(),
              ])

            if (
              cancelled
            ) {
              return
            }

            const geometry =
              extractPdfVectorGeometry(
                page,
                pdfjs,
                viewport,
                operatorList
              )

            setDrawingGeometryByPage(
              (current) => ({
                ...current,

                [pageNumber]:
                  geometry,
              })
            )

          } catch (
            geometryError
          ) {
            console.error(
              'PDF vector geometry analysis failed.',
              geometryError
            )

            if (
              !cancelled
            ) {
              setDrawingGeometryByPage(
                (current) => ({
                  ...current,

                  [pageNumber]: {
                    pageNumber,

                    status:
                      'error',

                    segments: [],
                    vertices: [],
                    midpoints: [],
                    segmentCount:
                      0,

                    hasRasterImage:
                      false,

                    truncated:
                      false,
                  },
                })
              )
            }
          }

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
      resetCalibrationDraft,
      resetAllGeometryDrafts,
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
  // NATIVE DRAWING RENDER SIZE
  // ==========================================================

  useEffect(
    () => {
      if (
        documentMode !==
          'native' ||
        !pageBaseSize ||
        !effectiveScale
      ) {
        return
      }

      setRenderedSize({
        width:
          pageBaseSize.width *
          effectiveScale,
        height:
          pageBaseSize.height *
          effectiveScale,
      })
    },
    [
      documentMode,
      pageBaseSize,
      effectiveScale,
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
        if (!workspaceReady) {
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
        workspaceReady,
      ]
    )


  const fitWidth =
    useCallback(
      () => {
        if (!workspaceReady) {
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
        workspaceReady,
      ]
    )


  // ==========================================================
  // PAGE NAVIGATION
  // ==========================================================

  function previousPage() {
    setPageNumber(
      (current) =>
        Math.max(
          1,
          current - 1
        )
    )
  }


  function nextPage() {
    setPageNumber(
      (current) =>
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
          !workspaceReady ||
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
        workspaceReady,
        renderedSize,
        effectiveScale,
        pan,
      ]
    )


  const resolveCadPoint =
    useCallback(
      (
        rawPoint,
        anchorPoint = null,
        options = {}
      ) => {
        if (
          !rawPoint
        ) {
          return {
            point:
              null,

            snap:
              null,

            ortho:
              null,
          }
        }

        const {
          excludeEntityId =
            null,

          allowSnap =
            true,

          allowOrtho =
            true,
        } =
          options

        const snapTolerance =
          12 /
          Math.max(
            effectiveScale,
            0.01
          )

        if (
          snapEnabled &&
          allowSnap
        ) {
          const drawingVertices =
            currentDrawingGeometry
              ?.status ===
              'vector'
              ? currentDrawingGeometry.vertices
              : []

          const drawingMidpoints =
            currentDrawingGeometry
              ?.status ===
              'vector'
              ? currentDrawingGeometry.midpoints
              : []

          const drawingSegments =
            currentDrawingGeometry
              ?.status ===
              'vector'
              ? currentDrawingGeometry.segments
              : []

          const combinedSegments = [
            ...currentPageSnapData.segments.filter(
              (segment) =>
                segment.entityId !==
                excludeEntityId
            ),
            ...drawingSegments,
          ]

          const localSegments =
            combinedSegments
              .filter(
                (segment) =>
                  pointInsideBoundingBox(
                    rawPoint,
                    segmentBoundingBox(
                      segment,
                      snapTolerance *
                        1.25
                    )
                  )
              )
              .map(
                (segment) => ({
                  segment,

                  cursorDistance:
                    distancePointToSegment(
                      rawPoint,
                      segment.point1,
                      segment.point2
                    ),
                })
              )
              .sort(
                (
                  first,
                  second
                ) =>
                  first.cursorDistance -
                  second.cursorDistance
              )
              .slice(
                0,
                120
              )
              .map(
                (entry) =>
                  entry.segment
              )

          const localIntersections = [
            ...currentPageSnapData.intersections.filter(
              (candidate) =>
                !excludeEntityId ||
                !candidate.entityIds.includes(
                  excludeEntityId
                )
            ),
          ]

          for (
            let firstIndex = 0;
            firstIndex <
              localSegments.length;
            firstIndex += 1
          ) {
            for (
              let secondIndex =
                firstIndex + 1;
              secondIndex <
                localSegments.length;
              secondIndex += 1
            ) {
              const firstSegment =
                localSegments[
                  firstIndex
                ]

              const secondSegment =
                localSegments[
                  secondIndex
                ]

              if (
                firstSegment.source ===
                  'cad' &&
                secondSegment.source ===
                  'cad' &&
                firstSegment.entityId &&
                firstSegment.entityId ===
                  secondSegment.entityId
              ) {
                continue
              }

              const intersection =
                segmentIntersection(
                  firstSegment,
                  secondSegment
                )

              if (
                !intersection ||
                pointDistance(
                  rawPoint,
                  intersection
                ) >
                  snapTolerance
              ) {
                continue
              }

              localIntersections.push({
                source:
                  firstSegment.source ===
                    'pdf' ||
                  secondSegment.source ===
                    'pdf'
                    ? 'pdf'
                    : 'cad',

                entityIds: [
                  firstSegment.entityId,
                  secondSegment.entityId,
                ].filter(
                  Boolean
                ),

                point:
                  intersection,
              })
            }
          }

          const candidateGroups = [
            {
              type:
                'Endpoint',

              candidates: [
                ...currentPageSnapData.vertices.filter(
                  (candidate) =>
                    candidate.entityId !==
                    excludeEntityId
                ),
                ...drawingVertices,
              ],
            },
            {
              type:
                'Midpoint',

              candidates: [
                ...currentPageSnapData.midpoints.filter(
                  (candidate) =>
                    candidate.entityId !==
                    excludeEntityId
                ),
                ...drawingMidpoints,
              ],
            },
            {
              type:
                'Intersection',

              candidates:
                localIntersections,
            },
          ]

          for (
            const group of
            candidateGroups
          ) {
            let bestCandidate =
              null

            let bestDistance =
              Infinity

            for (
              const candidate of
              group.candidates
            ) {
              const distance =
                pointDistance(
                  rawPoint,
                  candidate.point
                )

              if (
                distance <=
                  snapTolerance &&
                distance <
                  bestDistance
              ) {
                bestCandidate =
                  candidate

                bestDistance =
                  distance
              }
            }

            if (
              bestCandidate
            ) {
              return {
                point: {
                  ...bestCandidate.point,
                },

                snap: {
                  type:
                    group.type,

                  source:
                    bestCandidate.source ||
                    'cad',

                  point: {
                    ...bestCandidate.point,
                  },
                },

                ortho:
                  null,
              }
            }
          }

          let nearestCandidate =
            null

          let nearestDistance =
            Infinity

          for (
            const segment of
            combinedSegments
          ) {
            const nearest =
              nearestPointOnSegment(
                rawPoint,
                segment.point1,
                segment.point2
              )

            if (
              nearest &&
              nearest.distance <=
                snapTolerance &&
              nearest.distance <
                nearestDistance
            ) {
              nearestCandidate = {
                ...nearest,

                source:
                  segment.source ||
                  'cad',
              }

              nearestDistance =
                nearest.distance
            }
          }

          if (
            nearestCandidate
          ) {
            return {
              point: {
                ...nearestCandidate.point,
              },

              snap: {
                type:
                  'Nearest',

                source:
                  nearestCandidate.source,

                point: {
                  ...nearestCandidate.point,
                },
              },

              ortho:
                null,
            }
          }
        }

        if (
          orthoEnabled &&
          allowOrtho &&
          anchorPoint
        ) {
          const constrained =
            constrainOrthoPoint(
              anchorPoint,
              rawPoint
            )

          return {
            point:
              constrained.point,

            snap:
              null,

            ortho: {
              axis:
                constrained.axis,

              anchorPoint: {
                ...anchorPoint,
              },

              point: {
                ...constrained.point,
              },
            },
          }
        }

        return {
          point: {
            ...rawPoint,
          },

          snap:
            null,

          ortho:
            null,
        }
      },
      [
        currentDrawingGeometry,
        currentPageSnapData,
        effectiveScale,
        snapEnabled,
        orthoEnabled,
      ]
    )


  function updateCadFeedback(
    resolution
  ) {
    setSnapMarker(
      resolution
        ?.snap ||
      null
    )

    setOrthoTracking(
      resolution
        ?.ortho ||
      null
    )
  }


  // ==========================================================
  // POINTER MOVE
  // ==========================================================

  function handlePointerMove(
    event
  ) {
    const rawPoint =
      clientToPdfPoint(
        event.clientX,
        event.clientY
      )

    const panSession =
      panSessionRef.current

    if (
      panSession
    ) {
      setSnapMarker(
        null
      )

      setOrthoTracking(
        null
      )

      setCursorPosition(
        rawPoint || {
          x: null,
          y: null,
        }
      )

      setPan({
        x:
          panSession.panX +
          event.clientX -
          panSession.startX,

        y:
          panSession.panY +
          event.clientY -
          panSession.startY,
      })

      return
    }

    const editSession =
      editSessionRef.current

    if (
      editSession &&
      rawPoint
    ) {
      const resolution =
        resolveCadPoint(
          rawPoint,
          editSession.startPoint,
          {
            excludeEntityId:
              editSession.entityId,

            allowSnap:
              editSession.mode ===
              'grip',

            allowOrtho:
              true,
          }
        )

      updateCadFeedback(
        resolution
      )

      setCursorPosition(
        resolution.point
      )

      if (
        editSession.mode ===
        'grip'
      ) {
        setEditPreviewEntity(
          updateEntityGrip(
            editSession.originalEntity,
            editSession.gripId,
            resolution.point
          )
        )

      } else if (
        editSession.mode ===
        'move'
      ) {
        setEditPreviewEntity(
          translateEntity(
            editSession.originalEntity,
            resolution.point.x -
              editSession.startPoint.x,
            resolution.point.y -
              editSession.startPoint.y
          )
        )
      }

      return
    }

    if (
      !rawPoint
    ) {
      setCursorPosition({
        x: null,
        y: null,
      })

      setSnapMarker(
        null
      )

      setOrthoTracking(
        null
      )

      return
    }

    let anchorPoint =
      null

    let allowSnap =
      false

    let allowOrtho =
      false

    if (
      activeTool ===
      'calibrate'
    ) {
      anchorPoint =
        calibrationDraft.point1

      allowSnap =
        true

      allowOrtho =
        Boolean(
          anchorPoint
        )

    } else if (
      activeTool ===
      'distance'
    ) {
      anchorPoint =
        distanceDraft.point1

      allowSnap =
        true

      allowOrtho =
        Boolean(
          anchorPoint
        )

    } else if (
      activeTool ===
        'line' ||
      activeTool ===
        'draw-line'
    ) {
      anchorPoint =
        lineDraft.point1

      allowSnap =
        true

      allowOrtho =
        Boolean(
          anchorPoint
        )

    } else if (
      activeTool ===
        'polyline' ||
      activeTool ===
        'draw-polyline'
    ) {
      anchorPoint =
        polylineDraft.points.at(-1) ||
        null

      allowSnap =
        true

      allowOrtho =
        Boolean(
          anchorPoint
        )

    } else if (
      activeTool ===
        'area' ||
      activeTool ===
        'draw-polygon'
    ) {
      anchorPoint =
        areaDraft.points.at(-1) ||
        null

      allowSnap =
        true

      allowOrtho =
        Boolean(
          anchorPoint
        )

    } else if (
      activeTool ===
        'rectangle' ||
      activeTool ===
        'draw-rectangle'
    ) {
      anchorPoint =
        rectangleDraft.point1

      allowSnap =
        true

      allowOrtho =
        false

    } else if (
      activeTool ===
      'count'
    ) {
      allowSnap =
        true
    }

    const resolution =
      resolveCadPoint(
        rawPoint,
        anchorPoint,
        {
          allowSnap,
          allowOrtho,
        }
      )

    const point =
      resolution.point

    updateCadFeedback(
      resolution
    )

    setCursorPosition(
      point
    )

    if (
      activeTool ===
        'calibrate' &&
      calibrationDraft.point1 &&
      !calibrationDraft.point2
    ) {
      setCalibrationDraft(
        (current) => ({
          ...current,
          previewPoint:
            point,
        })
      )
    }

    if (
      activeTool ===
        'distance' &&
      distanceDraft.point1
    ) {
      setDistanceDraft(
        (current) => ({
          ...current,
          previewPoint:
            point,
        })
      )
    }

    if (
      (
        activeTool ===
          'line' ||
        activeTool ===
          'draw-line'
      ) &&
      lineDraft.point1
    ) {
      setLineDraft(
        (current) => ({
          ...current,
          previewPoint:
            point,
        })
      )
    }

    if (
      (
        activeTool ===
          'polyline' ||
        activeTool ===
          'draw-polyline'
      ) &&
      polylineDraft.points.length
    ) {
      setPolylineDraft(
        (current) => ({
          ...current,
          previewPoint:
            point,
        })
      )
    }

    if (
      (
        activeTool ===
          'area' ||
        activeTool ===
          'draw-polygon'
      ) &&
      areaDraft.points.length
    ) {
      setAreaDraft(
        (current) => ({
          ...current,
          previewPoint:
            point,
        })
      )
    }

    if (
      (
        activeTool ===
          'rectangle' ||
        activeTool ===
          'draw-rectangle'
      ) &&
      rectangleDraft.point1
    ) {
      setRectangleDraft(
        (current) => ({
          ...current,
          previewPoint:
            point,
        })
      )
    }

    if (
      activeTool ===
        'draw-circle' &&
      circleDraft.center
    ) {
      setCircleDraft(
        (current) => ({
          ...current,
          previewPoint:
            point,
        })
      )
    }
  }


  // ==========================================================
  // POINTER DOWN
  // ==========================================================

  function handlePointerDown(
    event
  ) {
    if (!workspaceReady) {
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
      usingMiddleMouse ||
      usingPanTool
    ) {
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

      return
    }

    if (
      event.button !==
      0
    ) {
      return
    }

    const rawPoint =
      clientToPdfPoint(
        event.clientX,
        event.clientY
      )

    if (!rawPoint) {
      if (
        activeTool ===
        'select'
      ) {
        setSelectedEntityId(
          null
        )

        setEditPreviewEntity(
          null
        )
      }

      return
    }


    // ========================================================
    // SELECTION + EDITING
    // ========================================================

    if (
      activeTool ===
      'select'
    ) {
      event.preventDefault()

      const tolerance =
        10 /
        Math.max(
          effectiveScale,
          0.01
        )

      if (
        selectedEntity &&
        selectedEntity.pageNumber ===
          pageNumber
      ) {
        const grips =
          entityGripPoints(
            selectedEntity
          )

        let hitGrip =
          null

        let hitGripDistance =
          Infinity

        grips.forEach(
          (grip) => {
            const distance =
              pointDistance(
                rawPoint,
                grip.point
              )

            if (
              distance <=
                tolerance *
                  1.25 &&
              distance <
                hitGripDistance
            ) {
              hitGrip =
                grip

              hitGripDistance =
                distance
            }
          }
        )

        if (
          hitGrip
        ) {
          editSessionRef.current = {
            mode:
              'grip',

            entityId:
              selectedEntity.id,

            gripId:
              hitGrip.id,

            startPoint: {
              ...rawPoint,
            },

            originalEntity: {
              ...selectedEntity,

              points:
                selectedEntity.points.map(
                  (entityPoint) => ({
                    ...entityPoint,
                  })
                ),
            },
          }

          setEditPreviewEntity({
            ...selectedEntity,

            points:
              selectedEntity.points.map(
                (entityPoint) => ({
                  ...entityPoint,
                })
              ),
          })

          event.currentTarget
            .setPointerCapture(
              event.pointerId
            )

          return
        }

        if (
          hitTestEntity(
            selectedEntity,
            rawPoint,
            tolerance
          )
        ) {
          editSessionRef.current = {
            mode:
              'move',

            entityId:
              selectedEntity.id,

            startPoint: {
              ...rawPoint,
            },

            originalEntity: {
              ...selectedEntity,

              points:
                selectedEntity.points.map(
                  (entityPoint) => ({
                    ...entityPoint,
                  })
                ),
            },
          }

          setEditPreviewEntity({
            ...selectedEntity,

            points:
              selectedEntity.points.map(
                (entityPoint) => ({
                  ...entityPoint,
                })
              ),
          })

          event.currentTarget
            .setPointerCapture(
              event.pointerId
            )

          return
        }
      }

      const pageEntities =
        cadEntities.filter(
          (entity) =>
            entity.pageNumber ===
            pageNumber
        )

      let hitEntity =
        null

      for (
        let index =
          pageEntities.length -
          1;
        index >=
          0;
        index -= 1
      ) {
        if (
          hitTestEntity(
            pageEntities[index],
            rawPoint,
            tolerance
          )
        ) {
          hitEntity =
            pageEntities[index]

          break
        }
      }

      setSelectedEntityId(
        hitEntity
          ?.id ||
        null
      )

      setEditPreviewEntity(
        null
      )

      if (
        hitEntity
      ) {
        setInspectorTab(
          'properties'
        )

        setInspectorOpen(
          true
        )
      }

      return
    }


    let anchorPoint =
      null

    let allowOrtho =
      false

    if (
      activeTool ===
      'calibrate'
    ) {
      anchorPoint =
        calibrationDraft.point1

      allowOrtho =
        Boolean(
          anchorPoint
        )

    } else if (
      activeTool ===
      'distance'
    ) {
      anchorPoint =
        distanceDraft.point1

      allowOrtho =
        Boolean(
          anchorPoint
        )

    } else if (
      activeTool ===
        'line' ||
      activeTool ===
        'draw-line'
    ) {
      anchorPoint =
        lineDraft.point1

      allowOrtho =
        Boolean(
          anchorPoint
        )

    } else if (
      activeTool ===
        'polyline' ||
      activeTool ===
        'draw-polyline'
    ) {
      anchorPoint =
        polylineDraft.points.at(-1) ||
        null

      allowOrtho =
        Boolean(
          anchorPoint
        )

    } else if (
      activeTool ===
        'area' ||
      activeTool ===
        'draw-polygon'
    ) {
      anchorPoint =
        areaDraft.points.at(-1) ||
        null

      allowOrtho =
        Boolean(
          anchorPoint
        )

    } else if (
      activeTool ===
        'rectangle' ||
      activeTool ===
        'draw-rectangle'
    ) {
      anchorPoint =
        rectangleDraft.point1

      allowOrtho =
        false

    } else if (
      activeTool ===
        'draw-circle'
    ) {
      anchorPoint =
        circleDraft.center

      allowOrtho =
        false
    }

    const resolution =
      resolveCadPoint(
        rawPoint,
        anchorPoint,
        {
          allowSnap:
            true,

          allowOrtho,
        }
      )

    const point =
      resolution.point

    updateCadFeedback(
      resolution
    )

    setCursorPosition(
      point
    )


    // ========================================================
    // CALIBRATION
    // ========================================================

    if (
      activeTool ===
      'calibrate'
    ) {
      event.preventDefault()

      if (
        calibrationDraft.point1 &&
        calibrationDraft.point2
      ) {
        return
      }

      if (
        !calibrationDraft.point1
      ) {
        setCalibrationDraft({
          point1:
            point,

          point2:
            null,

          previewPoint:
            point,
        })

        setCalibrationError(
          null
        )

        return
      }

      const distance =
        pointDistance(
          calibrationDraft.point1,
          point
        )

      if (
        distance <
        0.0001
      ) {
        setCalibrationError(
          'Choose a second point away from the first point.'
        )

        return
      }

      setCalibrationDraft(
        (current) => ({
          ...current,

          point2:
            point,

          previewPoint:
            null,
        })
      )

      setCalibrationError(
        null
      )

      setInspectorTab(
        'properties'
      )

      setInspectorOpen(
        true
      )

      return
    }


    // ========================================================
    // NATIVE DRAWING
    // ========================================================

    if (
      activeTool ===
        'draw-line'
    ) {
      event.preventDefault()

      if (
        !lineDraft.point1
      ) {
        setLineDraft({
          point1:
            point,
          previewPoint:
            point,
        })

        return
      }

      if (
        pointDistance(
          lineDraft.point1,
          point
        ) <
          0.0001
      ) {
        return
      }

      commitCadEntities(
        (current) => [
          ...current,
          {
            id:
              createEntityId(),

            type:
              'cad-line',

            category:
              'drawing',

            pageNumber,

            points: [
              {
                ...lineDraft.point1,
              },
              {
                ...point,
              },
            ],

            createdAt:
              new Date()
                .toISOString(),
          },
        ]
      )

      resetLineDraft()

      return
    }


    if (
      activeTool ===
        'draw-polyline'
    ) {
      event.preventDefault()

      setPolylineDraft(
        (current) => {
          if (
            !current.points.length
          ) {
            return {
              points: [
                point,
              ],
              previewPoint:
                point,
            }
          }

          const lastPoint =
            current.points.at(-1)

          if (
            pointDistance(
              lastPoint,
              point
            ) <
            0.0001
          ) {
            return current
          }

          return {
            points: [
              ...current.points,
              point,
            ],
            previewPoint:
              point,
          }
        }
      )

      return
    }


    if (
      activeTool ===
        'draw-polygon'
    ) {
      event.preventDefault()

      setAreaDraft(
        (current) => {
          if (
            !current.points.length
          ) {
            return {
              points: [
                point,
              ],
              previewPoint:
                point,
            }
          }

          const lastPoint =
            current.points.at(-1)

          if (
            pointDistance(
              lastPoint,
              point
            ) <
            0.0001
          ) {
            return current
          }

          return {
            points: [
              ...current.points,
              point,
            ],
            previewPoint:
              point,
          }
        }
      )

      return
    }


    if (
      activeTool ===
        'draw-rectangle'
    ) {
      event.preventDefault()

      if (
        !rectangleDraft.point1
      ) {
        setRectangleDraft({
          point1:
            point,
          previewPoint:
            point,
        })

        return
      }

      const width =
        Math.abs(
          point.x -
          rectangleDraft.point1.x
        )

      const height =
        Math.abs(
          point.y -
          rectangleDraft.point1.y
        )

      if (
        width <
          0.0001 ||
        height <
          0.0001
      ) {
        return
      }

      commitCadEntities(
        (current) => [
          ...current,
          {
            id:
              createEntityId(),

            type:
              'cad-rectangle',

            category:
              'drawing',

            pageNumber,

            points: [
              {
                ...rectangleDraft.point1,
              },
              {
                ...point,
              },
            ],

            createdAt:
              new Date()
                .toISOString(),
          },
        ]
      )

      resetRectangleDraft()

      return
    }


    if (
      activeTool ===
        'draw-circle'
    ) {
      event.preventDefault()

      if (
        !circleDraft.center
      ) {
        setCircleDraft({
          center:
            point,
          previewPoint:
            point,
        })

        return
      }

      if (
        pointDistance(
          circleDraft.center,
          point
        ) <
        0.0001
      ) {
        return
      }

      commitCadEntities(
        (current) => [
          ...current,
          {
            id:
              createEntityId(),

            type:
              'cad-circle',

            category:
              'drawing',

            pageNumber,

            points: [
              {
                ...circleDraft.center,
              },
              {
                ...point,
              },
            ],

            createdAt:
              new Date()
                .toISOString(),
          },
        ]
      )

      resetCircleDraft()

      return
    }


    // ========================================================
    // COUNT
    // ========================================================

    if (
      activeTool ===
      'count'
    ) {
      event.preventDefault()

      setCountDraft(
        (current) => ({
          points: [
            ...current.points,
            {
              ...point,
            },
          ],
        })
      )

      setInspectorTab(
        'properties'
      )

      setInspectorOpen(
        true
      )

      return
    }


    // ========================================================
    // REQUIRE CALIBRATION
    // ========================================================

    if (
      [
        'distance',
        'line',
        'polyline',
        'area',
        'rectangle',
      ].includes(
        activeTool
      ) &&
      !currentCalibration
    ) {
      setInspectorTab(
        'properties'
      )

      setInspectorOpen(
        true
      )

      return
    }


    // ========================================================
    // DISTANCE
    // ========================================================

    if (
      activeTool ===
      'distance'
    ) {
      event.preventDefault()

      if (
        !distanceDraft.point1
      ) {
        setDistanceDraft({
          point1:
            point,

          previewPoint:
            point,
        })

        return
      }

      if (
        pointDistance(
          distanceDraft.point1,
          point
        ) <
        0.0001
      ) {
        return
      }

      commitCadEntities(
        (current) => [
          ...current,
          {
            id:
              createEntityId(),

            type:
              'distance',

            pageNumber,

            points: [
              {
                ...distanceDraft.point1,
              },
              {
                ...point,
              },
            ],

            createdAt:
              new Date()
                .toISOString(),
          },
        ]
      )

      resetDistanceDraft()

      return
    }


    // ========================================================
    // LINEAR
    // ========================================================

    if (
      activeTool ===
      'line'
    ) {
      event.preventDefault()

      if (
        !lineDraft.point1
      ) {
        setLineDraft({
          point1:
            point,

          previewPoint:
            point,
        })

        return
      }

      if (
        pointDistance(
          lineDraft.point1,
          point
        ) <
        0.0001
      ) {
        return
      }

      commitCadEntities(
        (current) => [
          ...current,
          {
            id:
              createEntityId(),

            type:
              'linear',

            pageNumber,

            points: [
              {
                ...lineDraft.point1,
              },
              {
                ...point,
              },
            ],

            createdAt:
              new Date()
                .toISOString(),
          },
        ]
      )

      resetLineDraft()

      return
    }


    // ========================================================
    // POLYLINE
    // ========================================================

    if (
      activeTool ===
      'polyline'
    ) {
      event.preventDefault()

      setPolylineDraft(
        (current) => {
          if (
            !current.points.length
          ) {
            return {
              points: [
                point,
              ],

              previewPoint:
                point,
            }
          }

          const lastPoint =
            current.points.at(-1)

          if (
            pointDistance(
              lastPoint,
              point
            ) <
            0.0001
          ) {
            return current
          }

          return {
            points: [
              ...current.points,
              point,
            ],

            previewPoint:
              point,
          }
        }
      )

      return
    }


    // ========================================================
    // AREA
    // ========================================================

    if (
      activeTool ===
      'area'
    ) {
      event.preventDefault()

      setAreaDraft(
        (current) => {
          if (
            !current.points.length
          ) {
            return {
              points: [
                point,
              ],

              previewPoint:
                point,
            }
          }

          const lastPoint =
            current.points.at(-1)

          if (
            pointDistance(
              lastPoint,
              point
            ) <
            0.0001
          ) {
            return current
          }

          return {
            points: [
              ...current.points,
              point,
            ],

            previewPoint:
              point,
          }
        }
      )

      return
    }


    // ========================================================
    // RECTANGLE
    // ========================================================

    if (
      activeTool ===
      'rectangle'
    ) {
      event.preventDefault()

      if (
        !rectangleDraft.point1
      ) {
        setRectangleDraft({
          point1:
            point,

          previewPoint:
            point,
        })

        return
      }

      const width =
        Math.abs(
          point.x -
          rectangleDraft.point1.x
        )

      const height =
        Math.abs(
          point.y -
          rectangleDraft.point1.y
        )

      if (
        width <
          0.0001 ||
        height <
          0.0001
      ) {
        return
      }

      commitCadEntities(
        (current) => [
          ...current,
          {
            id:
              createEntityId(),

            type:
              'rectangle',

            pageNumber,

            points: [
              {
                ...rectangleDraft.point1,
              },
              {
                ...point,
              },
            ],

            createdAt:
              new Date()
                .toISOString(),
          },
        ]
      )

      resetRectangleDraft()

      return
    }
  }


  // ==========================================================
  // DOUBLE CLICK
  // ==========================================================

  function handleDoubleClick(
    event
  ) {
    if (
      activeTool ===
      'draw-polyline'
    ) {
      event.preventDefault()
      finishNativePolyline()
      return
    }

    if (
      activeTool ===
      'draw-polygon'
    ) {
      event.preventDefault()
      finishNativePolygon()
      return
    }

    if (
      activeTool ===
      'polyline'
    ) {
      event.preventDefault()
      finishPolyline()
      return
    }

    if (
      activeTool ===
      'area'
    ) {
      event.preventDefault()
      finishArea()
    }
  }


  // ==========================================================
  // POINTER UP
  // ==========================================================

  function handlePointerUp(
    event
  ) {
    const editSession =
      editSessionRef.current

    if (
      editSession
    ) {
      if (
        editPreviewEntity &&
        entityGeometryChanged(
          editSession.originalEntity,
          editPreviewEntity
        )
      ) {
        const updatedEntity =
          editPreviewEntity

        commitCadEntities(
          (current) =>
            current.map(
              (entity) =>
                entity.id ===
                  editSession.entityId
                  ? updatedEntity
                  : entity
            )
        )
      }

      editSessionRef.current =
        null

      setEditPreviewEntity(
        null
      )

      setSnapMarker(
        null
      )

      setOrthoTracking(
        null
      )

      try {
        event.currentTarget
          .releasePointerCapture(
            event.pointerId
          )
      } catch {
        // Pointer may already be released.
      }

      return
    }

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

    setSnapMarker(
      null
    )

    setOrthoTracking(
      null
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
    if (!workspaceReady) {
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
      (current) => ({
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
          tagName ===
            'select' ||
          target
            ?.isContentEditable
        ) {
          return
        }


        if (
          event.key ===
            'Escape' &&
          editSessionRef.current
        ) {
          event.preventDefault()

          editSessionRef.current =
            null

          setEditPreviewEntity(
            null
          )

          setSnapMarker(
            null
          )

          setOrthoTracking(
            null
          )

          return
        }


        if (
          event.key ===
          'F3'
        ) {
          event.preventDefault()

          setSnapEnabled(
            (current) =>
              !current
          )

          return
        }


        if (
          event.key ===
          'F8'
        ) {
          event.preventDefault()

          setOrthoEnabled(
            (current) =>
              !current
          )

          return
        }


        const usingModifier =
          event.ctrlKey ||
          event.metaKey

        const lowerKey =
          event.key
            .toLowerCase()

        if (
          usingModifier &&
          lowerKey ===
            'z'
        ) {
          event.preventDefault()

          if (
            event.shiftKey
          ) {
            redoCad()
          } else {
            undoCad()
          }

          return
        }

        if (
          usingModifier &&
          lowerKey ===
            'y'
        ) {
          event.preventDefault()

          redoCad()

          return
        }

        if (
          (
            event.key ===
              'Delete' ||
            event.key ===
              'Backspace'
          ) &&
          selectedEntityId
        ) {
          event.preventDefault()

          deleteSelectedEntity()

          return
        }


        if (
          event.key ===
          'Enter'
        ) {
          if (
            activeTool ===
              'draw-polyline' &&
            polylineDraft.points.length >=
              2
          ) {
            event.preventDefault()

            finishNativePolyline()

            return
          }

          if (
            activeTool ===
              'draw-polygon' &&
            areaDraft.points.length >=
              3
          ) {
            event.preventDefault()

            finishNativePolygon()

            return
          }

          if (
            activeTool ===
              'polyline' &&
            polylineDraft.points.length >=
              2
          ) {
            event.preventDefault()

            finishPolyline()

            return
          }

          if (
            activeTool ===
              'area' &&
            areaDraft.points.length >=
              3
          ) {
            event.preventDefault()

            finishArea()

            return
          }

          if (
            activeTool ===
              'draw-circle' &&
            circleDraft.center
          ) {
            resetCircleDraft()
            return
          }

          if (
            activeTool ===
              'count' &&
            countDraft.points.length
          ) {
            event.preventDefault()

            finishCount()

            return
          }
        }


        if (
          event.key ===
          'Escape'
        ) {
          if (
            activeTool ===
            'calibrate'
          ) {
            cancelCalibration()

            return
          }

          if (
            activeTool ===
              'distance' &&
            distanceDraft.point1
          ) {
            resetDistanceDraft()
            return
          }

          if (
            (
              activeTool ===
                'line' ||
              activeTool ===
                'draw-line'
            ) &&
            lineDraft.point1
          ) {
            resetLineDraft()
            return
          }

          if (
            (
              activeTool ===
                'polyline' ||
              activeTool ===
                'draw-polyline'
            ) &&
            polylineDraft.points.length
          ) {
            resetPolylineDraft()
            return
          }

          if (
            (
              activeTool ===
                'area' ||
              activeTool ===
                'draw-polygon'
            ) &&
            areaDraft.points.length
          ) {
            resetAreaDraft()
            return
          }

          if (
            (
              activeTool ===
                'rectangle' ||
              activeTool ===
                'draw-rectangle'
            ) &&
            rectangleDraft.point1
          ) {
            resetRectangleDraft()
            return
          }

          if (
            activeTool ===
              'count' &&
            countDraft.points.length
          ) {
            resetCountDraft()
            return
          }

          if (
            selectedEntityId
          ) {
            setSelectedEntityId(
              null
            )

            return
          }

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
          activateTool(
            'select'
          )

        } else if (
          key ===
          'h'
        ) {
          activateTool(
            'pan'
          )

        } else if (
          key ===
          'z'
        ) {
          activateTool(
            'zoom'
          )

        } else if (
          key ===
          '1'
        ) {
          activateTool(
            'draw-line'
          )

        } else if (
          key ===
          '2'
        ) {
          activateTool(
            'draw-polyline'
          )

        } else if (
          key ===
          '3'
        ) {
          activateTool(
            'draw-rectangle'
          )

        } else if (
          key ===
          '4'
        ) {
          activateTool(
            'draw-polygon'
          )

        } else if (
          key ===
          '5'
        ) {
          activateTool(
            'draw-circle'
          )

        } else if (
          key ===
          'd'
        ) {
          activateTool(
            'distance'
          )

        } else if (
          key ===
          'l'
        ) {
          activateTool(
            'line'
          )

        } else if (
          key ===
          'p'
        ) {
          activateTool(
            'polyline'
          )

        } else if (
          key ===
          'a'
        ) {
          activateTool(
            'area'
          )

        } else if (
          key ===
          'r'
        ) {
          activateTool(
            'rectangle'
          )

        } else if (
          key ===
          'c'
        ) {
          activateTool(
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
      activeTool,
      activateTool,
      areaDraft,
      cancelCalibration,
      countDraft,
      distanceDraft,
      finishArea,
      finishCount,
      finishNativePolygon,
      finishNativePolyline,
      finishPolyline,
      fitPage,
      fitWidth,
      lineDraft,
      polylineDraft,
      rectangleDraft,
      circleDraft,
      resetAreaDraft,
      resetCircleDraft,
      resetCountDraft,
      resetDistanceDraft,
      resetLineDraft,
      resetPolylineDraft,
      resetRectangleDraft,
      selectedEntityId,
      deleteSelectedEntity,
      undoCad,
      redoCad,
    ]
  )


  useEffect(
    () => {
      setSnapMarker(
        null
      )

      setOrthoTracking(
        null
      )
    },
    [
      pageNumber,
      pdfDocument,
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
    [
      'calibrate',
      'distance',
      'line',
      'polyline',
      'area',
      'rectangle',
      'count',
      'draw-line',
      'draw-polyline',
      'draw-rectangle',
      'draw-polygon',
      'draw-circle',
    ].includes(
      activeTool
    )
  ) {
    viewportCursor =
      'crosshair'

  } else if (
    workspaceReady
  ) {
    viewportCursor =
      'crosshair'
  }


  // ==========================================================
  // COMMAND LABELS
  // ==========================================================

  const scaleHeaderLabel =
    currentCalibration
      ? `Calibrated · ${currentCalibration.displayUnit}`
      : 'Not calibrated'


  let commandName =
    null

  let commandInstruction =
    null

  let liveLength =
    null

  let liveArea =
    null


  if (
    activeTool ===
    'calibrate'
  ) {
    commandName =
      'CALIBRATE'

    if (
      !calibrationDraft.point1
    ) {
      commandInstruction =
        'Click the first reference point.'
    } else if (
      !calibrationDraft.point2
    ) {
      commandInstruction =
        'Click the second reference point.'
    } else {
      commandInstruction =
        'Enter the known real distance.'
    }

  } else if (
    activeTool ===
    'distance'
  ) {
    commandName =
      'DISTANCE'

    if (
      !currentCalibration
    ) {
      commandInstruction =
        'Calibrate this page before measuring distance.'
    } else if (
      !distanceDraft.point1
    ) {
      commandInstruction =
        'Click the first measurement point.'
    } else {
      commandInstruction =
        'Click the second measurement point.'
    }

    liveLength =
      previewDistance

  } else if (
    activeTool ===
    'line'
  ) {
    commandName =
      'LINEAR'

    if (
      !currentCalibration
    ) {
      commandInstruction =
        'Calibrate this page before creating linear takeoff.'
    } else if (
      !lineDraft.point1
    ) {
      commandInstruction =
        'Click the first linear takeoff point.'
    } else {
      commandInstruction =
        'Click the second point to save the linear quantity.'
    }

    liveLength =
      previewLinear

  } else if (
    activeTool ===
    'polyline'
  ) {
    commandName =
      'POLYLINE'

    if (
      !currentCalibration
    ) {
      commandInstruction =
        'Calibrate this page before creating polyline takeoff.'
    } else if (
      !polylineDraft.points.length
    ) {
      commandInstruction =
        'Click the first polyline point.'
    } else if (
      polylineDraft.points.length ===
      1
    ) {
      commandInstruction =
        'Click the next point. Continue adding vertices.'
    } else {
      commandInstruction =
        'Continue clicking vertices. Enter or double-click to finish.'
    }

    liveLength =
      previewPolyline

  } else if (
    activeTool ===
    'area'
  ) {
    commandName =
      'AREA'

    if (
      !currentCalibration
    ) {
      commandInstruction =
        'Calibrate this page before creating area takeoff.'
    } else if (
      !areaDraft.points.length
    ) {
      commandInstruction =
        'Click the first polygon point.'
    } else if (
      areaDraft.points.length <
      3
    ) {
      commandInstruction =
        'Continue adding polygon points.'
    } else {
      commandInstruction =
        'Continue clicking vertices. Enter or double-click to finish.'
    }

    liveArea =
      previewArea

  } else if (
    activeTool ===
    'rectangle'
  ) {
    commandName =
      'RECTANGLE'

    if (
      !currentCalibration
    ) {
      commandInstruction =
        'Calibrate this page before creating rectangle takeoff.'
    } else if (
      !rectangleDraft.point1
    ) {
      commandInstruction =
        'Click the first rectangle corner.'
    } else {
      commandInstruction =
        'Click the opposite corner to save the area.'
    }

    liveArea =
      previewRectangleArea

  } else if (
    activeTool ===
    'count'
  ) {
    commandName =
      'COUNT'

    if (
      !countDraft.points.length
    ) {
      commandInstruction =
        'Click each item to start a count group.'
    } else {
      commandInstruction =
        'Continue clicking items. Press Enter to finish this group.'
    }
  }


  // ==========================================================
  // RENDER HELPERS
  // ==========================================================

  const geometryScale =
    Math.max(
      effectiveScale,
      0.01
    )

  const areaUnit =
    currentCalibration
      ? `${currentCalibration.displayUnit}²`
      : '—'


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
                RitsuCAD™
              </strong>

              <span>
                CAD Drawing Workspace
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
              nativeDrawingName ||
              'No drawing loaded'
            }
          >
            {
              pdfFileName ||
              nativeDrawingName ||
              'No drawing loaded'
            }
          </span>
        </div>


        <div
          className={
            styles.headerRight
          }
        >

          {workspaceReady && (
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
              {
                scaleHeaderLabel
              }
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


          <Link
            href="/dashboard"
            title="Return to RitsuFlow"
            aria-label="RitsuFlow"
            style={{
              display:
                'inline-flex',
              alignItems:
                'center',
              justifyContent:
                'center',
              flex:
                '0 0 auto',
              height:
                34,
              padding:
                '3px 8px',
              marginLeft:
                4,
              border:
                '1px solid #a7e5dc',
              borderRadius:
                8,
              background:
                '#ffffff',
              textDecoration:
                'none',
              overflow:
                'hidden',
            }}
          >
            <img
              src="/logo.png"
              alt="RitsuFlow"
              style={{
                display:
                  'block',
                width:
                  'auto',
                height:
                  24,
                maxWidth:
                  140,
                objectFit:
                  'contain',
              }}
            />
          </Link>

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
              styles.toolbarButtonWide
            }
            onClick={
              createNewDrawing
            }
            title="Create a new RitsuCAD drawing"
          >
            <Icon
              type="rectangle"
            />

            <span>
              New Drawing
            </span>
          </button>


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
              .filter(Boolean)
              .join(' ')}
            onClick={() =>
              setDrawingDrawerOpen(
                (current) =>
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
            (tool) => (
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
                  .filter(Boolean)
                  .join(' ')}
                onClick={() =>
                  activateTool(
                    tool.id
                  )
                }
                disabled={
                  !workspaceReady &&
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
              !workspaceReady
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
              !workspaceReady
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

          {drawingTools.map(
            (tool) => (
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
                  .filter(Boolean)
                  .join(' ')}
                onClick={() =>
                  activateTool(
                    tool.id
                  )
                }
                disabled={
                  !workspaceReady
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

          {measurementTools.map(
            (tool) => (
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
                  .filter(Boolean)
                  .join(' ')}
                onClick={() =>
                  activateTool(
                    tool.id
                  )
                }
                disabled={
                  !workspaceReady
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
            className={[
              styles.toolbarButtonWide,
              activeTool ===
                'calibrate'
                ? styles.toolbarButtonActive
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={
              startCalibration
            }
            disabled={
              !workspaceReady
            }
            title={
              currentCalibration
                ? 'Recalibrate current page'
                : 'Calibrate Scale'
            }
          >
            <Icon
              type="calibrate"
            />

            <span>
              {
                currentCalibration
                  ? 'Recalibrate'
                  : 'Calibrate'
              }
            </span>
          </button>


          <button
            type="button"
            className={
              styles.toolbarIconButton
            }
            onClick={
              undoCad
            }
            disabled={
              undoCount ===
              0
            }
            title="Undo (Ctrl+Z)"
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
            onClick={
              redoCad
            }
            disabled={
              redoCount ===
              0
            }
            title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
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
            .filter(Boolean)
            .join(' ')}
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
          onDoubleClick={
            handleDoubleClick
          }
          onPointerLeave={() => {
            if (
              !panSessionRef.current
            ) {
              setCursorPosition({
                x: null,
                y: null,
              })

              setSnapMarker(
                null
              )

              setOrthoTracking(
                null
              )

              if (
                activeTool ===
                  'calibrate'
              ) {
                setCalibrationDraft(
                  (current) => ({
                    ...current,
                    previewPoint:
                      null,
                  })
                )
              }

              if (
                activeTool ===
                  'distance'
              ) {
                setDistanceDraft(
                  (current) => ({
                    ...current,
                    previewPoint:
                      null,
                  })
                )
              }

              if (
                activeTool ===
                  'line' ||
                activeTool ===
                  'draw-line'
              ) {
                setLineDraft(
                  (current) => ({
                    ...current,
                    previewPoint:
                      null,
                  })
                )
              }

              if (
                activeTool ===
                  'polyline' ||
                activeTool ===
                  'draw-polyline'
              ) {
                setPolylineDraft(
                  (current) => ({
                    ...current,
                    previewPoint:
                      null,
                  })
                )
              }

              if (
                activeTool ===
                  'area' ||
                activeTool ===
                  'draw-polygon'
              ) {
                setAreaDraft(
                  (current) => ({
                    ...current,
                    previewPoint:
                      null,
                  })
                )
              }

              if (
                activeTool ===
                  'rectangle' ||
                activeTool ===
                  'draw-rectangle'
              ) {
                setRectangleDraft(
                  (current) => ({
                    ...current,
                    previewPoint:
                      null,
                  })
                )
              }


              if (
                activeTool ===
                  'draw-circle'
              ) {
                setCircleDraft(
                  (current) => ({
                    ...current,
                    previewPoint:
                      null,
                  })
                )
              }
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

          {!workspaceReady && (
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
                Start a drawing
              </h2>

              <p>
                Create a native RitsuCAD drawing or import a PDF as a drawing reference.
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
                  createNewDrawing
                }
              >
                <Icon
                  type="rectangle"
                />

                New Drawing
              </button>

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

              {documentMode ===
                'native' && (
                <div
                  aria-hidden="true"
                  style={{
                    position:
                      'absolute',
                    inset:
                      0,
                    background:
                      '#ffffff',
                    boxShadow:
                      '0 0 0 1px rgba(15, 23, 42, 0.12)',
                  }}
                />
              )}

              {pdfDocument && (
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
              )}


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
              >

                {/* ============================================
                    NATIVE RITSUCAD GEOMETRY
                ============================================ */}

                {currentPageNativeEntities.map(
                  (entity) => {
                    const renderEntity =
                      selectedRenderEntity &&
                      selectedRenderEntity.id ===
                        entity.id
                        ? selectedRenderEntity
                        : entity

                    const isSelected =
                      selectedEntityId ===
                      entity.id

                    const stroke =
                      isSelected
                        ? '#0f766e'
                        : '#0f172a'

                    const strokeWidth =
                      isSelected
                        ? 3
                        : 2

                    if (
                      renderEntity.type ===
                        'cad-line'
                    ) {
                      return (
                        <line
                          key={
                            entity.id
                          }
                          x1={
                            renderEntity.points[0]?.x
                          }
                          y1={
                            renderEntity.points[0]?.y
                          }
                          x2={
                            renderEntity.points[1]?.x
                          }
                          y2={
                            renderEntity.points[1]?.y
                          }
                          stroke={
                            stroke
                          }
                          strokeWidth={
                            strokeWidth
                          }
                          vectorEffect="non-scaling-stroke"
                        />
                      )
                    }

                    if (
                      renderEntity.type ===
                        'cad-polyline'
                    ) {
                      return (
                        <polyline
                          key={
                            entity.id
                          }
                          points={
                            renderEntity.points
                              .map(
                                (point) =>
                                  `${point.x},${point.y}`
                              )
                              .join(' ')
                          }
                          fill="none"
                          stroke={
                            stroke
                          }
                          strokeWidth={
                            strokeWidth
                          }
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      )
                    }

                    if (
                      renderEntity.type ===
                        'cad-rectangle'
                    ) {
                      const point1 =
                        renderEntity.points[0]

                      const point2 =
                        renderEntity.points[1]

                      if (
                        !point1 ||
                        !point2
                      ) {
                        return null
                      }

                      return (
                        <rect
                          key={
                            entity.id
                          }
                          x={
                            Math.min(
                              point1.x,
                              point2.x
                            )
                          }
                          y={
                            Math.min(
                              point1.y,
                              point2.y
                            )
                          }
                          width={
                            Math.abs(
                              point2.x -
                              point1.x
                            )
                          }
                          height={
                            Math.abs(
                              point2.y -
                              point1.y
                            )
                          }
                          fill="none"
                          stroke={
                            stroke
                          }
                          strokeWidth={
                            strokeWidth
                          }
                          vectorEffect="non-scaling-stroke"
                        />
                      )
                    }

                    if (
                      renderEntity.type ===
                        'cad-polygon'
                    ) {
                      return (
                        <polygon
                          key={
                            entity.id
                          }
                          points={
                            renderEntity.points
                              .map(
                                (point) =>
                                  `${point.x},${point.y}`
                              )
                              .join(' ')
                          }
                          fill="rgba(15, 23, 42, 0.04)"
                          stroke={
                            stroke
                          }
                          strokeWidth={
                            strokeWidth
                          }
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      )
                    }

                    if (
                      renderEntity.type ===
                        'cad-circle'
                    ) {
                      const center =
                        renderEntity.points[0]

                      const edge =
                        renderEntity.points[1]

                      if (
                        !center ||
                        !edge
                      ) {
                        return null
                      }

                      return (
                        <circle
                          key={
                            entity.id
                          }
                          cx={
                            center.x
                          }
                          cy={
                            center.y
                          }
                          r={
                            pointDistance(
                              center,
                              edge
                            )
                          }
                          fill="none"
                          stroke={
                            stroke
                          }
                          strokeWidth={
                            strokeWidth
                          }
                          vectorEffect="non-scaling-stroke"
                        />
                      )
                    }

                    return null
                  }
                )}


                {/* ============================================
                    NATIVE DRAWING PREVIEW
                ============================================ */}

                {activeTool ===
                  'draw-line' &&
                  lineDraft.point1 &&
                  lineDraft.previewPoint && (
                    <line
                      x1={
                        lineDraft.point1.x
                      }
                      y1={
                        lineDraft.point1.y
                      }
                      x2={
                        lineDraft.previewPoint.x
                      }
                      y2={
                        lineDraft.previewPoint.y
                      }
                      stroke="#0f766e"
                      strokeWidth="2"
                      strokeDasharray="7 5"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}

                {activeTool ===
                  'draw-polyline' &&
                  polylineDraft.points.length >
                    0 && (
                    <polyline
                      points={[
                        ...polylineDraft.points,
                        ...(polylineDraft.previewPoint
                          ? [
                              polylineDraft.previewPoint,
                            ]
                          : []),
                      ]
                        .map(
                          (point) =>
                            `${point.x},${point.y}`
                        )
                        .join(' ')}
                      fill="none"
                      stroke="#0f766e"
                      strokeWidth="2"
                      strokeDasharray="7 5"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}

                {activeTool ===
                  'draw-polygon' &&
                  areaDraft.points.length >
                    0 && (
                    <polyline
                      points={[
                        ...areaDraft.points,
                        ...(areaDraft.previewPoint
                          ? [
                              areaDraft.previewPoint,
                            ]
                          : []),
                      ]
                        .map(
                          (point) =>
                            `${point.x},${point.y}`
                        )
                        .join(' ')}
                      fill="none"
                      stroke="#0f766e"
                      strokeWidth="2"
                      strokeDasharray="7 5"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}

                {activeTool ===
                  'draw-rectangle' &&
                  rectangleDraft.point1 &&
                  rectangleDraft.previewPoint && (
                    <rect
                      x={
                        Math.min(
                          rectangleDraft.point1.x,
                          rectangleDraft.previewPoint.x
                        )
                      }
                      y={
                        Math.min(
                          rectangleDraft.point1.y,
                          rectangleDraft.previewPoint.y
                        )
                      }
                      width={
                        Math.abs(
                          rectangleDraft.previewPoint.x -
                          rectangleDraft.point1.x
                        )
                      }
                      height={
                        Math.abs(
                          rectangleDraft.previewPoint.y -
                          rectangleDraft.point1.y
                        )
                      }
                      fill="none"
                      stroke="#0f766e"
                      strokeWidth="2"
                      strokeDasharray="7 5"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}

                {activeTool ===
                  'draw-circle' &&
                  circleDraft.center &&
                  circleDraft.previewPoint && (
                    <circle
                      cx={
                        circleDraft.center.x
                      }
                      cy={
                        circleDraft.center.y
                      }
                      r={
                        pointDistance(
                          circleDraft.center,
                          circleDraft.previewPoint
                        )
                      }
                      fill="none"
                      stroke="#0f766e"
                      strokeWidth="2"
                      strokeDasharray="7 5"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}


                {/* ============================================
                    CALIBRATION
                ============================================ */}

                {currentCalibration && (
                  <g>
                    <line
                      x1={
                        currentCalibration.point1.x
                      }
                      y1={
                        currentCalibration.point1.y
                      }
                      x2={
                        currentCalibration.point2.x
                      }
                      y2={
                        currentCalibration.point2.y
                      }
                      stroke="#14b8a6"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                    />

                    {[currentCalibration.point1, currentCalibration.point2]
                      .map(
                        (
                          point,
                          index
                        ) => (
                          <circle
                            key={`calibration-${index}`}
                            cx={
                              point.x
                            }
                            cy={
                              point.y
                            }
                            r={
                              4 /
                              geometryScale
                            }
                            fill="#ffffff"
                            stroke="#14b8a6"
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                          />
                        )
                      )}
                  </g>
                )}


                {/* ============================================
                    DISTANCE
                ============================================ */}

                {currentPageDistances.map(
                  (entity) => {
                    const [
                      point1,
                      point2,
                    ] =
                      entity.points

                    const quantity =
                      realDistanceFromPoints(
                        point1,
                        point2,
                        currentCalibration
                      )

                    const midpoint = {
                      x:
                        (
                          point1.x +
                          point2.x
                        ) / 2,
                      y:
                        (
                          point1.y +
                          point2.y
                        ) / 2,
                    }

                    return (
                      <g
                        key={
                          entity.id
                        }
                      >
                        <line
                          x1={
                            point1.x
                          }
                          y1={
                            point1.y
                          }
                          x2={
                            point2.x
                          }
                          y2={
                            point2.y
                          }
                          stroke="#2563eb"
                          strokeWidth="2"
                          vectorEffect="non-scaling-stroke"
                        />

                        <text
                          x={
                            midpoint.x
                          }
                          y={
                            midpoint.y -
                            8 /
                            geometryScale
                          }
                          textAnchor="middle"
                          fill="#052c49"
                          fontSize={
                            11 /
                            geometryScale
                          }
                          fontWeight="800"
                          stroke="#ffffff"
                          strokeWidth={
                            3 /
                            geometryScale
                          }
                          paintOrder="stroke"
                        >
                          {
                            quantity !==
                              null
                              ? `${formatNumber(
                                  quantity
                                )} ${currentCalibration.displayUnit}`
                              : 'Unscaled'
                          }
                        </text>
                      </g>
                    )
                  }
                )}


                {/* ============================================
                    LINEAR
                ============================================ */}

                {currentPageLinears.map(
                  (entity) => {
                    const [
                      point1,
                      point2,
                    ] =
                      entity.points

                    const quantity =
                      realDistanceFromPoints(
                        point1,
                        point2,
                        currentCalibration
                      )

                    const midpoint = {
                      x:
                        (
                          point1.x +
                          point2.x
                        ) / 2,
                      y:
                        (
                          point1.y +
                          point2.y
                        ) / 2,
                    }

                    return (
                      <g
                        key={
                          entity.id
                        }
                      >
                        <line
                          x1={
                            point1.x
                          }
                          y1={
                            point1.y
                          }
                          x2={
                            point2.x
                          }
                          y2={
                            point2.y
                          }
                          stroke="#7c3aed"
                          strokeWidth="3"
                          vectorEffect="non-scaling-stroke"
                        />

                        <text
                          x={
                            midpoint.x
                          }
                          y={
                            midpoint.y -
                            8 /
                            geometryScale
                          }
                          textAnchor="middle"
                          fill="#6d28d9"
                          fontSize={
                            11 /
                            geometryScale
                          }
                          fontWeight="800"
                          stroke="#ffffff"
                          strokeWidth={
                            3 /
                            geometryScale
                          }
                          paintOrder="stroke"
                        >
                          {
                            quantity !==
                              null
                              ? `${formatNumber(
                                  quantity
                                )} ${currentCalibration.displayUnit}`
                              : 'Unscaled'
                          }
                        </text>
                      </g>
                    )
                  }
                )}


                {/* ============================================
                    POLYLINE
                ============================================ */}

                {currentPagePolylines.map(
                  (entity) => {
                    const quantity =
                      realPolylineLength(
                        entity.points,
                        currentCalibration
                      )

                    const lastPoint =
                      entity.points.at(-1)

                    return (
                      <g
                        key={
                          entity.id
                        }
                      >
                        <polyline
                          points={
                            entity.points
                              .map(
                                (point) =>
                                  `${point.x},${point.y}`
                              )
                              .join(' ')
                          }
                          fill="none"
                          stroke="#ea580c"
                          strokeWidth="3"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                        />

                        <text
                          x={
                            lastPoint.x +
                            8 /
                            geometryScale
                          }
                          y={
                            lastPoint.y -
                            8 /
                            geometryScale
                          }
                          fill="#c2410c"
                          fontSize={
                            11 /
                            geometryScale
                          }
                          fontWeight="800"
                          stroke="#ffffff"
                          strokeWidth={
                            3 /
                            geometryScale
                          }
                          paintOrder="stroke"
                        >
                          {
                            quantity !==
                              null
                              ? `${formatNumber(
                                  quantity
                                )} ${currentCalibration.displayUnit}`
                              : 'Unscaled'
                          }
                        </text>
                      </g>
                    )
                  }
                )}


                {/* ============================================
                    AREA
                ============================================ */}

                {currentPageAreas.map(
                  (entity) => {
                    const quantity =
                      realPolygonArea(
                        entity.points,
                        currentCalibration
                      )

                    const centroid =
                      polygonCentroid(
                        entity.points
                      )

                    return (
                      <g
                        key={
                          entity.id
                        }
                      >
                        <polygon
                          points={
                            entity.points
                              .map(
                                (point) =>
                                  `${point.x},${point.y}`
                              )
                              .join(' ')
                          }
                          fill="rgba(20, 184, 166, 0.20)"
                          stroke="#0f9f91"
                          strokeWidth="3"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />

                        <text
                          x={
                            centroid.x
                          }
                          y={
                            centroid.y
                          }
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="#087f73"
                          fontSize={
                            12 /
                            geometryScale
                          }
                          fontWeight="900"
                          stroke="#ffffff"
                          strokeWidth={
                            3 /
                            geometryScale
                          }
                          paintOrder="stroke"
                        >
                          {
                            quantity !==
                              null
                              ? `${formatNumber(
                                  quantity
                                )} ${currentCalibration.displayUnit}²`
                              : 'Unscaled'
                          }
                        </text>
                      </g>
                    )
                  }
                )}


                {/* ============================================
                    RECTANGLE
                ============================================ */}

                {currentPageRectangles.map(
                  (entity) => {
                    const [
                      point1,
                      point2,
                    ] =
                      entity.points

                    const x =
                      Math.min(
                        point1.x,
                        point2.x
                      )

                    const y =
                      Math.min(
                        point1.y,
                        point2.y
                      )

                    const width =
                      Math.abs(
                        point2.x -
                        point1.x
                      )

                    const height =
                      Math.abs(
                        point2.y -
                        point1.y
                      )

                    const quantity =
                      realRectangleArea(
                        point1,
                        point2,
                        currentCalibration
                      )

                    return (
                      <g
                        key={
                          entity.id
                        }
                      >
                        <rect
                          x={
                            x
                          }
                          y={
                            y
                          }
                          width={
                            width
                          }
                          height={
                            height
                          }
                          fill="rgba(37, 99, 235, 0.16)"
                          stroke="#1d4ed8"
                          strokeWidth="3"
                          vectorEffect="non-scaling-stroke"
                        />

                        <text
                          x={
                            x +
                            width / 2
                          }
                          y={
                            y +
                            height / 2
                          }
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="#1d4ed8"
                          fontSize={
                            12 /
                            geometryScale
                          }
                          fontWeight="900"
                          stroke="#ffffff"
                          strokeWidth={
                            3 /
                            geometryScale
                          }
                          paintOrder="stroke"
                        >
                          {
                            quantity !==
                              null
                              ? `${formatNumber(
                                  quantity
                                )} ${currentCalibration.displayUnit}²`
                              : 'Unscaled'
                          }
                        </text>
                      </g>
                    )
                  }
                )}


                {/* ============================================
                    COUNT
                ============================================ */}

                {currentPageCounts.map(
                  (
                    entity,
                    groupIndex
                  ) => (
                    <g
                      key={
                        entity.id
                      }
                    >
                      {entity.points.map(
                        (
                          point,
                          index
                        ) => (
                          <g
                            key={`${entity.id}-${index}`}
                          >
                            <circle
                              cx={
                                point.x
                              }
                              cy={
                                point.y
                              }
                              r={
                                10 /
                                geometryScale
                              }
                              fill="rgba(220, 38, 38, 0.92)"
                              stroke="#ffffff"
                              strokeWidth="2"
                              vectorEffect="non-scaling-stroke"
                            />

                            <text
                              x={
                                point.x
                              }
                              y={
                                point.y
                              }
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill="#ffffff"
                              fontSize={
                                9 /
                                geometryScale
                              }
                              fontWeight="900"
                            >
                              {
                                index +
                                1
                              }
                            </text>
                          </g>
                        )
                      )}

                      {entity.points.length >
                        0 && (
                        <text
                          x={
                            entity.points.at(-1).x +
                            15 /
                            geometryScale
                          }
                          y={
                            entity.points.at(-1).y
                          }
                          dominantBaseline="middle"
                          fill="#b91c1c"
                          fontSize={
                            11 /
                            geometryScale
                          }
                          fontWeight="900"
                          stroke="#ffffff"
                          strokeWidth={
                            3 /
                            geometryScale
                          }
                          paintOrder="stroke"
                        >
                          Group {
                            groupIndex +
                            1
                          }: {
                            entity.points.length
                          } ea
                        </text>
                      )}
                    </g>
                  )
                )}


                {/* ============================================
                    SELECTION OVERLAY + GRIPS
                ============================================ */}

                {selectedRenderEntity &&
                  selectedRenderEntity.pageNumber ===
                    pageNumber && (
                    <g
                      pointerEvents="none"
                    >
                      {(
                        selectedRenderEntity.type ===
                          'distance' ||
                        selectedRenderEntity.type ===
                          'linear'
                      ) &&
                        selectedRenderEntity.points.length >=
                          2 && (
                        <line
                          x1={
                            selectedRenderEntity.points[0].x
                          }
                          y1={
                            selectedRenderEntity.points[0].y
                          }
                          x2={
                            selectedRenderEntity.points[1].x
                          }
                          y2={
                            selectedRenderEntity.points[1].y
                          }
                          stroke="#f59e0b"
                          strokeWidth="6"
                          strokeDasharray="8 5"
                          opacity="0.95"
                          vectorEffect="non-scaling-stroke"
                        />
                      )}


                      {selectedRenderEntity.type ===
                        'polyline' && (
                        <polyline
                          points={
                            selectedRenderEntity.points
                              .map(
                                (point) =>
                                  `${point.x},${point.y}`
                              )
                              .join(' ')
                          }
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="6"
                          strokeDasharray="8 5"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          opacity="0.95"
                          vectorEffect="non-scaling-stroke"
                        />
                      )}


                      {selectedRenderEntity.type ===
                        'area' && (
                        <polygon
                          points={
                            selectedRenderEntity.points
                              .map(
                                (point) =>
                                  `${point.x},${point.y}`
                              )
                              .join(' ')
                          }
                          fill="rgba(245, 158, 11, 0.08)"
                          stroke="#f59e0b"
                          strokeWidth="5"
                          strokeDasharray="8 5"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      )}


                      {selectedRenderEntity.type ===
                        'rectangle' &&
                        selectedRenderEntity.points.length >=
                          2 && (
                        <rect
                          x={
                            Math.min(
                              selectedRenderEntity.points[0].x,
                              selectedRenderEntity.points[1].x
                            )
                          }
                          y={
                            Math.min(
                              selectedRenderEntity.points[0].y,
                              selectedRenderEntity.points[1].y
                            )
                          }
                          width={
                            Math.abs(
                              selectedRenderEntity.points[1].x -
                              selectedRenderEntity.points[0].x
                            )
                          }
                          height={
                            Math.abs(
                              selectedRenderEntity.points[1].y -
                              selectedRenderEntity.points[0].y
                            )
                          }
                          fill="rgba(245, 158, 11, 0.06)"
                          stroke="#f59e0b"
                          strokeWidth="5"
                          strokeDasharray="8 5"
                          vectorEffect="non-scaling-stroke"
                        />
                      )}


                      {selectedRenderEntity.type ===
                        'count' &&
                        selectedRenderEntity.points.map(
                          (
                            point,
                            index
                          ) => (
                            <circle
                              key={`selected-count-${index}`}
                              cx={
                                point.x
                              }
                              cy={
                                point.y
                              }
                              r={
                                14 /
                                geometryScale
                              }
                              fill="none"
                              stroke="#f59e0b"
                              strokeWidth="4"
                              vectorEffect="non-scaling-stroke"
                            />
                          )
                        )}


                      {entityGripPoints(
                        selectedRenderEntity
                      ).map(
                        (grip) => (
                          <circle
                            key={`grip-${selectedRenderEntity.id}-${grip.id}`}
                            cx={
                              grip.point.x
                            }
                            cy={
                              grip.point.y
                            }
                            r={
                              5.5 /
                              geometryScale
                            }
                            fill="#ffffff"
                            stroke="#f59e0b"
                            strokeWidth="2.5"
                            vectorEffect="non-scaling-stroke"
                          />
                        )
                      )}
                    </g>
                  )}


                {/* ============================================
                    SNAP MARKER
                ============================================ */}

                {snapEnabled &&
                  snapMarker &&
                  snapMarker.point && (
                    <g
                      pointerEvents="none"
                    >
                      {snapMarker.type ===
                        'Endpoint' && (
                        <rect
                          x={
                            snapMarker.point.x -
                            5 /
                            geometryScale
                          }
                          y={
                            snapMarker.point.y -
                            5 /
                            geometryScale
                          }
                          width={
                            10 /
                            geometryScale
                          }
                          height={
                            10 /
                            geometryScale
                          }
                          fill="rgba(255,255,255,0.90)"
                          stroke="#06b6d4"
                          strokeWidth="2"
                          vectorEffect="non-scaling-stroke"
                        />
                      )}


                      {snapMarker.type ===
                        'Midpoint' && (
                        <polygon
                          points={`${snapMarker.point.x},${snapMarker.point.y - 6 / geometryScale} ${snapMarker.point.x + 6 / geometryScale},${snapMarker.point.y + 5 / geometryScale} ${snapMarker.point.x - 6 / geometryScale},${snapMarker.point.y + 5 / geometryScale}`}
                          fill="rgba(255,255,255,0.90)"
                          stroke="#06b6d4"
                          strokeWidth="2"
                          vectorEffect="non-scaling-stroke"
                        />
                      )}


                      {snapMarker.type ===
                        'Intersection' && (
                        <>
                          <line
                            x1={
                              snapMarker.point.x -
                              6 /
                              geometryScale
                            }
                            y1={
                              snapMarker.point.y -
                              6 /
                              geometryScale
                            }
                            x2={
                              snapMarker.point.x +
                              6 /
                              geometryScale
                            }
                            y2={
                              snapMarker.point.y +
                              6 /
                              geometryScale
                            }
                            stroke="#06b6d4"
                            strokeWidth="2.5"
                            vectorEffect="non-scaling-stroke"
                          />

                          <line
                            x1={
                              snapMarker.point.x +
                              6 /
                              geometryScale
                            }
                            y1={
                              snapMarker.point.y -
                              6 /
                              geometryScale
                            }
                            x2={
                              snapMarker.point.x -
                              6 /
                              geometryScale
                            }
                            y2={
                              snapMarker.point.y +
                              6 /
                              geometryScale
                            }
                            stroke="#06b6d4"
                            strokeWidth="2.5"
                            vectorEffect="non-scaling-stroke"
                          />
                        </>
                      )}


                      {snapMarker.type ===
                        'Nearest' && (
                        <rect
                          x={
                            snapMarker.point.x -
                            4.5 /
                            geometryScale
                          }
                          y={
                            snapMarker.point.y -
                            4.5 /
                            geometryScale
                          }
                          width={
                            9 /
                            geometryScale
                          }
                          height={
                            9 /
                            geometryScale
                          }
                          transform={`rotate(45 ${snapMarker.point.x} ${snapMarker.point.y})`}
                          fill="rgba(255,255,255,0.90)"
                          stroke="#06b6d4"
                          strokeWidth="2"
                          vectorEffect="non-scaling-stroke"
                        />
                      )}


                      <text
                        x={
                          snapMarker.point.x +
                          10 /
                          geometryScale
                        }
                        y={
                          snapMarker.point.y -
                          10 /
                          geometryScale
                        }
                        fill="#0891b2"
                        fontSize={
                          10 /
                          geometryScale
                        }
                        fontWeight="900"
                        stroke="#ffffff"
                        strokeWidth={
                          3 /
                          geometryScale
                        }
                        paintOrder="stroke"
                      >
                        {
                          snapMarker.source ===
                            'pdf'
                            ? `${snapMarker.type} · Drawing`
                            : snapMarker.type
                        }
                      </text>
                    </g>
                  )}


                {/* ============================================
                    ORTHO TRACKING
                ============================================ */}

                {orthoEnabled &&
                  orthoTracking &&
                  orthoTracking.anchorPoint &&
                  orthoTracking.point && (
                    <line
                      x1={
                        orthoTracking.anchorPoint.x
                      }
                      y1={
                        orthoTracking.anchorPoint.y
                      }
                      x2={
                        orthoTracking.point.x
                      }
                      y2={
                        orthoTracking.point.y
                      }
                      stroke="#0ea5e9"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                      opacity="0.8"
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                  )}


                {/* ============================================
                    CALIBRATION DRAFT
                ============================================ */}

                {activeTool ===
                  'calibrate' &&
                  calibrationDraft.point1 &&
                  calibrationPreviewEnd && (
                    <line
                      x1={
                        calibrationDraft.point1.x
                      }
                      y1={
                        calibrationDraft.point1.y
                      }
                      x2={
                        calibrationPreviewEnd.x
                      }
                      y2={
                        calibrationPreviewEnd.y
                      }
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeDasharray="7 5"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}


                {/* ============================================
                    DISTANCE DRAFT
                ============================================ */}

                {activeTool ===
                  'distance' &&
                  distanceDraft.point1 &&
                  distanceDraft.previewPoint &&
                  currentCalibration && (
                    <line
                      x1={
                        distanceDraft.point1.x
                      }
                      y1={
                        distanceDraft.point1.y
                      }
                      x2={
                        distanceDraft.previewPoint.x
                      }
                      y2={
                        distanceDraft.previewPoint.y
                      }
                      stroke="#2563eb"
                      strokeWidth="2"
                      strokeDasharray="6 4"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}


                {/* ============================================
                    LINEAR DRAFT
                ============================================ */}

                {activeTool ===
                  'line' &&
                  lineDraft.point1 &&
                  lineDraft.previewPoint &&
                  currentCalibration && (
                    <line
                      x1={
                        lineDraft.point1.x
                      }
                      y1={
                        lineDraft.point1.y
                      }
                      x2={
                        lineDraft.previewPoint.x
                      }
                      y2={
                        lineDraft.previewPoint.y
                      }
                      stroke="#7c3aed"
                      strokeWidth="3"
                      strokeDasharray="6 4"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}


                {/* ============================================
                    POLYLINE DRAFT
                ============================================ */}

                {activeTool ===
                  'polyline' &&
                  previewPolylinePoints.length >=
                    2 &&
                  currentCalibration && (
                    <polyline
                      points={
                        previewPolylinePoints
                          .map(
                            (point) =>
                              `${point.x},${point.y}`
                          )
                          .join(' ')
                      }
                      fill="none"
                      stroke="#ea580c"
                      strokeWidth="3"
                      strokeDasharray="6 4"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}


                {/* ============================================
                    AREA DRAFT
                ============================================ */}

                {activeTool ===
                  'area' &&
                  previewAreaPoints.length >=
                    2 &&
                  currentCalibration && (
                    <polygon
                      points={
                        previewAreaPoints
                          .map(
                            (point) =>
                              `${point.x},${point.y}`
                          )
                          .join(' ')
                      }
                      fill={
                        previewAreaPoints.length >=
                          3
                          ? 'rgba(20, 184, 166, 0.12)'
                          : 'none'
                      }
                      stroke="#0f9f91"
                      strokeWidth="3"
                      strokeDasharray="6 4"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}


                {/* ============================================
                    RECTANGLE DRAFT
                ============================================ */}

                {activeTool ===
                  'rectangle' &&
                  rectangleDraft.point1 &&
                  rectangleDraft.previewPoint &&
                  currentCalibration && (
                    <rect
                      x={
                        Math.min(
                          rectangleDraft.point1.x,
                          rectangleDraft.previewPoint.x
                        )
                      }
                      y={
                        Math.min(
                          rectangleDraft.point1.y,
                          rectangleDraft.previewPoint.y
                        )
                      }
                      width={
                        Math.abs(
                          rectangleDraft.previewPoint.x -
                          rectangleDraft.point1.x
                        )
                      }
                      height={
                        Math.abs(
                          rectangleDraft.previewPoint.y -
                          rectangleDraft.point1.y
                        )
                      }
                      fill="rgba(37, 99, 235, 0.10)"
                      stroke="#1d4ed8"
                      strokeWidth="3"
                      strokeDasharray="6 4"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}


                {/* ============================================
                    COUNT DRAFT
                ============================================ */}

                {activeTool ===
                  'count' &&
                  countDraft.points.map(
                    (
                      point,
                      index
                    ) => (
                      <g
                        key={`count-draft-${index}`}
                      >
                        <circle
                          cx={
                            point.x
                          }
                          cy={
                            point.y
                          }
                          r={
                            11 /
                            geometryScale
                          }
                          fill="#dc2626"
                          stroke="#fef2f2"
                          strokeWidth="3"
                          vectorEffect="non-scaling-stroke"
                        />

                        <text
                          x={
                            point.x
                          }
                          y={
                            point.y
                          }
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="#ffffff"
                          fontSize={
                            9 /
                            geometryScale
                          }
                          fontWeight="900"
                        >
                          {
                            index +
                            1
                          }
                        </text>
                      </g>
                    )
                  )}

              </svg>


              <div
                className={
                  styles.interactionLayer
                }
              />

            </div>
          )}


          {/* ==================================================
              COMMAND PROMPT
          ================================================== */}

          {commandInstruction && (
            <div
              style={{
                position:
                  'absolute',
                left:
                  '50%',
                bottom:
                  18,
                transform:
                  'translateX(-50%)',
                zIndex:
                  40,
                display:
                  'flex',
                alignItems:
                  'center',
                gap:
                  10,
                padding:
                  '9px 14px',
                borderRadius:
                  7,
                background:
                  'rgba(5, 44, 73, 0.94)',
                color:
                  '#ffffff',
                boxShadow:
                  '0 8px 24px rgba(0,0,0,0.18)',
                fontSize:
                  12,
                pointerEvents:
                  'none',
                whiteSpace:
                  'nowrap',
              }}
            >
              <strong>
                {
                  commandName
                }
              </strong>

              <span
                style={{
                  opacity:
                    0.85,
                }}
              >
                {
                  commandInstruction
                }
              </span>


              {liveLength !==
                null &&
                currentCalibration && (
                <strong
                  style={{
                    color:
                      '#7dd3fc',
                  }}
                >
                  {
                    formatNumber(
                      liveLength
                    )
                  } {
                    currentCalibration.displayUnit
                  }
                </strong>
              )}


              {liveArea !==
                null &&
                currentCalibration && (
                <strong
                  style={{
                    color:
                      '#5eead4',
                  }}
                >
                  {
                    formatNumber(
                      liveArea
                    )
                  } {
                    areaUnit
                  }
                </strong>
              )}


              {activeTool ===
                'count' && (
                <strong
                  style={{
                    color:
                      '#fca5a5',
                  }}
                >
                  {
                    countDraft.points.length
                  } ea
                </strong>
              )}


              <span
                style={{
                  opacity:
                    0.55,
                }}
              >
                Esc to cancel
              </span>
            </div>
          )}


          {/* ==================================================
              DRAWINGS DRAWER
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

                {!workspaceReady && (
                  <div
                    className={
                      styles.drawerEmpty
                    }
                  >
                    No drawing loaded.
                  </div>
                )}


                {documentMode ===
                  'native' && (
                  <div
                    className={
                      styles.drawingCard
                    }
                  >
                    <Icon
                      type="rectangle"
                    />

                    <div>
                      <strong>
                        {
                          nativeDrawingName ||
                          'Untitled Drawing'
                        }
                      </strong>

                      <span>
                        Native RitsuCAD drawing
                      </span>
                    </div>
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

                  {/* ==========================================
                      CALIBRATION
                  ========================================== */}

                  {activeTool ===
                    'calibrate' && (
                    <section
                      className={
                        styles.propertySection
                      }
                    >
                      <h3>
                        Scale Calibration
                      </h3>

                      <div
                        style={{
                          marginBottom:
                            12,
                          padding:
                            '10px 11px',
                          border:
                            '1px solid #d8e1e8',
                          borderRadius:
                            6,
                          background:
                            '#f8fafc',
                          color:
                            '#334155',
                          fontSize:
                            12,
                          lineHeight:
                            1.45,
                        }}
                      >
                        {
                          commandInstruction
                        }
                      </div>


                      <div
                        className={
                          styles.propertyRow
                        }
                      >
                        <span>
                          Point 1
                        </span>

                        <strong>
                          {
                            calibrationDraft.point1
                              ? `${formatNumber(
                                  calibrationDraft.point1.x
                                )}, ${formatNumber(
                                  calibrationDraft.point1.y
                                )}`
                              : 'Waiting'
                          }
                        </strong>
                      </div>


                      <div
                        className={
                          styles.propertyRow
                        }
                      >
                        <span>
                          Point 2
                        </span>

                        <strong>
                          {
                            calibrationDraft.point2
                              ? `${formatNumber(
                                  calibrationDraft.point2.x
                                )}, ${formatNumber(
                                  calibrationDraft.point2.y
                                )}`
                              : 'Waiting'
                          }
                        </strong>
                      </div>


                      {calibrationWaitingForDistance && (
                        <div
                          style={{
                            display:
                              'grid',
                            gap:
                              10,
                            marginTop:
                              14,
                          }}
                        >
                          <label
                            style={{
                              display:
                                'grid',
                              gap:
                                5,
                              fontSize:
                                12,
                              color:
                                '#475569',
                            }}
                          >
                            Known distance

                            <input
                              type="number"
                              min="0"
                              step="any"
                              autoFocus
                              value={
                                calibrationDistance
                              }
                              onChange={(
                                event
                              ) => {
                                setCalibrationDistance(
                                  event.target.value
                                )

                                setCalibrationError(
                                  null
                                )
                              }}
                              onKeyDown={(
                                event
                              ) => {
                                if (
                                  event.key ===
                                  'Enter'
                                ) {
                                  saveCalibration()
                                }
                              }}
                              placeholder="Enter distance"
                              style={{
                                width:
                                  '100%',
                                boxSizing:
                                  'border-box',
                                height:
                                  36,
                                border:
                                  '1px solid #cbd5e1',
                                borderRadius:
                                  5,
                                padding:
                                  '0 10px',
                                background:
                                  '#ffffff',
                                color:
                                  '#0f172a',
                                outline:
                                  'none',
                              }}
                            />
                          </label>


                          <label
                            style={{
                              display:
                                'grid',
                              gap:
                                5,
                              fontSize:
                                12,
                              color:
                                '#475569',
                            }}
                          >
                            Unit

                            <select
                              value={
                                calibrationUnit
                              }
                              onChange={(
                                event
                              ) => {
                                setCalibrationUnit(
                                  event.target.value
                                )

                                setCalibrationError(
                                  null
                                )
                              }}
                              style={{
                                width:
                                  '100%',
                                boxSizing:
                                  'border-box',
                                height:
                                  36,
                                border:
                                  '1px solid #cbd5e1',
                                borderRadius:
                                  5,
                                padding:
                                  '0 10px',
                                background:
                                  '#ffffff',
                                color:
                                  '#0f172a',
                              }}
                            >
                              {Object.entries(
                                UNIT_LABELS
                              ).map(
                                ([
                                  value,
                                  label,
                                ]) => (
                                  <option
                                    key={
                                      value
                                    }
                                    value={
                                      value
                                    }
                                  >
                                    {label} ({value})
                                  </option>
                                )
                              )}
                            </select>
                          </label>


                          {calibrationError && (
                            <div
                              style={{
                                padding:
                                  '8px 10px',
                                borderRadius:
                                  5,
                                background:
                                  '#fef2f2',
                                color:
                                  '#b91c1c',
                                fontSize:
                                  12,
                              }}
                            >
                              {
                                calibrationError
                              }
                            </div>
                          )}


                          <div
                            style={{
                              display:
                                'grid',
                              gridTemplateColumns:
                                '1fr 1fr',
                              gap:
                                8,
                            }}
                          >
                            <button
                              type="button"
                              onClick={
                                cancelCalibration
                              }
                            >
                              Cancel
                            </button>

                            <button
                              type="button"
                              onClick={
                                saveCalibration
                              }
                            >
                              Save Scale
                            </button>
                          </div>

                        </div>
                      )}

                    </section>
                  )}


                  {/* ==========================================
                      COUNT TOOL
                  ========================================== */}

                  {activeTool ===
                    'count' && (
                    <section
                      className={
                        styles.propertySection
                      }
                    >

                      <h3>
                        Count Takeoff
                      </h3>


                      <div
                        style={{
                          padding:
                            '10px 11px',
                          border:
                            '1px solid #d8e1e8',
                          borderRadius:
                            6,
                          background:
                            '#f8fafc',
                          color:
                            '#334155',
                          fontSize:
                            12,
                          lineHeight:
                            1.45,
                        }}
                      >
                        {
                          commandInstruction
                        }
                      </div>


                      <div
                        className={
                          styles.propertyRow
                        }
                      >
                        <span>
                          Current group
                        </span>

                        <strong>
                          {
                            countDraft.points.length
                          } ea
                        </strong>
                      </div>


                      <div
                        className={
                          styles.propertyRow
                        }
                      >
                        <span>
                          Saved groups
                        </span>

                        <strong>
                          {
                            currentPageCounts.length
                          }
                        </strong>
                      </div>


                      <div
                        className={
                          styles.propertyRow
                        }
                      >
                        <span>
                          Saved quantity
                        </span>

                        <strong>
                          {
                            pageCountQuantity
                          } ea
                        </strong>
                      </div>


                      {countDraft.points.length >
                        0 && (
                        <button
                          type="button"
                          onClick={
                            finishCount
                          }
                        >
                          Finish Count Group
                        </button>
                      )}

                    </section>
                  )}


                  {/* ==========================================
                      ACTIVE TOOL
                  ========================================== */}

                  {[
                    'distance',
                    'line',
                    'polyline',
                    'area',
                    'rectangle',
                  ].includes(
                    activeTool
                  ) && (
                    <section
                      className={
                        styles.propertySection
                      }
                    >

                      <h3>
                        {
                          activeTool ===
                            'distance'
                            ? 'Distance'
                            : activeTool ===
                                'line'
                              ? 'Linear Takeoff'
                              : activeTool ===
                                  'polyline'
                                ? 'Polyline Takeoff'
                                : activeTool ===
                                    'area'
                                  ? 'Area Takeoff'
                                  : 'Rectangle Takeoff'
                        }
                      </h3>


                      <div
                        style={{
                          padding:
                            '10px 11px',
                          border:
                            '1px solid #d8e1e8',
                          borderRadius:
                            6,
                          background:
                            currentCalibration
                              ? '#f8fafc'
                              : '#fff7ed',
                          color:
                            currentCalibration
                              ? '#334155'
                              : '#9a3412',
                          fontSize:
                            12,
                          lineHeight:
                            1.45,
                        }}
                      >
                        {
                          commandInstruction
                        }
                      </div>


                      {activeTool ===
                        'polyline' &&
                        currentCalibration && (
                        <>
                          <div
                            className={
                              styles.propertyRow
                            }
                          >
                            <span>
                              Vertices
                            </span>

                            <strong>
                              {
                                polylineDraft.points.length
                              }
                            </strong>
                          </div>

                          <div
                            className={
                              styles.propertyRow
                            }
                          >
                            <span>
                              Live length
                            </span>

                            <strong>
                              {
                                previewPolyline !==
                                  null
                                  ? `${formatNumber(
                                      previewPolyline
                                    )} ${currentCalibration.displayUnit}`
                                  : '—'
                              }
                            </strong>
                          </div>

                          {polylineDraft.points.length >=
                            2 && (
                            <button
                              type="button"
                              onClick={
                                finishPolyline
                              }
                            >
                              Finish Polyline
                            </button>
                          )}
                        </>
                      )}


                      {activeTool ===
                        'area' &&
                        currentCalibration && (
                        <>
                          <div
                            className={
                              styles.propertyRow
                            }
                          >
                            <span>
                              Vertices
                            </span>

                            <strong>
                              {
                                areaDraft.points.length
                              }
                            </strong>
                          </div>

                          <div
                            className={
                              styles.propertyRow
                            }
                          >
                            <span>
                              Live area
                            </span>

                            <strong>
                              {
                                previewArea !==
                                  null
                                  ? `${formatNumber(
                                      previewArea
                                    )} ${areaUnit}`
                                  : '—'
                              }
                            </strong>
                          </div>

                          {areaDraft.points.length >=
                            3 && (
                            <button
                              type="button"
                              onClick={
                                finishArea
                              }
                            >
                              Finish Area
                            </button>
                          )}
                        </>
                      )}


                      {activeTool ===
                        'rectangle' &&
                        previewRectangleDimensions &&
                        currentCalibration && (
                        <>
                          <div
                            className={
                              styles.propertyRow
                            }
                          >
                            <span>
                              Width
                            </span>

                            <strong>
                              {
                                formatNumber(
                                  previewRectangleDimensions.width
                                )
                              } {
                                currentCalibration.displayUnit
                              }
                            </strong>
                          </div>

                          <div
                            className={
                              styles.propertyRow
                            }
                          >
                            <span>
                              Height
                            </span>

                            <strong>
                              {
                                formatNumber(
                                  previewRectangleDimensions.height
                                )
                              } {
                                currentCalibration.displayUnit
                              }
                            </strong>
                          </div>

                          <div
                            className={
                              styles.propertyRow
                            }
                          >
                            <span>
                              Area
                            </span>

                            <strong>
                              {
                                previewRectangleArea !==
                                  null
                                  ? `${formatNumber(
                                      previewRectangleArea
                                    )} ${areaUnit}`
                                  : '—'
                              }
                            </strong>
                          </div>
                        </>
                      )}


                      {!currentCalibration && (
                        <button
                          type="button"
                          onClick={
                            startCalibration
                          }
                        >
                          Calibrate Page
                        </button>
                      )}

                    </section>
                  )}


                  {/* ==========================================
                      DRAWING
                  ========================================== */}

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
                            ? drawingGeometryStatusLabel(
                                currentDrawingGeometry
                              )
                            : '—'
                        }
                      </strong>
                    </div>
                  </section>


                  {/* ==========================================
                      VIEW
                  ========================================== */}

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


                  {/* ==========================================
                      SCALE
                  ========================================== */}

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
                        {
                          currentCalibration
                            ? 'Calibrated'
                            : 'Not calibrated'
                        }
                      </strong>
                    </div>

                    <div
                      className={
                        styles.propertyRow
                      }
                    >
                      <span>
                        Linear unit
                      </span>

                      <strong>
                        {
                          currentCalibration
                            ? currentCalibration.displayUnit
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
                        Area unit
                      </span>

                      <strong>
                        {
                          currentCalibration
                            ? areaUnit
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
                        Reference
                      </span>

                      <strong>
                        {
                          currentCalibration
                            ? `${formatNumber(
                                currentCalibration.referenceDistance
                              )} ${currentCalibration.displayUnit}`
                            : '—'
                        }
                      </strong>
                    </div>

                    {currentCalibration && (
                      <button
                        type="button"
                        onClick={
                          startCalibration
                        }
                      >
                        Recalibrate Page
                      </button>
                    )}
                  </section>


                  {/* ==========================================
                      TAKEOFF SUMMARY
                  ========================================== */}

                  <section
                    className={
                      styles.propertySection
                    }
                  >
                    <h3>
                      Takeoff
                    </h3>

                    <div
                      className={
                        styles.propertyRow
                      }
                    >
                      <span>
                        Distances
                      </span>

                      <strong>
                        {
                          currentPageDistances.length
                        }
                      </strong>
                    </div>

                    <div
                      className={
                        styles.propertyRow
                      }
                    >
                      <span>
                        Linear
                      </span>

                      <strong>
                        {
                          currentPageLinears.length
                        }
                      </strong>
                    </div>

                    <div
                      className={
                        styles.propertyRow
                      }
                    >
                      <span>
                        Polylines
                      </span>

                      <strong>
                        {
                          currentPagePolylines.length
                        }
                      </strong>
                    </div>

                    <div
                      className={
                        styles.propertyRow
                      }
                    >
                      <span>
                        Areas
                      </span>

                      <strong>
                        {
                          currentPageAreas.length
                        }
                      </strong>
                    </div>

                    <div
                      className={
                        styles.propertyRow
                      }
                    >
                      <span>
                        Rectangles
                      </span>

                      <strong>
                        {
                          currentPageRectangles.length
                        }
                      </strong>
                    </div>


                    <div
                      className={
                        styles.propertyRow
                      }
                    >
                      <span>
                        Count groups
                      </span>

                      <strong>
                        {
                          currentPageCounts.length
                        }
                      </strong>
                    </div>


                    <div
                      className={
                        styles.propertyRow
                      }
                    >
                      <span>
                        Count quantity
                      </span>

                      <strong>
                        {
                          pageCountQuantity
                        } ea
                      </strong>
                    </div>


                    <div
                      className={
                        styles.propertyRow
                      }
                    >
                      <span>
                        Latest area
                      </span>

                      <strong>
                        {
                          latestArea &&
                          currentCalibration
                            ? `${formatNumber(
                                realPolygonArea(
                                  latestArea.points,
                                  currentCalibration
                                )
                              )} ${areaUnit}`
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
                        Latest rectangle
                      </span>

                      <strong>
                        {
                          latestRectangle &&
                          currentCalibration
                            ? `${formatNumber(
                                realRectangleArea(
                                  latestRectangle.points[0],
                                  latestRectangle.points[1],
                                  currentCalibration
                                )
                              )} ${areaUnit}`
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
                        Latest linear
                      </span>

                      <strong>
                        {
                          latestLinear &&
                          currentCalibration
                            ? `${formatNumber(
                                realDistanceFromPoints(
                                  latestLinear.points[0],
                                  latestLinear.points[1],
                                  currentCalibration
                                )
                              )} ${currentCalibration.displayUnit}`
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
                        Latest polyline
                      </span>

                      <strong>
                        {
                          latestPolyline &&
                          currentCalibration
                            ? `${formatNumber(
                                realPolylineLength(
                                  latestPolyline.points,
                                  currentCalibration
                                )
                              )} ${currentCalibration.displayUnit}`
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
                        Latest distance
                      </span>

                      <strong>
                        {
                          latestDistance &&
                          currentCalibration
                            ? `${formatNumber(
                                realDistanceFromPoints(
                                  latestDistance.points[0],
                                  latestDistance.points[1],
                                  currentCalibration
                                )
                              )} ${currentCalibration.displayUnit}`
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
                        Latest count
                      </span>

                      <strong>
                        {
                          latestCount
                            ? `${latestCount.points.length} ea`
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
                      Selection
                    </h3>

                    {!selectedEntity && (
                      <div
                        className={
                          styles.selectionEmpty
                        }
                      >
                        Select RitsuCAD geometry to inspect
                        and edit its properties.
                      </div>
                    )}


                    {selectedEntity && (
                      <>
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
                              selectedEntityLabel
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
                              selectedEntity.pageNumber
                            }
                          </strong>
                        </div>


                        <div
                          className={
                            styles.propertyRow
                          }
                        >
                          <span>
                            Points
                          </span>

                          <strong>
                            {
                              selectedEntity.points.length
                            }
                          </strong>
                        </div>


                        <div
                          className={
                            styles.propertyRow
                          }
                        >
                          <span>
                            Quantity
                          </span>

                          <strong>
                            {
                              selectedEntityQuantity !==
                                null
                                ? `${formatNumber(
                                    selectedEntityQuantity,
                                    selectedEntity.type ===
                                      'count'
                                      ? 0
                                      : 2
                                  )} ${selectedEntityUnit}`
                                : selectedEntity.category ===
                                    'drawing'
                                  ? '—'
                                  : 'Unscaled'
                            }
                          </strong>
                        </div>


                        <button
                          type="button"
                          onClick={
                            deleteSelectedEntity
                          }
                        >
                          Delete Selected
                        </button>
                      </>
                    )}
                  </section>

                </>
              )}


              {/* ==============================================
                  LAYERS
              ============================================== */}

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
                      Native drawing geometry and measurement geometry are kept as separate RitsuCAD entity classes.
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
                        {
                          documentMode ===
                            'pdf'
                            ? 'PDF Reference'
                            : 'Native Drawing'
                        }
                      </span>

                      <strong>
                        Visible
                      </strong>
                    </div>
                  </section>


                  {currentPageNativeEntities.length >
                    0 && (
                    <section
                      className={
                        styles.propertySection
                      }
                    >
                      <h3>
                        CAD Geometry
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
                          Native Geometry
                        </span>

                        <strong>
                          {
                            currentPageNativeEntities.length
                          }
                        </strong>
                      </div>
                    </section>
                  )}


                  {[
                    [
                      'Distance',
                      currentPageDistances.length,
                    ],
                    [
                      'Linear',
                      currentPageLinears.length,
                    ],
                    [
                      'Polyline',
                      currentPagePolylines.length,
                    ],
                    [
                      'Area',
                      currentPageAreas.length,
                    ],
                    [
                      'Rectangle',
                      currentPageRectangles.length,
                    ],
                    [
                      'Count',
                      currentPageCounts.length,
                    ],
                  ]
                    .filter(
                      (
                        [
                          ,
                          count,
                        ]
                      ) =>
                        count >
                        0
                    )
                    .map(
                      ([
                        label,
                        count,
                      ]) => (
                        <section
                          key={
                            label
                          }
                          className={
                            styles.propertySection
                          }
                        >
                          <h3>
                            {
                              label
                            }
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
                              {
                                label
                              } Takeoff
                            </span>

                            <strong>
                              {
                                count
                              }
                            </strong>
                          </div>
                        </section>
                      )
                    )}

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
                (current) =>
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
                (current) =>
                  !current
              )
            }
            title="Object Snap (F3)"
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
                (current) =>
                  !current
              )
            }
            title="Ortho (F8)"
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
                (current) =>
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
              selectedEntityId
                ? styles.railButtonActive
                : styles.railButton
            }
            onClick={
              deleteSelectedEntity
            }
            disabled={
              !selectedEntityId
            }
            title="Delete selected geometry (Delete)"
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


          {selectedEntity && (
            <>
              <span>
                Selected

                <strong>
                  {
                    selectedEntityLabel
                  }
                </strong>
              </span>

              <span
                className={
                  styles.statusDivider
                }
              />
            </>
          )}


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


          {snapMarker && (
            <>
              <span
                className={
                  styles.statusDivider
                }
              />

              <span>
                Snap

                <strong>
                  {
                    snapMarker.source ===
                      'pdf'
                      ? `${snapMarker.type} · Drawing`
                      : snapMarker.type
                  }
                </strong>
              </span>
            </>
          )}


          {orthoTracking && (
            <>
              <span
                className={
                  styles.statusDivider
                }
              />

              <span>
                Ortho

                <strong>
                  {
                    orthoTracking.axis
                  }
                </strong>
              </span>
            </>
          )}


          {commandInstruction && (
            <>
              <span
                className={
                  styles.statusDivider
                }
              />

              <span>
                Command

                <strong>
                  {
                    commandInstruction
                  }
                </strong>
              </span>
            </>
          )}


          {liveLength !==
            null &&
            currentCalibration && (
            <>
              <span
                className={
                  styles.statusDivider
                }
              />

              <span>
                Length

                <strong>
                  {
                    formatNumber(
                      liveLength
                    )
                  } {
                    currentCalibration.displayUnit
                  }
                </strong>
              </span>
            </>
          )}


          {liveArea !==
            null &&
            currentCalibration && (
            <>
              <span
                className={
                  styles.statusDivider
                }
              />

              <span>
                Area

                <strong>
                  {
                    formatNumber(
                      liveArea
                    )
                  } {
                    areaUnit
                  }
                </strong>
              </span>
            </>
          )}


          {activeTool ===
            'count' && (
            <>
              <span
                className={
                  styles.statusDivider
                }
              />

              <span>
                Count

                <strong>
                  {
                    countDraft.points.length
                  } ea
                </strong>
              </span>
            </>
          )}

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
                (current) =>
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
                (current) =>
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
                (current) =>
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
            Geometry

            <strong>
              {
                pdfDocument
                  ? drawingGeometryStatusLabel(
                      currentDrawingGeometry
                    )
                  : '—'
              }
            </strong>
          </span>


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
              {
                scaleHeaderLabel
              }
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
