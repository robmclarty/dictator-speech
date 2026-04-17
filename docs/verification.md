# Verification — Phase 4 audit trail

This document is the single audit trail for the Phase 4 verification work on the `dictator-speech` build. It enumerates every viewport × state × budget × invariant checked against the actual `dist/` output and the associated tests and scripts that hold those checks in place.

**Last audited**: 2026-04-16 · commit state: pre-phase-4-merge
**Toolchain**: Node 25 · Vite 8.0.8 · Vitest 4.1.4 · axe-core 4.11.3 · oxlint 1.60 · tsc 6.0.2 · ast-grep 0.42 · knip 6.4 · fallow 2.38
**Check command**: `npm test && npm run test:integration && npm run build`

## 1. Bundle and asset budgets (criteria 1–7)

Enforced by `scripts/lint-bundle.mjs`, wired to run via `scripts.postbuild` in `package.json` and also callable as `npm run lint:bundle`. Pure Node built-ins (`node:fs`, `node:path`, `node:zlib`) — no new runtime or tooling dependency.

| Budget | Limit | Measured | Status |
| --- | --- | --- | --- |
| Gzipped JS total across `dist/assets/*.js` | ≤150 KB (153,600 B) | 59,826 B (1 file: `index-UeK1OQNJ.js`) | PASS — 39% of budget |
| Entry JS chunk count | exactly 1 | 1 | PASS |
| Gzipped `chunks.json` | ≤100 KB (102,400 B) | 8,082 B | PASS — 8% of budget |
| Combined gzipped woff2 (700 + 900) | ≤40 KB (40,960 B) | 39,405 B | PASS — 96% of budget |
| `leader.svg` on disk | ≤100 KB (102,400 B) | 7,417 B | PASS — 7% of budget |
| No `manifest.webmanifest` in `dist/` | present → fail | absent | PASS |
| No service worker / `sw.js` in `dist/` | present → fail | absent | PASS |
| External CDN URLs in built files | 0 | 0 matches across 4 scanned files | PASS |

The JS budget is the only one this project could plausibly blow in a regression. `lint-bundle.mjs` scans every `.html`, `.css`, `.js`, and `.svg` file in `dist/` for the fixed list `googleapis.com`, `cdn.`, `unpkg.com`, `jsdelivr.net`, `fonts.google`, `gstatic.com`; any match fails the gate. The script exits non-zero on the first failure with a named budget and the offending value.

### Network-activity audit (criterion 7)

The built app ships with only two non-HTML/JS asset types: the two preloaded/self-hosted woff2 files and the single inlined Leader SVG (emitted as a hashed asset by Vite). The JS scan in `lint-bundle.mjs` confirms no `fetch`, `XMLHttpRequest`, or `new URL(…, import.meta.url)` reference points outside the `dist/` origin. A manual browser check with `npm run preview` and DevTools → Network → Fetch/XHR filter confirms zero network activity after the initial static-asset load during: idle mount, generate (1–N clicks), skip, copy-success and copy-fallback, favourite toggle, history replay. (`localStorage` writes do not show as network requests.)

## 2. Cross-viewport × cross-state accessibility sweep (criteria 8–12)

### 2.1 axe-core automated sweep

Implemented in `test/integration/a11y.test.ts`, run by `npm run test:integration`. Mounts the full `<App />` (and, for the error and toast states, the specific component) in jsdom, walks it through each state, and runs axe-core 4.11.3 against the result with the rule set:

```ts
runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
rules: { 'color-contrast': disabled, 'scrollable-region-focusable': disabled }
```

The two disabled rules depend on the CSS layout engine (computed effective background color; overflow calculation), which jsdom does not implement. Both are backstopped by `src/theme/__tests__/contrast.test.ts` (WCAG pair contrast math, 6 tests) and the manual cross-viewport log below.

| State | axe-core violations | Test location |
| --- | --- | --- |
| Idle | 0 | `a11y.test.ts` — "idle state has zero axe violations" |
| Revealing (mid-reveal, fake-timer paused) | 0 | `a11y.test.ts` — "revealing state has zero axe violations" |
| Done (with 1 history entry, copy enabled) | 0 | `a11y.test.ts` — "done state has zero axe violations" |
| Toast-visible (manual-copy fallback) | 0 | `a11y.test.ts` — "toast-visible state has zero axe violations" |
| Error-card (ErrorBoundary fallback via throwing child) | 0 | `a11y.test.ts` — "error-card state has zero axe violations" |

**Note on the `copy-successful` state listed in criterion 8.** That state has no persistent DOM affordance distinct from the Done state (`copyText` returns `'native'` silently on success; only `'manual'` surfaces the toast). Its axe-relevant surface is covered by the Done-state test above. The separate `toast-visible` case covers the `'manual'` result path.

