import type { DayResult, Trade } from './types'

export interface DaySummary {
  date: string
  pnl: number
  trades: number
  result: DayResult
}

export function classify(pnl: number, breakevenThreshold: number): DayResult {
  if (Math.abs(pnl) <= breakevenThreshold) return 'breakeven'
  return pnl > 0 ? 'profit' : 'loss'
}

export function summarizeDays(trades: Trade[], breakevenThreshold: number): Map<string, DaySummary> {
  const days = new Map<string, DaySummary>()
  for (const t of trades) {
    const d = days.get(t.date) ?? { date: t.date, pnl: 0, trades: 0, result: 'breakeven' as DayResult }
    d.pnl += t.pnl
    d.trades++
    days.set(t.date, d)
  }
  for (const d of days.values()) {
    d.pnl = Math.round(d.pnl * 100) / 100
    d.result = classify(d.pnl, breakevenThreshold)
  }
  return days
}

export interface PeriodStats {
  pnl: number
  green: number
  red: number
  gray: number
  trades: number
  bestDay: number
  worstDay: number
}

export function periodStats(days: DaySummary[]): PeriodStats {
  const s: PeriodStats = { pnl: 0, green: 0, red: 0, gray: 0, trades: 0, bestDay: 0, worstDay: 0 }
  for (const d of days) {
    s.pnl += d.pnl
    s.trades += d.trades
    if (d.result === 'profit') s.green++
    else if (d.result === 'loss') s.red++
    else s.gray++
    s.bestDay = Math.max(s.bestDay, d.pnl)
    s.worstDay = Math.min(s.worstDay, d.pnl)
  }
  s.pnl = Math.round(s.pnl * 100) / 100
  return s
}

export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function formatMoney(n: number, currency: string, signed = false): string {
  const text = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Math.abs(n))
  if (n < 0) return `−${text}`
  return signed && n > 0 ? `+${text}` : text
}
