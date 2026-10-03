import { classify, netPnl } from './stats'
import type { BreakevenRange, Trade } from './types'

export type EdgeDimension = 'hour' | 'weekday' | 'symbol'

export interface EdgeRow {
  key: string
  label: string
  trades: number
  wins: number
  losses: number
  pnl: number
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** "MNQZ6" → "MNQ", "ES 12-26" → "ES": contracts of the same product group together. */
export function symbolRoot(symbol: string): string {
  const first = symbol.trim().split(/\s+/)[0].toUpperCase()
  return first.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, '') || first
}

/** 24-hour hour of a trade's time ("17:36:50", "2:31 PM"), or null. */
export function tradeHour(time: string | undefined): number | null {
  const m = time?.match(/^(\d{1,2}):\d{2}(?::\d{2})?\s*([AP]M)?$/i)
  if (!m) return null
  let h = Number(m[1])
  if (m[2]?.toUpperCase() === 'PM' && h < 12) h += 12
  if (m[2]?.toUpperCase() === 'AM' && h === 12) h = 0
  return h < 24 ? h : null
}

function keyOf(t: Trade, dim: EdgeDimension): { key: string; label: string } | null {
  if (dim === 'symbol') {
    if (!t.symbol) return null
    const root = symbolRoot(t.symbol)
    return { key: root, label: root }
  }
  if (dim === 'weekday') {
    const i = (new Date(`${t.date}T12:00:00Z`).getUTCDay() + 6) % 7
    return { key: String(i), label: WEEKDAYS[i] }
  }
  const h = tradeHour(t.time)
  if (h === null) return null
  return { key: String(h).padStart(2, '0'), label: `${String(h).padStart(2, '0')}:00` }
}

/**
 * Net P&L, trade count and wins/losses per hour of the exit time, weekday or product.
 * Trades without that information (manual entries have no time) are left out; the
 * count of those comes back as `skipped`.
 */
export function edgeBreakdown(trades: Trade[], dim: EdgeDimension, commission: number, breakeven: BreakevenRange) {
  const rows = new Map<string, EdgeRow>()
  let skipped = 0
  for (const t of trades) {
    const k = keyOf(t, dim)
    if (!k) {
      skipped++
      continue
    }
    const pnl = netPnl(t, commission)
    const r = rows.get(k.key) ?? { ...k, trades: 0, wins: 0, losses: 0, pnl: 0 }
    r.trades++
    const result = classify(pnl, breakeven)
    if (result === 'profit') r.wins++
    else if (result === 'loss') r.losses++
    r.pnl = Math.round((r.pnl + pnl) * 100) / 100
    rows.set(k.key, r)
  }
  // Hours and weekdays read in order; products from best to worst.
  const list = [...rows.values()].sort((a, b) => (dim === 'symbol' ? b.pnl - a.pnl : a.key.localeCompare(b.key)))
  return { rows: list, skipped }
}
