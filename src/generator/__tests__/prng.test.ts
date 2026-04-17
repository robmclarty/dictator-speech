import { describe, it, expect } from 'vitest'

import { createPrng, generateSeed } from '../prng'

describe('createPrng', () => {
  it('returns the same first value across invocations for the same seed', () => {
    const a = createPrng('abc')()
    const b = createPrng('abc')()
    expect(a).toBe(b)
  })

  it('produces different first values for adjacent seeds', () => {
    const a = createPrng('abc')()
    const b = createPrng('abd')()
    expect(a).not.toBe(b)
  })

  it('yields numbers strictly in [0, 1) over 10,000 samples', () => {
    const prng = createPrng('range-probe')
    for (let i = 0; i < 10_000; i += 1) {
      const value = prng()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('produces byte-identical sequences across two instances for 1000 calls', () => {
    const a = createPrng('determinism')
    const b = createPrng('determinism')
    for (let i = 0; i < 1000; i += 1) {
      expect(a()).toBe(b())
    }
  })
})

describe('generateSeed', () => {
  it('returns a base36 string of length 1–8 matching /^[0-9a-z]+$/', () => {
    for (let i = 0; i < 200; i += 1) {
      const seed = generateSeed()
      expect(seed).toMatch(/^[0-9a-z]+$/)
      expect(seed.length).toBeGreaterThanOrEqual(1)
      expect(seed.length).toBeLessThanOrEqual(8)
    }
  })

  it('round-trips losslessly through JSON.stringify/JSON.parse', () => {
    const seed = generateSeed()
    const roundTripped: unknown = JSON.parse(JSON.stringify({ seed }))
    expect(roundTripped).toEqual({ seed })
  })
})
