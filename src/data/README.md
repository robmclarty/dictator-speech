# Chunks corpus — authorial guardrails

`chunks.json` is the hand-authored comedy engine of the toy. It is the single
highest-stakes artifact in the project: polished code with a flat corpus will
feel mediocre; a thin corpus cannot be rescued downstream.

## Content rules (non-negotiable)

- **No real political figures.** Not by name, not by thinly-veiled nickname,
  not by clue-dropping biographical reference. The Leader is an archetype —
  the pompous generalissimo of nowhere — and must stay one.
- **No real ethnic, national, or religious groups.** Enemies are vague
  "neighbouring nations", "foreign agents", "saboteurs of the North",
  "the cabal". Never a real identifier.
- **No slurs.** Ever. Under any reading, for any group.
- **No punching down.** The mark of the joke is always the Leader himself:
  his vanity, his pettiness, his self-importance, his absurd self-love.
  The bakers, the citizens, the palace cats, the tailors, the waiters —
  they are not targets. They are long-suffering bystanders.

## Voice

Ministry-of-Information pompous, dry, mock-heroic, operetta — never newsreel.
Think late-period empire clinging to dignity while eating pastries in
uniform. Curly typography (`…`, `—`, `'`) is the house style; the font is
subsetted to cover those glyphs specifically.

## Shape

- Required cells (each `slot × mood` for `slot ∈ {salutation,
  opening_boast, grievance, enemy_accusation, triumphant_claim,
  call_to_action, sign_off}` × `mood ∈ {paranoid, triumphant, rambling}`)
  must have ≥3 chunks, or the slot must have a ≥3-chunk `mood: 'any'`
  fallback.
- `tangent` and `digression` exist only to be inserted after `grievance` and
  `triumphant_claim` slots in rambling-mood expansions; `mood: 'any'` is the
  right home for both.
- Each chunk id is unique and ≤400 characters. The validator at
  `chunks.schema.ts` enforces all of the above and fails the build on any
  violation.

## Changing the corpus

New chunks are welcome. Keep id prefixes consistent (`sal-`, `ob-`, `gr-`,
`en-`, `tc-`, `cta-`, `so-`, `tan-`, `dig-`) and re-run `npm test` — the
coverage test will call out any under-stocked cell by name.
