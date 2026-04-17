// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { copyText } from '../copy'

const originalClipboard = navigator.clipboard
const originalExec = document.execCommand

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: undefined,
  })
})

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: originalClipboard,
  })
  document.execCommand = originalExec
  vi.restoreAllMocks()
})

describe('copyText', () => {
  it('returns "clipboard" when navigator.clipboard.writeText resolves', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const result = await copyText('Glory.')
    expect(result).toBe('clipboard')
    expect(writeText).toHaveBeenCalledWith('Glory.')
  })

  it('falls through to execCommand when the Clipboard API rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('blocked'))
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const exec = vi.fn().mockReturnValue(true)
    document.execCommand = exec
    const result = await copyText('Glory.')
    expect(result).toBe('execCommand')
    expect(exec).toHaveBeenCalledWith('copy')
  })

  it('returns "manual" when both paths fail', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('nope'))
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const exec = vi.fn().mockReturnValue(false)
    document.execCommand = exec
    const result = await copyText('Glory.')
    expect(result).toBe('manual')
  })

  it('falls through to execCommand when no Clipboard API is present', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })
    const exec = vi.fn().mockReturnValue(true)
    document.execCommand = exec
    const result = await copyText('Address.')
    expect(result).toBe('execCommand')
  })
})
