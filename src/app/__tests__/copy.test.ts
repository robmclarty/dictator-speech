import { describe, expect, it } from 'vitest'
import {
  ERROR_BODY,
  ERROR_HEADLINE,
  ERROR_RELOAD_LABEL,
  FOOTER_DISCLAIMER,
  GENERATE_LABEL,
  IDLE_PROMPT,
  PORTRAIT_ALT,
  SKIP_LABEL,
  TOAST_FALLBACK,
} from '../copy'

describe('in-character copy strings', () => {
  it('idle teleprompter prompt is exact', () => {
    expect(IDLE_PROMPT).toBe("Awaiting the Leader's address\u2026")
  })

  it('generate button label is exact', () => {
    expect(GENERATE_LABEL).toBe('Address the Nation')
  })

  it('skip button label is exact', () => {
    expect(SKIP_LABEL).toBe('Skip')
  })

  it('clipboard fallback toast is exact', () => {
    expect(TOAST_FALLBACK).toBe('Selected for you, Comrade. Press \u2318C / Ctrl+C.')
  })

  it('error overlay headline is exact', () => {
    expect(ERROR_HEADLINE).toBe('The Leader is indisposed.')
  })

  it('error overlay body is exact', () => {
    expect(ERROR_BODY).toBe(
      'A regrettable interruption. The address will resume momentarily.',
    )
  })

  it('error overlay reload label is exact', () => {
    expect(ERROR_RELOAD_LABEL).toBe('Resume the address.')
  })

  it('footer disclaimer is exact', () => {
    expect(FOOTER_DISCLAIMER).toBe(
      'Entirely fictional. Any resemblance to actual persons is coincidental and ridiculous.',
    )
  })

  it('portrait alt text is exact', () => {
    expect(PORTRAIT_ALT).toBe(
      'A portrait of the Leader, resplendent in dress uniform and improbable medals.',
    )
  })
})
