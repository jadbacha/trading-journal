import type { BreakevenRange } from '../types'
import { describeRange } from '../stats'

interface Props {
  range: BreakevenRange
  currency: string
  onChange: (range: BreakevenRange) => void
}

/** Edits the breakeven range. The low end is kept at or below zero and the high end at or above it. */
export function BreakevenFields({ range, currency, onChange }: Props) {
  return (
    <div className="be-fields">
      <label>
        <span>From (loss side)</span>
        <input
          type="number"
          step={1}
          max={0}
          value={range.low}
          onChange={(e) => onChange({ ...range, low: -Math.abs(Number(e.target.value) || 0) })}
        />
      </label>
      <label>
        <span>To (profit side)</span>
        <input
          type="number"
          step={1}
          min={0}
          value={range.high}
          onChange={(e) => onChange({ ...range, high: Math.abs(Number(e.target.value) || 0) })}
        />
      </label>
      <p className="muted">
        Days and trades with a net P&L from {describeRange(range, currency)} count as breakeven: gray on the calendar and
        left out of the win rate. Typing 20 in "From" means −20.
      </p>
    </div>
  )
}
