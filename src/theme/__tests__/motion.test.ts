import { describe, expect, it } from 'vitest'
import {
  CHARS_PER_SECOND,
  MOTION_CSS_VARS,
  MOTION_EXCEPTIONS,
  TOAST_MS,
  TRANSITION,
} from '../motion'

describe('motion constants', () => {
  it('reveal cadence is 45 chars per second', () => {
    expect(CHARS_PER_SECOND).toBe(45)
  })

  it('universal transition is "120ms ease-out"', () => {
    expect(TRANSITION).toBe('120ms ease-out')
  })

  it('toast lifetime is 6000ms', () => {
    expect(TOAST_MS).toBe(6000)
  })

  it('records the named non-120ms exceptions', () => {
    expect(MOTION_EXCEPTIONS.toastSlideMs).toBe(200)
    expect(MOTION_EXCEPTIONS.skipFadeInMs).toBe(200)
    expect(MOTION_EXCEPTIONS.cursorFadeOutMs).toBe(800)
  })

  it('publishes every constant as a CSS custom property', () => {
    expect(MOTION_CSS_VARS['--motion-transition']).toBe(TRANSITION)
    expect(MOTION_CSS_VARS['--motion-chars-per-second']).toBe(String(CHARS_PER_SECOND))
    expect(MOTION_CSS_VARS['--motion-toast-ms']).toBe(`${TOAST_MS}ms`)
    expect(MOTION_CSS_VARS['--motion-toast-slide-ms']).toBe(`${MOTION_EXCEPTIONS.toastSlideMs}ms`)
    expect(MOTION_CSS_VARS['--motion-skip-fade-in-ms']).toBe(`${MOTION_EXCEPTIONS.skipFadeInMs}ms`)
    expect(MOTION_CSS_VARS['--motion-cursor-fade-out-ms']).toBe(
      `${MOTION_EXCEPTIONS.cursorFadeOutMs}ms`,
    )
  })
})
