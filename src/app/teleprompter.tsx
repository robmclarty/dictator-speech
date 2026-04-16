import { IDLE_PROMPT } from './copy'

/**
 * Phase 1 — idle teleprompter only. The full reveal pipeline (RAF loop,
 * cursor, skip, aria-live mirroring) lands in a later phase. This file
 * exists now so the no-set-interval ast-grep rule can target it.
 */
export function Teleprompter() {
  return (
    <section className="teleprompter" aria-label="Teleprompter">
      <p className="teleprompter-idle">{IDLE_PROMPT}</p>
    </section>
  )
}
