'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export default function RitsuCadEditSetupHeaderBridge() {
  const [slot, setSlot] = useState(null)
  const [actions, setActions] = useState([])

  useEffect(() => {
    let observer

    const sync = () => {
      const shell = document.querySelector('[data-ritsucad-approved-shell="true"]')
      const headerRight = document.querySelector('[class*="headerRight"]')
      if (!shell || !headerRight) return

      const sections = Array.from(shell.children).filter(el =>
        String(el.className || '').includes('toolbarSection')
      )
      const editSection = sections[4] || null

      if (editSection) {
        editSection.dataset.ritsucadEditSetupSource = 'true'
        const buttons = Array.from(editSection.querySelectorAll('button'))
        setActions(buttons.map((button, index) => ({
          index,
          label: (button.textContent || '').trim() || ['Calibrate', 'Undo', 'Redo'][index] || 'Edit',
          title: button.title || '',
          disabled: button.disabled,
          click: () => button.click(),
        })))
      }

      let target = headerRight.querySelector('[data-ritsucad-header-edit-slot="true"]')
      if (!target) {
        target = document.createElement('span')
        target.dataset.ritsucadHeaderEditSlot = 'true'
        target.className = 'ritsucadHeaderEditSlot'
        const fileSlot = headerRight.querySelector('[data-ritsucad-header-file-slot]')
        headerRight.insertBefore(target, fileSlot || headerRight.firstChild)
      }
      setSlot(current => current === target ? current : target)
    }

    sync()
    observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] })
    return () => observer?.disconnect()
  }, [])

  if (!slot) return null

  return createPortal(
    <div className="ritsucadHeaderEditGroup">
      {actions.map(action => (
        <button
          key={action.index}
          type="button"
          className="ritsucadHeaderEditButton"
          disabled={action.disabled}
          title={action.title}
          onClick={action.click}
        >
          <span>{editIcon(action.label, action.index)}</span>
          <small>{action.label}</small>
        </button>
      ))}
    </div>,
    slot
  )
}

function editIcon(label, index) {
  const value = String(label || '').toLowerCase()
  if (value.includes('calibr')) return '⌁'
  if (value.includes('undo')) return '↶'
  if (value.includes('redo')) return '↷'
  return ['⌁', '↶', '↷'][index] || '•'
}
