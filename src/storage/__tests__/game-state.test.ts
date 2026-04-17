import { describe, expect, it, vi } from 'vitest'
import {
  HISTORY_CAP,
  INITIAL_STATE,
  appendHistory,
  isLength,
  isUserMood,
  setLastLength,
  setLastMood,
  toggleFavourite,
  type HistoryEntry,
} from '../game-state'

function entry(seed: string, opts: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    seed,
    mood: 'triumphant',
    length: 'medium',
    timestamp: Number.parseInt(seed, 36),
    favourite: false,
    ...opts,
  }
}

describe('isUserMood / isLength', () => {
  it('accepts user-facing moods only', () => {
    expect(isUserMood('triumphant')).toBe(true)
    expect(isUserMood('paranoid')).toBe(true)
    expect(isUserMood('rambling')).toBe(true)
    expect(isUserMood('any')).toBe(false)
    expect(isUserMood('grand')).toBe(false)
    expect(isUserMood(42)).toBe(false)
  })

  it('accepts all four length buckets', () => {
    for (const l of ['short', 'medium', 'long', 'rambling']) {
      expect(isLength(l)).toBe(true)
    }
    expect(isLength('epic')).toBe(false)
    expect(isLength(undefined)).toBe(false)
  })
})

describe('appendHistory', () => {
  it('appends and increments totalGenerated', () => {
    const state = appendHistory(INITIAL_STATE, entry('a'))
    expect(state.history).toHaveLength(1)
    expect(state.totalGenerated).toBe(1)
  })

  it('caps history at HISTORY_CAP and evicts the oldest non-favourite first', () => {
    let state = INITIAL_STATE
    for (let i = 0; i < HISTORY_CAP; i += 1) {
      state = appendHistory(state, entry(`s${i}`))
    }
    expect(state.history).toHaveLength(HISTORY_CAP)
    expect(state.history[0]?.seed).toBe('s0')
    state = appendHistory(state, entry('overflow'))
    expect(state.history).toHaveLength(HISTORY_CAP)
    expect(state.history[0]?.seed).toBe('s1')
    expect(state.history[HISTORY_CAP - 1]?.seed).toBe('overflow')
    expect(state.totalGenerated).toBe(HISTORY_CAP + 1)
  })

  it('preserves favourites by skipping them during eviction', () => {
    let state = INITIAL_STATE
    state = appendHistory(state, entry('keepme', { favourite: true }))
    for (let i = 0; i < HISTORY_CAP - 1; i += 1) {
      state = appendHistory(state, entry(`s${i}`))
    }
    state = appendHistory(state, entry('overflow'))
    expect(state.history).toHaveLength(HISTORY_CAP)
    // favourite still present
    expect(state.history.some((h) => h.seed === 'keepme')).toBe(true)
    // oldest non-favourite (s0) is gone
    expect(state.history.some((h) => h.seed === 's0')).toBe(false)
  })

  it('evicts the oldest favourite as a last resort and emits one info notice', () => {
    let state = INITIAL_STATE
    for (let i = 0; i < HISTORY_CAP; i += 1) {
      state = appendHistory(state, entry(`f${i}`, { favourite: true }))
    }
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    try {
      state = appendHistory(state, entry('overflow'))
      expect(state.history).toHaveLength(HISTORY_CAP)
      expect(state.history[0]?.seed).toBe('f1')
      expect(info).toHaveBeenCalledTimes(1)
    } finally {
      info.mockRestore()
    }
  })
})

describe('toggleFavourite', () => {
  it('flips the favourite flag on the matching entry only', () => {
    let state = appendHistory(INITIAL_STATE, entry('one'))
    state = appendHistory(state, entry('two'))
    state = toggleFavourite(state, state.history[0]?.timestamp ?? 0)
    expect(state.history[0]?.favourite).toBe(true)
    expect(state.history[1]?.favourite).toBe(false)
    state = toggleFavourite(state, state.history[0]?.timestamp ?? 0)
    expect(state.history[0]?.favourite).toBe(false)
  })
})

describe('setLastMood / setLastLength', () => {
  it('updates only the named field', () => {
    const a = setLastMood(INITIAL_STATE, 'paranoid')
    expect(a.lastMood).toBe('paranoid')
    expect(a.lastLength).toBe(INITIAL_STATE.lastLength)
    const b = setLastLength(a, 'long')
    expect(b.lastLength).toBe('long')
    expect(b.lastMood).toBe('paranoid')
  })
})
