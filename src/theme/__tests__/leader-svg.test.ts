import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SVG_PATH = resolve(__dirname, '../leader.svg')
const SVG = readFileSync(SVG_PATH, 'utf8')

const PALETTE_HEXES = new Set([
  '#C9A961',
  '#4A7C59',
  '#D88B7A',
  '#F5E6C8',
  '#F4D35E',
  '#B8D8C8',
  '#2B1810',
])

const SVG_BUDGET_BYTES = 100 * 1024 // 100KB

describe('Leader portrait SVG', () => {
  it('declares a 600 x 800 viewBox', () => {
    expect(SVG).toMatch(/viewBox=["']0 0 600 800["']/)
  })

  it('exposes role and aria-label so screen readers can name it', () => {
    expect(SVG).toMatch(/role=["']img["']/)
    expect(SVG).toMatch(/aria-label=["'][^"']+["']/)
  })

  it('uses only the seven brand palette hex colors', () => {
    const hexes = SVG.match(/#[0-9A-Fa-f]{3,8}/g) ?? []
    expect(hexes.length).toBeGreaterThan(0)
    for (const hex of hexes) {
      const upper = hex.toUpperCase()
      expect(PALETTE_HEXES, `unexpected color ${upper} in leader.svg`).toContain(upper)
    }
  })

  it('contains zero pure black or pure white literals', () => {
    expect(SVG).not.toMatch(/#000(?!\w)/i)
    expect(SVG).not.toMatch(/#fff(?!\w)/i)
    expect(SVG).not.toMatch(/#000000/i)
    expect(SVG).not.toMatch(/#ffffff/i)
    expect(SVG).not.toMatch(/\bblack\b/i)
    expect(SVG).not.toMatch(/\bwhite\b/i)
  })

  it('file size stays under 100KB', () => {
    expect(statSync(SVG_PATH).size).toBeLessThanOrEqual(SVG_BUDGET_BYTES)
  })
})
