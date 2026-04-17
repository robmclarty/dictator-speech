import { describe, expect, it } from 'vitest'

const PALETTE: Readonly<Record<string, readonly [number, number, number]>> = {
  gold: [0xc9, 0xa9, 0x61],
  palm: [0x4a, 0x7c, 0x59],
  coral: [0xd8, 0x8b, 0x7a],
  parchment: [0xf5, 0xe6, 0xc8],
  banana: [0xf4, 0xd3, 0x5e],
  mint: [0xb8, 0xd8, 0xc8],
  ink: [0x2b, 0x18, 0x10],
}

function srgbToLinear(c: number): number {
  const cs = c / 255
  return cs <= 0.03928 ? cs / 12.92 : ((cs + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(rgb: readonly [number, number, number]): number {
  const [r, g, b] = rgb
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

function contrastRatio(a: keyof typeof PALETTE, b: keyof typeof PALETTE): number {
  const colorA = PALETTE[a]
  const colorB = PALETTE[b]
  if (!colorA || !colorB) {
    throw new Error(`Unknown color: ${String(a)} or ${String(b)}`)
  }
  const la = relativeLuminance(colorA)
  const lb = relativeLuminance(colorB)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}

describe('WCAG AA contrast on the named pairs', () => {
  it('ink on parchment passes 4.5:1 (normal text body)', () => {
    expect(contrastRatio('ink', 'parchment')).toBeGreaterThanOrEqual(4.5)
  })

  it('ink on banana passes 4.5:1 (page-tint body text)', () => {
    expect(contrastRatio('ink', 'banana')).toBeGreaterThanOrEqual(4.5)
  })

  it('palm on parchment passes 3:1 (large text only — 14px+ is borderline; we permit it as 3:1 for 18.66px+)', () => {
    expect(contrastRatio('palm', 'parchment')).toBeGreaterThanOrEqual(3)
  })

  it('ink on gold passes 4.5:1 (primary button text)', () => {
    expect(contrastRatio('ink', 'gold')).toBeGreaterThanOrEqual(4.5)
  })

  it('focus ring backstop (ink hairline) passes 3:1 against every background it appears on', () => {
    // The coral component of the compound focus ring does not meet 3:1
    // against gold/palm/parchment on its own (the math is published by
    // WCAG and the palette is fixed). The 1px ink hairline shipped on the
    // outer edge of the focus ring carries the SC 1.4.11 contrast.
    // Phase 4 (criterion 10) extends this to every background the ring
    // can land on: gold (primary button), palm (no — skip button text is
    // palm-on-parchment so the ring renders against parchment), parchment
    // (teleprompter/toast/error-card), banana (page tint), mint
    // (control surfaces), and palm itself (listed for completeness).
    expect(contrastRatio('ink', 'gold')).toBeGreaterThanOrEqual(3)
    expect(contrastRatio('ink', 'palm')).toBeGreaterThanOrEqual(3)
    expect(contrastRatio('ink', 'parchment')).toBeGreaterThanOrEqual(3)
    expect(contrastRatio('ink', 'banana')).toBeGreaterThanOrEqual(3)
    expect(contrastRatio('ink', 'mint')).toBeGreaterThanOrEqual(3)
  })

  it('ink on mint passes 4.5:1 (control-field text over mint surface)', () => {
    // Mint is the dropdown/slider/copy-button/history surface. The
    // control labels and copy-button text read against mint at 14px;
    // WCAG AA requires 4.5:1 for normal text.
    expect(contrastRatio('ink', 'mint')).toBeGreaterThanOrEqual(4.5)
  })
})
