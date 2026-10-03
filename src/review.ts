import type { DaySummary } from './stats'
import type { DayNote } from './types'

/** Monday of the week containing `date`, YYYY-MM-DD. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** A day counts toward discipline when a plan was written and the plan rating is 4 or 5. */
export const disciplined = (n: DayNote | undefined) => !!n?.plan?.trim() && (n.rating ?? 0) >= 4

export interface Streak {
  current: number
  best: number
  /** Days looked at: trading days plus days with a rating. */
  days: number
}

/**
 * Consecutive disciplined days, skipping days with neither trades nor a rating (weekends,
 * days off). The current streak counts back from the most recent such day.
 */
export function disciplineStreak(tradingDays: Iterable<string>, notes: Record<string, DayNote>): Streak {
  const dates = [...new Set([...tradingDays, ...Object.keys(notes).filter((d) => notes[d].rating)])].sort()
  let run = 0
  let best = 0
  for (const d of dates) {
    run = disciplined(notes[d]) ? run + 1 : 0
    best = Math.max(best, run)
  }
  return { current: run, best, days: dates.length }
}

export interface WeekReport {
  start: string
  end: string
  pnl: number
  green: number
  red: number
  gray: number
  bestDay: DaySummary | null
  worstDay: DaySummary | null
  /** Trading days that had a pre-market plan written. */
  plans: number
  /** Average "followed my plan" rating over rated days, or null. */
  avgRating: number | null
  ratedDays: number
}

export function weekReport(start: string, days: Map<string, DaySummary>, notes: Record<string, DayNote>): WeekReport {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const traded = dates.map((d) => days.get(d)).filter((d): d is DaySummary => !!d)
  const ratings = dates.map((d) => notes[d]?.rating).filter((r): r is number => !!r)
  const sorted = [...traded].sort((a, b) => b.pnl - a.pnl)
  return {
    start,
    end: dates[6],
    pnl: Math.round(traded.reduce((s, d) => s + d.pnl, 0) * 100) / 100,
    green: traded.filter((d) => d.result === 'profit').length,
    red: traded.filter((d) => d.result === 'loss').length,
    gray: traded.filter((d) => d.result === 'breakeven').length,
    bestDay: sorted[0] ?? null,
    worstDay: sorted.length > 1 ? sorted[sorted.length - 1] : null,
    plans: traded.filter((d) => notes[d.date]?.plan?.trim()).length,
    avgRating: ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null,
    ratedDays: ratings.length,
  }
}
