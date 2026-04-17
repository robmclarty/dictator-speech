/**
 * Mood + length controls and the "Address the Nation" primary button.
 * Mood / length state is owned by the parent (App) so the same values can
 * drive both the generation handler and the localStorage write path.
 *
 * Length is presented as a 0..3 slider for quick coarse selection; the
 * adjacent label is the source of truth for which bucket is selected.
 */

import { useId } from 'react'
import { GENERATE_LABEL } from './copy'
import {
  DEFAULT_LENGTH,
  LENGTHS,
  USER_MOODS,
  type Length,
  type UserMood,
} from '../storage/game-state'

const LENGTH_LABELS: Readonly<Record<Length, string>> = {
  short: 'Short (~80 words)',
  medium: 'Medium (~200 words)',
  long: 'Long (~400 words)',
  rambling: 'Rambling (~800 words)',
}

const MOOD_LABELS: Readonly<Record<UserMood, string>> = {
  paranoid: 'Paranoid',
  triumphant: 'Triumphant',
  rambling: 'Rambling',
}

function indexOfLength(length: Length): number {
  for (let i = 0; i < LENGTHS.length; i += 1) {
    if (LENGTHS[i] === length) return i
  }
  return LENGTHS.indexOf(DEFAULT_LENGTH)
}

function lengthAt(index: number): Length {
  if (index < 0) return LENGTHS[0] ?? DEFAULT_LENGTH
  if (index >= LENGTHS.length) {
    const last = LENGTHS[LENGTHS.length - 1]
    return last ?? DEFAULT_LENGTH
  }
  return LENGTHS[index] ?? DEFAULT_LENGTH
}

function isValidMood(value: string): value is UserMood {
  for (const m of USER_MOODS) {
    if (m === value) return true
  }
  return false
}

interface ControlsProps {
  readonly mood: UserMood
  readonly length: Length
  readonly disabled: boolean
  onMoodChange(next: UserMood): void
  onLengthChange(next: Length): void
  onGenerate(): void
}

export function Controls({
  mood,
  length,
  disabled,
  onMoodChange,
  onLengthChange,
  onGenerate,
}: ControlsProps) {
  const moodId = useId()
  const lengthId = useId()
  const lengthLabelId = useId()

  return (
    <div className="controls" role="group" aria-label="Speech controls">
      <div className="control-field">
        <label className="control-label" htmlFor={moodId}>
          Mood
        </label>
        <select
          id={moodId}
          className="control-select"
          value={mood}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value
            if (isValidMood(next)) onMoodChange(next)
          }}
        >
          {USER_MOODS.map((m) => (
            <option key={m} value={m}>
              {MOOD_LABELS[m]}
            </option>
          ))}
        </select>
      </div>
      <div className="control-field">
        <label className="control-label" htmlFor={lengthId}>
          Length
        </label>
        <input
          id={lengthId}
          className="control-slider"
          type="range"
          min={0}
          max={LENGTHS.length - 1}
          step={1}
          value={indexOfLength(length)}
          disabled={disabled}
          aria-describedby={lengthLabelId}
          onChange={(event) => {
            const index = Number(event.target.value)
            onLengthChange(lengthAt(index))
          }}
        />
        <span id={lengthLabelId} className="control-readout">
          {LENGTH_LABELS[length] ?? LENGTH_LABELS[DEFAULT_LENGTH]}
        </span>
      </div>
      <button
        type="button"
        className="primary-button"
        disabled={disabled}
        onClick={onGenerate}
      >
        {GENERATE_LABEL}
      </button>
    </div>
  )
}

