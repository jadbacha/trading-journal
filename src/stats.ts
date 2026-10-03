import type { BreakevenRange, DayResult, Settings, Trade } from './types'

export interface DaySummary {
  date: string
  /** Net of commissions. */
  pnl: number
  fees: number
  trades: number
  result: DayResult
}

/** Commission charged on a trade: only gross trades owe it, once per contract round trip. */
export function tradeFees(t: Trade, commissionPerContract: number): number {
  return t.gross ? Math.round((t.qty ?? 1) * commissionPerContract * 100) / 100 : 0
}

export const netPnl = (t: Trade, commissionPerContract: number) =>
  Math.round((t.pnl - tradeFees(t, commissionPerContract)) * 100) / 100

const ZERO: BreakevenRange = { low: 0, high: 0 }

/** Above the breakeven range is a profit, below it a loss, inside it breakeven. */
export function classify(pnl: number, { low, high }: BreakevenRange = ZERO): DayResult {
  if (pnl > high) return 'profit'
  if (pnl < low) return 'loss'
  return 'breakeven'
}

export function summarizeDays(
  trades: Trade[],
  { breakeven, commissionPerContract }: Pick<Settings, 'breakeven' | 'commissionPerContract'>,
): Map<string, DaySummary> {
  const days = new Map<string, DaySummary>()
  for (const t of trades) {
    const d = days.get(t.date) ?? { date: t.date, pnl: 0, fees: 0, trades: 0, result: 'breakeven' as DayResult }
    d.pnl += netPnl(t, commissionPerContract)
    d.fees += tradeFees(t, commissionPerContract)
    d.trades++
    days.set(t.date, d)
  }
  for (const d of days.values()) {
    d.pnl = Math.round(d.pnl * 100) / 100
    d.fees = Math.round(d.fees * 100) / 100
    d.result = classify(d.pnl, breakeven)
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

export interface TradeStats {
  trades: number
  wins: number
  losses: number
  breakeven: number
  /** Wins as a share of decided trades (breakeven trades excluded), 0–1, or null with none. */
  winRate: number | null
  avgWin: number
  avgLoss: number
  /** Average win divided by average loss, or null when either side is missing. */
  winLossRatio: number | null
  /** Total won divided by total lost; Infinity with wins and no losses, null with neither. */
  profitFactor: number | null
  /** Sum of every trade's P&L after commissions. */
  totalPnl: number
}

/** Trade-level performance, using P&L after commissions. Trades inside the breakeven range are neither wins nor losses. */
export function tradeStats(trades: Trade[], commissionPerContract: number, breakeven: BreakevenRange = ZERO): TradeStats {
  let won = 0
  let total = 0
  let lost = 0
  let wins = 0
  let losses = 0
  for (const t of trades) {
    const pnl = netPnl(t, commissionPerContract)
    total += pnl
    const result = classify(pnl, breakeven)
    if (result === 'profit') {
      wins++
      won += pnl
    } else if (result === 'loss') {
      losses++
      lost -= pnl
    }
  }
  const round = (n: number) => Math.round(n * 100) / 100
  const avgWin = wins ? round(won / wins) : 0
  const avgLoss = losses ? round(lost / losses) : 0
  return {
    trades: trades.length,
    totalPnl: round(total),
    wins,
    losses,
    breakeven: trades.length - wins - losses,
    winRate: wins + losses ? wins / (wins + losses) : null,
    avgWin,
    avgLoss,
    winLossRatio: wins && losses ? avgWin / avgLoss : null,
    profitFactor: losses ? won / lost : wins ? Infinity : null,
  }
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

/** "−$20.00 to +$15.00", or "exactly $0" when there is no range. */
export const describeRange = ({ low, high }: BreakevenRange, currency: string) =>
  low === 0 && high === 0 ? 'exactly $0' : `${formatMoney(low, currency)} to ${formatMoney(high, currency, true)}`
