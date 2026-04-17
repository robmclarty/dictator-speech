// @vitest-environment jsdom

/**
 * Integration: keyboard tab order across idle, revealing, and done
 * states. Acceptance criteria 6/23/27/38 all reduce to the same rule —
 * the DOM sequence of focusable controls must be
 *
 *   mood → length → generate → skip (when present) → copy → favourite
 *
 * regardless of where those controls sit visually. This test mounts the
 * full `<App />` and walks the document's tab-order candidates to confirm
 * the sequence in each state.
 */

import { createElement } from 'react'
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/app/app'

type Labelled = { readonly label: string; readonly el: Element }

/**
 * Return the tab-ordered list of "role-bearing" focusables we care about,
 * labelled by their semantic role. We inspect document DOM order (which
 * is the browser's default tab order, modulo explicit tabIndex) and
 * filter to the six control types the spec enumerates.
 */
function focusOrder(container: Element): readonly Labelled[] {
  const result: Labelled[] = []
  const focusables = container.querySelectorAll<HTMLElement>(
    'button, input, select, [tabindex]',
  )
  for (const el of focusables) {
    if (el.hasAttribute('disabled')) continue
    const tabIndex = el.getAttribute('tabindex')
    if (tabIndex !== null && Number.parseInt(tabIndex, 10) < 0) continue
    const label = labelFor(el)
    if (label === null) continue
    result.push({ el, label })
  }
  return result
}

function labelFor(el: Element): string | null {
  if (el instanceof HTMLSelectElement && el.classList.contains('control-select')) {
    return 'mood'
  }
  if (el instanceof HTMLInputElement && el.classList.contains('control-slider')) {
    return 'length'
  }
  if (el.classList.contains('primary-button')) return 'generate'
  if (el.classList.contains('skip-button')) return 'skip'
  if (el.classList.contains('copy-button')) return 'copy'
  if (el.classList.contains('history-replay')) return 'replay'
  if (el.classList.contains('history-favourite')) return 'favourite'
  return null
}

interface Harness {
  container: HTMLDivElement
  root: Root
  unmount(): void
}

function mount(): Harness {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(createElement(App))
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

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  window.localStorage.clear()
})

describe('keyboard tab order across states', () => {
  let harness: Harness | null = null

  afterEach(() => {
    if (harness !== null) {
      harness.unmount()
      harness = null
    }
  })

  it('idle state: mood → length → generate (copy disabled, no history)', () => {
    harness = mount()
    const order = focusOrder(harness.container).map((o) => o.label)
    // Copy is disabled on idle so it should not appear in the enabled-
    // focusable list. Skip is absent. No history entries → no favourite.
    expect(order).toEqual(['mood', 'length', 'generate'])
  })

  it('revealing state: mood → length → generate → skip (skip appears after generate)', () => {
    // Fake rAF so the reveal stalls mid-flight and the Skip button
    // remains rendered for the duration of the assertion.
    vi.useFakeTimers()
    try {
      harness = mount()
      const generate = harness.container.querySelector<HTMLButtonElement>('.primary-button')
      expect(generate).not.toBeNull()
      act(() => {
        generate?.click()
      })
      const order = focusOrder(harness.container).map((o) => o.label)
      expect(order).toEqual(['mood', 'length', 'generate', 'skip'])
      // Skip precedes Copy in the sequence — pin the rule explicitly.
      expect(order.indexOf('skip')).toBe(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('done state: mood → length → generate → copy → replay → favourite (skip absent)', () => {
    vi.useFakeTimers()
    try {
      harness = mount()
      const generate = harness.container.querySelector<HTMLButtonElement>('.primary-button')
      expect(generate).not.toBeNull()
      act(() => {
        generate?.click()
      })
      // Drive the reveal + 800ms cursor-fade-out timer to completion.
      // Speeches top out at ~1000 words; advancing 30s past rAF start
      // clears the cadence and the completion timer.
      act(() => {
        vi.advanceTimersByTime(30_000)
      })
      const order = focusOrder(harness.container).map((o) => o.label)
      expect(order).toEqual(['mood', 'length', 'generate', 'copy', 'replay', 'favourite'])
      expect(order).not.toContain('skip')
    } finally {
      vi.useRealTimers()
    }
  })
})
