'use client'

import { useEffect, useState } from 'react'

const DEFAULT_WALL = {
  layer: 'A-WALL',
  name: '',
  height: '',
  lineColor: '#0f766e',
  wallThicknessMm: '100',
}

function previewThicknessPx(value) {
  const millimeters = Number(value)
  if (!Number.isFinite(millimeters) || millimeters <= 0) return 2
  return Math.max(2, Math.min(24, millimeters / 10))
}

export default function WallSettingsModal({ open, initialValue, onCancel, onSave }) {
  const [form, setForm] = useState(DEFAULT_WALL)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!open) return

    const normalizedInitialValue = initialValue
      ? {
          ...initialValue,
          wallThicknessMm:
            initialValue.wallThicknessMm ??
            initialValue.thicknessMm ??
            DEFAULT_WALL.wallThicknessMm,
        }
      : {}

    setForm({ ...DEFAULT_WALL, ...normalizedInitialValue })
    setErrors({})
  }, [open, initialValue])

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCancel?.()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  if (!open) return null

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: null }))
  }

  function submit(event) {
    event.preventDefault()
    const nextErrors = {}

    if (!form.layer.trim()) nextErrors.layer = 'Layer is required.'
    if (!form.name.trim()) nextErrors.name = 'Wall name is required.'
    if (!Number.isFinite(Number(form.height)) || Number(form.height) <= 0) {
      nextErrors.height = 'Enter a height greater than 0.'
    }
    if (!Number.isFinite(Number(form.wallThicknessMm)) || Number(form.wallThicknessMm) <= 0) {
      nextErrors.wallThicknessMm = 'Enter a wall thickness greater than 0 mm.'
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    onSave?.({
      layer: form.layer.trim(),
      name: form.name.trim(),
      height: Number(form.height),
      lineColor: form.lineColor,
      wallThicknessMm: Number(form.wallThicknessMm),
      thicknessUnit: 'mm',
    })
  }

  const previewPx = previewThicknessPx(form.wallThicknessMm)

  return (
    <div className="ritsucadWallModalBackdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel?.()}>
      <form className="ritsucadWallModal" onSubmit={submit} aria-label="Wall settings">
        <div className="ritsucadWallModalHeader">
          <div>
            <small>SMART TAKEOFF · ARCHITECTURE</small>
            <h2>Wall Settings</h2>
          </div>
          <button type="button" className="ritsucadWallModalClose" onClick={onCancel} aria-label="Close wall settings">×</button>
        </div>

        <p className="ritsucadWallModalIntro">Define the wall before drawing. These properties will travel with the wall geometry.</p>

        <div className="ritsucadWallModalGrid">
          <Field label="Layer" error={errors.layer}>
            <input value={form.layer} onChange={(e) => update('layer', e.target.value)} autoFocus />
          </Field>

          <Field label="Wall Name" error={errors.name}>
            <input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Exterior Wall Type A" />
          </Field>

          <Field label="Height" error={errors.height}>
            <div className="ritsucadWallInputWithUnit">
              <input type="number" min="0" step="0.01" value={form.height} onChange={(e) => update('height', e.target.value)} placeholder="0.00" />
              <span>drawing unit</span>
            </div>
          </Field>

          <Field label="Wall Thickness" error={errors.wallThicknessMm}>
            <div className="ritsucadWallInputWithUnit">
              <input type="number" min="1" step="1" value={form.wallThicknessMm} onChange={(e) => update('wallThicknessMm', e.target.value)} placeholder="100" />
              <span>mm</span>
            </div>
          </Field>

          <Field label="Line Color">
            <div className="ritsucadWallColorRow">
              <input className="ritsucadWallColorInput" type="color" value={form.lineColor} onChange={(e) => update('lineColor', e.target.value)} />
              <input value={form.lineColor.toUpperCase()} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && update('lineColor', e.target.value)} />
            </div>
          </Field>
        </div>

        <div className="ritsucadWallPreview">
          <span>Preview · {form.wallThicknessMm || 0} mm</span>
          <div style={{ borderTop: `${previewPx}px solid ${form.lineColor || '#0f766e'}` }} />
        </div>

        <div className="ritsucadWallModalActions">
          <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="primary">Save &amp; Draw</button>
        </div>
      </form>

      <style jsx global>{`
        .ritsucadWallModalBackdrop{position:fixed;inset:0;z-index:3000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(5,31,45,.46);backdrop-filter:blur(2px)}
        .ritsucadWallModal{width:min(620px,calc(100vw - 48px));max-height:calc(100vh - 48px);overflow:auto;border:1px solid #c7d5dd;border-radius:12px;background:#fff;box-shadow:0 24px 70px rgba(4,31,45,.28);color:#173e52;font-family:inherit}
        .ritsucadWallModalHeader{display:flex;align-items:flex-start;justify-content:space-between;padding:20px 22px 16px;border-bottom:1px solid #e0e8ed;background:#f8fafc}
        .ritsucadWallModalHeader small{display:block;margin-bottom:5px;color:#668391;font-size:9px;font-weight:900;letter-spacing:.09em}.ritsucadWallModalHeader h2{margin:0;font-size:20px;color:#123c52}
        .ritsucadWallModalClose{width:32px;height:32px;border:1px solid #cbd8df;border-radius:6px;background:#fff;color:#456676;font-size:22px;line-height:1;cursor:pointer}
        .ritsucadWallModalIntro{margin:0;padding:16px 22px 4px;color:#607d8b;font-size:12px}
        .ritsucadWallModalGrid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:16px 22px}
        .ritsucadWallField{display:flex;flex-direction:column;gap:6px}.ritsucadWallField:nth-child(2){grid-column:span 2}.ritsucadWallField label{font-size:10px;font-weight:900;letter-spacing:.04em;color:#31556b}
        .ritsucadWallField input{width:100%;height:38px;box-sizing:border-box;border:1px solid #bdccd5;border-radius:6px;padding:0 10px;background:#fff;color:#173e52;font:inherit;font-size:12px;outline:none}.ritsucadWallField input:focus{border-color:#2aa8a1;box-shadow:0 0 0 2px rgba(42,168,161,.12)}
        .ritsucadWallFieldError{font-size:10px;color:#b42318}.ritsucadWallInputWithUnit{display:flex}.ritsucadWallInputWithUnit input{border-radius:6px 0 0 6px}.ritsucadWallInputWithUnit span{display:flex;align-items:center;padding:0 9px;border:1px solid #bdccd5;border-left:0;border-radius:0 6px 6px 0;background:#f5f8fa;color:#718895;font-size:9px;white-space:nowrap}
        .ritsucadWallColorRow{display:grid;grid-template-columns:46px 1fr;gap:7px}.ritsucadWallColorInput{padding:3px!important;cursor:pointer}
        .ritsucadWallPreview{margin:0 22px 18px;padding:12px;border:1px solid #d8e2e8;border-radius:7px;background:#f8fafc}.ritsucadWallPreview span{display:block;margin-bottom:12px;color:#6b8491;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.06em}.ritsucadWallPreview div{width:100%;height:1px}
        .ritsucadWallModalActions{display:flex;justify-content:flex-end;gap:8px;padding:14px 22px;border-top:1px solid #e0e8ed;background:#f8fafc}.ritsucadWallModalActions button{height:38px;padding:0 16px;border-radius:6px;font:inherit;font-size:11px;font-weight:900;cursor:pointer}.ritsucadWallModalActions .secondary{border:1px solid #bdccd5;background:#fff;color:#31556b}.ritsucadWallModalActions .primary{border:1px solid #087f79;background:#087f79;color:#fff}
        @media(max-width:640px){.ritsucadWallModalGrid{grid-template-columns:1fr}.ritsucadWallField:nth-child(2){grid-column:auto}}
      `}</style>
    </div>
  )
}

function Field({ label, error, children }) {
  return <div className="ritsucadWallField"><label>{label}</label>{children}{error ? <span className="ritsucadWallFieldError">{error}</span> : null}</div>
}
