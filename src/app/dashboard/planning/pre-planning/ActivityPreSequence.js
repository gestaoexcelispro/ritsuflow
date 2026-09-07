'use client'

import {
  useEffect,
  useMemo,
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


function normalizeLayers(items) {
  const sorted =
    [...items].sort(
      (first, second) => {
        const sequenceDifference =
          Number(first.sequence || 1) -
          Number(second.sequence || 1)

        if (sequenceDifference !== 0) {
          return sequenceDifference
        }

        return String(first.code)
          .localeCompare(
            String(second.code)
          )
      }
    )

  const originalLayers =
    [...new Set(
      sorted.map(
        (item) =>
          Number(item.sequence || 1)
      )
    )].sort(
      (first, second) =>
        first - second
    )

  const layerMap =
    new Map(
      originalLayers.map(
        (layer, index) => [
          layer,
          index + 1,
        ]
      )
    )

  return sorted.map(
    (item) => ({
      ...item,
      sequence:
        layerMap.get(
          Number(item.sequence || 1)
        ) || 1,
    })
  )
}


function layersFromItems(items) {
  const groups =
    new Map()

  for (const item of items) {
    const layer =
      Number(item.sequence || 1)

    const current =
      groups.get(layer) || []

    current.push(item)
    groups.set(layer, current)
  }

  return [...groups.entries()]
    .sort(
      ([first], [second]) =>
        first - second
    )
    .map(
      ([sequence, layerItems]) => ({
        sequence,
        items: layerItems,
      })
    )
}


function rebuildFromLayers(layers) {
  return layers.flatMap(
    (layer, layerIndex) =>
      layer.items.map(
        (item) => ({
          ...item,
          sequence:
            layerIndex + 1,
        })
      )
  )
}


export default function ActivityPreSequence({
  projectId,
  initialItems,
}) {
  const [items, setItems] =
    useState(
      normalizeLayers(
        initialItems || []
      )
    )

  const [draggedId, setDraggedId] =
    useState(null)

  const [dropTarget, setDropTarget] =
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
      const normalized =
        normalizeLayers(
          initialItems || []
        )

      setItems(normalized)
      latestItemsRef.current =
        normalized
    },
    [initialItems]
  )

  const layers =
    useMemo(
      () =>
        layersFromItems(items),
      [items]
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

    const response =
      await fetch(
        '/api/pre-planning/activity-sequence',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            projectId,
            items:
              orderedItems.map(
                (item) => ({
                  serviceId: item.id,
                  sequence:
                    Number(
                      item.sequence
                    ),
                })
              ),
          }),
        }
      )

    let result = null

    try {
      result =
        await response.json()
    } catch {
      result = null
    }

    if (
      version !==
      saveVersionRef.current
    ) {
      return
    }

    if (!response.ok) {
      setSaveState('error')
      setErrorMessage(
        result?.error ||
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


  function beginDrag(
    event,
    itemId
  ) {
    setDraggedId(itemId)

    event.dataTransfer.effectAllowed =
      'move'

    event.dataTransfer.setData(
      'text/plain',
      itemId
    )
  }


  function endDrag() {
    setDraggedId(null)
    setDropTarget(null)
  }


  function allowDrop(
    event,
    target
  ) {
    event.preventDefault()

    event.dataTransfer.dropEffect =
      'move'

    setDropTarget(target)
  }


  function applyDrop(target) {
    const sourceId =
      draggedId

    if (!sourceId) {
      return
    }

    const currentLayers =
      layersFromItems(
        latestItemsRef.current
      ).map(
        (layer) => ({
          ...layer,
          items: [...layer.items],
        })
      )

    let draggedItem = null

    for (const layer of currentLayers) {
      const index =
        layer.items.findIndex(
          (item) =>
            item.id === sourceId
        )

      if (index >= 0) {
        ;[draggedItem] =
          layer.items.splice(
            index,
            1
          )
        break
      }
    }

    if (!draggedItem) {
      endDrag()
      return
    }

    const compactLayers =
      currentLayers.filter(
        (layer) =>
          layer.items.length > 0
      )

    if (
      target.type ===
      'layer'
    ) {
      const targetIndex =
        compactLayers.findIndex(
          (layer) =>
            layer.sequence ===
            target.sequence
        )

      if (targetIndex >= 0) {
        compactLayers[
          targetIndex
        ].items.push(
          draggedItem
        )
      } else {
        compactLayers.push({
          sequence:
            target.sequence,
          items: [draggedItem],
        })
      }
    } else {
      let insertIndex =
        target.position

      if (
        insertIndex < 0
      ) {
        insertIndex = 0
      }

      if (
        insertIndex >
        compactLayers.length
      ) {
        insertIndex =
          compactLayers.length
      }

      compactLayers.splice(
        insertIndex,
        0,
        {
          sequence: 0,
          items: [draggedItem],
        }
      )
    }

    const nextItems =
      rebuildFromLayers(
        compactLayers
      )

    latestItemsRef.current =
      nextItems

    setItems(nextItems)
    endDrag()

    void persistOrder(
      nextItems
    )
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
        No active Scope Items are available for sequencing.
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
            Production rule:
          </strong>{' '}
          one layer follows the previous layer. Activities inside the same layer may be performed in parallel.
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
          padding: '12px 14px 4px',
          color: MUTED,
          fontSize: '11px',
          lineHeight: 1.5,
        }}
      >
        Drop an activity <strong>inside a layer</strong> to make it parallel with that layer. Drop it on the <strong>gap between layers</strong> to create a separate production layer.
      </div>

      <div
        onDragOver={
          (event) =>
            allowDrop(
              event,
              {
                type: 'gap',
                position: 0,
              }
            )
        }
        onDrop={
          (event) => {
            event.preventDefault()
            applyDrop({
              type: 'gap',
              position: 0,
            })
          }
        }
        style={{
          height: '12px',
          margin: '4px 14px 0',
          borderRadius: '6px',
          background:
            dropTarget?.type ===
              'gap' &&
            dropTarget?.position ===
              0
              ? '#ccfbf1'
              : 'transparent',
        }}
      />

      <div
        style={{
          display: 'grid',
          gap: '0',
          padding: '0 14px 14px',
        }}
      >
        {layers.map(
          (layer, layerIndex) => (
            <div
              key={
                `layer-${layer.sequence}`
              }
            >
              <div
                onDragOver={
                  (event) =>
                    allowDrop(
                      event,
                      {
                        type: 'layer',
                        sequence:
                          layer.sequence,
                      }
                    )
                }
                onDrop={
                  (event) => {
                    event.preventDefault()
                    applyDrop({
                      type: 'layer',
                      sequence:
                        layer.sequence,
                    })
                  }
                }
                style={{
                  overflow: 'hidden',
                  border:
                    dropTarget?.type ===
                      'layer' &&
                    dropTarget?.sequence ===
                      layer.sequence
                      ? `2px solid ${TEAL}`
                      : `1px solid ${BORDER}`,
                  borderRadius: '10px',
                  background: '#ffffff',
                  boxShadow:
                    dropTarget?.type ===
                      'layer' &&
                    dropTarget?.sequence ===
                      layer.sequence
                      ? '0 0 0 2px rgba(0, 153, 139, 0.08)'
                      : 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent:
                      'space-between',
                    gap: '12px',
                    minHeight: '34px',
                    padding: '0 12px',
                    borderBottom:
                      `1px solid ${BORDER}`,
                    background: '#f7fafc',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span
                      style={{
                        color: TEAL,
                        fontSize: '10px',
                        fontWeight: 900,
                        letterSpacing:
                          '0.06em',
                        textTransform:
                          'uppercase',
                      }}
                    >
                      Production Layer
                    </span>

                    <strong
                      style={{
                        color: NAVY,
                        fontSize: '12px',
                        fontWeight: 900,
                        fontVariantNumeric:
                          'tabular-nums',
                      }}
                    >
                      {String(
                        layerIndex + 1
                      ).padStart(2, '0')}
                    </strong>
                  </div>

                  <span
                    style={{
                      color:
                        layer.items.length >
                        1
                          ? TEAL
                          : MUTED,
                      fontSize: '10px',
                      fontWeight: 800,
                    }}
                  >
                    {layer.items.length > 1
                      ? `${layer.items.length} activities · parallel allowed`
                      : '1 activity'}
                  </span>
                </div>

                <div>
                  {layer.items.map(
                    (item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            '44px 72px minmax(180px, 1fr) minmax(220px, 2fr)',
                          alignItems:
                            'center',
                          minHeight:
                            '50px',
                          borderBottom:
                            layer.items[
                              layer.items.length -
                                1
                            ]?.id !==
                            item.id
                              ? '1px solid #edf1f4'
                              : 0,
                          opacity:
                            draggedId ===
                            item.id
                              ? 0.45
                              : 1,
                        }}
                      >
                        <div
                          draggable
                          onDragStart={
                            (event) =>
                              beginDrag(
                                event,
                                item.id
                              )
                          }
                          onDragEnd={
                            endDrag
                          }
                          title="Hold and drag"
                          aria-label={`Drag ${item.code} ${item.description}`}
                          style={{
                            display:
                              'grid',
                            placeItems:
                              'center',
                            alignSelf:
                              'stretch',
                            borderRight:
                              `1px solid ${BORDER}`,
                            color: MUTED,
                            fontSize:
                              '20px',
                            fontWeight:
                              900,
                            cursor:
                              draggedId ===
                              item.id
                                ? 'grabbing'
                                : 'grab',
                            userSelect:
                              'none',
                          }}
                        >
                          ☰
                        </div>

                        <div
                          style={{
                            color: TEAL,
                            fontSize:
                              '11px',
                            fontWeight:
                              900,
                            textAlign:
                              'center',
                          }}
                        >
                          {item.code}
                        </div>

                        <div
                          style={{
                            minWidth: 0,
                            padding:
                              '0 12px',
                            color: TEXT,
                            fontSize:
                              '12px',
                            fontWeight:
                              900,
                            overflow:
                              'hidden',
                            textOverflow:
                              'ellipsis',
                            whiteSpace:
                              'nowrap',
                          }}
                        >
                          {item.description}
                        </div>

                        <div
                          style={{
                            minWidth: 0,
                            padding:
                              '0 14px',
                            color: MUTED,
                            fontSize:
                              '11px',
                            overflow:
                              'hidden',
                            textOverflow:
                              'ellipsis',
                            whiteSpace:
                              'nowrap',
                          }}
                        >
                          {item.workPackage}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div
                onDragOver={
                  (event) =>
                    allowDrop(
                      event,
                      {
                        type: 'gap',
                        position:
                          layerIndex + 1,
                      }
                    )
                }
                onDrop={
                  (event) => {
                    event.preventDefault()
                    applyDrop({
                      type: 'gap',
                      position:
                        layerIndex + 1,
                    })
                  }
                }
                style={{
                  height: '14px',
                  borderRadius:
                    '7px',
                  background:
                    dropTarget?.type ===
                      'gap' &&
                    dropTarget?.position ===
                      layerIndex + 1
                      ? '#ccfbf1'
                      : 'transparent',
                }}
              />
            </div>
          )
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
