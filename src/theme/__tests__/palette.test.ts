import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PALETTE_PATH = resolve(__dirname, '../palette.css')
const RAW_CSS = readFileSync(PALETTE_PATH, 'utf8')

/**
 * Strip /* ... *\/ block comments before scanning for forbidden literals —
 * we only care about declared values, not commentary that may name the
 * forbidden tokens to explain that they are forbidden.
 */
const CSS = RAW_CSS.replace(/\/\*[\s\S]*?\*\//g, '')

const BRAND_TOKENS: ReadonlyArray<readonly [string, string]> = [
  ['--color-gold', '#C9A961'],
  ['--color-palm', '#4A7C59'],
  ['--color-coral', '#D88B7A'],
  ['--color-parchment', '#F5E6C8'],
  ['--color-banana', '#F4D35E'],
  ['--color-mint', '#B8D8C8'],
  ['--color-ink', '#2B1810'],
]

function tokenValue(name: string): string | undefined {
  const match = CSS.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))
  return match?.[1]?.trim()
}

describe('palette.css', () => {
  it('declares all seven brand tokens at exact hex values on :root', () => {
    expect(CSS).toMatch(/:root\s*{/)
    for (const [name, hex] of BRAND_TOKENS) {
      expect(tokenValue(name), `expected ${name} to equal ${hex}`).toBe(hex)
    }
  })

  it('forbids pure black and pure white literals anywhere', () => {
    expect(CSS).not.toMatch(/#000(?!\w)/i)
    expect(CSS).not.toMatch(/#fff(?!\w)/i)
    expect(CSS).not.toMatch(/#000000/i)
    expect(CSS).not.toMatch(/#ffffff/i)
    expect(CSS).not.toMatch(/\bblack\b/i)
    expect(CSS).not.toMatch(/\bwhite\b/i)
  })
})
