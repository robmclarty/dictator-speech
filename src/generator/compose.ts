// Compose a full speech from (seed, mood, length, corpus). Pure, deterministic,
// side-effect free: the only external contact is the injected corpus. Same
// input yields a byte-identical `Speech` record across runs, across engines,
// and across rebuilds.

import type { Chunk, Mood, Slot } from '../data/chunks.schema'
import { createPrng } from './prng'
import { expandSkeleton } from './skeleton'
import type { Length } from './skeleton'
import { pickChunks } from './picker'

export type { Length } from './skeleton'

export interface SpeechChunk {
  readonly slot: Slot
  readonly chunkId: string
}

export interface Speech {
  readonly seed: string
  readonly mood: Mood
  readonly length: Length
  readonly text: string
  readonly chunks: readonly SpeechChunk[]
}

export interface ComposeInput {
  readonly seed: string
  readonly mood: Mood
  readonly length: Length
  readonly corpus: readonly Chunk[]
}

// Slots that should open a fresh paragraph in the rendered text. A paragraph
// break is the composer's only structural punctuation; everything else is
// prose joined by single spaces.
const PARAGRAPH_BREAK_SLOTS: ReadonlySet<Slot> = new Set<Slot>([
  'enemy_accusation',
  'call_to_action',
])

export function composeSpeech({ seed, mood, length, corpus }: ComposeInput): Speech {
  const prng = createPrng(seed)
  const skeleton = expandSkeleton(mood, length, prng)
  const picks = pickChunks(skeleton, mood, corpus, prng)

  const byId = new Map<string, Chunk>()
  for (const chunk of corpus) byId.set(chunk.id, chunk)

  const kept: Array<{ readonly slot: Slot; readonly chunkId: string; readonly text: string }> = []
  for (const pick of picks) {
    if (pick.chunkId === null) continue
    const chunk = byId.get(pick.chunkId)
    if (chunk === undefined) continue
    kept.push({ slot: pick.slot, chunkId: pick.chunkId, text: chunk.text })
  }

  const segments: string[] = []
  for (let i = 0; i < kept.length; i += 1) {
    const entry = kept[i]
    if (entry === undefined) continue
    if (i === 0) {
      segments.push(entry.text)
    } else if (PARAGRAPH_BREAK_SLOTS.has(entry.slot)) {
      segments.push('\n\n', entry.text)
    } else {
      segments.push(' ', entry.text)
    }
  }

  // Collapse any accidental runs of 2+ regular spaces (does not touch the
  // intentional `\n\n` paragraph breaks) and strip trailing whitespace.
  const text = segments.join('').replace(/ {2,}/g, ' ').trimEnd()

  return {
    seed,
    mood,
    length,
    text,
    chunks: kept.map((k) => ({ slot: k.slot, chunkId: k.chunkId })),
  }
}
