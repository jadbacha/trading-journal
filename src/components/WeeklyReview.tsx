import { useState } from 'react'
import { formatDay } from '../accounts'
import { mistakeReport } from '../mistakes'
import type { Streak } from '../review'
import { addDays, weekReport } from '../review'
import type { DaySummary } from '../stats'
import { formatMoney, tradeStats } from '../stats'
import type { DayNote, Settings, Trade, WeekNote } from '../types'

interface Props {
  initialWeek: string
  days: Map<string, DaySummary>
  trades: Trade[]
  notes: Record<string, DayNote>
  weeks: Record<string, WeekNote>
  streak: Streak
  settings: Settings
  scopeLabel: string
  onWeekNote: (start: string, note: WeekNote) => void
  onOpenDay: (date: string) => void
  onClose: () => void
}

export function WeeklyReview({ initialWeek, days, trades, notes, weeks, streak, settings, scopeLabel, onWeekNote, onOpenDay, onClose }: Props) {
  const [start, setStart] = useState(initialWeek)
  const r = weekReport(start, days, notes)
  const weekTrades = trades.filter((t) => t.date >= start && t.date <= r.end)
  const ts = tradeStats(weekTrades, settings.commissionPerContract, settings.breakeven)
  const mistakes = mistakeReport(weekTrades, settings.commissionPerContract)
  const note = weeks[start] ?? { good: '', fix: '' }
  const lastFocus = weeks[addDays(start, -7)]?.fix?.trim()
  const money = (n: number, signed = false) => formatMoney(n, settings.currency, signed)
  const tradingDays = r.green + r.red + r.gray
  const dayDates = Array.from({ length: 7 }, (_, i) => addDays(start, i))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-label="Weekly review" onClick={(e) => e.stopPropagation()}>
        <header className="panel-head">
          <div className="week-nav">
            <button className="icon-btn" onClick={() => setStart(addDays(start, -7))} aria-label="Previous week">
              ‹
            </button>
            <h2>
              Week of {formatDay(start)} <span className="muted">· {scopeLabel}</span>
            </h2>
            <button className="icon-btn" onClick={() => setStart(addDays(start, 7))} aria-label="Next week">
              ›
            </button>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        {lastFocus && (
          <p className="focus-note">
            🎯 Focus for this week (set last week): <strong>{lastFocus}</strong>
          </p>
        )}

        <div className="stats perf-stats">
          <div className="stat">
            <span className="stat-label">Week P&L</span>
            <span className={`stat-value ${r.pnl > 0 ? 'pos' : r.pnl < 0 ? 'neg' : ''}`}>{money(r.pnl, true)}</span>
            <span className="meter-detail">
              {r.green}W / {r.red}L{r.gray ? ` / ${r.gray} BE` : ''} · {tradingDays} day{tradingDays === 1 ? '' : 's'}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Win rate (trades)</span>
            <span className="stat-value">{ts.winRate === null ? '—' : `${Math.round(ts.winRate * 100)}%`}</span>
            <span className="meter-detail">
              {ts.wins}W / {ts.losses}L · {ts.trades} trade{ts.trades === 1 ? '' : 's'}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Plans written</span>
            <span className="stat-value">{tradingDays ? `${r.plans} / ${tradingDays}` : '—'}</span>
            <span className="meter-detail">trading days with a pre-market plan</span>
          </div>
          <div className="stat">
            <span className="stat-label">Followed my plan</span>
            <span className="stat-value">{r.avgRating === null ? '—' : `${r.avgRating.toFixed(1)} ★`}</span>
            <span className="meter-detail">
              average over {r.ratedDays} rated day{r.ratedDays === 1 ? '' : 's'}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Mistakes cost</span>
            <span className={`stat-value ${mistakes.mistakePnl < 0 ? 'neg' : ''}`}>{mistakes.rows.length ? money(mistakes.mistakePnl, true) : '—'}</span>
            <span className="meter-detail">{mistakes.rows.length ? mistakes.rows.map((m) => `${m.tag} ×${m.trades}`).join(', ') : 'no tagged mistakes'}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Discipline streak</span>
            <span className="stat-value">🔥 {streak.current}</span>
            <span className="meter-detail">best {streak.best} · plan written and rated 4★+</span>
          </div>
        </div>

        <h3>Days</h3>
        <div className="week-days">
          {dayDates.map((d) => {
            const s = days.get(d)
            const n = notes[d]
            return (
              <button key={d} className={`week-day ${s ? `day-${s.result}` : ''}`} onClick={() => onOpenDay(d)}>
                <span className="muted">{new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</span>
                <strong>{s ? money(s.pnl, true) : '—'}</strong>
                <span className="muted">
                  {n?.plan?.trim() ? '📝' : ''}
                  {n?.rating ? ` ${n.rating}★` : ''}
                </span>
              </button>
            )
          })}
        </div>

        <h3>Review</h3>
        <div className="week-notes">
          <label>
            <span>What went well</span>
            <textarea rows={3} value={note.good} onChange={(e) => onWeekNote(start, { ...note, good: e.target.value })} placeholder="Setups that worked, rules you kept…" />
          </label>
          <label>
            <span>One thing to fix next week</span>
            <textarea
              rows={3}
              value={note.fix}
              onChange={(e) => onWeekNote(start, { ...note, fix: e.target.value })}
              placeholder="e.g. No trades after 11:00. Shown on every day of next week."
            />
          </label>
        </div>
      </div>
    </div>
  )
}
