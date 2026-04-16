# Secrets & Config

## Where things live

| File | Tracked? | Purpose |
| --- | --- | --- |
| `.env.example` | Yes | Template of every variable the app reads. No real values. |
| `.env` | No (gitignored) | Your local values. Never commit. |
| `process.env` | — | The only runtime access point. Read it once at startup, not scattered through the code. |

## Rules

- **Never hardcode secrets.** Not in tests, not in fixtures, not "temporarily."
- **Never commit `.env`.** `.gitignore` already excludes `.env` and `.env.*.local`. Don't override.
- **Every variable the app reads must appear in `.env.example`.** If it's not in the example, someone cloning the repo can't know it exists. Add it the same commit you add the `process.env.X` reference.
- **Fail fast on missing values.** Validate required env at startup and throw with the variable name. Don't let a missing secret surface as a mysterious 500 later.
- **Rotate on leak.** If a secret lands in git history (even a deleted commit), rotate it. Scrubbing history is second priority.

## Adding a new variable

1. Add `NEW_VAR=` (no value) to `.env.example` with a one-line comment if the name isn't self-evident.
2. Add `NEW_VAR=<real-value>` to your local `.env`.
3. Read it in code via `process.env.NEW_VAR`, validated at the boundary.
4. Commit the `.env.example` change alongside the code that uses it.

## Reading env in code

Keep the read path thin. Read `process.env` once (e.g. in a `src/config.ts`), validate, and export a typed object. The rest of the app imports from there — not from `process.env` directly. This gives you one place to add validation, defaults, and types, and it keeps tests mockable.

This template does not ship a config module — add one when the project needs its first variable.

## Secrets in CI / deployment

Out of scope for the template. When you add a deploy target (GitHub Actions, Vercel, Fly, etc.), wire the same variable names as `.env.example` into that platform's secret store. Keep the names identical across local, CI, and prod — drift is where leaks and outages come from.
