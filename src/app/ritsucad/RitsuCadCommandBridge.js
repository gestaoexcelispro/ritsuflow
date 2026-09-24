'use client'

import { useEffect } from 'react'

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function findButton({ title, text }) {
  const buttons = [...document.querySelectorAll('button')]
  return buttons.find((button) => {
    const buttonTitle = normalize(button.getAttribute('title'))
    const buttonText = normalize(button.innerText || button.textContent)
    return (title && buttonTitle.includes(normalize(title))) || (text && buttonText === normalize(text))
  }) || null
}

function clickNative(criteria) {
  const button = findButton(criteria)
  if (!button || button.disabled) return false
  button.click()
  return true
}

function dispatchKey(key, options = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', {
    key,
    code: options.code || (key.length === 1 ? `Key${key.toUpperCase()}` : key),
    ctrlKey: Boolean(options.ctrlKey),
    metaKey: Boolean(options.metaKey),
    shiftKey: Boolean(options.shiftKey),
    bubbles: true,
  }))
}

export default function RitsuCadCommandBridge() {
  useEffect(() => {
    const handlers = {
      'ritsucad:undo': () => dispatchKey('z', { ctrlKey: true }),
      'ritsucad:redo': () => dispatchKey('y', { ctrlKey: true }),
      'ritsucad:open-properties': () => clickNative({ title: 'Properties' }),
      'ritsucad:open-layers': () => clickNative({ title: 'Layers' }),
      'ritsucad:toggle-snap': () => dispatchKey('F3', { code: 'F3' }),
      'ritsucad:toggle-ortho': () => dispatchKey('F8', { code: 'F8' }),
      'ritsucad:toggle-grid': () => clickNative({ title: 'Grid' }),
      'ritsucad:calibrate': () => {
        if (!clickNative({ title: 'Calibrate Scale' })) {
          clickNative({ title: 'Recalibrate current page' })
        }
      },
      'ritsucad:open-drawings': () => clickNative({ title: 'Drawings' }),
      'ritsucad:delete-selection': () => dispatchKey('Delete', { code: 'Delete' }),
    }

    const listeners = Object.entries(handlers).map(([name, handler]) => {
      window.addEventListener(name, handler)
      return [name, handler]
    })

    return () => {
      listeners.forEach(([name, handler]) => window.removeEventListener(name, handler))
    }
  }, [])

  return null
}
