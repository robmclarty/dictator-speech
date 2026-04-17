/**
 * Top-level orchestration. Owns the in-flight speech, the `reduceMotion`
 * media query, the toast visibility, and the persisted game state. Every
 * piece of mutable state lives here so the controls, teleprompter, and
 * history list can stay focused on rendering.
 *
 * DOM ordering note: `.controls` appears BEFORE `.app-main` in the DOM
 * (and the Skip button sits inside `.app-main`'s teleprompter-frame). CSS
 * `order` on the flex column reverses the visual placement so the
 * teleprompter still sits above the controls. This is the mechanical
 * fix that pins keyboard tab order at mood → length → generate → skip →
 * copy → favourite (acceptance criteria 6/23/27/38).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { composeSpeech, type Speech } from '../generator/compose'
import { generateSeed } from '../generator/prng'
import { parseChunksCorpus, type Chunk } from '../data/chunks.schema'
import chunksJson from '../data/chunks.json'
import { useGameState } from '../storage/use-local-storage'
import type { HistoryEntry } from '../storage/game-state'
import { installMotionCssVars } from '../theme/motion'
import { Controls } from './controls'
import { copyText, COPY_LABEL, SKIP_LABEL } from './copy'
import { Copy as CopyIcon } from '../theme/icons'
import { ErrorBoundary } from './error-boundary'
import { Footer } from './footer'
import { HistoryList } from './history'
import { Portrait } from './portrait'
import { Teleprompter } from './teleprompter'
import { Toast } from './toast'

import './app.css'

// Parse the corpus once at module scope. The validator is O(n); doing it
// at module load ensures every render path can trust the data.
const CORPUS: readonly Chunk[] = parseChunksCorpus(chunksJson)

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState<boolean>(() => readMatch())
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (event: MediaQueryListEvent): void => setReduce(event.matches)
    mql.addEventListener('change', handler)
    setReduce(mql.matches)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return reduce
}

function readMatch(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface ActiveSpeech {
  readonly speech: Speech
  readonly mood: HistoryEntry['mood']
  readonly length: HistoryEntry['length']
  readonly generationId: number
  readonly persistOnComplete: boolean
}

export function App() {
  const reduceMotion = usePrefersReducedMotion()
  const { state, setMood, setLength, appendEntry, toggleFavouriteEntry } = useGameState()
  const [active, setActive] = useState<ActiveSpeech | null>(null)
  const [revealComplete, setRevealComplete] = useState<boolean>(false)
  const [toastVisible, setToastVisible] = useState<boolean>(false)
  // Skip counter — bumped every time the user presses Skip. Teleprompter
  // watches this via its skipSignal prop. Initial value of 0 is the
  // no-skip sentinel.
  const [skipSignal, setSkipSignal] = useState<number>(0)

  useEffect(() => {
    installMotionCssVars()
  }, [])

  const text = active?.speech.text ?? ''
  const generationId = active?.generationId ?? 0

  const startSpeech = useCallback(
    (input: { seed: string; mood: HistoryEntry['mood']; length: HistoryEntry['length']; persist: boolean }) => {
      const speech = composeSpeech({
        seed: input.seed,
        mood: input.mood,
        length: input.length,
        corpus: CORPUS,
      })
      setRevealComplete(false)
      setToastVisible(false)
      setActive((prev) => ({
        speech,
        mood: input.mood,
        length: input.length,
        generationId: (prev?.generationId ?? 0) + 1,
        persistOnComplete: input.persist,
      }))
    },
    [],
  )

  const handleGenerate = useCallback(() => {
    const seed = generateSeed()
    startSpeech({ seed, mood: state.lastMood, length: state.lastLength, persist: true })
  }, [startSpeech, state.lastMood, state.lastLength])

  const handleReplay = useCallback(
    (entry: HistoryEntry) => {
      startSpeech({ seed: entry.seed, mood: entry.mood, length: entry.length, persist: false })
    },
    [startSpeech],
  )

  const handleComplete = useCallback(() => {
    setRevealComplete(true)
    setActive((prev) => {
      if (prev === null || !prev.persistOnComplete) return prev
      const entry: HistoryEntry = {
        seed: prev.speech.seed,
        mood: prev.mood,
        length: prev.length,
        timestamp: Date.now(),
        favourite: false,
      }
      appendEntry(entry)
      return { ...prev, persistOnComplete: false }
    })
  }, [appendEntry])

  const handleCopy = useCallback(async () => {
    if (active === null || !revealComplete) return
    const result = await copyText(active.speech.text)
    setToastVisible(result === 'manual')
  }, [active, revealComplete])

  const handleDismissToast = useCallback(() => setToastVisible(false), [])

  const handleSkip = useCallback(() => {
    setSkipSignal((s) => s + 1)
  }, [])

  const copyDisabled = !revealComplete || active === null
  const generateDisabled = false
  // Skip is rendered whenever a speech is active AND either (a) the
  // reveal is still running under normal motion, or (b) reduced motion
  // is on. Under reduced motion the reveal completes instantly, so
  // criterion 22 requires the Skip button to remain rendered and
  // operable for the duration of the active speech (a safe no-op once
  // the reveal has completed).
  const showSkip = active !== null && (reduceMotion || !revealComplete)

  const historyApi = useMemo(
    () => ({
      onReplay: handleReplay,
      onToggleFavourite: toggleFavouriteEntry,
    }),
    [handleReplay, toggleFavouriteEntry],
  )

  return (
    <ErrorBoundary>
      <div className="app-shell">
        <header className="app-header">
          <h1 className="app-title">Dictator Speech Generator</h1>
        </header>
        {/* Controls precede <main> in DOM so the keyboard tab order runs
            mood → length → generate → skip (inside main) → copy → favourite.
            CSS `order` restores the visual placement (main above controls). */}
        <Controls
          mood={state.lastMood}
          length={state.lastLength}
          disabled={generateDisabled}
          onMoodChange={setMood}
          onLengthChange={setLength}
          onGenerate={handleGenerate}
        />
        <main className="app-main">
          <Portrait />
          <div className="teleprompter-frame">
            <Teleprompter
              text={text}
              generationId={generationId}
              reduceMotion={reduceMotion}
              skipSignal={skipSignal}
              onComplete={handleComplete}
            />
            {showSkip && (
              <button
                type="button"
                className={
                  reduceMotion ? 'skip-button skip-button--instant' : 'skip-button'
                }
                onClick={handleSkip}
              >
                {SKIP_LABEL}
              </button>
            )}
          </div>
        </main>
        <div className="actions-row">
          <button
            type="button"
            className="copy-button"
            disabled={copyDisabled}
            onClick={() => {
              void handleCopy()
            }}
          >
            <CopyIcon />
            <span className="copy-label">{COPY_LABEL}</span>
          </button>
        </div>
        <HistoryList
          history={state.history}
          onReplay={historyApi.onReplay}
          onToggleFavourite={historyApi.onToggleFavourite}
        />
        <Footer totalGenerated={state.totalGenerated} />
        <Toast visible={toastVisible} reduceMotion={reduceMotion} onDismiss={handleDismissToast} />
      </div>
    </ErrorBoundary>
  )
}
