'use client'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

const ROW_HEIGHT = 44

function safeNumber(value, digits = 2) {
  const numeric = Number(value)

  if (!Number.isFinite(numeric)) {
    return '—'
  }

  return new Intl.NumberFormat(
    'en-US',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    }
  ).format(numeric)
}

function normalizeItems(value) {
  return Array.isArray(value) ? value : []
}

function flattenWbsItems(items) {
  const normalized = normalizeItems(items)
  const byParent = new Map()

  normalized.forEach((item) => {
    const parentKey = item.parentId || '__root__'

    if (!byParent.has(parentKey)) {
      byParent.set(parentKey, [])
    }

    byParent.get(parentKey).push(item)
  })

  byParent.forEach((siblings) => {
    siblings.sort(
      (first, second) =>
        Number(first.sortOrder || 0) -
        Number(second.sortOrder || 0)
    )
  })

  const rows = []
  const visited = new Set()

  function visit(parentId, parentCode, depth) {
    const parentKey = parentId || '__root__'
    const siblings = byParent.get(parentKey) || []

    siblings.forEach((item, index) => {
      if (visited.has(item.id)) {
        return
      }

      visited.add(item.id)

      const wbs =
        depth === 0
          ? `${index + 1}.0`
          : `${parentCode}.${index + 1}`

      rows.push({
        ...item,
        depth,
        wbs,
      })

      visit(
        item.id,
        wbs,
        depth + 1
      )
    })
  }

  visit(null, '', 0)

  return rows
}

function getItemTypeLabel(itemType) {
  if (itemType === 'summary') return 'Summary'
  if (itemType === 'milestone') return 'Milestone'
  return 'Task'
}

function getItemSymbol(itemType) {
  if (itemType === 'summary') return 'Σ'
  if (itemType === 'milestone') return '◆'
  return '▰'
}

function getSiblingItems(items, item) {
  return normalizeItems(items)
    .filter(
      (candidate) =>
        (candidate.parentId || null) ===
        (item.parentId || null)
    )
    .sort(
      (first, second) =>
        Number(first.sortOrder || 0) -
        Number(second.sortOrder || 0)
    )
}

function getChildren(items, parentId) {
  return normalizeItems(items)
    .filter(
      (item) =>
        item.parentId === parentId
    )
    .sort(
      (first, second) =>
        Number(first.sortOrder || 0) -
        Number(second.sortOrder || 0)
    )
}

function buildStructurePayload(items) {
  const byParent = new Map()

  normalizeItems(items).forEach((item) => {
    const parentKey = item.parentId || '__root__'

    if (!byParent.has(parentKey)) {
      byParent.set(parentKey, [])
    }

    byParent.get(parentKey).push(item)
  })

  const rows = []

  byParent.forEach((siblings) => {
    siblings
      .sort(
        (first, second) =>
          Number(first.sortOrder || 0) -
          Number(second.sortOrder || 0)
      )
      .forEach((item, index) => {
        rows.push({
          id: item.id,
          parentId: item.parentId || null,
          sortOrder: index + 1,
        })
      })
  })

  return rows
}

