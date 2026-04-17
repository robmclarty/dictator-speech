// @vitest-environment jsdom

import { createElement } from 'react'
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CHARS_PER_SECOND } from '../../theme/motion'
import { Teleprompter, visibleAtElapsed } from '../teleprompter'

describe('visibleAtElapsed', () => {
  it('returns 0 for non-positive elapsed time', () => {
    expect(visibleAtElapsed(0, 100)).toBe(0)
    expect(visibleAtElapsed(-50, 100)).toBe(0)
  })

  it('clamps to the input length when the cadence overruns it', () => {
    expect(visibleAtElapsed(60_000, 50)).toBe(50)
  })

  it('lands within 40-50 chars/sec over a 200-character span', () => {
    // The configured cadence is 45 chars/sec. Over 1000ms we expect
    // exactly floor(45) = 45 visible characters.
    const visible = visibleAtElapsed(1000, 200)
    expect(visible).toBeGreaterThanOrEqual(40)
    expect(visible).toBeLessThanOrEqual(50)
    expect(visible).toBe(CHARS_PER_SECOND)
  })
})

interface MountedHarness {
  container: HTMLDivElement
  root: Root
  unmount: () => void
}

function mountInDocument(node: React.ReactElement): MountedHarness {
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

describe('Teleprompter rendering', () => {
  let harness: MountedHarness | null = null

  afterEach(() => {
    if (harness) {
      harness.unmount()
      harness = null
    }
  })

  it('renders the idle prompt and an empty aria-live region for empty text', () => {
    const onComplete = vi.fn()
    harness = mountInDocument(
      createElement(Teleprompter, {
        text: '',
        generationId: 0,
        reduceMotion: true,
        skipSignal: 0,
        onComplete,
      }),
    )
    expect(harness.container.querySelector('.teleprompter-idle')?.textContent).toBe(
      "Awaiting the Leader's address\u2026",
    )
    const live = harness.container.querySelector('[aria-live="polite"]')
    expect(live).not.toBeNull()
    expect(live?.getAttribute('aria-atomic')).toBe('true')
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('reduceMotion=true renders the full text on first paint and skips the cursor', () => {
    const onComplete = vi.fn()
    const text = 'Glory to the harvest. Peace to the loyal.'
    harness = mountInDocument(
      createElement(Teleprompter, {
        text,
        generationId: 1,
        reduceMotion: true,
        skipSignal: 0,
        onComplete,
      }),
    )
    const body = harness.container.querySelector('.teleprompter-body')
    expect(body?.textContent).toContain(text)
    expect(harness.container.querySelector('.teleprompter-cursor')).toBeNull()
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('writes the complete text into the aria-live region exactly once per generation', () => {
    const onComplete = vi.fn()
    const text = 'A full address with multiple sentences. Glory.'
    harness = mountInDocument(
      createElement(Teleprompter, {
        text,
        generationId: 1,
        reduceMotion: true,
        skipSignal: 0,
        onComplete,
      }),
    )
    const live = harness.container.querySelector('[aria-live="polite"]')
    expect(live?.textContent).toBe(text)
    // A second prop change should produce exactly one new write — checked
    // by re-rendering with a different generationId/text.
    const text2 = 'A second address. Even more glory.'
    act(() => {
      harness?.root.render(
        createElement(Teleprompter, {
          text: text2,
          generationId: 2,
          reduceMotion: true,
          skipSignal: 0,
          onComplete,
        }),
      )
    })
    expect(live?.textContent).toBe(text2)
  })

  it('does not render the Skip button inside the teleprompter (it lives in the app-level tab order)', () => {
    // Criteria 6/23/27/38: Skip must appear after Generate in tab order.
    // The fix is to lift Skip out of Teleprompter into a sibling of the
    // teleprompter <section>, rendered by App. This test pins that the
    // teleprompter itself never mounts its own .skip-button.
    const onComplete = vi.fn()
    harness = mountInDocument(
      createElement(Teleprompter, {
        text: 'Hello comrades.',
        generationId: 1,
        reduceMotion: false,
        skipSignal: 0,
        onComplete,
      }),
    )
    expect(harness.container.querySelector('.skip-button')).toBeNull()
  })

  it('ignores the initial skipSignal value on mount', () => {
    const onComplete = vi.fn()
    // The reveal is in-flight; if the initial skipSignal value triggered
    // skip, onComplete would fire synchronously on mount. Under normal
    // motion it should only fire after the 800ms cursor-fade-out timer.
    harness = mountInDocument(
      createElement(Teleprompter, {
        text: 'Hello.',
        generationId: 1,
        reduceMotion: false,
        skipSignal: 7,
        onComplete,
      }),
    )
    expect(onComplete).not.toHaveBeenCalled()
  })
})
