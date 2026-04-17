// Runtime validator for the hand-authored chunks corpus. Narrows unknown JSON
// into a strongly-typed Chunk[] at load time so every consumer downstream can
// trust the data without additional runtime checks.

export type Slot =
  | 'salutation'
  | 'opening_boast'
  | 'grievance'
  | 'enemy_accusation'
  | 'triumphant_claim'
  | 'call_to_action'
  | 'sign_off'
  | 'tangent'
  | 'digression'

export type Mood = 'paranoid' | 'triumphant' | 'rambling' | 'any'

export interface Chunk {
  readonly id: string
  readonly slot: Slot
  readonly mood: Mood
  readonly text: string
}

export const SLOT_VALUES: readonly Slot[] = [
  'salutation',
  'opening_boast',
  'grievance',
  'enemy_accusation',
  'triumphant_claim',
  'call_to_action',
  'sign_off',
  'tangent',
  'digression',
]

export const MOOD_VALUES: readonly Mood[] = ['paranoid', 'triumphant', 'rambling', 'any']

export const MAX_CHUNK_TEXT_LENGTH = 400

export class ChunkCorpusError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChunkCorpusError'
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSlot(value: unknown): value is Slot {
  if (typeof value !== 'string') return false
  for (const candidate of SLOT_VALUES) {
    if (candidate === value) return true
  }
  return false
}

function isMood(value: unknown): value is Mood {
  if (typeof value !== 'string') return false
  for (const candidate of MOOD_VALUES) {
    if (candidate === value) return true
  }
  return false
}

function parseChunk(value: unknown, index: number): Chunk {
  if (!isRecord(value)) {
    throw new ChunkCorpusError(`Entry at index ${index} is not an object.`)
  }
  const { id, slot, mood, text } = value
  if (typeof id !== 'string' || id.length === 0) {
    throw new ChunkCorpusError(`Entry at index ${index} has a missing or empty id.`)
  }
  if (!isSlot(slot)) {
    throw new ChunkCorpusError(`Chunk ${id} has unknown slot ${JSON.stringify(slot)}.`)
  }
  if (!isMood(mood)) {
    throw new ChunkCorpusError(`Chunk ${id} has unknown mood ${JSON.stringify(mood)}.`)
  }
  if (typeof text !== 'string') {
    throw new ChunkCorpusError(`Chunk ${id} has non-string text.`)
  }
  if (text.length === 0) {
    throw new ChunkCorpusError(`Chunk ${id} has empty text.`)
  }
  if (text.length > MAX_CHUNK_TEXT_LENGTH) {
    throw new ChunkCorpusError(
      `Chunk ${id} text exceeds ${MAX_CHUNK_TEXT_LENGTH} characters (length ${text.length}).`,
    )
  }
  return { id, slot, mood, text }
}

/**
 * Parse an unknown value (typically `chunks.json` imported via Vite) into a
 * `Chunk[]`. Throws a `ChunkCorpusError` naming the first offending entry on
 * any shape violation or duplicate id.
 */
export function parseChunksCorpus(input: unknown): Chunk[] {
  if (!Array.isArray(input)) {
    throw new ChunkCorpusError('Chunks corpus must be a JSON array.')
  }
  const seen = new Set<string>()
  const result: Chunk[] = []
  for (let i = 0; i < input.length; i += 1) {
    const chunk = parseChunk(input[i], i)
    if (seen.has(chunk.id)) {
      throw new ChunkCorpusError(`Duplicate chunk id ${chunk.id}.`)
    }
    seen.add(chunk.id)
    result.push(chunk)
  }
  return result
}
