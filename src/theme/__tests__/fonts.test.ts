import { gzipSync } from 'node:zlib'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const FONTS_DIR = resolve(__dirname, '../fonts')
const FILE_700 = resolve(FONTS_DIR, 'PlayfairDisplay-700.woff2')
const FILE_900 = resolve(FONTS_DIR, 'PlayfairDisplay-900.woff2')

const HTML = readFileSync(resolve(__dirname, '../../../index.html'), 'utf8')
const TYPO = readFileSync(resolve(__dirname, '../typography.css'), 'utf8')

const FONT_BUDGET_BYTES = 40 * 1024 // 40KB

describe('Self-hosted Playfair Display', () => {
  it('ships exactly 700 + 900 woff2 weights', () => {
    expect(statSync(FILE_700).isFile()).toBe(true)
    expect(statSync(FILE_900).isFile()).toBe(true)
  })

  it('combined gzipped size stays under 40KB', () => {
    const buf700 = readFileSync(FILE_700)
    const buf900 = readFileSync(FILE_900)
    const combined = Buffer.concat([buf700, buf900])
    const gzipped = gzipSync(combined, { level: 9 })
    expect(gzipped.byteLength).toBeLessThanOrEqual(FONT_BUDGET_BYTES)
  })

  it('@font-face declarations use font-display: swap', () => {
    const faces = TYPO.match(/@font-face\s*{[^}]*}/g) ?? []
    expect(faces).toHaveLength(2)
    for (const face of faces) {
      expect(face).toMatch(/font-display:\s*swap/)
    }
  })

  it('preloads only the 700 weight in index.html', () => {
    const preloads = HTML.match(/<link[^>]+rel=["']preload["'][^>]*>/g) ?? []
    const fontPreloads = preloads.filter((tag) => /as=["']font["']/.test(tag))
    expect(fontPreloads).toHaveLength(1)
    expect(fontPreloads[0]).toContain('PlayfairDisplay-700')
    expect(fontPreloads[0]).not.toContain('900')
  })

  it('does not reference any external font CDN', () => {
    expect(HTML).not.toMatch(/fonts\.googleapis\.com/)
    expect(HTML).not.toMatch(/fonts\.gstatic\.com/)
    expect(TYPO).not.toMatch(/fonts\.googleapis\.com/)
    expect(TYPO).not.toMatch(/fonts\.gstatic\.com/)
  })
})
