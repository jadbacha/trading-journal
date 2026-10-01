import type { DaySummary } from './stats'

export interface ChallengeRules {
  enabled: boolean
  /** First day that counts, YYYY-MM-DD. Empty means every trade counts. */
  startDate: string
  startBalance: number
  profitTarget: number
  dailyLossLimit: number
  maxDrawdown: number
  /** The drawdown floor follows the highest end-of-day balance instead of staying at start − max drawdown. */
  trailing: boolean
  /** Best day may be at most this % of the profit target. */
  consistencyPct: number
  minTradingDays: number
}

// The Trading Pit Futures Prime $50,000 challenge, phase 1.
export const defaultRules = (): ChallengeRules => ({
  enabled: true,
  startDate: '',
  startBalance: 50000,
  profitTarget: 3000,
  dailyLossLimit: 1000,
  maxDrawdown: 2000,
  trailing: true,
  consistencyPct: 40,
  minTradingDays: 3,
})

/** Share of the daily loss limit at which a day is flagged as a close call. */
export const NEAR_LIMIT = 0.8

export type DayFlag = 'near-limit' | 'limit-hit' | 'over-cap'

export const FLAG_INFO: Record<DayFlag, { icon: string; label: string }> = {
  'near-limit': { icon: '⚠', label: 'Close to the daily loss limit' },
  'limit-hit': { icon: '⛔', label: 'Daily loss limit hit' },
  'over-cap': { icon: '⚑', label: 'Over the consistency cap' },
}

export interface ChallengeStatus {
  balance: number
  profit: number
  bestDay: number
  consistencyCap: number
  tradingDays: number
  todayPnl: number
  /** Lowest balance allowed before the account fails. */
  floor: number
  /** True if any end-of-day balance closed at or below the floor in force that day. */
  drawdownBreached: boolean
  passed: boolean
  flags: Map<string, DayFlag[]>
}

const round = (n: number) => Math.round(n * 100) / 100

export function challengeStatus(days: Iterable<DaySummary>, rules: ChallengeRules, today: string): ChallengeStatus {
  const counted = [...days].filter((d) => !rules.startDate || d.date >= rules.startDate).sort((a, b) => a.date.localeCompare(b.date))
  const consistencyCap = round((rules.consistencyPct / 100) * rules.profitTarget)

  let balance = rules.startBalance
  let floor = rules.startBalance - rules.maxDrawdown
  let drawdownBreached = false
  let bestDay = 0
  const flags = new Map<string, DayFlag[]>()

  for (const d of counted) {
    balance += d.pnl
    // Only end-of-day balances are known from the trade history, so intraday breaches can't be seen here.
    if (balance <= floor) drawdownBreached = true
    if (rules.trailing) floor = Math.max(floor, balance - rules.maxDrawdown)
    bestDay = Math.max(bestDay, d.pnl)

    const f: DayFlag[] = []
    if (rules.dailyLossLimit > 0 && d.pnl <= -rules.dailyLossLimit) f.push('limit-hit')
    else if (rules.dailyLossLimit > 0 && d.pnl <= -rules.dailyLossLimit * NEAR_LIMIT) f.push('near-limit')
    if (consistencyCap > 0 && d.pnl > consistencyCap) f.push('over-cap')
    if (f.length) flags.set(d.date, f)
  }

  const profit = round(balance - rules.startBalance)
  return {
    balance: round(balance),
    profit,
    bestDay: round(bestDay),
    consistencyCap,
    tradingDays: counted.length,
    todayPnl: counted.find((d) => d.date === today)?.pnl ?? 0,
    floor: round(floor),
    drawdownBreached,
    passed:
      !drawdownBreached &&
      profit >= rules.profitTarget &&
      counted.length >= rules.minTradingDays &&
      bestDay <= consistencyCap,
    flags,
  }
}
