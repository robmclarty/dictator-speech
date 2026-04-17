/**
 * Versioned, typed, gracefully-degrading persistence for the single
 * `alpha:state` key. The parser narrows `unknown -> GameState` without
 * `any` and without `as` casts (enforced by ast-grep). Every storage
 * boundary — read, write, JSON.parse — is wrapped so failures fall back to
 * in-memory state and emit at most one console warning per session.
 */

import { useCallback, useRef, useState } from 'react'
import {
  HISTORY_CAP,
  INITIAL_STATE,
  SCHEMA_VERSION,
  STORAGE_KEY,
  appendHistory,
  isLength,
  isUserMood,
  setLastLength,
  setLastMood,
  toggleFavourite,
  type GameState,
  type HistoryEntry,
  type Length,
  type UserMood,
} from './game-state'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseHistoryEntry(value: unknown): HistoryEntry | null {
  if (!isRecord(value)) return null
  const { seed, mood, length, timestamp, favourite } = value
  if (typeof seed !== 'string' || seed.length === 0) return null
  if (!isUserMood(mood)) return null
  if (!isLength(length)) return null
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return null
  if (typeof favourite !== 'boolean') return null
  return { seed, mood, length, timestamp, favourite }
}

function parseHistory(value: unknown): readonly HistoryEntry[] | null {
  if (!Array.isArray(value)) return null
  const out: HistoryEntry[] = []
  for (const item of value) {
    const entry = parseHistoryEntry(item)
    if (entry === null) return null
    out.push(entry)
  }
  return out
}

/**
 * Narrow `unknown` (typically `JSON.parse(rawString)`) into a `GameState`.
 * Returns `null` if any field is missing, mistyped, or carries a version
 * other than `SCHEMA_VERSION`. The caller treats `null` as a signal to
 * fall back to `INITIAL_STATE` (no migration in v1).
 */
export function parseGameState(input: unknown): GameState | null {
  if (!isRecord(input)) return null
  const { version, lastMood, lastLength, history, totalGenerated } = input
  if (version !== SCHEMA_VERSION) return null
  if (!isUserMood(lastMood)) return null
  if (!isLength(lastLength)) return null
  if (typeof totalGenerated !== 'number' || !Number.isFinite(totalGenerated)) return null
  const parsedHistory = parseHistory(history)
  if (parsedHistory === null) return null
  return {
    version: SCHEMA_VERSION,
    lastMood,
    lastLength,
    history: parsedHistory,
    totalGenerated,
  }
}

/**
 * Resolve the browser localStorage in a Node-safe way. Returns `null`
 * when no Storage is available (SSR, private-mode throw, missing global).
 * Wrapped in try/catch because some browsers throw on access in private
 * browsing mode.
 */
function getDefaultStorage(): StorageLike | null {
  try {
    if (typeof window === 'undefined') return null
    const ls = window.localStorage
    if (typeof ls.getItem !== 'function' || typeof ls.setItem !== 'function') return null
    return ls
  } catch {
    return null
  }
}

interface SessionWarn {
  warn: (message: string) => void
}

function makeOnceWarner(): SessionWarn {
  let warned = false
  return {
    warn(message: string): void {
      if (warned) return
      warned = true
      console.warn(message)
    },
  }
}

/**
 * Load and parse the stored state. Any failure (missing storage, invalid
 * JSON, schema mismatch, throw on read) returns `INITIAL_STATE` and emits
 * at most one warning containing the storage key.
 */
export function loadGameState(
  storage: StorageLike | null = getDefaultStorage(),
  warner: SessionWarn = makeOnceWarner(),
): GameState {
  if (storage === null) return INITIAL_STATE
  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    warner.warn(`alpha:state: read failed; using defaults`)
    return INITIAL_STATE
  }
  if (raw === null) return INITIAL_STATE
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    warner.warn(`alpha:state: stored payload is not valid JSON; using defaults`)
    return INITIAL_STATE
  }
  const state = parseGameState(parsed)
  if (state === null) {
    warner.warn(`alpha:state: stored payload failed schema check; using defaults`)
    return INITIAL_STATE
  }
  return state
}

export type SaveResult = 'ok' | 'failed' | 'unavailable'

/**
 * Serialize and persist the state. Returns `'failed'` on quota /
 * SecurityError (and warns once); returns `'unavailable'` when no
 * storage backend exists. The caller's in-memory state is unaffected on
 * failure.
 */
export function saveGameState(
  state: GameState,
  storage: StorageLike | null = getDefaultStorage(),
  warner: SessionWarn = makeOnceWarner(),
): SaveResult {
  if (storage === null) return 'unavailable'
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state))
    return 'ok'
  } catch {
    warner.warn(`alpha:state: write failed (quota or SecurityError); state kept in memory only`)
    return 'failed'
  }
}

export interface GameStateApi {
  readonly state: GameState
  setMood(mood: UserMood): void
  setLength(length: Length): void
  appendEntry(entry: HistoryEntry): void
  toggleFavouriteEntry(timestamp: number): void
}

/**
 * React state mirror over the single `alpha:state` key. Read happens once
 * on mount via lazy init; writes flow through every setter. The hook
 * never throws — write failures keep the in-memory value and warn once.
 */
export function useGameState(storage: StorageLike | null = getDefaultStorage()): GameStateApi {
  const warnerRef = useRef<SessionWarn>(makeOnceWarner())
  const storageRef = useRef<StorageLike | null>(storage)
  const [state, setState] = useState<GameState>(() => loadGameState(storage, warnerRef.current))

  const persist = useCallback((next: GameState): void => {
    saveGameState(next, storageRef.current, warnerRef.current)
  }, [])

  const update = useCallback(
    (mutate: (prev: GameState) => GameState): void => {
      setState((prev) => {
        const next = mutate(prev)
        if (next === prev) return prev
        persist(next)
        return next
      })
    },
    [persist],
  )

  const setMood = useCallback(
    (mood: UserMood): void => update((prev) => setLastMood(prev, mood)),
    [update],
  )
  const setLength = useCallback(
    (length: Length): void => update((prev) => setLastLength(prev, length)),
    [update],
  )
  const appendEntry = useCallback(
    (entry: HistoryEntry): void => update((prev) => appendHistory(prev, entry)),
    [update],
  )
  const toggleFavouriteEntry = useCallback(
    (timestamp: number): void => update((prev) => toggleFavourite(prev, timestamp)),
    [update],
  )

  return { state, setMood, setLength, appendEntry, toggleFavouriteEntry }
}

export { HISTORY_CAP }
