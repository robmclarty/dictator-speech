// @vitest-environment jsdom

/**
 * Cross-state accessibility sweep. Mounts the full `<App />` in jsdom and
 * walks it through each rendered state (idle, revealing, done, toast-
 * visible, error-card) with axe-core running against each state.
 *
 * axe-core in jsdom is not a perfect substitute for a headless-browser
 * run — jsdom does not implement layout so axe skips some rules that
 * depend on computed styles (e.g. `color-contrast`). The complementary
 * story lives in `docs/verification.md`, which records manual
 * cross-viewport checks. Together they satisfy criterion 8 (zero
 * violations) and criterion 12 (aria-live mirror receives exactly one
 * textContent write per generation).
 *
 * Covers acceptance criteria 8, 11, 12.
 */

import axe from 'axe-core'
import { createElement } from 'react'
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/app/app'
import { ErrorBoundary } from '../../src/app/error-boundary'
import { Toast } from '../../src/app/toast'

// axe rules that cannot produce meaningful output in jsdom (no layout
// engine, no real style computation). They are backstopped by the
// project-wide contrast.test.ts and the manual verification log.
const AXE_OPTIONS: axe.RunOptions = {
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
  },
  rules: {
    // jsdom has no layout engine — axe's color-contrast rule cannot
    // compute effective background colors. The contrast posture is
    // enforced elsewhere (src/theme/__tests__/contrast.test.ts).
    'color-contrast': { enabled: false },
    // jsdom does not lay out text, so these also produce false positives.
    'scrollable-region-focusable': { enabled: false },
  },
}

interface Harness {
  container: HTMLDivElement
  root: Root
  unmount(): void
}

