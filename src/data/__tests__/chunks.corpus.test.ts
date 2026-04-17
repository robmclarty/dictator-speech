import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  MAX_CHUNK_TEXT_LENGTH,
  MOOD_VALUES,
  SLOT_VALUES,
  parseChunksCorpus,
} from '../chunks.schema'
import type { Chunk, Mood, Slot } from '../chunks.schema'
import rawCorpus from '../chunks.json'

const corpus: readonly Chunk[] = parseChunksCorpus(rawCorpus)

// Slots × moods that the spec requires to be stocked (≥3 chunks in the
// (slot, mood) cell, or a ≥3-chunk (slot, 'any') fallback for that slot).
const REQUIRED_SLOTS: readonly Slot[] = [
  'salutation',
  'opening_boast',
  'grievance',
  'enemy_accusation',
  'triumphant_claim',
  'call_to_action',
  'sign_off',
]
const REQUIRED_MOODS: readonly Mood[] = ['paranoid', 'triumphant', 'rambling']

// Resolve chunks.json on disk for the gzipped-size budget check.
const corpusPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'chunks.json')

describe('chunks corpus', () => {
  it('contains at least 100 entries', () => {
    expect(corpus.length).toBeGreaterThanOrEqual(100)
  })

  it('has unique, non-empty ids and valid slot/mood/text fields on every chunk', () => {
    const seen = new Set<string>()
    for (const chunk of corpus) {
      expect(chunk.id.length, `empty id in corpus`).toBeGreaterThan(0)
      expect(seen.has(chunk.id), `duplicate id ${chunk.id}`).toBe(false)
      seen.add(chunk.id)
      expect(SLOT_VALUES, `chunk ${chunk.id} unknown slot ${chunk.slot}`).toContain(chunk.slot)
      expect(MOOD_VALUES, `chunk ${chunk.id} unknown mood ${chunk.mood}`).toContain(chunk.mood)
      expect(chunk.text.length, `chunk ${chunk.id} has empty text`).toBeGreaterThan(0)
      expect(
        chunk.text.length,
        `chunk ${chunk.id} text exceeds ${MAX_CHUNK_TEXT_LENGTH} chars`,
      ).toBeLessThanOrEqual(MAX_CHUNK_TEXT_LENGTH)
    }
  })

  it('every required (slot, mood) cell has ≥3 chunks, or the slot has a ≥3-chunk "any" fallback', () => {
    const thin: string[] = []
    for (const slot of REQUIRED_SLOTS) {
      const anyCount = corpus.filter((c) => c.slot === slot && c.mood === 'any').length
      for (const mood of REQUIRED_MOODS) {
        const count = corpus.filter((c) => c.slot === slot && c.mood === mood).length
        if (count < 3 && anyCount < 3) {
          thin.push(`${slot} × ${mood} (cell=${count}, any=${anyCount})`)
        }
      }
    }
    expect(thin, `under-stocked cells: ${thin.join(', ')}`).toHaveLength(0)
  })

  it('gzipped chunks.json is ≤100KB', () => {
    const bytes = readFileSync(corpusPath)
    const gzipped = gzipSync(bytes)
    expect(gzipped.byteLength).toBeLessThanOrEqual(100 * 1024)
  })

  it('contains no references to real political figures, ethnic/national/religious groups, or slurs', () => {
    // Mechanical guard backing the authorial review note in
    // `src/data/README.md`. The list is non-exhaustive by design — its job
    // is to catch accidental drift during routine corpus expansion, not to
    // replace the authorial discipline the README describes.
    const forbiddenTerms: readonly string[] = [
      'Trump', 'Putin', 'Biden', 'Obama', 'Stalin', 'Hitler', 'Mussolini', 'Mao',
      'Kim Jong', 'Xi Jinping', 'Pol Pot', 'Castro', 'Franco', 'Pinochet',
      'Russia', 'China', 'America', 'American', 'Korea', 'Korean',
      'Iran', 'Iranian', 'Iraq', 'Iraqi', 'Israel', 'Israeli', 'Palestine',
      'Christian', 'Muslim', 'Jewish', 'Hindu', 'Buddhist',
    ]
    const violations: string[] = []
    for (const chunk of corpus) {
      for (const term of forbiddenTerms) {
        const pattern = new RegExp(`\\b${term}\\b`, 'i')
        if (pattern.test(chunk.text)) {
          violations.push(`${chunk.id} contains "${term}"`)
        }
      }
    }
    expect(violations, `content guardrail violations: ${violations.join('; ')}`).toHaveLength(0)
  })
})
