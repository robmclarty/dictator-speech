import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

// Guard the purity contract of `src/generator/**`: no module in the generator
// tree may touch the DOM, `localStorage`, or a real-clock `Date.now()`. The
// ast-grep rule set already forbids `Math.random` and `setInterval`; this
// test closes the loop on the remaining side-effect surface.

const GENERATOR_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
)

const GENERATOR_FILES = [
  'prng.ts',
  'skeleton.ts',
  'picker.ts',
  'compose.ts',
]

const FORBIDDEN_PATTERNS: ReadonlyArray<{ readonly label: string; readonly pattern: RegExp }> = [
  { label: 'document', pattern: /\bdocument\b/ },
  { label: 'window', pattern: /\bwindow\b/ },
  { label: 'localStorage', pattern: /\blocalStorage\b/ },
  { label: 'Date.now', pattern: /\bDate\s*\.\s*now\s*\(/ },
  { label: 'Math.random', pattern: /\bMath\s*\.\s*random\s*\(/ },
  { label: 'setInterval', pattern: /\bsetInterval\s*\(/ },
]

// `prng.ts` legitimately uses `crypto.getRandomValues`. Everything else in
// the generator tree must route randomness through an injected prng.
const CRYPTO_ALLOWED = new Set<string>(['prng.ts'])

describe('src/generator purity', () => {
  for (const file of GENERATOR_FILES) {
    it(`${file} references no DOM, storage, or real-clock APIs`, () => {
      const source = readFileSync(resolve(GENERATOR_DIR, file), 'utf8')
      for (const { label, pattern } of FORBIDDEN_PATTERNS) {
        expect(pattern.test(source), `${file} references forbidden ${label}`).toBe(false)
      }
      if (!CRYPTO_ALLOWED.has(file)) {
        expect(/\bcrypto\b/.test(source), `${file} uses crypto outside prng.ts`).toBe(false)
      }
    })
  }
})
