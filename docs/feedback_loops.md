# Feedback Loops for AI Agents

The test and lint pipeline in this project (see [testing.md](./testing.md)) is not only for humans. It's the primary mechanism by which an AI coding agent learns whether the code it just wrote is correct. This doc explains how to think about those tools as feedback loops — and how to design work so an agent can close the loop without you in the middle.

## Why feedback loops matter

An AI agent writing code is doing the same thing a human does: forming a hypothesis ("this change should work"), observing the result, and correcting. The tighter and more specific that observation cycle is, the better the agent's output.

Without a feedback loop, the agent is guessing. It produces code that looks plausible, claims success, and moves on. With a feedback loop, the agent can:

- Detect its own mistakes before handing work back to you
- Self-correct when a check fails, instead of asking clarifying questions
- Know *when to stop* — the signal to halt is "all checks pass," not "I think I'm done"
- Explore unfamiliar code safely, because the lint pipeline catches drift

The cost of a bad feedback loop isn't just wasted tokens — it's wrong code that ships because no automated check disagreed with it.

## What makes a good loop

A feedback loop is good for an agent when it has three properties:

1. **Fast.** The agent will run it many times in one task. If `npm test` takes 30 seconds, the agent waits 30 seconds per iteration. If it takes 1 second, the agent iterates freely. Speed changes behavior.
2. **Specific.** "Tests failed" is useless. "Expected `'alice'`, received `'ALICE'` at `token.test.ts:14`" is actionable. Prefer tools that point at the offending line and name the problem.
3. **Deterministic.** Flaky tests poison the loop. An agent that sees a test fail once and pass once will either stop trusting the signal or keep retrying until it happens to pass. Either way, the code is wrong.

The lint pipeline in this repo is designed around these properties: five tools, each fast, each with pinpoint error messages, each configured rather than ad-hoc.

## The loops, from innermost to outermost

Think of the checks as nested loops at different cadences. The agent should run the inner ones often and the outer ones at natural boundaries (finishing a feature, before committing).

| Loop | Command | When the agent runs it |
| --- | --- | --- |
| Type check | `npm run lint:tsc` | After any structural change it's unsure about |
| General lint | `npm run lint:ox` | Same — bugs oxlint catches are bugs tsc misses |
| Unit tests | `npm run test:unit` | After any logic change |
| Full lint + unit | `npm test` | Before claiming a task is done |
| Conventions | `npm run lint:ast-grep` | Part of `npm test` — enforces project rules |
| Drift | `npm run lint:knip`, `lint:fallow` | Part of `npm test` — catches unused/duplicated code |
| Integration | `npm run test:integration` | Before committing a feature that touches I/O |
| End-to-end | `npm run test:e2e` | Before merging |

`npm test` is the canonical "am I done?" signal. It runs lint + unit in one command, and it's fast enough that an agent can run it after every meaningful edit. Integration and e2e are deliberately *not* in `npm test` — they're slower, and forcing them into the inner loop would make the agent lazy about iterating.

## Designing each check for agent consumption

### Type errors (`tsc`)

TypeScript is the single most valuable feedback signal for an agent because it catches entire categories of hallucination — wrong property names, wrong argument counts, nullable values used as non-nullable — before any test runs. `strict: true` plus `noUncheckedIndexedAccess` means the compiler complains about things that would otherwise silently produce bad values at runtime.

Agent implication: keep types precise. Vague types (`any`, `unknown` without narrowing, loose records) remove the agent's guardrails. Every `any` is a place where the agent can invent a field that doesn't exist and the build still passes.

### Unit tests (Vitest)

Tests are the agent's target. If there's a test that says "when I pass X, I should get Y," the agent has a concrete definition of done. If the only specification is a prose description of what the function should do, the agent has to guess.

Write tests first when the behavior is clear. The agent can then iterate against them without you in the loop. See [testing.md](./testing.md) for the `__tests__/` layout.

### Structural rules (`ast-grep`)

ast-grep is underused by humans but invaluable for agents. It encodes conventions that are otherwise tribal knowledge — "never throw, return `Result`", "don't import from `src/internal/*` across module boundaries", "all React effects must have a cleanup." An agent reading the codebase for the first time doesn't know these. A rule file tells it.

When you catch an agent doing something that's technically correct but against convention, add an ast-grep rule in `config/ast-grep/rules/` instead of just correcting it. Future agents then learn the rule the first time they try to break it, without you being there.

### Unused code (`knip`) and drift (`fallow`)

These catch a specific agent failure mode: leaving behind scaffolding. Agents often create helpers, abandon them for a different approach, and fail to delete the originals. Knip flags the orphaned exports. Fallow flags duplication — the agent re-implementing a helper that already exists under a different name.

Both are cheap to run and produce exact file paths, so the agent can clean up without re-exploring the whole tree.

## Patterns that work

**Run tests before declaring done.** The simplest and highest-value pattern. An agent that says "I've implemented X" without having run `npm test` is guessing. An agent that ran `npm test` and saw it pass has evidence. The `superpowers:verification-before-completion` skill exists for exactly this reason.

**Tests as the spec.** For any non-trivial change, write (or ask the agent to write) failing tests first. Then the agent's job is mechanical: make them pass. This also means the agent can't accidentally "fix" the code by changing the test — the test was the contract.

**One failing check at a time.** If the agent is iterating on multiple failures at once, it loses track of cause and effect. The lint pipeline is sequenced (`oxlint → tsc → ast-grep → knip → fallow`) so the first failure stops the run. The agent fixes that one, re-runs, and moves on. This is why the pipeline is `&&`-chained in `package.json`.

**Encode corrections as rules.** When you correct an agent, ask: could this correction be an ast-grep rule, a stricter tsc flag, or a new test? If yes, encode it. The next agent (or the next task for the same agent) inherits the correction for free.

**Lock the dev server into the loop for UI work.** Type and unit checks don't verify that a page renders. For frontend work, an agent should have the dev server running and a way to observe the output (screenshots, DOM assertions). Without that, "the types check out" is not the same as "the feature works."

## Anti-patterns to avoid

- **Skipping checks to make the agent finish faster.** Tempting when the pipeline fails and you just want the diff. Don't. The failing check is usually right.
- **Broad `any`, `@ts-ignore`, or `// eslint-disable` to silence errors.** These remove the feedback signal entirely. If the agent reaches for one of these, it's stuck — help it fix the real issue instead.
- **Flaky tests.** Once tests flake, the agent stops trusting them and you stop running them. Fix flakes as bugs.
- **Slow inner loop.** If `npm test` drifts above a few seconds, move the slow tests out to `integration` or `e2e`. The inner loop protects iteration speed.
- **Vague error messages.** If a check fails with "something went wrong," rewrite it. An agent can't fix what it can't name.

## Summary

The tools in this project are configured for a specific purpose: give an AI agent enough signal to finish a task correctly and know when it's done. `npm test` is the contract. Everything else — the five-stage lint, the three-tier Vitest projects, the pattern rules — exists to make that contract both fast to run and sharp enough to catch real mistakes. Treat new features the same way: if you can't tell the agent how to verify its own work, you haven't finished the design yet.
