import type { DayFlag } from '../challenge'
import { FLAG_INFO } from '../challenge'
import type { DaySummary } from '../stats'
import type { DayNote } from '../types'
import { formatMoney, isoDay } from '../stats'

interface Props {
  year: number
  month: number // 0-11
  days: Map<string, DaySummary>
  notes: Record<string, DayNote>
  selected: string | null
  today: string
  currency: string
  flags?: Map<string, DayFlag[]>
  onSelect: (date: string) => void
}

/** Short form for narrow cells: +470, −1.2k. */
function compact(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  const a = Math.abs(n)
  return sign + (a >= 1000 ? `${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k` : Math.round(a).toString())
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function Calendar({ year, month, days, notes, selected, today, currency, flags, onSelect }: Props) {
  // Weeks start on Monday; pad the grid with the trailing/leading days of nearby months.
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - offset)
  const lastOfMonth = new Date(year, month + 1, 0)
  const weeks = Math.ceil((offset + lastOfMonth.getDate()) / 7)

  const rows = Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + w * 7 + i)
      return d
    }),
  )

  return (
    <div className="calendar" role="grid" aria-label="Monthly P&L calendar">
      <div className="cal-row cal-head" role="row">
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-weekday" role="columnheader">
            {w}
          </div>
        ))}
        <div className="cal-weekday cal-week-col" role="columnheader">
          Week
        </div>
      </div>
      {rows.map((week, w) => {
        let weekPnl = 0
        let weekHasTrades = false
        return (
          <div className="cal-row" role="row" key={w}>
            {week.map((d) => {
              const key = isoDay(d)
              const inMonth = d.getMonth() === month
              const summary = inMonth ? days.get(key) : undefined
              if (summary) {
                weekPnl += summary.pnl
                weekHasTrades = true
              }
              const hasNote = inMonth && !!notes[key]
              const dayFlags = (inMonth && flags?.get(key)) || []
              const cls = [
                'cal-day',
                inMonth ? '' : 'outside',
                summary ? `day-${summary.result}` : '',
                key === selected ? 'selected' : '',
                key === today ? 'today' : '',
                dayFlags.some((f) => f !== 'over-cap') ? 'flag-risk' : '',
              ].join(' ')
              return (
                <button
                  key={key}
                  className={cls}
                  role="gridcell"
                  disabled={!inMonth}
                  onClick={() => onSelect(key)}
                  aria-label={[d.toDateString(), summary && formatMoney(summary.pnl, currency, true), ...dayFlags.map((f) => FLAG_INFO[f].label)]
                    .filter(Boolean)
                    .join(', ')}
                >
                  <span className="cal-date">
                    {d.getDate()}
                    {hasNote && <span className="note-dot" title="Has journal entry" />}
                    {dayFlags.map((f) => (
                      <span key={f} className={`day-flag flag-${f}`} title={FLAG_INFO[f].label} aria-hidden>
                        {FLAG_INFO[f].icon}
                      </span>
                    ))}
                  </span>
                  {summary && (
                    <>
                      <span className="cal-pnl">
                        <span className="pnl-full">{formatMoney(summary.pnl, currency, true)}</span>
                        <span className="pnl-short" aria-hidden>
                          {compact(summary.pnl)}
                        </span>
                      </span>
                      <span className="cal-trades">
                        {summary.trades} trade{summary.trades === 1 ? '' : 's'}
                      </span>
                    </>
                  )}
                </button>
              )
            })}
            <div className={`cal-week ${weekHasTrades ? (weekPnl > 0 ? 'pos' : weekPnl < 0 ? 'neg' : '') : ''}`}>
              {weekHasTrades ? formatMoney(Math.round(weekPnl * 100) / 100, currency, true) : '—'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
