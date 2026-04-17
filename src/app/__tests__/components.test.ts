import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  ERROR_BODY,
  ERROR_HEADLINE,
  ERROR_RELOAD_LABEL,
  FOOTER_DISCLAIMER,
  IDLE_PROMPT,
} from '../copy'
import { ErrorBoundary } from '../error-boundary'
import { Footer } from '../footer'
import { Teleprompter } from '../teleprompter'

/**
 * SSR snapshots only. We render with renderToStaticMarkup so a Node env is
 * sufficient — no jsdom required at this phase.
 *
 * Note on ErrorBoundary: React's legacy synchronous SSR renderer does not
 * invoke error boundaries when a child throws (only the streaming renderer
 * does). To exercise the fallback we (a) verify the static catch hook
 * directly, and (b) render via a minimal subclass that pre-sets
 * state.hasError = true. The single-class-component ast-grep rule targets
 * `extends Component` / `extends React.Component`; subclassing
 * ErrorBoundary itself is not a class-component proliferation.
 */

const ESCAPED_APOSTROPHE = '&#x27;'

function htmlIncludes(html: string, raw: string): boolean {
  const escaped = raw.replace(/'/g, ESCAPED_APOSTROPHE)
  return html.includes(escaped) || html.includes(raw)
}

describe('Footer', () => {
  it('renders the disclaimer copy verbatim inside a footer landmark', () => {
    const html = renderToStaticMarkup(createElement(Footer))
    expect(html).toContain('<footer')
    expect(htmlIncludes(html, FOOTER_DISCLAIMER)).toBe(true)
  })
})

describe('Teleprompter (idle state)', () => {
  it('exposes a labelled section with the idle prompt copy', () => {
    const html = renderToStaticMarkup(
      createElement(Teleprompter, {
        text: '',
        generationId: 0,
        reduceMotion: true,
        skipSignal: 0,
        onComplete: () => {},
      }),
    )
    expect(html).toContain('aria-label="Teleprompter"')
    expect(htmlIncludes(html, IDLE_PROMPT)).toBe(true)
  })
})

class HasErrorBoundary extends ErrorBoundary {
  override state = { hasError: true }
}

describe('ErrorBoundary', () => {
  it('renders children when no error has been thrown', () => {
    const child = createElement('p', { 'data-testid': 'happy' }, 'hello')
    const html = renderToStaticMarkup(createElement(ErrorBoundary, null, child))
    expect(html).toContain('data-testid="happy"')
    expect(html).toContain('hello')
    expect(htmlIncludes(html, ERROR_HEADLINE)).toBe(false)
  })

  it('getDerivedStateFromError flips state.hasError to true', () => {
    expect(ErrorBoundary.getDerivedStateFromError(new Error('boom'))).toEqual({
      hasError: true,
    })
  })

  it('renders the in-character fallback overlay when state.hasError is true', () => {
    const placeholder: ReactNode = createElement('p', null, 'never-rendered')
    const html = renderToStaticMarkup(
      createElement(HasErrorBoundary, null, placeholder),
    )
    expect(html).toContain('role="alertdialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-labelledby="error-headline"')
    expect(htmlIncludes(html, ERROR_HEADLINE)).toBe(true)
    expect(htmlIncludes(html, ERROR_BODY)).toBe(true)
    expect(htmlIncludes(html, ERROR_RELOAD_LABEL)).toBe(true)
    // Footer must still ship inside the fallback so the disclaimer stays visible.
    expect(htmlIncludes(html, FOOTER_DISCLAIMER)).toBe(true)
    // The original child must not have rendered.
    expect(html).not.toContain('never-rendered')
  })
})
