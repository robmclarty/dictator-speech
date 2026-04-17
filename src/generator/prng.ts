// Seeded pseudo-random number generator. Every randomness decision in the
// generator pipeline flows through this module so two runs with the same seed
// yield byte-identical speeches.

/**
 * Fold a string seed into a 32-bit integer via the xmur3 mixing step. This
 * lets `createPrng` accept human-friendly base36 seeds while still feeding
 * mulberry32 a well-mixed integer state.
 */
function xmur3(str: string): number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  h ^= h >>> 16
  return h >>> 0
}

/**
 * mulberry32 — a fast, tiny, deterministic PRNG with a 32-bit state. Returns a
 * function that yields numbers in `[0, 1)`. Byte-identical output across JS
 * engines and across runs when seeded with the same state.
 */
export function createPrng(seed: string): () => number {
  let state = xmur3(seed)
  return function prng(): number {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Produce a short, URL-safe seed drawn from 4 bytes of `crypto.getRandomValues`
 * and encoded as base36. Kept short so favourited history entries read
 * pleasantly when serialised to JSON.
 */
export function generateSeed(): string {
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  const value =
    ((bytes[0] ?? 0) << 24) |
    ((bytes[1] ?? 0) << 16) |
    ((bytes[2] ?? 0) << 8) |
    (bytes[3] ?? 0)
  // Coerce to an unsigned 32-bit integer before base36 encoding so the seed is
  // always 1–8 chars in `/^[0-9a-z]+$/`.
  return (value >>> 0).toString(36)
}
