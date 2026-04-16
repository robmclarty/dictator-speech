# ts-ai-template

A minimal TypeScript project template optimized for collaborating with AI coding agents. It ships with a strict compiler, a five-stage lint pipeline, and a three-tier Vitest setup — all tuned to give agents fast, specific, actionable feedback so they can close the loop on their own work.

## What's in the box

- **TypeScript** in strict mode (`noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`)
- **Vitest** with three projects: `unit` (colocated with source), `integration`, and `e2e`
- **oxlint** — fast Rust-based linter for correctness issues
- **ast-grep** — pattern-based structural rules you add as conventions emerge
- **knip** — unused files, exports, and dependencies
- **fallow** — dead code, duplication, and complexity analysis
- **npm test** — single command that runs the full lint + unit tier

No runtime framework, no bundler config, no app-specific scaffolding. You add those when you know what you're building.

## Using this template

```bash
# 1. Copy or clone to a new directory
cp -R ts-ai-template my-new-project
cd my-new-project

# 2. Rename the package and reset version/changelog
$EDITOR package.json           # change "name", reset "version": "0.1.0"
$EDITOR CHANGELOG.md           # clear and start fresh

# 3. Install
npm install

# 4. Verify everything works on a clean slate
npm test
```

`npm test` should pass immediately on a fresh copy (all lint tools pass on an empty codebase, and the test projects pass with no tests).

## Daily commands

| Command | What it does |
| --- | --- |
| `npm test` | Full lint + unit tests (the fast dev loop) |
| `npm run test:unit` | Unit tests only |
| `npm run test:integration` | Integration tests |
| `npm run test:e2e` | End-to-end tests |
| `npm run lint` | All linters in sequence |

See [docs/testing.md](./docs/testing.md) for the full reference, including individual lint commands.

## Docs

- [architecture.md](./docs/architecture.md) — directory layout and how to extend it
- [technology.md](./docs/technology.md) — the tools and why each one is in the stack
- [testing.md](./docs/testing.md) — test harness and lint pipeline in detail
- [feedback_loops.md](./docs/feedback_loops.md) — how the tooling is designed for AI agents

## Philosophy

The lint and test pipeline is the contract. If `npm test` passes, the code meets the project's current standards — nothing more, nothing less. When you correct an agent (or yourself), try to encode the correction as a new test, a stricter type, or an ast-grep rule, so the next time nobody has to remember it.
