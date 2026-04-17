/**
 * History list. Each entry shows mood + length + a relative timestamp,
 * a Replay button (deterministic re-generation from the stored seed),
 * and a FavouriteStar toggle. Replays do not append a new history
 * entry and do not increment `totalGenerated` (acceptance criterion 33).
 */

import type { HistoryEntry } from '../storage/game-state'
import { FavouriteStar } from '../theme/icons'
import { FAVOURITE_LABEL, HISTORY_LABEL, UNFAVOURITE_LABEL } from './copy'

interface HistoryListProps {
  readonly history: readonly HistoryEntry[]
  onReplay(entry: HistoryEntry): void
  onToggleFavourite(timestamp: number): void
}

const MOOD_TITLE: Readonly<Record<HistoryEntry['mood'], string>> = {
  paranoid: 'Paranoid',
  triumphant: 'Triumphant',
  rambling: 'Rambling',
}

const LENGTH_TITLE: Readonly<Record<HistoryEntry['length'], string>> = {
  short: 'Short',
  medium: 'Medium',
  long: 'Long',
  rambling: 'Rambling',
}

function formatTimestamp(ms: number): string {
  // No locale switching in v1 — keep the rendered value deterministic
  // across machines so screenshots are stable.
  const d = new Date(ms)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function HistoryList({ history, onReplay, onToggleFavourite }: HistoryListProps) {
  if (history.length === 0) return null
  // Render newest first so the Replay/Favourite affordances are at the top.
  const rows = [...history].reverse()
  return (
    <section className="history" aria-label="Speech history">
      <h2 className="history-title">Recent addresses</h2>
      <ul className="history-list">
        {rows.map((entry) => (
          <li key={`${entry.timestamp}-${entry.seed}`} className="history-item">
            <button
              type="button"
              className="history-replay"
              onClick={() => onReplay(entry)}
            >
              <span className="history-meta">
                {MOOD_TITLE[entry.mood]} · {LENGTH_TITLE[entry.length]} · {formatTimestamp(entry.timestamp)}
              </span>
              <span className="history-action">{HISTORY_LABEL}</span>
            </button>
            <button
              type="button"
              className="history-favourite"
              aria-pressed={entry.favourite}
              onClick={() => onToggleFavourite(entry.timestamp)}
            >
              <FavouriteStar active={entry.favourite} />
              <span className="history-favourite-label">
                {entry.favourite ? UNFAVOURITE_LABEL : FAVOURITE_LABEL}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
