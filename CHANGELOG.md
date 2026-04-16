# Changelog

## 0.1.2

- Rename package to `ts-ai-template`; reframe the repo as a reusable TypeScript project foundation
- Wire up strict `tsconfig` and the five-stage lint pipeline (oxlint, tsc, ast-grep, knip, fallow) behind `npm run lint`
- Add Vitest harness with separate `unit`, `integration`, and `e2e` projects; `npm test` runs lint + unit only
- Rewrite README and docs (architecture, technology, testing, feedback_loops) around AI-agent feedback loops; drop hallpass-era stubs

## 0.1.1

- Initial scaffold of ts-ai-template project with dev tooling (vite, tsup, oxlint, knip, ast-grep, fallow)
- Add ridgeline web-ui build config, version skill, and placeholder docs
