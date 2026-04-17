import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { parseChunksCorpus } from '../../data/chunks.schema'
import type { Chunk, Mood } from '../../data/chunks.schema'
import rawCorpus from '../../data/chunks.json'
import { createPrng } from '../prng'
import { expandSkeleton } from '../skeleton'
import type { Length } from '../skeleton'
import { pickChunks } from '../picker'

const corpus: readonly Chunk[] = parseChunksCorpus(rawCorpus)

describe('pickChunks', () => {
  it('never picks the same chunkId in two consecutive positions over 100 generations', () => {
    const moods: readonly Mood[] = ['triumphant', 'paranoid', 'rambling']
    const lengths: readonly Length[] = ['short', 'medium', 'long', 'rambling']
    for (let i = 0; i < 100; i += 1) {
      const mood = moods[i % moods.length] ?? 'triumphant'
      const length = lengths[i % lengths.length] ?? 'short'
      const seed = `consec-${i}`
      const skeleton = expandSkeleton(mood, length, createPrng(seed))
      const picks = pickChunks(skeleton, mood, corpus, createPrng(`${seed}-pick`))
      for (let j = 1; j < picks.length; j += 1) {
        const prev = picks[j - 1]
        const current = picks[j]
        if (prev === undefined || current === undefined) continue
        if (prev.chunkId === null || current.chunkId === null) continue
        expect(current.chunkId).not.toBe(prev.chunkId)
      }
    }
  })

  it('falls back to mood "any" when the (slot, mood) cell is empty', () => {
    const synthetic: readonly Chunk[] = parseChunksCorpus([
      // `salutation` has only an `any`-mood chunk; triumphant mood must
      // fall back to it rather than produce a null pick.
      { id: 'only-any', slot: 'salutation', mood: 'any', text: 'Hello.' },
    ])
    const picks = pickChunks(['salutation'], 'triumphant', synthetic, createPrng('fallback'))
    expect(picks).toEqual([{ slot: 'salutation', chunkId: 'only-any' }])
  })

  it('returns chunkId: null and warns exactly once per missing slot when no chunks are available', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const synthetic: readonly Chunk[] = parseChunksCorpus([
      // No salutation at all — neither triumphant nor any.
      { id: 'so-any-1', slot: 'sign_off', mood: 'any', text: 'Goodbye.' },
    ])
    const picks = pickChunks(
      ['salutation', 'salutation', 'sign_off'],
      'triumphant',
      synthetic,
      createPrng('warn'),
    )
    expect(picks[0]).toEqual({ slot: 'salutation', chunkId: null })
    expect(picks[1]).toEqual({ slot: 'salutation', chunkId: null })
    expect(picks[2]).toEqual({ slot: 'sign_off', chunkId: 'so-any-1' })
    expect(warn).toHaveBeenCalledTimes(1)
    const firstCall = warn.mock.calls[0]
    expect(firstCall).toBeDefined()
    const message = firstCall?.[0]
    expect(typeof message).toBe('string')
    expect(String(message)).toContain('salutation')
    warn.mockRestore()
  })

  it('is deterministic: same seed + skeleton + corpus yields byte-identical selections', () => {
    const skeleton = expandSkeleton('paranoid', 'long', createPrng('det'))
    const a = pickChunks(skeleton, 'paranoid', corpus, createPrng('det-pick'))
    const b = pickChunks(skeleton, 'paranoid', corpus, createPrng('det-pick'))
    expect(a).toEqual(b)
  })

  it('yields different selections for different seeds', () => {
    const skeleton = expandSkeleton('triumphant', 'long', createPrng('x'))
    const a = pickChunks(skeleton, 'triumphant', corpus, createPrng('alpha'))
    const b = pickChunks(skeleton, 'triumphant', corpus, createPrng('beta'))
    // Different seeds should produce at least one differing pick across a
    // 12-slot long skeleton — if they don't, the picker is ignoring the prng.
    const anyDifferent = a.some((pick, i) => pick.chunkId !== b[i]?.chunkId)
    expect(anyDifferent).toBe(true)
  })

  let originalWarn: typeof console.warn | null = null
  beforeEach(() => {
    originalWarn = console.warn
  })
  afterEach(() => {
    if (originalWarn !== null) console.warn = originalWarn
  })
})
