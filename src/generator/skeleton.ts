// Deterministic skeleton expansion — maps (mood, length) to an ordered list
// of slots the composer will fill. Same PRNG in, byte-identical slot array
// out; no I/O, no globals.

import type { Mood, Slot } from '../data/chunks.schema'

export type Length = 'short' | 'medium' | 'long' | 'rambling'

// Middle slots (repeated in the medium/long/rambling length buckets) are
// `grievance`, `enemy_accusation`, and `triumphant_claim` — the narrative
// torque of the speech. `opening_boast` is reserved for the short bucket only;
// in longer speeches the middle trio carries the body instead.
const MIDDLE_SLOTS: readonly Slot[] = ['grievance', 'enemy_accusation', 'triumphant_claim']

const MIDDLE_REPEATS: Readonly<Record<Length, number>> = {
  short: 1,
  medium: 2,
  long: 3,
  rambling: 5,
}

// Rambling mood inserts a tangent or digression after every grievance and
// every triumphant_claim slot — the hallmark "wait, where was I" drift.
const RAMBLING_INSERT_AFTER: ReadonlySet<Slot> = new Set<Slot>([
  'grievance',
  'triumphant_claim',
])

function baseSkeleton(length: Length): Slot[] {
  if (length === 'short') {
    return [
      'salutation',
      'opening_boast',
      'grievance',
      'enemy_accusation',
      'triumphant_claim',
      'call_to_action',
      'sign_off',
    ]
  }
  const repeats = MIDDLE_REPEATS[length]
  const middles: Slot[] = []
  for (let i = 0; i < repeats; i += 1) {
    for (const slot of MIDDLE_SLOTS) middles.push(slot)
  }
  return ['salutation', ...middles, 'call_to_action', 'sign_off']
}

/**
 * Expand a `(mood, length)` pair into a concrete ordered slot list. The PRNG
 * is consulted only for rambling-mood tangent/digression choices; for every
 * other mood the output is a pure function of `length`.
 */
export function expandSkeleton(mood: Mood, length: Length, prng: () => number): Slot[] {
  const base = baseSkeleton(length)
  if (mood !== 'rambling') return base
  const expanded: Slot[] = []
  for (const slot of base) {
    expanded.push(slot)
    if (RAMBLING_INSERT_AFTER.has(slot)) {
      expanded.push(prng() < 0.5 ? 'tangent' : 'digression')
    }
  }
  return expanded
}
