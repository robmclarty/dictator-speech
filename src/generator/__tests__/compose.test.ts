import { describe, expect, it } from 'vitest'

import { parseChunksCorpus } from '../../data/chunks.schema'
import type { Chunk, Slot } from '../../data/chunks.schema'
import rawCorpus from '../../data/chunks.json'
import { composeSpeech } from '../compose'
import type { Length } from '../skeleton'

const corpus: readonly Chunk[] = parseChunksCorpus(rawCorpus)

function wordCount(text: string): number {
  const trimmed = text.trim()
  if (trimmed.length === 0) return 0
  return trimmed.split(/\s+/).length
}

function meanWords(length: Length): number {
  let total = 0
  const samples = 100
  for (let i = 0; i < samples; i += 1) {
    const speech = composeSpeech({
      seed: `wc-${length}-${i}`,
      mood: 'triumphant',
      length,
      corpus,
    })
    total += wordCount(speech.text)
  }
  return total / samples
}

describe('composeSpeech', () => {
  it('is deterministic: identical (seed, mood, length, corpus) yields byte-identical text', () => {
    const a = composeSpeech({ seed: 'fixed', mood: 'triumphant', length: 'short', corpus })
    const b = composeSpeech({ seed: 'fixed', mood: 'triumphant', length: 'short', corpus })
    expect(a.text).toBe(b.text)
    expect(a.chunks).toEqual(b.chunks)
    expect(a.seed).toBe(b.seed)
  })

  it('produces no consecutive double spaces and no trailing whitespace over 20 varied speeches', () => {
    const lengths: readonly Length[] = ['short', 'medium', 'long', 'rambling']
    for (let i = 0; i < 20; i += 1) {
      const length = lengths[i % lengths.length] ?? 'short'
      const speech = composeSpeech({
        seed: `ws-${i}`,
        mood: 'triumphant',
        length,
        corpus,
      })
      expect(speech.text).not.toMatch(/ {2,}/)
      expect(speech.text).toBe(speech.text.trimEnd())
    }
  })

  it('inserts a paragraph break before every enemy_accusation and call_to_action (except when one leads the speech)', () => {
    const speech = composeSpeech({
      seed: 'para-break',
      mood: 'triumphant',
      length: 'long',
      corpus,
    })
    // Rebuild the text from chunks and verify paragraph-break placement.
    const byId = new Map<string, Chunk>()
    for (const chunk of corpus) byId.set(chunk.id, chunk)
    let cursor = 0
    for (let i = 0; i < speech.chunks.length; i += 1) {
      const entry = speech.chunks[i]
      if (entry === undefined) continue
      const chunk = byId.get(entry.chunkId)
      expect(chunk).toBeDefined()
      if (chunk === undefined) continue
      const fragmentIndex = speech.text.indexOf(chunk.text, cursor)
      expect(fragmentIndex).toBeGreaterThanOrEqual(cursor)
      if (i === 0) {
        expect(fragmentIndex).toBe(0)
      } else if (entry.slot === 'enemy_accusation' || entry.slot === 'call_to_action') {
        // Expect exactly the two-newline boundary immediately before the
        // fragment, with no stray space in between.
        const separator = speech.text.slice(cursor, fragmentIndex)
        expect(separator).toBe('\n\n')
      } else {
        const separator = speech.text.slice(cursor, fragmentIndex)
        expect(separator).toBe(' ')
      }
      cursor = fragmentIndex + chunk.text.length
    }
  })

  it('skips null-chunk slots and sets chunks.length to skeleton.length minus skipped slots', () => {
    const synthetic: readonly Chunk[] = parseChunksCorpus([
      // Cover every slot the short-length skeleton needs except grievance.
      { id: 'sal-1', slot: 'salutation', mood: 'any', text: 'Hello.' },
      { id: 'ob-1', slot: 'opening_boast', mood: 'any', text: 'I won.' },
      { id: 'en-1', slot: 'enemy_accusation', mood: 'any', text: 'They lost.' },
      { id: 'tc-1', slot: 'triumphant_claim', mood: 'any', text: 'All is well.' },
      { id: 'cta-1', slot: 'call_to_action', mood: 'any', text: 'Cheer on.' },
      { id: 'so-1', slot: 'sign_off', mood: 'any', text: 'Goodbye.' },
    ])
    // Silence the expected grievance warning during this test.
    const warn = console.warn
    console.warn = () => undefined
    try {
      const speech = composeSpeech({
        seed: 'null-skip',
        mood: 'triumphant',
        length: 'short',
        corpus: synthetic,
      })
      // Skeleton length 7 minus 1 missing grievance = 6 kept chunks.
      expect(speech.chunks).toHaveLength(6)
      const slots = speech.chunks.map((c) => c.slot)
      expect(slots).not.toContain<Slot>('grievance')
    } finally {
      console.warn = warn
    }
  })

  it('triumphant short speeches have mean word count in [50, 130] over 100 seeds', () => {
    const mean = meanWords('short')
    expect(mean).toBeGreaterThanOrEqual(50)
    expect(mean).toBeLessThanOrEqual(130)
  })

  it('triumphant medium speeches have mean word count in [140, 280] over 100 seeds', () => {
    const mean = meanWords('medium')
    expect(mean).toBeGreaterThanOrEqual(140)
    expect(mean).toBeLessThanOrEqual(280)
  })

  it('triumphant long speeches have mean word count in [300, 520] over 100 seeds', () => {
    const mean = meanWords('long')
    expect(mean).toBeGreaterThanOrEqual(300)
    expect(mean).toBeLessThanOrEqual(520)
  })

  it('triumphant rambling speeches have mean word count in [600, 1000] over 100 seeds', () => {
    const mean = meanWords('rambling')
    expect(mean).toBeGreaterThanOrEqual(600)
    expect(mean).toBeLessThanOrEqual(1000)
  })
})
