/**
 * Persistence schema and pure FIFO/favourite helpers. The storage hook
 * (use-local-storage.ts) keeps its own concerns thin by delegating every
 * mutation to a pure function defined here. Pure means: no I/O, no
 * `Date.now()`, no globals — every output is a deterministic function of
 * its inputs. Mutation helpers return new objects; callers never see
 * mutated input.
 */

import type { Length } from '../generator/compose'

/** Three user-facing moods. The corpus schema also accepts `'any'`, but
 * that value is a corpus-shape token, never offered to the user.
 * `UserMood` is a structural subset of `Mood` from chunks.schema, so it
 * passes through to `composeSpeech` without a cast. */
export type UserMood = 'paranoid' | 'triumphant' | 'rambling'

export type { Length }

export interface HistoryEntry {
  readonly seed: string
  readonly mood: UserMood
  readonly length: Length
  readonly timestamp: number
  readonly favourite: boolean
}

export interface GameState {
  readonly version: 1
  readonly lastMood: UserMood
  readonly lastLength: Length
  readonly history: readonly HistoryEntry[]
  readonly totalGenerated: number
}

export const STORAGE_KEY = 'alpha:state'

export const SCHEMA_VERSION = 1 as const

export const HISTORY_CAP = 50

export const USER_MOODS: readonly UserMood[] = ['paranoid', 'triumphant', 'rambling']

export const LENGTHS: readonly Length[] = ['short', 'medium', 'long', 'rambling']

export const DEFAULT_MOOD: UserMood = 'triumphant'

export const DEFAULT_LENGTH: Length = 'medium'

export const INITIAL_STATE: GameState = {
  version: SCHEMA_VERSION,
  lastMood: DEFAULT_MOOD,
  lastLength: DEFAULT_LENGTH,
  history: [],
  totalGenerated: 0,
}

export function isUserMood(value: unknown): value is UserMood {
  return value === 'paranoid' || value === 'triumphant' || value === 'rambling'
}

export function isLength(value: unknown): value is Length {
  return value === 'short' || value === 'medium' || value === 'long' || value === 'rambling'
}

/**
 * Append a new history entry, evicting the oldest non-favourite when the
 * cap is reached. If every entry is favourited, the oldest favourite is
 * evicted as a last resort and a single dev-console notice is emitted.
 * Increments `totalGenerated` by 1.
 */
export function appendHistory(state: GameState, entry: HistoryEntry): GameState {
  const nextHistory = pushWithCap(state.history, entry)
  return {
    ...state,
    history: nextHistory,
    totalGenerated: state.totalGenerated + 1,
  }
}

function pushWithCap(
  history: readonly HistoryEntry[],
  entry: HistoryEntry,
): readonly HistoryEntry[] {
  const grown = [...history, entry]
  if (grown.length <= HISTORY_CAP) return grown
  // Scan only the *existing* entries for an evictable non-favourite.
  // Including the freshly-appended entry would let a non-favourite new
  // arrival evict itself, silently dropping it.
  const evictionIndex = history.findIndex((h) => !h.favourite)
  if (evictionIndex === -1) {
    // Every existing entry is favourited. Last resort: evict the oldest
    // favourite so the new entry still appears. One notice per overflow.
    console.info('history cap reached with all entries favourited; evicting oldest favourite')
    return grown.slice(1)
  }
  // Splice without mutation.
  return [...grown.slice(0, evictionIndex), ...grown.slice(evictionIndex + 1)]
}

/**
 * Toggle the favourite flag on the history entry matching `timestamp`.
 * Timestamp + seed together identify an entry uniquely (seeds may repeat
 * across re-plays from history, which do not append a new entry — see
 * acceptance criterion 33).
 */
export function toggleFavourite(state: GameState, timestamp: number): GameState {
  const next = state.history.map((h) =>
    h.timestamp === timestamp ? { ...h, favourite: !h.favourite } : h,
  )
  return { ...state, history: next }
}

export function setLastMood(state: GameState, mood: UserMood): GameState {
  return { ...state, lastMood: mood }
}

export function setLastLength(state: GameState, length: Length): GameState {
  return { ...state, lastLength: length }
}
