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
  /** A trailing floor stops rising once it reaches the starting balance. */
  lockAtStart: boolean
  /** Best day may be at most this % of the profit target. */
  consistencyPct: number
  minTradingDays: number
  /** Deadline as an ISO timestamp. Empty means no time limit. */
  endsAt: string
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
  lockAtStart: true,
  consistencyPct: 40,
  minTradingDays: 3,
  endsAt: '',
})

/** Parses "15d 12h 26m", "3d", "5h 30m" into milliseconds. */
export function parseDuration(text: string): number | null {
  const parts = [...text.toLowerCase().matchAll(/(\d+(?:\.\d+)?)\s*(d|h|m)/g)]
  if (parts.length === 0) return null
  const unit = { d: 86_400_000, h: 3_600_000, m: 60_000 }
  return parts.reduce((ms, [, n, u]) => ms + Number(n) * unit[u as keyof typeof unit], 0)
}

/** Formats a positive duration like the prop-firm dashboard: "15d 12h 26m". */
export function formatRemaining(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000))
  const d = Math.floor(totalMin / 1440)
  const h = Math.floor((totalMin % 1440) / 60)
  const m = totalMin % 60
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** ISO timestamp → value for a datetime-local input, in the viewer's timezone. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso)
  if (!iso || Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

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
  /** All objectives met on some day, with no drawdown breach before it. */
  passed: boolean
  /** First day the objectives were all met, YYYY-MM-DD. */
  passedOn: string | null
  /** What is still needed to pass, in words; empty once passed. */
  missing: string[]
  /** First day the end-of-day balance closed at or below the floor, YYYY-MM-DD. */
  breachedOn: string | null
  /** End-of-day balance and the floor in force that day, for the equity curve. */
  series: { date: string; balance: number; floor: number }[]
  flags: Map<string, DayFlag[]>
}

const round = (n: number) => Math.round(n * 100) / 100
const money = (n: number) => `$${round(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function challengeStatus(days: Iterable<DaySummary>, rules: ChallengeRules, today: string): ChallengeStatus {
  const counted = [...days].filter((d) => !rules.startDate || d.date >= rules.startDate).sort((a, b) => a.date.localeCompare(b.date))
  const consistencyCap = round((rules.consistencyPct / 100) * rules.profitTarget)

  let balance = rules.startBalance
  let floor = rules.startBalance - rules.maxDrawdown
  let drawdownBreached = false
  let bestDay = 0
  let passedOn: string | null = null
  let breachedOn: string | null = null
  const series: ChallengeStatus['series'] = []
  const flags = new Map<string, DayFlag[]>()

  for (const [i, d] of counted.entries()) {
    balance += d.pnl
    // Only end-of-day balances are known from the trade history, so intraday breaches can't be seen here.
    if (balance <= floor) {
      drawdownBreached = true
      breachedOn ??= d.date
    }
    series.push({ date: d.date, balance: round(balance), floor: round(floor) })
    if (rules.trailing) {
      floor = Math.max(floor, balance - rules.maxDrawdown)
      // e.g. $50K account, $2K drawdown: from a $52K balance on, the floor stays at $50K.
      if (rules.lockAtStart) floor = Math.min(floor, rules.startBalance)
    }
    bestDay = Math.max(bestDay, d.pnl)
    if (
      passedOn === null &&
      !drawdownBreached &&
      balance - rules.startBalance >= rules.profitTarget &&
      i + 1 >= rules.minTradingDays &&
      (consistencyCap <= 0 || bestDay <= consistencyCap)
    )
      passedOn = d.date

    const f: DayFlag[] = []
    if (rules.dailyLossLimit > 0 && d.pnl <= -rules.dailyLossLimit) f.push('limit-hit')
    else if (rules.dailyLossLimit > 0 && d.pnl <= -rules.dailyLossLimit * NEAR_LIMIT) f.push('near-limit')
    if (consistencyCap > 0 && d.pnl > consistencyCap) f.push('over-cap')
    if (f.length) flags.set(d.date, f)
  }

  const profit = round(balance - rules.startBalance)
  const missing: string[] = []
  if (passedOn === null) {
    if (drawdownBreached) missing.push('max drawdown was breached')
    if (profit < rules.profitTarget) missing.push(`${money(rules.profitTarget - profit)} more profit`)
    const daysLeft = rules.minTradingDays - counted.length
    if (daysLeft > 0) missing.push(`${daysLeft} more trading day${daysLeft === 1 ? '' : 's'}`)
    if (consistencyCap > 0 && bestDay > consistencyCap)
      missing.push(`best day ${money(bestDay)} is over the ${money(consistencyCap)} consistency cap`)
  }
  return {
    balance: round(balance),
    profit,
    bestDay: round(bestDay),
    consistencyCap,
    tradingDays: counted.length,
    todayPnl: counted.find((d) => d.date === today)?.pnl ?? 0,
    floor: round(floor),
    drawdownBreached,
    passed: passedOn !== null,
    passedOn,
    missing,
    breachedOn,
    series,
    flags,
  }
}
