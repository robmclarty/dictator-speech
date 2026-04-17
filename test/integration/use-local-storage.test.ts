/**
 * Integration: persistence over the real (jsdom) `window.localStorage`.
 *
 * Covers acceptance criterion 36 in full:
 *   - initial empty read returns defaults
 *   - write/read round-trip
 *   - FIFO cap at 50 evicts the oldest non-favourite
 *   - all-favourites overflow evicts the oldest favourite + emits one
 *     dev-console notice
 *   - favourite toggle persists across reload
 *   - quota / SecurityError on setItem keeps in-memory state intact
 *   - malformed-JSON in storage falls back to defaults (with one warn)
 *   - unknown `version` in storage falls back to defaults (with one warn)
 *
 * The test exercises the same `loadGameState` / `saveGameState` API the
 * React hook routes through, using jsdom's `window.localStorage` as the
 * concrete `StorageLike`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HISTORY_CAP,
  INITIAL_STATE,
  STORAGE_KEY,
  appendHistory,
  toggleFavourite,
  type GameState,
  type HistoryEntry,
} from '../../src/storage/game-state'
import {
  loadGameState,
  saveGameState,
  type StorageLike,
} from '../../src/storage/use-local-storage'

function entry(seed: string, opts: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    seed,
    mood: 'triumphant',
    length: 'medium',
    timestamp: Number.parseInt(seed.replace(/[^0-9a-z]/gi, '0'), 36) || 1,
    favourite: false,
    ...opts,
  }
}

function realStorage(): StorageLike {
  return window.localStorage
}

let warnSpy: ReturnType<typeof vi.spyOn>
let infoSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  window.localStorage.clear()
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  warnSpy.mockRestore()
  infoSpy.mockRestore()
  window.localStorage.clear()
})

describe('use-local-storage integration over window.localStorage', () => {
  it('returns INITIAL_STATE when storage is empty', () => {
    expect(loadGameState(realStorage())).toEqual(INITIAL_STATE)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('round-trips a write through the real localStorage backend', () => {
    const next: GameState = {
      ...INITIAL_STATE,
      lastMood: 'paranoid',
      lastLength: 'long',
      totalGenerated: 3,
      history: [entry('alpha'), entry('beta', { favourite: true })],
    }
    expect(saveGameState(next, realStorage())).toBe('ok')
    const reloaded = loadGameState(realStorage())
    expect(reloaded).toEqual(next)
  })

  it('enforces the FIFO cap at HISTORY_CAP and evicts the oldest non-favourite first', () => {
    let state: GameState = INITIAL_STATE
    for (let i = 0; i < HISTORY_CAP; i += 1) {
      state = appendHistory(state, entry(`s${i}`))
    }
    expect(saveGameState(state, realStorage())).toBe('ok')
    const reloaded = loadGameState(realStorage())
    expect(reloaded.history).toHaveLength(HISTORY_CAP)
    // Now overflow.
    const overflowed = appendHistory(reloaded, entry('overflow'))
    expect(saveGameState(overflowed, realStorage())).toBe('ok')
    const final = loadGameState(realStorage())
    expect(final.history).toHaveLength(HISTORY_CAP)
    expect(final.history[0]?.seed).toBe('s1')
    expect(final.history[HISTORY_CAP - 1]?.seed).toBe('overflow')
    expect(final.totalGenerated).toBe(HISTORY_CAP + 1)
  })

  it('evicts the oldest favourite as a last resort and emits one dev-console notice', () => {
    let state: GameState = INITIAL_STATE
    for (let i = 0; i < HISTORY_CAP; i += 1) {
      state = appendHistory(state, entry(`f${i}`, { favourite: true }))
    }
    expect(saveGameState(state, realStorage())).toBe('ok')
    const reloaded = loadGameState(realStorage())
    const overflowed = appendHistory(reloaded, entry('overflow'))
    expect(saveGameState(overflowed, realStorage())).toBe('ok')
    const final = loadGameState(realStorage())
    expect(final.history).toHaveLength(HISTORY_CAP)
    expect(final.history[0]?.seed).toBe('f1')
    expect(final.history[HISTORY_CAP - 1]?.seed).toBe('overflow')
    // The dev-console notice fires on the in-memory `appendHistory` call,
    // not on save/load. Confirm exactly one notice was emitted.
    expect(infoSpy).toHaveBeenCalledTimes(1)
  })

  it('round-trips a favourite toggle through reload', () => {
    let state = appendHistory(INITIAL_STATE, entry('only-one'))
    expect(saveGameState(state, realStorage())).toBe('ok')
    const reloaded = loadGameState(realStorage())
    expect(reloaded.history[0]?.favourite).toBe(false)
    const toggledTimestamp = reloaded.history[0]?.timestamp ?? 0
    state = toggleFavourite(reloaded, toggledTimestamp)
    expect(saveGameState(state, realStorage())).toBe('ok')
    const after = loadGameState(realStorage())
    expect(after.history[0]?.favourite).toBe(true)
    // Toggle off again.
    state = toggleFavourite(after, toggledTimestamp)
    expect(saveGameState(state, realStorage())).toBe('ok')
    expect(loadGameState(realStorage()).history[0]?.favourite).toBe(false)
  })

  it('keeps in-memory state intact when setItem throws (quota / SecurityError)', () => {
    const realLs = window.localStorage
    const failing: StorageLike = {
      getItem: realLs.getItem.bind(realLs),
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    const state: GameState = {
      ...INITIAL_STATE,
      lastMood: 'rambling',
      totalGenerated: 7,
    }
    expect(saveGameState(state, failing)).toBe('failed')
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0]?.[0]).toContain('alpha:state')
    // Real storage was never written, so a fresh read still yields defaults.
    expect(loadGameState(realStorage())).toEqual(INITIAL_STATE)
  })

  it('falls back to defaults when storage holds malformed JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, '{ this is not json')
    const reloaded = loadGameState(realStorage())
    expect(reloaded).toEqual(INITIAL_STATE)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0]?.[0]).toContain('alpha:state')
  })

  it('falls back to defaults when stored payload carries an unknown version', () => {
    const futureShape = {
      version: 99,
      lastMood: 'triumphant',
      lastLength: 'medium',
      history: [],
      totalGenerated: 0,
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(futureShape))
    const reloaded = loadGameState(realStorage())
    expect(reloaded).toEqual(INITIAL_STATE)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0]?.[0]).toContain('alpha:state')
  })
})
