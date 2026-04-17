/**
 * Manual-copy toast. Renders only when the Clipboard API and
 * `execCommand('copy')` both fall through. Auto-dismisses after
 * `TOAST_MS` (or sooner if the user clicks). The toast slide is a named
 * motion exception (see `MOTION_EXCEPTIONS.toastSlideMs`) but routes
 * through the `--motion-toast-*` CSS custom properties exclusively.
 */

import { useEffect } from 'react'
import { TOAST_MS } from '../theme/motion'
import { TOAST_FALLBACK } from './copy'

interface ToastProps {
  readonly visible: boolean
  readonly reduceMotion: boolean
  readonly onDismiss: () => void
}

export function Toast({ visible, reduceMotion, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(onDismiss, TOAST_MS)
    return () => clearTimeout(timer)
  }, [visible, onDismiss])

  if (!visible) return null

  const className = reduceMotion ? 'toast toast--reduced-motion' : 'toast'

  return (
    <div role="status" aria-live="polite" className="toast-region">
      <button type="button" className={className} onClick={onDismiss}>
        {TOAST_FALLBACK}
      </button>
    </div>
  )
}
