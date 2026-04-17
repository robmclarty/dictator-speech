import { describe, it, expect } from 'vitest'

import type { Length } from '../skeleton'
import { createPrng } from '../prng'
import { expandSkeleton } from '../skeleton'
import type { Mood, Slot } from '../../data/chunks.schema'

const ALL_MOODS: readonly Mood[] = ['triumphant', 'paranoid', 'rambling']
const ALL_LENGTHS: readonly Length[] = ['short', 'medium', 'long', 'rambling']

describe('expandSkeleton', () => {
  it('short (any mood) returns the fixed 7-slot base skeleton', () => {
    const expected: Slot[] = [
      'salutation',
      'opening_boast',
      'grievance',
      'enemy_accusation',
      'triumphant_claim',
      'call_to_action',
      'sign_off',
    ]
    expect(expandSkeleton('triumphant', 'short', createPrng('s'))).toEqual(expected)
  })

  it('triumphant medium returns 9 slots with gr/en/tc each exactly twice', () => {
    const skeleton = expandSkeleton('triumphant', 'medium', createPrng('m'))
    expect(skeleton).toHaveLength(9)
    expect(skeleton.filter((s) => s === 'grievance')).toHaveLength(2)
    expect(skeleton.filter((s) => s === 'enemy_accusation')).toHaveLength(2)
    expect(skeleton.filter((s) => s === 'triumphant_claim')).toHaveLength(2)
  })

  it('triumphant long returns 12 slots with each repeated middle slot exactly three times', () => {
    const skeleton = expandSkeleton('triumphant', 'long', createPrng('l'))
    expect(skeleton).toHaveLength(12)
    expect(skeleton.filter((s) => s === 'grievance')).toHaveLength(3)
    expect(skeleton.filter((s) => s === 'enemy_accusation')).toHaveLength(3)
    expect(skeleton.filter((s) => s === 'triumphant_claim')).toHaveLength(3)
  })

  it('triumphant rambling-length returns 18 slots with each repeated middle slot exactly five times', () => {
    const skeleton = expandSkeleton('triumphant', 'rambling', createPrng('r'))
    expect(skeleton).toHaveLength(18)
    expect(skeleton.filter((s) => s === 'grievance')).toHaveLength(5)
    expect(skeleton.filter((s) => s === 'enemy_accusation')).toHaveLength(5)
    expect(skeleton.filter((s) => s === 'triumphant_claim')).toHaveLength(5)
  })

  it('rambling mood + medium length returns 13 slots with an insert after each gr and tc', () => {
    const skeleton = expandSkeleton('rambling', 'medium', createPrng('rm-seed'))
    expect(skeleton).toHaveLength(13)
    // The skeleton was built from the 9-slot medium base + 4 inserts (one
    // after each of two grievance slots + one after each of two
    // triumphant_claim slots). Verify each gr/tc is followed by a tan/dig.
    for (let i = 0; i < skeleton.length - 1; i += 1) {
      const current = skeleton[i]
      if (current === 'grievance' || current === 'triumphant_claim') {
        expect(['tangent', 'digression']).toContain(skeleton[i + 1])
      }
    }
    const inserts = skeleton.filter((s) => s === 'tangent' || s === 'digression')
    expect(inserts).toHaveLength(4)
  })

  it('first slot is always salutation and last is always sign_off for every (mood, length) combination', () => {
    for (const mood of ALL_MOODS) {
      for (const length of ALL_LENGTHS) {
        const skeleton = expandSkeleton(mood, length, createPrng(`${mood}-${length}`))
        expect(skeleton[0]).toBe('salutation')
        expect(skeleton[skeleton.length - 1]).toBe('sign_off')
      }
    }
  })

  it('is deterministic: same seed + mood + length yields byte-identical slot arrays across runs', () => {
    for (const mood of ALL_MOODS) {
      for (const length of ALL_LENGTHS) {
        const seed = `det:${mood}:${length}`
        const a = expandSkeleton(mood, length, createPrng(seed))
        const b = expandSkeleton(mood, length, createPrng(seed))
        expect(a).toEqual(b)
      }
    }
  })
})