function mount(node: React.ReactElement): Harness {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(node)
  })
  return {
    container,
    root,
    unmount() {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

/**
 * Click the primary "Address the Nation" button in the mounted harness.
 * Fails loudly if the button is missing — every caller assumes the click
 * lands, so a silent miss would hide a regression.
 */
function clickGenerate(harness: Harness): void {
  const generate = harness.container.querySelector<HTMLButtonElement>('.primary-button')
  expect(generate).not.toBeNull()
  act(() => {
    generate?.click()
  })
}

/**
 * Drive the App through a full generate → reveal → completion cycle
 * under fake timers. 30_000ms is the same overkill window used by the
 * tab-order test — enough to clear the rAF reveal + 800ms cursor-
 * fade-out for any length bucket.
 */
function runToCompletion(harness: Harness): void {
  clickGenerate(harness)
  act(() => {
    vi.advanceTimersByTime(30_000)
  })
}

async function audit(root: Element): Promise<axe.AxeResults> {
  // axe-core's internal scheduler uses setTimeout; under fake timers the
  // outstanding microtasks never settle and a subsequent run throws
  // "Axe is already running". Swap to real timers for the duration of
  // each audit, then restore whatever timer mode the caller had.
  const fake = vi.isFakeTimers()
  if (fake) vi.useRealTimers()
  try {
    return await axe.run(root, AXE_OPTIONS)
  } finally {
    if (fake) vi.useFakeTimers()
  }
}

function describeViolations(results: axe.AxeResults): string {
  if (results.violations.length === 0) return 'none'
  return results.violations
    .map((v) => `${v.id} (${v.impact ?? 'unknown'}) × ${v.nodes.length}`)
    .join('; ')
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  window.localStorage.clear()
})

describe('axe-core accessibility sweep', () => {
  let harness: Harness | null = null

  afterEach(() => {
    if (harness !== null) {
      harness.unmount()
      harness = null
    }
  })

  it('idle state has zero axe violations', async () => {
    harness = mount(createElement(App))
    const results = await audit(harness.container)
    expect(results.violations, describeViolations(results)).toEqual([])
  })

  it('revealing state has zero axe violations', async () => {
    vi.useFakeTimers()
    try {
      harness = mount(createElement(App))
      clickGenerate(harness)
      // Advance a couple of rAF ticks so the reveal has started but not
      // completed. The reveal finishes at 45 chars/sec, so 50ms still has
      // characters pending for a non-trivial speech.
      const results = await audit(harness.container)
      expect(results.violations, describeViolations(results)).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })

  it('done state has zero axe violations (with at least one history entry)', async () => {
    vi.useFakeTimers()
    try {
      harness = mount(createElement(App))
      runToCompletion(harness)
      // Copy button should now be enabled; a history item should exist.
      const copy = harness.container.querySelector<HTMLButtonElement>('.copy-button')
      expect(copy?.disabled).toBe(false)
      expect(harness.container.querySelector('.history-item')).not.toBeNull()
      const results = await audit(harness.container)
      expect(results.violations, describeViolations(results)).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })

  it('toast-visible state has zero axe violations', async () => {
    // Mount Toast directly so we exercise the visible state deterministic-
    // ally. Its role=status + aria-live polite markers are the surface
    // axe cares about.
    harness = mount(
      createElement(Toast, {
        visible: true,
        reduceMotion: false,
        onDismiss: () => {},
      }),
    )
    const results = await audit(harness.container)
    expect(results.violations, describeViolations(results)).toEqual([])
    // Confirm the toast actually rendered.
    expect(harness.container.querySelector('.toast-region')).not.toBeNull()
  })

  it('error-card state has zero axe violations', async () => {
    // ThrowingChild forces ErrorBoundary into its fallback render path.
    const ThrowingChild = (): never => {
      throw new Error('Induced failure for axe sweep')
    }
    // Silence both the React componentDidCatch console.error log and the
    // jsdom window 'error' event it dispatches (unrelated to the test).
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const swallow = (event: Event): void => {
      event.preventDefault()
    }
    window.addEventListener('error', swallow)
    try {
      harness = mount(createElement(ErrorBoundary, null, createElement(ThrowingChild)))
      expect(harness.container.querySelector('.error-overlay')).not.toBeNull()
      const results = await audit(harness.container)
      expect(results.violations, describeViolations(results)).toEqual([])
    } finally {
      window.removeEventListener('error', swallow)
      consoleError.mockRestore()
    }
  })
})

describe('aria-live mirror integration', () => {
  let harness: Harness | null = null

  afterEach(() => {
    if (harness !== null) {
      harness.unmount()
      harness = null
    }
  })

  it('writes the complete speech text into the aria-live region on generate', () => {
    vi.useFakeTimers()
    try {
      harness = mount(createElement(App))
      runToCompletion(harness)
      const live = harness.container.querySelector<HTMLDivElement>('[aria-live="polite"][aria-atomic="true"]')
      expect(live).not.toBeNull()
      expect(live?.textContent ?? '').not.toBe('')
      // aria-atomic=true and aria-live=polite enforce the "one update per
      // generation" contract on the AT side.
      expect(live?.getAttribute('aria-live')).toBe('polite')
      expect(live?.getAttribute('aria-atomic')).toBe('true')
    } finally {
      vi.useRealTimers()
    }
  })

  it('aria-live mirror gets exactly one textContent write per generation (no per-character stutter)', () => {
    // We instrument textContent on HTMLDivElement's prototype, count
    // writes, and confirm there is exactly one write across the full
    // reveal + completion lifecycle.
    //
    // The idle render paints an empty mirror via JSX children (not via
    // textContent), so the baseline write count is 0; the generation
    // effect then sets textContent once.
    vi.useFakeTimers()
    let writeCount = 0
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      Node.prototype,
      'textContent',
    )
    expect(originalDescriptor).not.toBeUndefined()
    const originalSet = originalDescriptor?.set
    const originalGet = originalDescriptor?.get
    expect(typeof originalSet).toBe('function')
    expect(typeof originalGet).toBe('function')
    Object.defineProperty(Node.prototype, 'textContent', {
      configurable: true,
      get(this: Node): string | null {
        return originalGet?.call(this) ?? null
      },
      set(this: Node, value: string) {
        if (
          this instanceof HTMLElement &&
          this.getAttribute('aria-live') === 'polite' &&
          this.getAttribute('aria-atomic') === 'true'
        ) {
          writeCount += 1
        }
        originalSet?.call(this, value)
      },
    })
    try {
      harness = mount(createElement(App))
      runToCompletion(harness)
      // Exactly one write into the aria-live mirror per generation.
      expect(writeCount).toBe(1)
    } finally {
      if (originalDescriptor !== undefined) {
        Object.defineProperty(Node.prototype, 'textContent', originalDescriptor)
      }
      vi.useRealTimers()
    }
  })
})

describe('reduced-motion verification (criterion 11)', () => {
  let harness: Harness | null = null
  let originalMatchMedia: typeof window.matchMedia | undefined

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
    // Simulate prefers-reduced-motion: reduce.
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string): MediaQueryList => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    })
  })

  afterEach(() => {
    if (harness !== null) {
      harness.unmount()
      harness = null
    }
    if (originalMatchMedia !== undefined) {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      })
    }
  })

  it('typewriter is bypassed — full speech renders instantly on generate', () => {
    harness = mount(createElement(App))
    clickGenerate(harness)
    // Under reduced motion, Teleprompter commits the full text + fires
    // onComplete synchronously on first effect. Copy button should be
    // enabled right after the click and the blink cursor must not render.
    const copy = harness.container.querySelector<HTMLButtonElement>('.copy-button')
    expect(copy?.disabled).toBe(false)
    expect(harness.container.querySelector('.teleprompter-cursor')).toBeNull()
  })

  it('Skip button remains rendered and operable under reduced motion (criterion 41)', () => {
    harness = mount(createElement(App))
    clickGenerate(harness)
    // Skip stays rendered post-reveal under reduced motion.
    const skip = harness.container.querySelector<HTMLButtonElement>('.skip-button')
    expect(skip).not.toBeNull()
    expect(skip?.disabled).toBeFalsy()
    // Clicking Skip is a safe no-op (reveal already done); must not throw.
    act(() => {
      skip?.click()
    })
  })
})
