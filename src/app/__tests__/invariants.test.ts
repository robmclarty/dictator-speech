/**
 * Project-wide invariant sweep. This is the Phase 4 guardrail — it
 * re-asserts the escape-hatch ban and the class-component / external-URL
 * / single-class rules against the full source tree, as a backstop for the
 * ast-grep rules under `config/ast-grep/rules/`.
 *
 * Two independent enforcement paths for the same invariant is the whole
 * point: if an ast-grep rule ever regresses (pattern gets too narrow, rule
 * gets deleted by mistake), this suite fails and names the offending path.
 *
 * Covers acceptance criteria 13, 14, 15, 16, 17.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = resolve(__dirname, '../../..')
const SRC = resolve(REPO_ROOT, 'src')
const RULES_DIR = resolve(REPO_ROOT, 'config/ast-grep/rules')
const INDEX_HTML = resolve(REPO_ROOT, 'index.html')

// File-extension allowlist for the source scans. Woff2 binaries, JSON
// fixtures, and .svg are excluded from TypeScript-pattern scans below.
const SCANNABLE_EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.html', '.mjs', '.js', '.json', '.yml', '.svg'])

interface SourceFile {
  readonly path: string
  readonly relative: string
  readonly content: string
}

function walkSrc(): readonly SourceFile[] {
  const out: SourceFile[] = []
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      const full = resolve(dir, entry.name)
      if (entry.isDirectory()) {
        visit(full)
        continue
      }
      const dot = entry.name.lastIndexOf('.')
      const ext = dot >= 0 ? entry.name.slice(dot) : ''
      if (!SCANNABLE_EXTENSIONS.has(ext)) continue
      out.push({
        path: full,
        relative: full.slice(REPO_ROOT.length + 1),
        content: readFileSync(full, 'utf8'),
      })
    }
  }
  visit(SRC)
  return out
}

function filterByExt(files: readonly SourceFile[], exts: readonly string[]): readonly SourceFile[] {
  return files.filter((f) => exts.some((e) => f.relative.endsWith(e)))
}

const ALL_FILES = walkSrc()
// This file scans for patterns it must itself contain as regex literals;
// exclude self-references across the sweep suites so they aren't false-
// positives. Likewise the other project-wide audits (e.g. purity.test.ts)
// are guarded.
const SELF_EXCLUDES: readonly string[] = [
  'src/app/__tests__/invariants.test.ts',
  'src/generator/__tests__/purity.test.ts',
]

const TS_FILES = filterByExt(ALL_FILES, ['.ts', '.tsx']).filter(
  (f) => !SELF_EXCLUDES.includes(f.relative),
)

/**
 * Line-level scan helper. Walks each file and reports offenders (file +
 * line + content) where `predicate(line)` returns true. Centralises the
 * loop so the per-check closures stay shallow.
 */
function scanOffenders(
  files: readonly SourceFile[],
  predicate: (line: string) => boolean,
): readonly string[] {
  const out: string[] = []
  for (const f of files) {
    const lines = f.content.split('\n')
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? ''
      if (predicate(line)) out.push(`${f.relative}:${i + 1}: ${line.trim()}`)
    }
  }
  return out
}

/**
 * True if `line` contains a TypeScript `any`-type escape hatch:
 * `: any`, `as any`, or `<any>`. Excludes the `mood: 'any'` corpus token.
 */
function hasAnyTypeEscape(line: string): boolean {
  if (/\bas\s+any\b/.test(line)) return true
  if (/<any>/.test(line)) return true
  if (/:\s*any\b/.test(line) && !/\bas 'any'|mood: 'any'/.test(line)) return true
  return false
}

/**
 * True if `line` contains a non-import / non-`as const` type-cast
 * expression. Returns false for `import { Foo as Bar }` and `x as const`.
 */
function hasBoundaryCast(line: string): boolean {
  if (/\bas\s+const\b/.test(line)) return false
  if (/\bimport\b.*\bas\s+[A-Z]/.test(line)) return false
  if (/\bfrom\b/.test(line) && /\{[^}]*\bas\s+[A-Z]/.test(line)) return false
  return /\bas\s+[A-Z][A-Za-z0-9_<>[\],\s.]*/.test(line)
}

