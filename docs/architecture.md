# Architecture

This template has no runtime architecture — that's deliberate. What it does have is a deliberate *project* architecture: a directory layout, a tool pipeline, and a set of conventions designed so any TypeScript project can grow into this shape without fighting it.

## Directory layout

```
.
├── src/                     ← application code
│   ├── index.ts               entry point (declared in knip.json)
│   └── <feature>/
│       ├── <module>.ts
│       └── __tests__/
│           └── <module>.test.ts   ← unit tests colocated with code
│
├── test/                    ← non-unit tests and test infrastructure
│   ├── integration/<name>.test.ts
│   ├── e2e/<name>.test.ts
│   ├── fixtures/              shared fixture data
│   ├── mocks/                 shared mocks/stubs
│   └── setup/
│       └── vitest.setup.ts    loaded before every test in every project
│
├── config/                  ← configuration that's too long or code-like for dotfiles
│   └── ast-grep/
│       ├── rules/             structural lint rules (YAML)
│       └── tests/             tests for those rules
│
├── docs/                    ← project documentation
├── dist/                    ← build output (gitignored in real projects)
│
├── package.json             ← scripts, deps, project metadata
├── tsconfig.json            ← strict TypeScript config
├── vitest.config.ts         ← three-tier test setup
├── knip.json                ← unused code detection
├── sgconfig.yml             ← ast-grep wiring
├── .oxlintrc.json           ← oxlint rules
└── .fallowrc.json           ← fallow analysis config
```

## The two layers

**Code lives in `src/`.** Tests for that code — the unit tests — live next to the code in `__tests__/` folders. This keeps the unit of work (module + its tests) together so moving, renaming, or deleting a module takes its tests along with it.

**Cross-cutting concerns live in `test/`.** Integration tests, end-to-end tests, shared fixtures, shared mocks, and global setup are all in `test/` because they don't belong to any single module. This is also where test infrastructure (helpers, factories) goes as it grows.

The split is load-bearing: `vitest.config.ts` uses `src/**/__tests__/**` as the `unit` project pattern and `test/integration/**` / `test/e2e/**` for the slower tiers. Keeping unit tests colocated is what makes the inner feedback loop fast.

## The pipeline

Every project in this template gets the same verification pipeline. It runs in order, with early stages failing fast so the agent (or human) sees the cheapest-to-fix problem first:

```
npm test
  → npm run lint
    → oxlint       (correctness bugs)
    → tsc          (type errors)
    → ast-grep     (project conventions)
    → knip         (unused code)
    → fallow       (drift, duplication, complexity)
  → npm run test:unit   (Vitest unit project)
```

Integration and e2e tests are *not* in `npm test`. They're separate commands invoked at natural boundaries (committing a feature, merging a branch). This keeps the inner loop fast enough to run on every save.

See [testing.md](./testing.md) for tool details and [feedback_loops.md](./feedback_loops.md) for why the pipeline is shaped this way.

## Extension points

Most new work will land in one of these places:

- **New source module** → `src/<feature>/` with `__tests__/` alongside. Nothing else to register; Vitest picks it up by path.
- **New integration or e2e test** → `test/integration/<name>.test.ts` or `test/e2e/<name>.test.ts`. Also auto-discovered.
- **New project convention** → add an ast-grep rule in `config/ast-grep/rules/` and a test in `config/ast-grep/tests/`. See the [ast-grep docs](https://ast-grep.github.io/) for rule syntax.
- **New test category** (performance, contract, load) → add a project entry in `vitest.config.ts` and a matching `test:<name>` script in `package.json`. Keep it out of `npm test` unless it's fast.
- **New entry point** → add it to the `entry` array in `knip.json` so knip doesn't flag it as unused.
- **New top-level config directory** → add it to the `include` array in `tsconfig.json` so TS checks it.

## What this template is not

It's not a framework. It has no HTTP server, no UI library, no database client, no build/bundle step for deployment. Add those when the project needs them — the intent is that you drop in Express, Hono, Vite+React, Nitro, whatever, without having to rearrange the verification pipeline around it.

If a future addition requires changing the pipeline itself, update this doc and [testing.md](./testing.md) together.