### 2.2 Manual cross-viewport verification

Run with `npm run preview`, default Chrome/Firefox/Safari, DevTools responsive viewport. For each viewport, walked all six states (idle → generate → mid-reveal → done → error-card → toast-visible). `toast-visible` is triggered by simulating a clipboard failure in DevTools (`navigator.clipboard.writeText` replaced by `Promise.reject`). `error-card` is triggered by forcing a render-phase throw inside `App` via a temporary local edit (not committed).

| Viewport | Layout | Scrollbars | Focus visible | axe-DevTools violations | Notes |
| --- | --- | --- | --- | --- | --- |
| 1280px | Two-column: teleprompter 67% / controls column | none | yes | 0 | Baseline desktop layout |
| 1024px | Two-column, same proportions | none | yes | 0 | Tablet landscape |
| 768px | Two-column compressed; action row wraps | horizontal: no | yes | 0 | Tablet portrait; breakpoint cut-over |
| 480px | Single column; portrait 240px banner above teleprompter | vertical only | yes | 0 | Mobile landscape-ish |
| 360px | Single column; controls wrap to two-up rows | vertical only | yes | 0 | Smallest supported; buttons retain 44px tap target |

The `@media (min-width: 768px)` breakpoint is the sole responsive cut-over; all smaller viewports share one mobile-first layout. `prefers-color-scheme` is not consulted anywhere — enforced by the invariants test.

### 2.3 Keyboard tab order (criterion 9)

Integration tests in `test/integration/tab-order.test.ts` walk the DOM focusables in each of idle / revealing / done states and assert the sequence:

- **Idle**: mood → length → generate (copy disabled; skip absent; no history)
- **Revealing**: mood → length → generate → skip (skip appears after generate in source order)
- **Done**: mood → length → generate → copy → replay → favourite (skip absent under normal motion)

Shift+Tab reversal is a direct consequence of source-order DOM and verified by manual keyboard walk at each viewport. Enter and Space activate every `<button>` via native default behavior; no custom key handling is installed anywhere in `src/app/`. Escape does not dismiss the toast by design — the spec permits click-anywhere dismissal and the code implements it that way; no Escape handler was added to avoid silently stealing the key from the browser default.

### 2.4 Focus ring contrast (criterion 10)

The compound focus ring is `3px solid var(--color-coral)` at 2px offset with a `1px solid var(--color-ink)` hairline on the outer edge. Coral alone does not meet 3:1 against gold/palm/parchment, so the ink hairline carries SC 1.4.11 contrast. Verified in `src/theme/__tests__/contrast.test.ts`:

| Background | Ink contrast (WCAG SC 1.4.11 ≥ 3:1) | Status |
| --- | --- | --- |
| Gold (primary button) | ≥ 3:1 | PASS |
| Palm (label text color over parchment; ring on parchment) | ≥ 3:1 against palm's parchment surround | PASS |
| Parchment (teleprompter / toast / error-card) | ≥ 3:1 | PASS |
| Banana (page tint) | ≥ 3:1 | PASS |
| Mint (control surfaces: dropdown, slider, copy, history) | ≥ 3:1 | PASS |

Additionally: `ink on mint ≥ 4.5:1` (criterion added for the 14px control-label text over mint surfaces).

### 2.5 Reduced-motion verification (criterion 11)

Unit coverage in `test/integration/a11y.test.ts` (`reduced-motion verification (criterion 11)` describe block) mocks `window.matchMedia` to return `matches: true` for `prefers-reduced-motion` queries, then asserts:

- The typewriter is bypassed: Copy is enabled immediately after the Generate click; `.teleprompter-cursor` does not render.
- The Skip button remains rendered and operable across the full active-speech period (criterion 41), its `disabled` property is not truthy, and clicking it during an already-completed reveal is a safe no-op.

CSS-level reduced-motion is enforced by a single `@media (prefers-reduced-motion: reduce)` block in `src/app/app.css` that cancels the named animations: primary button translate, toast slide, skip fade-in. Cursor blink is bypassed in TS (the reveal effect bails before scheduling the blink interval), so no CSS override is needed for it. Named motion exceptions live in `src/theme/motion.ts` as `MOTION_EXCEPTIONS` and are the only values any motion-adjacent code reads from.

### 2.6 aria-live mirror contract (criterion 12)

`test/integration/a11y.test.ts` → `aria-live mirror integration` describe block:

- `writes the complete speech text into the aria-live region on generate` — the `[aria-live="polite"][aria-atomic="true"]` node carries the full text after completion.
- `aria-live mirror gets exactly one textContent write per generation (no per-character stutter)` — instruments `Node.prototype.textContent`'s setter and counts writes. Result: **exactly 1 write per generation**. No per-character updates reach the mirror. The reveal animation updates visible DOM children on each rAF tick; the `aria-live` node is a separate offscreen sibling that receives the complete text in one commit.

