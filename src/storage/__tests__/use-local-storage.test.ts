import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INITIAL_STATE, STORAGE_KEY, type GameState } from '../game-state'
import {
  loadGameState,
  parseGameState,
  saveGameState,
  type StorageLike,
} from '../use-local-storage'

function memoryStorage(initial?: string): StorageLike & { getCalls: string[]; setCalls: Array<[string, string]> } {
  let value: string | null = initial ?? null
  const getCalls: string[] = []
  const setCalls: Array<[string, string]> = []
  return {
    getCalls,
    setCalls,
    getItem(key) {
      getCalls.push(key)
      return key === STORAGE_KEY ? value : null
    },
    setItem(key, val) {
      setCalls.push([key, val])
      if (key === STORAGE_KEY) value = val
    },
  }
}

let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  warn.mockRestore()
})

describe('parseGameState', () => {
  it('round-trips a well-formed payload', () => {
    const state: GameState = {
      version: 1,
      lastMood: 'paranoid',
      lastLength: 'long',
      history: [
        { seed: 'abc', mood: 'paranoid', length: 'long', timestamp: 1, favourite: true },
      ],
      totalGenerated: 5,
    }
    expect(parseGameState(JSON.parse(JSON.stringify(state)))).toEqual(state)
  })

  it('rejects non-object input', () => {
    expect(parseGameState(null)).toBeNull()
    expect(parseGameState('hi')).toBeNull()
    expect(parseGameState(['array'])).toBeNull()
  })

  it('rejects unknown version', () => {
    expect(parseGameState({ version: 2, lastMood: 'triumphant', lastLength: 'medium', history: [], totalGenerated: 0 })).toBeNull()
  })

  it('rejects mistyped fields', () => {
    expect(parseGameState({ version: 1, lastMood: 'invalid', lastLength: 'medium', history: [], totalGenerated: 0 })).toBeNull()
    expect(parseGameState({ version: 1, lastMood: 'triumphant', lastLength: 'epic', history: [], totalGenerated: 0 })).toBeNull()
    expect(parseGameState({ version: 1, lastMood: 'triumphant', lastLength: 'medium', history: [{}], totalGenerated: 0 })).toBeNull()
    expect(parseGameState({ version: 1, lastMood: 'triumphant', lastLength: 'medium', history: [], totalGenerated: NaN })).toBeNull()
  })
})

describe('loadGameState', () => {
  it('returns INITIAL_STATE when storage is empty', () => {
    const s = memoryStorage()
    expect(loadGameState(s)).toEqual(INITIAL_STATE)
    expect(warn).not.toHaveBeenCalled()
  })

  it('returns INITIAL_STATE when storage is null and does not warn', () => {
    expect(loadGameState(null)).toEqual(INITIAL_STATE)
    expect(warn).not.toHaveBeenCalled()
  })

  it('falls back to defaults and warns once on malformed JSON', () => {
    const s = memoryStorage('{ malformed')
    expect(loadGameState(s)).toEqual(INITIAL_STATE)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('alpha:state')
  })

  it('falls back to defaults and warns once on schema mismatch', () => {
    const s = memoryStorage(JSON.stringify({ version: 99, lastMood: 'paranoid' }))
    expect(loadGameState(s)).toEqual(INITIAL_STATE)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('alpha:state')
  })

  it('falls back to defaults and warns once when getItem throws', () => {
    const s: StorageLike = {
      getItem() {
        throw new Error('SecurityError')
      },
      setItem() {},
    }
    expect(loadGameState(s)).toEqual(INITIAL_STATE)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('alpha:state')
  })
})

describe('saveGameState', () => {
  it('writes a JSON-serialised payload to the alpha:state key', () => {
    const s = memoryStorage()
    expect(saveGameState(INITIAL_STATE, s)).toBe('ok')
    expect(s.setCalls).toHaveLength(1)
    expect(s.setCalls[0]?.[0]).toBe(STORAGE_KEY)
    const parsed = JSON.parse(s.setCalls[0]?.[1] ?? '')
    expect(parsed.version).toBe(1)
  })

  it('returns "failed" and warns once on quota / SecurityError', () => {
    const s: StorageLike = {
      getItem() {
        return null
      },
      setItem() {
        throw new Error('QuotaExceededError')
      },
    }
    expect(saveGameState(INITIAL_STATE, s)).toBe('failed')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('alpha:state')
  })

  it('returns "unavailable" when no storage is provided', () => {
    expect(saveGameState(INITIAL_STATE, null)).toBe('unavailable')
    expect(warn).not.toHaveBeenCalled()
  })
})
