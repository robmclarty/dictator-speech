/**
 * The teleprompter renders the speech with a typewriter cadence sourced
 * from the single `CHARS_PER_SECOND` constant. The visible reveal is
 * decorative — the screen-reader path mirrors the *complete* text into a
 * visually-hidden aria-live region in a single update per generation, so
 * AT users do not hear a per-character stutter storm.
 *
 * Cadence flows through `requestAnimationFrame` only — the no-set-interval
 * ast-grep rule continues to enforce that.
 */

import { useEffect, useRef, useState } from 'react'
import { CHARS_PER_SECOND, MOTION_EXCEPTIONS } from '../theme/motion'
import { IDLE_PROMPT, SKIP_LABEL } from './copy'

interface TeleprompterProps {
  readonly text: string
  readonly onComplete: () => void
  readonly reduceMotion: boolean
  /**
   * Bumped by the parent to start a fresh reveal of the same `text`. A
   * regenerated speech that happens to compose to identical text still
   * triggers a new reveal because this counter changes.
   */
  readonly generationId: number
}

interface RevealState {
  readonly visible: number
  readonly done: boolean
}

const INITIAL_REVEAL: RevealState = { visible: 0, done: false }

/**
 * Compute how many characters should be visible after `elapsedMs` of
 * reveal at the configured cadence. Exported for the cadence integration
 * test (it asserts the function over a 200-character input lands in the
 * 40–50 chars/sec range).
 */
export function visibleAtElapsed(elapsedMs: number, length: number): number {
  if (elapsedMs <= 0) return 0
  const charsPerMs = CHARS_PER_SECOND / 1000
  const visible = Math.floor(elapsedMs * charsPerMs)
  return visible >= length ? length : visible
}

export function Teleprompter({
  text,
  onComplete,
  reduceMotion,
  generationId,
}: TeleprompterProps) {
  const [reveal, setReveal] = useState<RevealState>(INITIAL_REVEAL)
  const [cursorVisible, setCursorVisible] = useState<boolean>(false)
  const liveRef = useRef<HTMLDivElement | null>(null)
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const cursorAnchorRef = useRef<HTMLSpanElement | null>(null)

  // Reset reveal whenever a new generation starts. The visible-text path
  // depends on `text`; the aria-live path is updated once below.
  useEffect(() => {
    if (text.length === 0) {
      setReveal(INITIAL_REVEAL)
      setCursorVisible(false)
      return
    }
    // Mirror the complete speech into the aria-live region exactly once
    // per generation. Setting textContent (vs React children) keeps this
    // a single observable mutation that the integration spy can pin.
    const live = liveRef.current
    if (live !== null) live.textContent = text

    if (reduceMotion) {
      setReveal({ visible: text.length, done: true })
      setCursorVisible(false)
      onComplete()
      return
    }

    setReveal(INITIAL_REVEAL)
    setCursorVisible(true)

    let rafHandle = 0
    let startTime = 0
    let cancelled = false
    let completionTimer: ReturnType<typeof setTimeout> | null = null

    const tick = (now: number): void => {
      if (cancelled) return
      if (startTime === 0) startTime = now
      const visible = visibleAtElapsed(now - startTime, text.length)
      if (visible >= text.length) {
        setReveal({ visible: text.length, done: true })
        completionTimer = setTimeout(() => {
          if (cancelled) return
          setCursorVisible(false)
          onComplete()
        }, MOTION_EXCEPTIONS.cursorFadeOutMs)
        return
      }
      setReveal({ visible, done: false })
      rafHandle = requestAnimationFrame(tick)
    }

    rafHandle = requestAnimationFrame(tick)

    return () => {
      cancelled = true
      if (rafHandle !== 0) cancelAnimationFrame(rafHandle)
      if (completionTimer !== null) clearTimeout(completionTimer)
    }
    // generationId / text / reduceMotion form the reveal contract.
    // onComplete is in deps for correctness; identity churn is harmless
    // because the cleanup cancels the in-flight rAF and timer.
  }, [text, reduceMotion, generationId, onComplete])

  // Auto-scroll: when the cursor crosses 80% of the surface viewport,
  // scroll the next line into view. Behaviour switches under reduced
  // motion to instant (per acceptance criterion 16).
  useEffect(() => {
    if (reveal.visible === 0) return
    const surface = surfaceRef.current
    const anchor = cursorAnchorRef.current
    if (surface === null || anchor === null) return
    const surfaceRect = surface.getBoundingClientRect()
    const anchorRect = anchor.getBoundingClientRect()
    const threshold = surfaceRect.top + surfaceRect.height * 0.8
    // Guard for environments (jsdom) that omit scrollIntoView.
    if (anchorRect.bottom >= threshold && typeof anchor.scrollIntoView === 'function') {
      anchor.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'nearest',
      })
    }
  }, [reveal.visible, reduceMotion])

  if (text.length === 0) {
    return (
      <section className="teleprompter" aria-label="Teleprompter">
        <p className="teleprompter-idle">{IDLE_PROMPT}</p>
        <div ref={liveRef} className="visually-hidden" aria-live="polite" aria-atomic="true" />
      </section>
    )
  }

  const visibleText = text.slice(0, reveal.visible)
  const showCursor = cursorVisible && !reveal.done

  const handleSkip = (): void => {
    setReveal({ visible: text.length, done: true })
    setCursorVisible(false)
    onComplete()
  }

  return (
    <section className="teleprompter" aria-label="Teleprompter">
      <div ref={surfaceRef} className="teleprompter-surface">
        <p className="teleprompter-body" aria-hidden="true">
          {visibleText}
          <span ref={cursorAnchorRef} className="teleprompter-cursor-anchor">
            {showCursor && (
              <span
                className={
                  reduceMotion
                    ? 'teleprompter-cursor teleprompter-cursor--static'
                    : 'teleprompter-cursor'
                }
                aria-hidden="true"
              >
                {'\u258C'}
              </span>
            )}
          </span>
        </p>
      </div>
      {!reveal.done && (
        <button
          type="button"
          className={
            reduceMotion ? 'skip-button skip-button--instant' : 'skip-button'
          }
          onClick={handleSkip}
        >
          {SKIP_LABEL}
        </button>
      )}
      <div ref={liveRef} className="visually-hidden" aria-live="polite" aria-atomic="true" />
    </section>
  )
}
