# CLAUDE.md

## The contract

`npm test` is the signal for done. It runs the full lint pipeline + unit tests. If it passes, the work meets the project's minimum standards. If it fails, the first failure is the next thing to fix.

Do not claim a task complete without running `npm test` and seeing it pass.

## Rules

- **No `any`, `@ts-ignore`, `eslint-disable`, or `--no-verify`** to silence a failing check. The check is usually right. Fix the real issue.
- **One failure at a time.** The pipeline is `&&`-chained and stops at the first error. Fix that one, re-run, move on.
- **Encode corrections as rules.** When a mistake is worth preventing, add an ast-grep rule (`config/ast-grep/rules/`), a stricter type, or a test — not a comment or a note in memory.
- **Unit tests colocate** in `src/**/__tests__/`. Integration and e2e live in `test/integration/` and `test/e2e/`.
- **Don't add a dep, framework, or abstraction** unless the current task requires it. This template stays minimal on purpose.
- **Secrets go in `.env`** (gitignored). See `docs/secrets.md`.

## Commands

| Command | Use |
| --- | --- |
| `npm test` | Inner loop — lint + unit. Run often. Must pass before done. |
| `npm run lint:ox` | Fastest single check. Pre-commit runs this. |
| `npm run test:integration` | Before committing I/O-touching work. |
| `npm run test:e2e` | Before merging. |

See `docs/feedback_loops.md` for why the pipeline is shaped this way.
