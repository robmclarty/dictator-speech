# Testing & Linting

This project uses [Vitest](https://vitest.dev) as the test runner and a five-stage lint pipeline that runs before every test invocation. The main `npm test` command is intentionally fast — it runs lint plus unit tests only. Integration and end-to-end tests are invoked separately.

## Quick reference

| Command | What it does |
| --- | --- |
| `npm test` | Full lint + unit tests (the fast dev loop) |
| `npm run test:unit` | Unit tests only |
| `npm run test:integration` | Integration tests |
| `npm run test:e2e` | End-to-end tests |
| `npm run lint` | All linters in sequence |
| `npm run lint:ox` | oxlint (ultra-fast JS/TS linter) |
| `npm run lint:tsc` | TypeScript type check (no emit) |
| `npm run lint:ast-grep` | Pattern-based structural lint rules |
| `npm run lint:knip` | Unused files / exports / dependencies |
| `npm run lint:fallow` | Dead code, duplication, complexity |

## Test harness

Vitest is configured in `vitest.config.ts` at the repo root. Three named projects live under a single config:

- **`unit`** — fast, isolated tests colocated with source code
- **`integration`** — cross-module tests and anything that touches real I/O
- **`e2e`** — full-stack flows exercised end-to-end

Each project is invoked explicitly by name via `vitest run --project <name>`. The main `npm test` command only runs the `unit` project, keeping the inner loop fast.

### Directory layout

```
src/
  <feature>/
    __tests__/
      <file>.test.ts       ← unit tests, colocated with the code they test

test/
  fixtures/                ← shared fixture data
  mocks/                   ← shared mocks/stubs
  setup/
    vitest.setup.ts        ← shared setup file loaded before every test
  integration/
    <name>.test.ts         ← cross-module / I/O tests
  e2e/
    <name>.test.ts         ← full end-to-end flows
```

### Writing a unit test

Place the test file inside a `__tests__/` folder next to the module it covers:

```ts
// src/auth/__tests__/token.test.ts
import { describe, it, expect } from 'vitest'
import { createToken } from '../token'

describe('createToken', () => {
  it('returns a non-empty string', () => {
    expect(createToken()).not.toBe('')
  })
})
```

Vitest is configured with `globals: true`, so `describe`, `it`, and `expect` are also available without the import if you prefer.

### Shared setup

`test/setup/vitest.setup.ts` is loaded before every test across all three projects. Put global hooks, polyfills, or test-environment setup there — things like setting env vars, registering custom matchers, or wiring up MSW.

### Passing with no tests

The config sets `passWithNoTests: true` so empty projects don't fail the run. This is useful early in development when a project (e.g. `e2e`) has no tests yet.

## Lint pipeline

`npm run lint` runs five checks sequentially. Each one has a narrow, well-defined job. They're split into separate scripts so CI can parallelize them or surface failures granularly.

The order is deliberate: cheapest and most-likely-to-fail first, so you get fast feedback on the common errors.

### 1. `oxlint` — general linting

Configured in `.oxlintrc.json`. This is a Rust-based linter with the `typescript`, `unicorn`, and `oxc` plugins enabled. The `correctness` category is set to `error` — it catches real bugs (unreachable code, wrong number of arguments, etc.) rather than stylistic nits.

Add or tune rules in `.oxlintrc.json`. Run `oxlint --rules` to see the full list of available rules.

### 2. `tsc --noEmit` — type check

Configured in `tsconfig.json`. Runs the TypeScript compiler in check-only mode (no output). Catches type errors across `src/`, `config/`, and `test/`.

The config uses `strict: true` plus `noUncheckedIndexedAccess`, `noImplicitOverride`, and `noFallthroughCasesInSwitch` — the typical strict set for modern TS apps. Module resolution is `Bundler` (the Vite-compatible mode).

### 3. `ast-grep scan` — structural pattern rules

Configured in `sgconfig.yml`. ast-grep is an AST-based pattern matcher — it lets you write rules that match specific code shapes and flag them. Think of it as "regex for your AST."

Rules live in `config/ast-grep/rules/`. Each rule is a YAML file describing a pattern to match and a message to report. Tests for rules go in `config/ast-grep/tests/`.

The rule directory starts empty. Add rules as project-specific conventions emerge (e.g. "never import from `src/internal/*`", "use `Result` instead of throwing").

### 4. `knip` — unused code

Configured in `knip.json`. Knip finds unused files, exports, dependencies, and devDependencies. It auto-detects the Vite and Vitest plugins so tests and configs are correctly treated as entry points.

Entry points are declared as `src/index.ts` plus optional `src/main.ts` / `src/main.tsx` (the `!` suffix marks them optional so knip won't fail if they don't exist).

### 5. `fallow` — codebase analysis

Configured in `.fallowrc.json`. Bare `fallow` runs the **full pipeline**:

- **Dead code** — unused exports, circular dependencies, boundary violations
- **Duplication** — clone detection across the codebase
- **Complexity** — functions exceeding cyclomatic/cognitive thresholds

`fallow init` was used to generate the starting config. It detected the TypeScript + Vitest stack automatically.

Subcommands (for targeted inspection, not used in the lint pipeline):

```
fallow dead-code         # Only unused code / circular deps
fallow dupes             # Only duplication
fallow health            # Only complexity (optionally --score for 0-100 grade)
fallow audit             # Changed files only, verdict: pass / warn / fail
fallow fix --dry-run     # Preview auto-removal of dead exports / deps
```

## Why this shape

- **Fast inner loop.** `npm test` stays under a second on a clean repo because it skips integration and e2e. If you wait for a full matrix every time you save a file, you stop running it.
- **One command, five tools.** Each linter catches a different class of problem — oxlint for bugs, tsc for types, ast-grep for conventions, knip for unused code, fallow for drift. Running them all means `npm run lint` is the single source of truth for "does my code pass."
- **Config files, not CLI flags.** Every tool is configured via its own config file rather than long flag chains in `package.json`. Makes the scripts section readable and the configs reviewable.

## Adding a new test category

If you need another test kind (performance, contract, load), add a new entry to the `projects` array in `vitest.config.ts`:

```ts
{
  extends: true,
  test: {
    name: 'perf',
    include: ['test/perf/**/*.test.ts'],
  },
},
```

Then add a matching script:

```json
"test:perf": "vitest run --project perf"
```

Leave it out of `npm test` unless it's fast enough to run on every save.
