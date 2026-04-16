/**
 * In-character copy strings — Ministry of Information voice. Strings are
 * exact: do not paraphrase, soften, or modernize. Tests in
 * src/app/__tests__/copy.test.ts pin every value to its spec'd literal.
 */

export const IDLE_PROMPT = "Awaiting the Leader's address…" as const

export const GENERATE_LABEL = 'Address the Nation' as const

export const SKIP_LABEL = 'Skip' as const

export const TOAST_FALLBACK = 'Selected for you, Comrade. Press \u2318C / Ctrl+C.' as const

export const ERROR_HEADLINE = 'The Leader is indisposed.' as const

export const ERROR_BODY = 'A regrettable interruption. The address will resume momentarily.' as const

export const ERROR_RELOAD_LABEL = 'Resume the address.' as const

export const FOOTER_DISCLAIMER =
  'Entirely fictional. Any resemblance to actual persons is coincidental and ridiculous.' as const

export const PORTRAIT_ALT =
  'A portrait of the Leader, resplendent in dress uniform and improbable medals.' as const
