'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '../../lib/i18n/useT'
import { Icon, ui } from '../fieldop/ui'
import styles from './precon.module.css'

const cx = (...names) => names.filter(Boolean).join(' ')
const SIZE = { small: styles.dialogSmall, wide: styles.dialogWide }

/** Modal dialog in the RitsuFlow style: header (title, optional text, close), scrolling body, footer. */
export function Dialog({ title, text, onClose, footer, size, as: Tag = 'div', onSubmit, children }) {
  const t = useT('precon')
  useEffect(() => {
    if (!onClose) return undefined
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return <div className={styles.overlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && onClose) onClose() }}>
    <Tag className={cx(styles.dialog, SIZE[size])} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} onSubmit={onSubmit}>
      <div className={styles.dialogHead}>
        <div>{title && <h2>{title}</h2>}{text && <p>{text}</p>}</div>
        {onClose && <button type="button" className={styles.close} onClick={onClose} aria-label={t('dialog.close')}><Icon name="close" size={20} /></button>}
      </div>
      <div className={styles.dialogBody}>{children}</div>
      {footer && <div className={styles.dialogFoot}>{footer}</div>}
    </Tag>
  </div>
}

// Confirm and prompt requests rendered by usePreconDialogs(); module level so the input keeps focus.
function RequestDialog({ request, onDone }) {
  const t = useT('precon')
  const [value, setValue] = useState(request.value || '')
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  if (request.kind === 'prompt') {
    const submit = (event) => { event.preventDefault(); if (value.trim()) onDone(value.trim()) }
    return <Dialog size="small" as="form" onSubmit={submit} title={request.title || request.message} text={request.title ? request.message : undefined} onClose={() => onDone(null)}
      footer={<>
        <button type="button" className={ui.btn} onClick={() => onDone(null)}>{t('dialog.cancel')}</button>
        <button type="submit" className={ui.btnPrimary} disabled={!value.trim()}>{request.confirmLabel || t('dialog.ok')}</button>
      </>}>
      <input ref={inputRef} value={value} onChange={(event) => setValue(event.target.value)} aria-label={request.message} />
    </Dialog>
  }

  return <Dialog size="small" title={request.title || t('dialog.confirmTitle')} onClose={() => onDone(false)}
    footer={<>
      <button type="button" className={ui.btn} onClick={() => onDone(false)}>{t('dialog.cancel')}</button>
      <button type="button" ref={inputRef} className={request.danger ? ui.btnDanger : ui.btnPrimary} onClick={() => onDone(true)}>{request.confirmLabel || t('dialog.confirm')}</button>
    </>}>
    <p>{request.message}</p>
  </Dialog>
}

function Toast({ toast, onClose }) {
  const t = useT('precon')
  const tone = toast.tone === 'ok' ? ui.noticeOk : toast.tone === 'warn' ? ui.noticeWarn : ui.noticeBad
  return <div className={cx(ui.notice, tone, styles.toast)} role={toast.tone === 'bad' ? 'alert' : 'status'}>
    <span>{toast.message}</span>
    <button type="button" className={styles.close} onClick={onClose} aria-label={t('dialog.close')}><Icon name="close" size={18} /></button>
  </div>
}

/**
 * In-page replacements for alert / confirm / prompt.
 *   const dialogs = usePreconDialogs()
 *   dialogs.notify(message, 'ok' | 'warn' | 'bad')
 *   if (!(await dialogs.confirm(message, { danger: true }))) return
 *   const name = await dialogs.prompt(message)   // null when cancelled
 * Render {dialogs.element} once in the page.
 */
export function usePreconDialogs() {
  const [request, setRequest] = useState(null)
  const [toast, setToast] = useState(null)
  const counter = useRef(0)
  const pending = useRef(null)

  const open = useCallback((kind, message, options) => new Promise((resolve) => {
    pending.current?.resolve(kind === 'prompt' ? null : false)
    counter.current += 1
    const next = { id: counter.current, kind, message, ...options, resolve }
    pending.current = next
    setRequest(next)
  }), [])

  const confirm = useCallback((message, options = {}) => open('confirm', message, options), [open])
  const prompt = useCallback((message, options = {}) => open('prompt', message, options), [open])

  const notify = useCallback((message, tone = 'ok') => {
    counter.current += 1
    setToast({ id: counter.current, message, tone })
  }, [])

  // Success messages close by themselves; warnings and errors stay until closed.
  useEffect(() => {
    if (!toast || toast.tone !== 'ok') return undefined
    const timer = window.setTimeout(() => setToast((current) => (current?.id === toast.id ? null : current)), 5000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const finish = useCallback((result) => {
    const current = pending.current
    pending.current = null
    setRequest(null)
    current?.resolve(result)
  }, [])

  const element = <>
    {request && <RequestDialog key={request.id} request={request} onDone={finish} />}
    {toast && <Toast key={toast.id} toast={toast} onClose={() => setToast(null)} />}
  </>

  return { confirm, prompt, notify, element }
}
