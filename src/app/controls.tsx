import { GENERATE_LABEL } from './copy'

/**
 * Stubbed controls row. Real mood/length state and the wire-up to the
 * generator land in later phases. Markup here exists so the layout, focus
 * ring, and keyboard tab order can be validated visually now.
 */
export function Controls() {
  return (
    <div className="controls" role="group" aria-label="Controls">
      <label className="control-field">
        <span className="control-label">Mood</span>
        <select className="control-select" defaultValue="grand" disabled>
          <option value="grand">Grand</option>
          <option value="paranoid">Paranoid</option>
          <option value="benevolent">Benevolent</option>
        </select>
      </label>
      <label className="control-field">
        <span className="control-label">Length</span>
        <input
          className="control-slider"
          type="range"
          min={1}
          max={3}
          defaultValue={2}
          step={1}
          disabled
        />
      </label>
      <button type="button" className="primary-button" disabled>
        {GENERATE_LABEL}
      </button>
    </div>
  )
}
