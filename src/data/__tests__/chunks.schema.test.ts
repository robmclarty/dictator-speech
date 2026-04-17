import { describe, expect, it } from 'vitest'

import {
  ChunkCorpusError,
  MAX_CHUNK_TEXT_LENGTH,
  parseChunksCorpus,
} from '../chunks.schema'
import rawCorpus from '../chunks.json'

describe('parseChunksCorpus', () => {
  it('accepts the real corpus and returns a Chunk[] with every id preserved', () => {
    const parsed = parseChunksCorpus(rawCorpus)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBeGreaterThan(0)
    const rawIds = (rawCorpus as ReadonlyArray<{ readonly id: string }>).map((c) => c.id)
    expect(parsed.map((c) => c.id)).toEqual(rawIds)
  })

  it('rejects a non-array input', () => {
    expect(() => parseChunksCorpus({ not: 'an array' })).toThrow(ChunkCorpusError)
  })

  it('rejects a duplicate chunk id and names it in the message', () => {
    const input = [
      { id: 'dup', slot: 'salutation', mood: 'any', text: 'First.' },
      { id: 'dup', slot: 'salutation', mood: 'any', text: 'Second.' },
    ]
    expect(() => parseChunksCorpus(input)).toThrow(/dup/)
  })

  it('rejects an unknown slot', () => {
    const input = [{ id: 'bad-slot', slot: 'banana', mood: 'any', text: 'nope' }]
    expect(() => parseChunksCorpus(input)).toThrow(/banana/)
  })

  it('rejects an unknown mood', () => {
    const input = [{ id: 'bad-mood', slot: 'salutation', mood: 'vibrant', text: 'nope' }]
    expect(() => parseChunksCorpus(input)).toThrow(/vibrant/)
  })

  it('rejects non-string text', () => {
    const input = [{ id: 'bad-text', slot: 'salutation', mood: 'any', text: 42 }]
    expect(() => parseChunksCorpus(input)).toThrow(/bad-text/)
  })

  it('rejects empty text', () => {
    const input = [{ id: 'empty', slot: 'salutation', mood: 'any', text: '' }]
    expect(() => parseChunksCorpus(input)).toThrow(/empty/)
  })

  it('rejects text exceeding the configured maximum length', () => {
    const input = [
      {
        id: 'too-long',
        slot: 'salutation',
        mood: 'any',
        text: 'x'.repeat(MAX_CHUNK_TEXT_LENGTH + 1),
      },
    ]
    expect(() => parseChunksCorpus(input)).toThrow(/too-long/)
  })

  it('rejects entries that are not objects', () => {
    expect(() => parseChunksCorpus(['not-an-object'])).toThrow(/index 0/)
  })

  it('rejects entries missing an id', () => {
    const input = [{ slot: 'salutation', mood: 'any', text: 'hi' }]
    expect(() => parseChunksCorpus(input)).toThrow(/missing or empty id/)
  })
})
