/**
 * In-character copy strings — Ministry of Information voice. Strings are
 * exact: do not paraphrase, soften, or modernize. Tests in
 * src/app/__tests__/copy.test.ts pin every value to its spec'd literal.
 *
 * Also exposes `copyText`, the two-tier clipboard fallback that powers the
 * Copy button. The third tier (a parchment toast) is rendered separately
 * by the Toast component when copyText resolves to `'manual'`.
 */

export const IDLE_PROMPT = "Awaiting the Leader's address…" as const

export const GENERATE_LABEL = 'Address the Nation' as const

export const SKIP_LABEL = 'Skip' as const

export const COPY_LABEL = 'Copy' as const

export const FAVOURITE_LABEL = 'Favourite' as const

export const UNFAVOURITE_LABEL = 'Unfavourite' as const

export const HISTORY_LABEL = 'Replay' as const

export const TOAST_FALLBACK = 'Selected for you, Comrade. Press \u2318C / Ctrl+C.' as const

export const ERROR_HEADLINE = 'The Leader is indisposed.' as const

export const ERROR_BODY = 'A regrettable interruption. The address will resume momentarily.' as const

export const ERROR_RELOAD_LABEL = 'Resume the address.' as const

export const FOOTER_DISCLAIMER =
  'Entirely fictional. Any resemblance to actual persons is coincidental and ridiculous.' as const

export const PORTRAIT_ALT =
  'A portrait of the Leader, resplendent in dress uniform and improbable medals.' as const

export type CopyResult = 'clipboard' | 'execCommand' | 'manual'

/**
 * Try the asynchronous Clipboard API first; fall back to the legacy
 * `execCommand('copy')` selection trick; if both fail, the caller
 * surfaces the toast that asks the user to press ⌘C / Ctrl+C themselves.
 *
 * Must run inside a user gesture handler (button click) — clipboard
 * writes outside a gesture are blocked by every modern browser.
 */
export async function copyText(text: string): Promise<CopyResult> {
  if (await tryClipboardApi(text)) return 'clipboard'
  if (tryExecCommand(text)) return 'execCommand'
  return 'manual'
}

async function tryClipboardApi(text: string): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined') return false
    const clip = navigator.clipboard
    if (!clip || typeof clip.writeText !== 'function') return false
    await clip.writeText(text)
    return true
  } catch {
    return false
  }
}

function tryExecCommand(text: string): boolean {
  try {
    if (typeof document === 'undefined') return false
    const exec = document.execCommand
    if (typeof exec !== 'function') return false
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '-1000px'
    textarea.style.left = '-1000px'
    document.body.appendChild(textarea)
    try {
      textarea.select()
      const ok = document.execCommand('copy')
      return ok === true
    } finally {
      document.body.removeChild(textarea)
    }
  } catch {
    return false
  }
}