export default function PrePlanningWbsEditor({
  projectId,
  versionId,
  editable = false,
  dayWidth = 34,
  timelineDays = 30,
  onNotice,
}) {
  const [items, setItems] = useState([])
  const [selectedItemId, setSelectedItemId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [actionState, setActionState] = useState('idle')
  const [addOpen, setAddOpen] = useState(false)
  const [addType, setAddType] = useState('summary')
  const [addName, setAddName] = useState('')

  const rows =
    useMemo(
      () =>
        flattenWbsItems(
          items
        ),
      [items]
    )

  const selectedItem =
    useMemo(
      () =>
        items.find(
          (item) =>
            item.id === selectedItemId
        ) || null,
      [items, selectedItemId]
    )

  const timelineWidth =
    Math.max(
      timelineDays,
      30
    ) * dayWidth

  function showNotice(notice) {
    if (typeof onNotice === 'function') {
      onNotice(notice)
    }
  }

  async function loadWbs() {
    if (!projectId || !versionId) {
      setItems([])
      setSelectedItemId(null)
      return
    }

    setLoading(true)

    try {
      const params =
        new URLSearchParams({
          projectId,
          versionId,
        })

      const response =
        await fetch(
          `/api/pre-planning/wbs?${params.toString()}`,
          {
            cache: 'no-store',
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result?.error ||
          'WBS could not be loaded.'
        )
      }

      const nextItems =
        normalizeItems(
          result.items
        )

      setItems(nextItems)

      setSelectedItemId(
        (current) =>
          current &&
          nextItems.some(
            (item) =>
              item.id === current
          )
            ? current
            : nextItems?.[0]?.id || null
      )
    } catch (error) {
      showNotice({
        type: 'error',
        text:
          error?.message ||
          'WBS could not be loaded.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWbs()
  }, [projectId, versionId])

  async function postAction(payload) {
    const response =
      await fetch(
        '/api/pre-planning/wbs',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            projectId,
            versionId,
            ...payload,
          }),
        }
      )

    const result =
      await response.json()

    if (!response.ok) {
      throw new Error(
        result?.error ||
        'WBS operation failed.'
      )
    }

    return result
  }

  function openAddLine() {
    if (!editable || !versionId) {
      showNotice({
        type: 'warning',
        text:
          versionId
            ? 'Historical versions are read-only.'
            : 'Save the sequence first to create a Pre-Planning version.',
      })
      return
    }

    setAddType('summary')
    setAddName('')
    setAddOpen(true)
  }

  async function handleAddLine() {
    if (actionState !== 'idle') return

    const name =
      String(addName || '')
        .trim()
        .replace(/\s+/g, ' ')

    if (!name) {
      showNotice({
        type: 'warning',
        text:
          'Enter a name for the new WBS line.',
      })
      return
    }

    let parentId = null

    if (selectedItem) {
      parentId =
        selectedItem.itemType ===
        'summary'
          ? selectedItem.id
          : selectedItem.parentId || null
    }

    setActionState('adding')

    try {
      const result =
        await postAction({
          action: 'add_item',
          parentId,
          itemType: addType,
          name,
          durationDays:
            addType ===
            'milestone'
              ? 0
              : null,
        })

      setItems(result.items || [])
      setSelectedItemId(
        result.item?.id || null
      )
      setAddOpen(false)
      setAddName('')

      showNotice({
        type: 'success',
        text:
          `${getItemTypeLabel(
            addType
          )} added to the WBS.`,
      })
    } catch (error) {
      showNotice({
        type: 'error',
        text:
          error?.message ||
          'The WBS line could not be added.',
      })
    } finally {
      setActionState('idle')
    }
  }

  async function updateItem(itemId, changes) {
    if (!editable || actionState !== 'idle') return

    const current =
      items.find(
        (item) =>
          item.id === itemId
      )

    if (!current) return

    setActionState('updating')

    try {
      const result =
        await postAction({
          action: 'update_item',
          itemId,
          name:
            changes.name ??
            current.name,
          durationDays:
            changes.durationDays !== undefined
              ? changes.durationDays
              : current.durationDays,
        })

      setItems(result.items || [])
    } catch (error) {
      showNotice({
        type: 'error',
        text:
          error?.message ||
          'The WBS line could not be updated.',
      })

      await loadWbs()
    } finally {
      setActionState('idle')
    }
  }

  async function persistStructure(
    nextItems,
    successText
  ) {
    if (!editable || actionState !== 'idle') return

    setActionState('structuring')

    try {
      const result =
        await postAction({
          action: 'set_structure',
          structure:
            buildStructurePayload(
              nextItems
            ),
        })

      setItems(
        result.items ||
        nextItems
      )

      showNotice({
        type: 'success',
        text: successText,
      })
    } catch (error) {
      showNotice({
        type: 'error',
        text:
          error?.message ||
          'The WBS structure could not be updated.',
      })

      await loadWbs()
    } finally {
      setActionState('idle')
    }
  }

  function handleIndent() {
    if (!selectedItem) return

    const siblings =
      getSiblingItems(
        items,
        selectedItem
      )

    const index =
      siblings.findIndex(
        (item) =>
          item.id ===
          selectedItem.id
      )

    if (index <= 0) {
      showNotice({
        type: 'warning',
        text:
          'There is no previous Summary available for this line.',
      })
      return
    }

    const previous =
      siblings[index - 1]

    if (previous.itemType !== 'summary') {
      showNotice({
        type: 'warning',
        text:
          'A WBS line can only be indented under a Summary.',
      })
      return
    }

    const childCount =
      getChildren(
        items,
        previous.id
      ).length

    const nextItems =
      items.map(
        (item) =>
          item.id ===
          selectedItem.id
            ? {
                ...item,
                parentId:
                  previous.id,
                sortOrder:
                  childCount + 1,
              }
            : item
      )

    persistStructure(
      nextItems,
      'WBS line indented.'
    )
  }

  function handleOutdent() {
    if (!selectedItem) return

    if (!selectedItem.parentId) {
      showNotice({
        type: 'warning',
        text:
          'This WBS line is already at the root level.',
      })
      return
    }

    const parent =
      items.find(
        (item) =>
          item.id ===
          selectedItem.parentId
      )

    if (!parent) return

    const targetParentId =
      parent.parentId || null

    const targetSiblings =
      items.filter(
        (item) =>
          (item.parentId || null) ===
          targetParentId
      )

    const nextItems =
      items.map(
        (item) =>
          item.id ===
          selectedItem.id
            ? {
                ...item,
                parentId:
                  targetParentId,
                sortOrder:
                  targetSiblings.length + 1,
              }
            : item
      )

    persistStructure(
      nextItems,
      'WBS line outdented.'
    )
  }

  function moveSelected(direction) {
    if (!selectedItem) return

    const siblings =
      getSiblingItems(
        items,
        selectedItem
      )

    const index =
      siblings.findIndex(
        (item) =>
          item.id ===
          selectedItem.id
      )

    const targetIndex =
      index + direction

    if (
      index < 0 ||
      targetIndex < 0 ||
      targetIndex >= siblings.length
    ) {
      return
    }

    const reordered =
      [...siblings]

    const [moved] =
      reordered.splice(
        index,
        1
      )

    reordered.splice(
      targetIndex,
      0,
      moved
    )

    const rank =
      new Map(
        reordered.map(
          (item, itemIndex) => [
            item.id,
            itemIndex + 1,
          ]
        )
      )

    const nextItems =
      items.map(
        (item) =>
          rank.has(item.id)
            ? {
                ...item,
                sortOrder:
                  rank.get(item.id),
              }
            : item
      )

    persistStructure(
      nextItems,
      direction < 0
        ? 'WBS line moved up.'
        : 'WBS line moved down.'
    )
  }

  async function handleDelete() {
    if (
      !selectedItem ||
      !editable ||
      actionState !== 'idle'
    ) {
      return
    }

    const confirmed =
      window.confirm(
        selectedItem.itemType ===
          'summary'
          ? `Delete "${selectedItem.name}" and all lines below it?`
          : `Delete "${selectedItem.name}"?`
      )

    if (!confirmed) return

    setActionState('deleting')

    try {
      const result =
        await postAction({
          action: 'delete_item',
          itemId:
            selectedItem.id,
        })

      setItems(result.items || [])
      setSelectedItemId(
        result.items?.[0]?.id ||
        null
      )

      showNotice({
        type: 'success',
        text:
          'WBS line deleted.',
      })
    } catch (error) {
      showNotice({
        type: 'error',
        text:
          error?.message ||
          'The WBS line could not be deleted.',
      })
    } finally {
      setActionState('idle')
    }
  }

  const buttonStyle = {
    minHeight: 30,
    border:
      '1px solid #c9d3d8',
    background:
      '#ffffff',
    borderRadius: 6,
    padding:
      '0 10px',
    fontSize: 12,
    fontWeight: 650,
    cursor:
      'pointer',
    color:
      '#24343b',
  }

  const disabledButtonStyle = {
    ...buttonStyle,
    opacity: 0.45,
    cursor:
      'not-allowed',
  }

  if (!versionId) {
    return (
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          minHeight: 380,
          background: '#f7f9fa',
          color: '#52656e',
        }}
      >
        Save Sequence first to create Version 1.
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: 0,
        display: 'grid',
        gridTemplateRows:
          '42px minmax(0, 1fr)',
        borderTop:
          '1px solid #dce3e6',
        borderBottom:
          '1px solid #dce3e6',
        background: '#ffffff',
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent:
            'space-between',
          gap: 10,
          padding: '5px 10px',
          borderBottom:
            '1px solid #dce3e6',
          background: '#f7f9fa',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={openAddLine}
            disabled={
              !editable ||
              actionState !== 'idle'
            }
            style={
              !editable ||
              actionState !== 'idle'
                ? disabledButtonStyle
                : {
                    ...buttonStyle,
                    background:
                      '#163d4a',
                    color:
                      '#ffffff',
                    borderColor:
                      '#163d4a',
                  }
            }
          >
            + Add Line
          </button>

          <button
            type="button"
            onClick={handleIndent}
            disabled={
              !editable ||
              !selectedItem ||
              actionState !== 'idle'
            }
            style={
              !editable ||
              !selectedItem ||
              actionState !== 'idle'
                ? disabledButtonStyle
                : buttonStyle
            }
          >
            Indent
          </button>

          <button
            type="button"
            onClick={handleOutdent}
            disabled={
              !editable ||
              !selectedItem ||
              actionState !== 'idle'
            }
            style={
              !editable ||
              !selectedItem ||
              actionState !== 'idle'
                ? disabledButtonStyle
                : buttonStyle
            }
          >
            Outdent
          </button>

          <button
            type="button"
            onClick={() =>
              moveSelected(-1)
            }
            disabled={
              !editable ||
              !selectedItem ||
              actionState !== 'idle'
            }
            style={
              !editable ||
              !selectedItem ||
              actionState !== 'idle'
                ? disabledButtonStyle
                : buttonStyle
            }
          >
            ↑ Move Up
          </button>

          <button
            type="button"
            onClick={() =>
              moveSelected(1)
            }
            disabled={
              !editable ||
              !selectedItem ||
              actionState !== 'idle'
            }
            style={
              !editable ||
              !selectedItem ||
              actionState !== 'idle'
                ? disabledButtonStyle
                : buttonStyle
            }
          >
            ↓ Move Down
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={
              !editable ||
              !selectedItem ||
              actionState !== 'idle'
            }
            style={
              !editable ||
              !selectedItem ||
              actionState !== 'idle'
                ? disabledButtonStyle
                : {
                    ...buttonStyle,
                    color: '#a23232',
                  }
            }
          >
            Delete
          </button>
        </div>

        <div
          style={{
            fontSize: 12,
            color: '#64757d',
          }}
        >
          {loading
            ? 'Loading WBS…'
            : `${rows.length} ${
                rows.length === 1
                  ? 'line'
                  : 'lines'
              }`}
        </div>
      </div>

      <div
        style={{
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns:
            'minmax(650px, 58%) minmax(360px, 42%)',
        }}
      >
        <section
          style={{
            minWidth: 0,
            minHeight: 0,
            overflow: 'auto',
            borderRight:
              '1px solid #dce3e6',
          }}
        >
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 4,
              display: 'grid',
              gridTemplateColumns:
                '92px 92px minmax(250px, 1fr) 92px 118px 112px',
              height: ROW_HEIGHT,
              alignItems: 'center',
              background: '#f2f5f6',
              borderBottom:
                '1px solid #d3dde1',
              fontSize: 11,
              fontWeight: 800,
              color: '#5f7078',
            }}
          >
            <div style={{padding:'0 10px'}}>WBS</div>
            <div style={{padding:'0 10px'}}>Type</div>
            <div style={{padding:'0 10px'}}>Name</div>
            <div style={{padding:'0 10px', textAlign:'right'}}>Duration</div>
            <div style={{padding:'0 10px'}}>Predecessor</div>
            <div style={{padding:'0 10px'}}>Relationship</div>
          </div>

          {rows.length > 0 ? (
            rows.map((row) => {
              const selected =
                row.id === selectedItemId
              const isSummary =
                row.itemType === 'summary'

              return (
                <div
                  key={row.id}
                  onClick={() =>
                    setSelectedItemId(row.id)
                  }
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      '92px 92px minmax(250px, 1fr) 92px 118px 112px',
                    minHeight: ROW_HEIGHT,
                    alignItems: 'center',
                    borderBottom:
                      '1px solid #e4eaed',
                    background:
                      selected
                        ? '#e7f2f5'
                        : isSummary
                          ? '#f5f8f9'
                          : '#ffffff',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  <div style={{padding:'0 10px', fontWeight:800}}>
                    {row.wbs}
                  </div>

                  <div style={{padding:'0 10px', fontWeight:700}}>
                    <span style={{display:'inline-block', width:18}}>
                      {getItemSymbol(row.itemType)}
                    </span>
                    {getItemTypeLabel(row.itemType)}
                  </div>

                  <div
                    style={{
                      paddingLeft:
                        `${10 + row.depth * 18}px`,
                      paddingRight: 8,
                      fontWeight:
                        isSummary ? 800 : 550,
                    }}
                  >
                    {row.name}
                  </div>

                  <div style={{padding:'0 10px', textAlign:'right'}}>
                    {row.itemType === 'task'
                      ? Number.isFinite(Number(row.durationDays)) &&
                        Number(row.durationDays) > 0
                        ? `${safeNumber(row.durationDays)} d`
                        : '—'
                      : row.itemType === 'milestone'
                        ? '0 d'
                        : '—'}
                  </div>

                  <div style={{padding:'0 10px', color:'#71828a'}}>
                    —
                  </div>

                  <div style={{padding:'0 10px', color:'#71828a'}}>
                    —
                  </div>
                </div>
              )
            })
          ) : (
            <div
              style={{
                minHeight: 280,
                display: 'grid',
                placeItems: 'center',
                textAlign: 'center',
                padding: 24,
                color: '#64757d',
              }}
            >
              <div>
                <strong
                  style={{
                    display: 'block',
                    color: '#263a43',
                    marginBottom: 6,
                  }}
                >
                  Start the authored WBS
                </strong>

                <span
                  style={{
                    display: 'block',
                    fontSize: 13,
                    marginBottom: 14,
                  }}
                >
                  Add a Summary, Task, or Milestone.
                </span>

                {editable ? (
                  <button
                    type="button"
                    onClick={openAddLine}
                    style={{
                      ...buttonStyle,
                      background: '#163d4a',
                      color: '#ffffff',
                      borderColor: '#163d4a',
                    }}
                  >
                    + Add First Line
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </section>

        <section
          style={{
            minWidth: 0,
            minHeight: 0,
            overflow: 'auto',
            background: '#ffffff',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: timelineWidth,
              minWidth: '100%',
              height:
                Math.max(
                  rows.length * ROW_HEIGHT,
                  ROW_HEIGHT
                ),
              backgroundImage:
                `linear-gradient(to right, rgba(210,220,224,.55) 1px, transparent 1px), linear-gradient(to bottom, rgba(222,229,232,.8) 1px, transparent 1px)`,
              backgroundSize:
                `${dayWidth}px ${ROW_HEIGHT}px`,
            }}
          >
            {rows.map((row, rowIndex) => {
              const duration =
                Number(row.durationDays)

              const hasDuration =
                row.itemType === 'task' &&
                Number.isFinite(duration) &&
                duration > 0

              return (
                <button
                  key={`gantt-${row.id}`}
                  type="button"
                  onClick={() =>
                    setSelectedItemId(row.id)
                  }
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top:
                      rowIndex * ROW_HEIGHT,
                    height: ROW_HEIGHT,
                    border: 0,
                    borderBottom:
                      '1px solid rgba(224,230,233,.9)',
                    background:
                      row.id === selectedItemId
                        ? 'rgba(221,239,244,.48)'
                        : row.itemType === 'summary'
                          ? 'rgba(245,248,249,.58)'
                          : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  {hasDuration ? (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 10,
                        height: 24,
                        width:
                          Math.max(
                            6,
                            duration * dayWidth
                          ),
                        borderRadius: 4,
                        background: '#16848d',
                        color: '#ffffff',
                        fontSize: 10,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 7px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {safeNumber(duration)} d
                    </div>
                  ) : row.itemType === 'milestone' ? (
                    <div
                      style={{
                        position: 'absolute',
                        left: 5,
                        top: 14,
                        width: 14,
                        height: 14,
                        background: '#9a6b1b',
                        transform: 'rotate(45deg)',
                        borderRadius: 2,
                      }}
                    />
                  ) : null}
                </button>
              )
            })}
          </div>
        </section>
      </div>

      {addOpen ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            display: 'grid',
            placeItems: 'center',
            background:
              'rgba(22, 38, 46, .24)',
          }}
        >
          <div
            style={{
              width:
                'min(430px, calc(100% - 32px))',
              background: '#ffffff',
              border:
                '1px solid #ccd7dc',
              borderRadius: 10,
              boxShadow:
                '0 18px 48px rgba(27, 46, 56, .18)',
              padding: 18,
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 850,
                color: '#203740',
                marginBottom: 4,
              }}
            >
              Add WBS Line
            </div>

            <div
              style={{
                fontSize: 12,
                color: '#687b84',
                marginBottom: 14,
              }}
            >
              Choose what this level represents.
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(3, 1fr)',
                gap: 8,
                marginBottom: 14,
              }}
            >
              {[
                ['summary', 'Σ', 'Summary'],
                ['task', '▰', 'Task'],
                ['milestone', '◆', 'Milestone'],
              ].map(
                ([value, symbol, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setAddType(value)
                    }
                    style={{
                      border:
                        addType === value
                          ? '2px solid #163d4a'
                          : '1px solid #cbd6db',
                      background:
                        addType === value
                          ? '#eef6f7'
                          : '#ffffff',
                      borderRadius: 8,
                      minHeight: 68,
                      cursor: 'pointer',
                      color: '#283f49',
                      fontWeight: 800,
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        fontSize: 18,
                        marginBottom: 4,
                      }}
                    >
                      {symbol}
                    </span>

                    {label}
                  </button>
                )
              )}
            </div>

            <input
              autoFocus
              value={addName}
              onChange={(event) =>
                setAddName(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleAddLine()
                }
              }}
              placeholder={
                addType === 'summary'
                  ? 'e.g. Production Cell 1'
                  : addType === 'milestone'
                    ? 'e.g. Zone A Complete'
                    : 'e.g. Interior Wall Framing'
              }
              style={{
                width: '100%',
                border:
                  '1px solid #bfcdd3',
                borderRadius: 6,
                padding: '9px 10px',
                fontSize: 13,
                marginBottom: 14,
              }}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setAddOpen(false)
                }
                style={buttonStyle}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleAddLine}
                disabled={
                  actionState !== 'idle'
                }
                style={{
                  ...buttonStyle,
                  background: '#163d4a',
                  color: '#ffffff',
                  borderColor: '#163d4a',
                }}
              >
                Add {getItemTypeLabel(addType)}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
