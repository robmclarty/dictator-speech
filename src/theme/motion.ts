/**
 * Motion constants — single source of truth for cadence, transitions, and
 * named exceptions. Both the RAF loop and the stylesheets read from here, so
 * the visible animation and the CSS transitions cannot drift.
 */

export const CHARS_PER_SECOND = 45 as const

export const TRANSITION = '120ms ease-out' as const

export const TOAST_MS = 6000 as const

/**
 * Named exceptions to the universal 120ms transition. These are the ONLY
 * non-120ms durations permitted anywhere in the app.
 */
export const MOTION_EXCEPTIONS = {
  toastSlideMs: 200,
  skipFadeInMs: 200,
  cursorFadeOutMs: 800,
} as const

/**
 * CSS custom properties surfaced from this module. Imported once at theme
 * boot so the stylesheet sees the same values as the RAF loop.
 */
export const MOTION_CSS_VARS: Readonly<Record<string, string>> = {
  '--motion-transition': TRANSITION,
  '--motion-chars-per-second': String(CHARS_PER_SECOND),
  '--motion-toast-ms': `${TOAST_MS}ms`,
  '--motion-toast-slide-ms': `${MOTION_EXCEPTIONS.toastSlideMs}ms`,
  '--motion-skip-fade-in-ms': `${MOTION_EXCEPTIONS.skipFadeInMs}ms`,
  '--motion-cursor-fade-out-ms': `${MOTION_EXCEPTIONS.cursorFadeOutMs}ms`,
}

/**
 * Inject the motion custom properties onto :root. Idempotent — safe to call
 * multiple times. Keeps motion.ts as the single tunable surface for both
 * TS and CSS.
 */
export function installMotionCssVars(target: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(MOTION_CSS_VARS)) {
    target.style.setProperty(name, value)
  }
}
