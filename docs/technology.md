# Technology

The stack for this template is small on purpose. Each tool earns its place by catching a class of error no other tool in the pipeline catches. Versions are pinned in `package.json` — no `^` or `~` — so an agent working in this repo gets the same behavior you do.

## Runtime and language

- **TypeScript** — compiler in check-only mode (`tsc --noEmit`), `strict: true` plus `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. Module resolution is `Bundler`, which matches Vite/modern bundler behavior. Target is `ES2022`.
- **Node.js** — implied by the `@types/node` dep and the `environment: 'node'` default in Vitest. If your project needs a browser-like environment for some tests, switch per-test with `// @vitest-environment jsdom` or add a fourth project.

No runtime is installed at startup: the template has no server, no client framework, no bundler configured. Add those when the project calls for them.

## Test runner

- **Vitest** — three-project config (`unit`, `integration`, `e2e`) in `vitest.config.ts`, `globals: true` so `describe`/`it`/`expect` don't need imports, `passWithNoTests: true` so empty tiers don't fail the run.

Vitest was chosen over Jest because it reuses the Vite/esbuild transform pipeline (fast startup, native ESM, native TS), and because its project feature cleanly separates tiers without multiple config files.

## Lint pipeline

Five tools, each with a narrow job. The pipeline is `&&`-chained so the first failure stops the run.

| Tool | Catches | Config |
| --- | --- | --- |
| [oxlint](https://oxc.rs/docs/guide/usage/linter.html) | Correctness bugs (unreachable code, wrong arg counts) | `.oxlintrc.json` |
| `tsc --noEmit` | Type errors | `tsconfig.json` |
| [ast-grep](https://ast-grep.github.io/) | Project-specific structural conventions | `sgconfig.yml`, `config/ast-grep/` |
| [knip](https://knip.dev/) | Unused files, exports, deps | `knip.json` |
| [fallow](https://github.com/fallow-rs/fallow) | Dead code, duplication, complexity | `.fallowrc.json` |

### Why each tool

- **oxlint** is a Rust-based linter with the `typescript`, `unicorn`, and `oxc` plugins enabled and the `correctness` category set to `error`. It runs fast enough to sit at the top of the pipeline and catch obvious bugs before TypeScript has to do the heavier type work.
- **tsc** is the single most valuable check for AI-agent-generated code: strict types catch hallucinated property names and wrong argument shapes before any test runs.
- **ast-grep** is where project conventions live. The rule directory starts empty; add rules as conventions emerge. See [feedback_loops.md](./feedback_loops.md) for why this matters for agents.
- **knip** catches the "orphaned scaffolding" failure mode where modules and exports get created, abandoned, and left behind.
- **fallow** catches duplication (the same helper reimplemented under a different name) and complexity drift.

Each tool's config file documents itself via `$schema`, so your editor will autocomplete valid options.

## Pinned versions

See `devDependencies` in `package.json`. Versions are exact, not ranges, because:

1. Lint tools are the contract. A minor version bump that adds a new default rule is effectively a change to the contract, and should be an intentional commit — not a silent `npm install` drift.
2. Reproducibility for agents: the same prompt against the same commit should produce the same verification results regardless of when it runs.

To upgrade a tool, bump the version in `package.json`, run `npm install`, run `npm test`, and deal with any new failures in the same commit.

## What's intentionally missing

- **No formatter.** Choose one per project (Prettier, Biome, dprint) once you know the codebase's formatting preferences. Running a formatter isn't a correctness check, so keeping it out of `npm test` is deliberate.
- **No pre-commit hooks.** Add them (husky, lefthook, simple-git-hooks) once the project has enough code that running the pipeline locally matters before pushing.
- **No CI config.** Different projects target different platforms (GitHub Actions, GitLab, Buildkite). Drop in the one your deployment target wants. The pipeline surface is just `npm test`, `npm run test:integration`, `npm run test:e2e`.
- **No runtime dependencies.** `dependencies` in `package.json` is empty. Install only what the project actually uses.