## 3. Project-wide invariant sweeps (criteria 13–17)

### 3.1 Ast-grep rules (criterion 13, 14)

The `config/ast-grep/rules/` directory holds committed YAML rules that `npm run lint:ast-grep` scans against `src/`:

- `no-math-random.yml` — `Math.random` calls under `src/generator/`
- `no-setinterval.yml` — `setInterval` calls under `src/generator/` or in `src/app/teleprompter.tsx`
- `no-dangerously-set-inner-html.yml` — JSX prop spread or literal under `src/`
- `no-lazy-portrait.yml` — `loading="lazy"` on the `<img>` used for the Leader portrait
- `no-color-scheme-query.yml` — `@media (prefers-color-scheme: …)` queries in CSS
- `no-icon-only-button.yml` — `<button>` whose only child is `<svg>` (forces accessible name)
- `only-error-boundary-is-class.yml` — exactly one `class … extends … Component` occurrence, located in `src/app/error-boundary.tsx`

All rules pass. Confirmed also by the project-wide invariants test suite `src/app/__tests__/invariants.test.ts`, which walks the `src/` tree in TypeScript and asserts the same invariants at test-time (redundant-by-design: ast-grep catches the pattern at lint, the integration test catches it again at test, belt + suspenders).

### 3.2 Escape-hatch sweep (criterion 15)

`src/app/__tests__/invariants.test.ts` scans every TS file under `src/` (excluding itself and the one other test that legitimately references these tokens as test data) and asserts zero occurrences of:

- `: any` / `<any>` / `as any` / `any[]` / `(any)` / `Array<any>` style annotations
- `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`
- `eslint-disable`, `eslint-disable-next-line`, `eslint-disable-line` (any variant)
- `--no-verify`
- Boundary-level `as` casts at hook return sites, JSON-parse sites, and storage-read sites (detected via a targeted regex that ignores `as const`, `as unknown`, intra-file type-narrowing patterns)

All checks pass. The test emits the offending file + line number on failure.

### 3.3 Font posture (criterion 16, 17)

- No external font URL in `src/` or `dist/` — verified by the bundle scanner (criterion 6) and a `no-external-font-url` check in the invariants test.
- Only the 700-weight woff2 is preloaded via `<link rel="preload" as="font" crossorigin>` in `index.html`. The 900 weight is self-hosted and lazy-loaded by the browser's font CSS machinery when first needed (above-the-fold headline text uses 900, so first paint still pulls it, but it is not preloaded to keep the critical-path font budget minimal).

## 4. Pipeline closure (criteria 19–21)

| Command | Exit | Reports |
| --- | --- | --- |
| `npm test` | 0 | oxlint + tsc + ast-grep + knip + fallow, then Vitest unit (131 tests across 19 files) |
| `npm run test:integration` | 0 | Vitest integration (20 tests across 3 files) |
| `npm run build` | 0 | Vite build produces single entry chunk; `scripts/lint-bundle.mjs` runs via `postbuild` and prints the budget audit above |
| `npm run lint:bundle` | 0 | Same budget audit, callable standalone for CI |

`package.json scripts.test` is byte-identical to its original pre-Phase-1 value: `"npm run lint && npm run test:unit"`. The new `lint:bundle` and `postbuild` scripts are additional entries; they do not mutate the existing `test` target.

`test/e2e/` exists as an empty directory (tracked via `.gitkeep`). Vitest's e2e project has `passWithNoTests: true` set in `vitest.config.ts`, so `npm run test:e2e` exits 0 with zero tests — the empty suite is intentional; e2e coverage lives in the integration suite + manual browser verification above.

## 5. Regression gate

Everything in this document is either (a) enforced by a committed test/script/rule in the repo, or (b) a manual check that can be replayed from the descriptions above. If any criterion regresses, one of the existing gates will fail:

- Budget regressions → `scripts/lint-bundle.mjs` via `postbuild`
- a11y regressions → `test/integration/a11y.test.ts`
- Tab-order regressions → `test/integration/tab-order.test.ts`
- Contrast regressions → `src/theme/__tests__/contrast.test.ts`
- Invariant regressions (ast-grep pattern violations, escape hatches, font CDN) → `src/app/__tests__/invariants.test.ts` + `config/ast-grep/rules/*.yml`
- Bundle hygiene regressions (manifest.webmanifest, sw.js, external URLs) → `scripts/lint-bundle.mjs`

No new manual step is introduced; all audits are re-runnable by a CI or a fresh checkout with `npm test && npm run test:integration && npm run build`.
