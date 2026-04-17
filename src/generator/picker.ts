// Chunk picker — selects one chunk per slot in an expanded skeleton. Honours
// three invariants: (1) mood-specific chunks take priority, with `mood: 'any'`
// as an empty-cell fallback; (2) a length tier derived from skeleton length
// biases toward pithy chunks for short speeches and verbose chunks for
// rambling ones, so the composed word count lands in the documented ranges
// without burdening the caller; (3) no chunk id appears in two consecutive
// positions when the candidate pool has a larger alternative available.

import type { Chunk, Mood, Slot } from '../data/chunks.schema'

type Tier = 'compact' | 'standard' | 'expanded' | 'verbose'

// Each tier degrades through the others in a preference order. Compact falls
// through standard next (closest to it in length) before expanded and verbose;
// verbose falls through expanded before shorter tiers. The ladder guarantees
// we always pick *something* while staying as close as possible to the
// preferred tier when it is under-stocked.
const TIER_CASCADE: Readonly<Record<Tier, readonly Tier[]>> = {
  compact: ['compact', 'standard', 'expanded', 'verbose'],
  standard: ['standard', 'compact', 'expanded', 'verbose'],
  expanded: ['expanded', 'verbose', 'standard', 'compact'],
  verbose: ['verbose', 'expanded', 'standard', 'compact'],
}

function wordCount(text: string): number {
  const trimmed = text.trim()
  if (trimmed.length === 0) return 0
  return trimmed.split(/\s+/).length
}

function tierForChunk(chunk: Chunk): Tier {
  const n = wordCount(chunk.text)
  if (n <= 14) return 'compact'
  if (n <= 28) return 'standard'
  if (n <= 45) return 'expanded'
  return 'verbose'
}

/**
 * Map skeleton length to a preferred tier. Thresholds match the length
 * buckets emitted by `expandSkeleton` and the word-count ranges documented in
 * the phase spec.
 */
function tierForSpeech(skeletonLength: number): Tier {
  if (skeletonLength <= 7) return 'compact'
  if (skeletonLength <= 9) return 'standard'
  if (skeletonLength <= 13) return 'expanded'
  return 'verbose'
}

function candidatesFor(corpus: readonly Chunk[], slot: Slot, mood: Mood): Chunk[] {
  const moodPool = corpus.filter((c) => c.slot === slot && c.mood === mood)
  if (moodPool.length > 0) return moodPool
  return corpus.filter((c) => c.slot === slot && c.mood === 'any')
}

function filterByTierCascade(candidates: readonly Chunk[], preferred: Tier): Chunk[] {
  for (const tier of TIER_CASCADE[preferred]) {
    const matches = candidates.filter((c) => tierForChunk(c) === tier)
    if (matches.length > 0) return matches
  }
  return candidates.slice()
}

function chooseAvoidingPrev(pool: Chunk[], prevId: string | null, prng: () => number): Chunk | null {
  const filtered = prevId === null ? pool : pool.filter((c) => c.id !== prevId)
  const source: Chunk[] = filtered.length > 0 ? filtered : pool
  if (source.length === 0) return null
  const index = Math.floor(prng() * source.length)
  const chosen: Chunk | undefined = source[index]
  return chosen ?? null
}

export interface PickedChunk {
  readonly slot: Slot
  readonly chunkId: string | null
}

/**
 * Pick one chunk per slot in the expanded skeleton. Returns `chunkId: null`
 * for any slot with no available chunks in either `(slot, mood)` or
 * `(slot, 'any')`; emits a single `console.warn` per missing slot.
 */
export function pickChunks(
  skeleton: readonly Slot[],
  mood: Mood,
  corpus: readonly Chunk[],
  prng: () => number,
): PickedChunk[] {
  const preferred = tierForSpeech(skeleton.length)
  const result: PickedChunk[] = []
  const warnedSlots = new Set<Slot>()
  let prevId: string | null = null

  for (const slot of skeleton) {
    const candidates = candidatesFor(corpus, slot, mood)
    if (candidates.length === 0) {
      if (!warnedSlots.has(slot)) {
        // A single warn per missing slot keeps the console quiet when a
        // whole speech is generated against a degenerate corpus in tests.
        console.warn(`pickChunks: no chunks available for slot "${slot}".`)
        warnedSlots.add(slot)
      }
      result.push({ slot, chunkId: null })
      prevId = null
      continue
    }

    const pool = filterByTierCascade(candidates, preferred)
    const chosen = chooseAvoidingPrev(pool, prevId, prng)
    if (chosen === null) {
      result.push({ slot, chunkId: null })
      prevId = null
      continue
    }
    result.push({ slot, chunkId: chosen.id })
    prevId = chosen.id
  }

  return result
}
