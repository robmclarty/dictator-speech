# Changelog

## 0.1.3

- Add `CLAUDE.md` with the project's contract and agent-facing rules
- Pre-approve all `npm run <script>` commands in `.claude/settings.json`
- Add `.githooks/pre-commit` running `lint:ox`; wire `core.hooksPath` via a new `prepare` script
- Add `.env.example` and `docs/secrets.md` documenting config and secret conventions

## 0.1.2

- Rename package to `ts-ai-template`; reframe the repo as a reusable TypeScript project foundation
- Wire up strict `tsconfig` and the five-stage lint pipeline (oxlint, tsc, ast-grep, knip, fallow) behind `npm run lint`
- Add Vitest harness with separate `unit`, `integration`, and `e2e` projects; `npm test` runs lint + unit only
- Rewrite README and docs (architecture, technology, testing, feedback_loops) around AI-agent feedback loops; drop the original scaffold's stub docs

## 0.1.1

- Initial scaffold of ts-ai-template project with dev tooling (vite, tsup, oxlint, knip, ast-grep, fallow)
- Add ridgeline web-ui build config, version skill, and placeholder docs