describe('project-wide invariant sweep', () => {
  describe('escape hatches (criterion 15)', () => {
    it('contains no `: any` or `as any` or `<any>` type annotations in src/', () => {
      const offenders = scanOffenders(TS_FILES, hasAnyTypeEscape)
      expect(offenders, offenders.join('\n')).toEqual([])
    })

    it('contains no @ts-ignore / @ts-expect-error / eslint-disable directives in src/', () => {
      const offenders = scanOffenders(TS_FILES, (line) =>
        /@ts-ignore\b|@ts-expect-error\b|eslint-disable/.test(line),
      )
      expect(offenders, offenders.join('\n')).toEqual([])
    })

    it('contains no boundary `as <Type>` casts outside test files in src/', () => {
      // "Boundary cast" = `as Foo` where Foo is a PascalCase type identifier.
      // Allowed: `import { Copy as CopyIcon }` (rename) and `x as const`
      // (literal narrowing). Test files are exempt — the constraint targets
      // validation boundaries in shipped code, not test fixtures.
      const nonTests = TS_FILES.filter((f) => !f.relative.includes('/__tests__/'))
      const offenders = scanOffenders(nonTests, hasBoundaryCast)
      expect(offenders, offenders.join('\n')).toEqual([])
    })
  })

  describe('single class component (criterion 14)', () => {
    it('exactly one `class ... extends ... Component` declaration exists in src/, and it is error-boundary.tsx', () => {
      const matches: string[] = []
      for (const f of TS_FILES) {
        // Skip tests — they may legitimately subclass ErrorBoundary to
        // exercise fallback paths (Phase 1 "HasErrorBoundary" pattern).
        if (f.relative.includes('/__tests__/')) continue
        if (/class\s+\w+\s+extends\s+(?:React\.)?Component\b/.test(f.content)) {
          matches.push(f.relative)
        }
      }
      expect(matches).toEqual(['src/app/error-boundary.tsx'])
    })
  })

  describe('no forbidden runtime patterns (criterion 13)', () => {
    it('no Math.random() anywhere in src/generator/', () => {
      const gen = TS_FILES.filter((f) => f.relative.startsWith('src/generator/'))
      const offenders: string[] = []
      for (const f of gen) {
        if (/Math\.random\(/.test(f.content)) offenders.push(f.relative)
      }
      expect(offenders).toEqual([])
    })

    it('no setInterval in teleprompter or src/generator/', () => {
      const targets = TS_FILES.filter(
        (f) =>
          f.relative.startsWith('src/generator/') ||
          f.relative === 'src/app/teleprompter.tsx',
      )
      const offenders: string[] = []
      for (const f of targets) {
        if (/\bsetInterval\s*\(/.test(f.content)) offenders.push(f.relative)
      }
      expect(offenders).toEqual([])
    })

    it('no dangerouslySetInnerHTML anywhere in src/', () => {
      const offenders: string[] = []
      for (const f of TS_FILES) {
        if (/dangerouslySetInnerHTML/.test(f.content)) offenders.push(f.relative)
      }
      expect(offenders).toEqual([])
    })

    it('no loading="lazy" on the Leader portrait', () => {
      const portrait = TS_FILES.find((f) => f.relative === 'src/app/portrait.tsx')
      expect(portrait, 'portrait.tsx not found').toBeDefined()
      expect(portrait?.content).not.toMatch(/loading=["']lazy["']/)
    })

    it('no @media (prefers-color-scheme) queries anywhere in src/', () => {
      const cssFiles = filterByExt(ALL_FILES, ['.css'])
      const offenders: string[] = []
      for (const f of cssFiles) {
        if (/prefers-color-scheme/.test(f.content)) offenders.push(f.relative)
      }
      expect(offenders).toEqual([])
    })
  })

  describe('no external font CDN or network URLs (criteria 6, 16)', () => {
    const FORBIDDEN = [
      /fonts\.googleapis\.com/i,
      /fonts\.gstatic\.com/i,
      /fonts\.google/i,
      /https?:\/\/cdn\./i,
      /https?:\/\/unpkg\.com/i,
      /https?:\/\/jsdelivr\.net/i,
    ]

    it('source (src/ + index.html) contains no external font/CDN URLs', () => {
      const filesToScan: readonly SourceFile[] = [
        ...filterByExt(ALL_FILES, ['.ts', '.tsx', '.css', '.html', '.svg']),
        {
          path: INDEX_HTML,
          relative: 'index.html',
          content: readFileSync(INDEX_HTML, 'utf8'),
        },
      ]
      const hits: string[] = []
      for (const f of filesToScan) {
        for (const p of FORBIDDEN) {
          const m = f.content.match(p)
          if (m !== null) hits.push(`${f.relative}: ${m[0]}`)
        }
      }
      expect(hits, hits.join('\n')).toEqual([])
    })
  })

  describe('font preload posture (criterion 17)', () => {
    it('index.html preloads exactly the 700 weight, never the 900 weight', () => {
      const html = readFileSync(INDEX_HTML, 'utf8')
      const preloads = html.match(/<link[^>]+rel=["']preload["'][^>]*>/g) ?? []
      const fontPreloads = preloads.filter((tag) => /as=["']font["']/.test(tag))
      expect(fontPreloads).toHaveLength(1)
      expect(fontPreloads[0]).toContain('PlayfairDisplay-700')
      expect(fontPreloads[0]).not.toContain('900')
    })
  })

  describe('package.json invariants (criterion 21)', () => {
    it('scripts.test is the byte-identical pre-Phase-1 value', () => {
      const pkg: { scripts: Record<string, string> } = JSON.parse(
        readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8'),
      )
      expect(pkg.scripts.test).toBe('npm run lint && npm run test:unit')
    })

    it('has both build and postbuild + lint:bundle scripts wired', () => {
      const pkg: { scripts: Record<string, string> } = JSON.parse(
        readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8'),
      )
      expect(pkg.scripts.build).toBe('vite build')
      expect(pkg.scripts.postbuild).toBe('node scripts/lint-bundle.mjs')
      expect(pkg.scripts['lint:bundle']).toBe('node scripts/lint-bundle.mjs')
    })
  })

  describe('ast-grep rule surface intact (criterion 13)', () => {
    // The individual sweeps above verify behaviour. This test verifies the
    // rule *files* still exist — catches accidental deletion before a rule
    // regresses silently.
    const REQUIRED_RULES = [
      'no-any-in-validators.yml',
      'no-as-cast-in-validators.yml',
      'no-bw-css.yml',
      'no-dangerously-set-inner-html-ts.yml',
      'no-dangerously-set-inner-html-tsx.yml',
      'no-icon-only-button.yml',
      'no-lazy-portrait.yml',
      'no-math-random.yml',
      'no-off-cadence-transition.yml',
      'no-off-scale-spacing.yml',
      'no-prefers-color-scheme.yml',
      'no-set-interval-teleprompter.yml',
      'no-set-interval.yml',
      'single-class-component-ts.yml',
      'single-class-component.yml',
    ] as const

    it('all required ast-grep rule files are present on disk', () => {
      const present = new Set(readdirSync(RULES_DIR))
      const missing: string[] = []
      for (const rule of REQUIRED_RULES) {
        if (!present.has(rule)) missing.push(rule)
      }
      expect(missing, missing.join(', ')).toEqual([])
    })
  })

  describe('dist output hygiene (criterion 1, 6, 16)', () => {
    const DIST = resolve(REPO_ROOT, 'dist')
    const distExists = (() => {
      try {
        return statSync(DIST).isDirectory()
      } catch {
        return false
      }
    })()

    // `npm run build` is not a prerequisite of `npm test` — if it hasn't
    // been run, skip the dist-specific assertions. The lint:bundle script
    // is the authoritative check for those; this suite only adds a second
    // rail that fires automatically when dist/ happens to be present.
    it.skipIf(!distExists)('exactly one JS entry chunk under dist/assets/', () => {
      const assets = readdirSync(resolve(DIST, 'assets'))
      const js = assets.filter((name) => name.endsWith('.js'))
      expect(js).toHaveLength(1)
    })

    it.skipIf(!distExists)('dist/index.html references no external font/CDN URLs', () => {
      const html = readFileSync(resolve(DIST, 'index.html'), 'utf8')
      expect(html).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com|fonts\.google|cdn\./i)
    })

    it.skipIf(!distExists)('no manifest.webmanifest / service-worker / sw.js in dist/', () => {
      const distEntries = readdirSync(DIST)
      for (const name of distEntries) {
        expect(name).not.toMatch(/manifest\.webmanifest$/)
        expect(name).not.toMatch(/service-?worker/i)
        expect(name).not.toMatch(/^sw\.js$/)
      }
    })
  })
})
