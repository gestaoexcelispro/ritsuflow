'use client'

import {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  createClient,
} from '../../../../lib/supabase/client'


const NAVY = '#052c49'
const TEAL = '#00998b'
const TEXT = '#263c4d'
const MUTED = '#6b7d8d'
const BORDER = '#dce5ed'
const DANGER = '#b42318'


function moveItem(
  items,
  sourceId,
  targetId
) {
  const sourceIndex =
    items.findIndex(
      (item) =>
        item.id === sourceId
    )

  const targetIndex =
    items.findIndex(
      (item) =>
        item.id === targetId
    )

  if (
    sourceIndex < 0 ||
    targetIndex < 0 ||
    sourceIndex === targetIndex
  ) {
    return items
  }

  const next = [...items]
  const [moved] =
    next.splice(sourceIndex, 1)

  next.splice(
    targetIndex,
    0,
    moved
  )

  return next.map(
    (item, index) => ({
      ...item,
      sequence: index + 1,
    })
  )
}


export default function ActivityPreSequence({
  projectId,
  initialItems,
}) {
  const [items, setItems] =
    useState(initialItems || [])

  const [draggedId, setDraggedId] =
    useState(null)

  const [overId, setOverId] =
    useState(null)

  const [saveState, setSaveState] =
    useState('idle')

  const [errorMessage, setErrorMessage] =
    useState('')

  const latestItemsRef =
    useRef(items)

  const saveVersionRef =
    useRef(0)

  useEffect(
    () => {
      setItems(initialItems || [])
      latestItemsRef.current =
        initialItems || []
    },
    [initialItems]
  )

  async function persistOrder(
    orderedItems
  ) {
    const version =
      saveVersionRef.current + 1

    saveVersionRef.current =
      version

    setSaveState('saving')
    setErrorMessage('')

    const supabase =
      createClient()

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await supabase.auth.getUser()

    if (
      userError ||
      !user
    ) {
      if (
        version ===
        saveVersionRef.current
      ) {
        setSaveState('error')
        setErrorMessage(
          'Authentication is required to save the sequence.'
        )
      }

      return
    }

    const payload =
      orderedItems.map(
        (item, index) => ({
          project_id: projectId,
          project_work_package_id:
            item.id,
          pre_sequence_number:
            index + 1,
          created_by: user.id,
          updated_at:
            new Date().toISOString(),
        })
      )

    const {
      error,
    } =
      await supabase
        .from(
          'project_activity_pre_sequence'
        )
        .upsert(
          payload,
          {
            onConflict:
              'project_id,project_work_package_id',
          }
        )

    if (
      version !==
      saveVersionRef.current
    ) {
      return
    }

    if (error) {
      setSaveState('error')
      setErrorMessage(
        error.message ||
        'The activity sequence could not be saved.'
      )
      return
    }

    setSaveState('saved')

    window.setTimeout(
      () => {
        if (
          version ===
          saveVersionRef.current
        ) {
          setSaveState('idle')
        }
      },
      1400
    )
  }


  function handleDragStart(
    event,
    itemId
  ) {
    setDraggedId(itemId)
    setOverId(itemId)

    event.dataTransfer.effectAllowed =
      'move'

    event.dataTransfer.setData(
      'text/plain',
      itemId
    )
  }


  function handleDragOver(
    event,
    targetId
  ) {
    event.preventDefault()

    event.dataTransfer.dropEffect =
      'move'

    setOverId(targetId)
  }


  function handleDrop(
    event,
    targetId
  ) {
    event.preventDefault()

    const sourceId =
      draggedId ||
      event.dataTransfer.getData(
        'text/plain'
      )

    if (!sourceId) {
      return
    }

    const nextItems =
      moveItem(
        latestItemsRef.current,
        sourceId,
        targetId
      )

    latestItemsRef.current =
      nextItems

    setItems(nextItems)
    setDraggedId(null)
    setOverId(null)

    void persistOrder(
      nextItems
    )
  }


  function handleDragEnd() {
    setDraggedId(null)
    setOverId(null)
  }


  if (items.length === 0) {
    return (
      <div
        style={{
          padding: '22px',
          color: MUTED,
          fontSize: '13px',
        }}
      >
        No active Work Packages are available for sequencing.
      </div>
    )
  }


  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent:
            'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          padding: '12px 16px',
          borderBottom:
            `1px solid ${BORDER}`,
          background: '#f0fdfa',
        }}
      >
        <div
          style={{
            color: '#135e56',
            fontSize: '12px',
            lineHeight: 1.5,
          }}
        >
          <strong>
            Drag to define flow:
          </strong>{' '}
          hold the handle, move the activity to its new position, and release.
        </div>

        <div
          aria-live="polite"
          style={{
            minHeight: '18px',
            color:
              saveState === 'error'
                ? DANGER
                : saveState === 'saved'
                  ? TEAL
                  : MUTED,
            fontSize: '11px',
            fontWeight: 800,
          }}
        >
          {saveState === 'saving'
            ? 'Saving sequence…'
            : saveState === 'saved'
              ? 'Sequence saved'
              : saveState === 'error'
                ? 'Save failed'
                : 'Autosave enabled'}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gap: '7px',
          padding: '14px',
          background: '#fbfcfd',
        }}
      >
        {items.map(
          (item, index) => {
            const isDragging =
              draggedId === item.id

            const isOver =
              overId === item.id &&
              draggedId !== item.id

            return (
              <div
                key={item.id}
                onDragOver={
                  (event) =>
                    handleDragOver(
                      event,
                      item.id
                    )
                }
                onDrop={
                  (event) =>
                    handleDrop(
                      event,
                      item.id
                    )
                }
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    '44px 52px 76px minmax(0, 1fr)',
                  alignItems: 'center',
                  minHeight: '54px',
                  border:
                    isOver
                      ? `2px solid ${TEAL}`
                      : `1px solid ${BORDER}`,
                  borderRadius: '9px',
                  background:
                    isDragging
                      ? '#eef3f6'
                      : '#ffffff',
                  opacity:
                    isDragging
                      ? 0.55
                      : 1,
                  boxShadow:
                    isOver
                      ? '0 0 0 2px rgba(0, 153, 139, 0.08)'
                      : 'none',
                  transition:
                    'border-color 120ms ease, opacity 120ms ease, box-shadow 120ms ease',
                }}
              >
                <div
                  draggable
                  onDragStart={
                    (event) =>
                      handleDragStart(
                        event,
                        item.id
                      )
                  }
                  onDragEnd={
                    handleDragEnd
                  }
                  title="Hold and drag"
                  aria-label={`Drag ${item.code} ${item.description}`}
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    alignSelf: 'stretch',
                    borderRight:
                      `1px solid ${BORDER}`,
                    color: MUTED,
                    fontSize: '20px',
                    fontWeight: 900,
                    cursor: isDragging
                      ? 'grabbing'
                      : 'grab',
                    userSelect: 'none',
                  }}
                >
                  ☰
                </div>

                <div
                  style={{
                    color: '#94a3b8',
                    fontSize: '12px',
                    fontWeight: 900,
                    textAlign: 'center',
                    fontVariantNumeric:
                      'tabular-nums',
                  }}
                >
                  {String(
                    index + 1
                  ).padStart(2, '0')}
                </div>

                <div
                  style={{
                    color: TEAL,
                    fontSize: '12px',
                    fontWeight: 900,
                  }}
                >
                  {item.code}
                </div>

                <div
                  style={{
                    minWidth: 0,
                    padding: '0 14px 0 0',
                    color: TEXT,
                    fontSize: '12px',
                    fontWeight: 800,
                    overflow: 'hidden',
                    textOverflow:
                      'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.description}
                </div>
              </div>
            )
          }
        )}
      </div>

      {errorMessage && (
        <div
          style={{
            padding: '10px 16px',
            borderTop:
              `1px solid ${BORDER}`,
            background: '#fef2f2',
            color: DANGER,
            fontSize: '11px',
            fontWeight: 700,
          }}
        >
          {errorMessage}
        </div>
      )}
    </div>
  )
}
