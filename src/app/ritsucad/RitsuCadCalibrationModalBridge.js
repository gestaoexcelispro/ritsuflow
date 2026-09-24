'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const UNITS = [
  ['mm', 'Millimeters (mm)'],
  ['cm', 'Centimeters (cm)'],
  ['m', 'Meters (m)'],
  ['in', 'Inches (in)'],
  ['ft', 'Feet (ft)'],
]

function calibrationSection() {
  return [...document.querySelectorAll('section')].find((section) =>
    [...section.querySelectorAll('h3')].some((heading) => heading.textContent?.trim() === 'Scale Calibration')
  ) || null
}

function nativeSetValue(element, value) {
  if (!element) return
  const prototype = element instanceof HTMLSelectElement
    ? window.HTMLSelectElement.prototype
    : window.HTMLInputElement.prototype
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
  descriptor?.set?.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

export default function RitsuCadCalibrationModalBridge() {
  const [open, setOpen] = useState(false)
  const [distance, setDistance] = useState('')
  const [unit, setUnit] = useState('ft')
  const [error, setError] = useState('')
  const distanceRef = useRef(null)

  useEffect(() => {
    let frame = 0
    let wasOpen = false

    const sync = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const section = calibrationSection()
        const input = section?.querySelector('input[type="number"]')
        const select = section?.querySelector('select')
        const shouldOpen = Boolean(input && select)

        if (shouldOpen && !wasOpen) {
          setDistance(input.value || '')
          setUnit(select.value || 'ft')
          setError('')
        }

        wasOpen = shouldOpen
        setOpen(shouldOpen)
      })
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => distanceRef.current?.focus(), 40)
    return () => window.clearTimeout(timer)
  }, [open])

  function updateDistance(value) {
    setDistance(value)
    setError('')
    const input = calibrationSection()?.querySelector('input[type="number"]')
    nativeSetValue(input, value)
  }

  function updateUnit(value) {
    setUnit(value)
    setError('')
    const select = calibrationSection()?.querySelector('select')
    nativeSetValue(select, value)
  }

  function findAction(label) {
    const section = calibrationSection()
    return [...(section?.querySelectorAll('button') || [])].find(
      (button) => button.textContent?.trim() === label
    ) || null
  }

  function save() {
    const numeric = Number(distance)
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setError('Enter a valid distance greater than zero.')
      distanceRef.current?.focus()
      return
    }

    const input = calibrationSection()?.querySelector('input[type="number"]')
    const select = calibrationSection()?.querySelector('select')
    nativeSetValue(input, distance)
    nativeSetValue(select, unit)

    const button = findAction('Save Scale')
    if (!button) {
      setError('RitsuCAD could not find the calibration save command.')
      return
    }
    button.click()
  }

  function cancel() {
    const button = findAction('Cancel')
    if (button) button.click()
    else window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))
  }

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div style={backdrop} role="presentation" onMouseDown={(event) => event.stopPropagation()}>
      <section style={modal} role="dialog" aria-modal="true" aria-labelledby="rf-scale-title">
        <header style={header}>
          <div>
            <strong id="rf-scale-title" style={title}>Set Drawing Scale</strong>
            <span style={subtitle}>Scale Calibration</span>
          </div>
          <button type="button" onClick={cancel} style={closeButton} aria-label="Cancel calibration">×</button>
        </header>

        <div style={body}>
          <p style={description}>Enter the real-world distance between the two reference points you selected on the drawing.</p>

          <label style={label}>
            <span>Known distance</span>
            <input
              ref={distanceRef}
              type="number"
              min="0"
              step="any"
              value={distance}
              onChange={(event) => updateDistance(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') save() }}
              placeholder="Enter distance"
              style={inputStyle}
            />
          </label>

          <label style={label}>
            <span>Unit</span>
            <select value={unit} onChange={(event) => updateUnit(event.target.value)} style={inputStyle}>
              {UNITS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </label>

          {error && <div style={errorStyle}>{error}</div>}
        </div>

        <footer style={footer}>
          <button type="button" onClick={cancel} style={secondaryButton}>Cancel</button>
          <button type="button" onClick={save} style={primaryButton}>Save Scale</button>
        </footer>
      </section>
    </div>,
    document.body
  )
}

const backdrop = { position:'fixed', inset:0, zIndex:10050, display:'grid', placeItems:'center', background:'rgba(9,30,42,.34)', backdropFilter:'blur(1px)' }
const modal = { width:390, maxWidth:'calc(100vw - 32px)', overflow:'hidden', border:'1px solid #9fb6c2', borderRadius:8, background:'#fff', boxShadow:'0 24px 70px rgba(6,35,50,.32)', color:'#123b50', fontFamily:'inherit' }
const header = { minHeight:58, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 14px 0 18px', borderBottom:'1px solid #d9e4e9', background:'#f8fbfc' }
const title = { display:'block', fontSize:16, fontWeight:900 }
const subtitle = { display:'block', marginTop:2, color:'#718b97', fontSize:9, fontWeight:800, letterSpacing:'.05em', textTransform:'uppercase' }
const closeButton = { width:30, height:30, border:0, borderRadius:4, background:'transparent', color:'#557480', fontSize:20, cursor:'pointer' }
const body = { display:'grid', gap:14, padding:'17px 18px 18px' }
const description = { margin:0, color:'#506d7a', fontSize:11, lineHeight:1.5 }
const label = { display:'grid', gap:6, color:'#315767', fontSize:10, fontWeight:900 }
const inputStyle = { width:'100%', height:38, boxSizing:'border-box', border:'1px solid #b9cbd3', borderRadius:5, padding:'0 10px', background:'#fff', color:'#102f3e', outline:'none', fontSize:12 }
const errorStyle = { padding:'8px 10px', border:'1px solid #efcaca', borderRadius:5, background:'#fff5f5', color:'#a53d3d', fontSize:10 }
const footer = { display:'flex', justifyContent:'flex-end', gap:8, padding:'11px 14px', borderTop:'1px solid #d9e4e9', background:'#f8fbfc' }
const secondaryButton = { height:34, padding:'0 15px', border:'1px solid #b9cbd3', borderRadius:5, background:'#fff', color:'#315767', fontSize:10, fontWeight:900, cursor:'pointer' }
const primaryButton = { height:34, padding:'0 17px', border:0, borderRadius:5, background:'#087b92', color:'#fff', fontSize:10, fontWeight:900, cursor:'pointer' }
