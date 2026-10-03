import type { ChallengeRules } from './challenge'
import { defaultRules } from './challenge'

export type AccountStatus = 'evaluation' | 'passed' | 'funded' | 'failed'

export const STATUS_LABEL: Record<AccountStatus, string> = {
  evaluation: 'Evaluation',
  passed: 'Passed',
  funded: 'Funded',
  failed: 'Failed',
}

export interface Payout {
  id: string
  /** YYYY-MM-DD */
  date: string
  amount: number
}

export interface Account {
  id: string
  name: string
  /** What the account cost to buy. */
  cost: number
  /** YYYY-MM-DD, or '' if not recorded. */
  purchasedAt: string
  status: AccountStatus
  /** Day the evaluation ended (passed or failed), YYYY-MM-DD, or ''. The start is rules.startDate. */
  evalEnd: string
  rules: ChallengeRules
  /** What the tracker shows next to the objectives. */
  showStart: boolean
  showRemaining: boolean
  /** Evaluation-only objectives, usually hidden once the account has passed. */
  showProfitTarget: boolean
  showConsistency: boolean
  showTradingDays: boolean
  /** Switch to passed by itself once every objective is met. */
  autoPass: boolean
  /** Set when auto-pass switched the account; cleared once the announcement is dismissed. */
  passNotice?: boolean
  payouts: Payout[]
}

export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

export const defaultAccount = (patch: Partial<Account> = {}): Account => ({
  id: newId('acc'),
  name: '$50K Challenge',
  cost: 0,
  purchasedAt: '',
  status: 'evaluation',
  evalEnd: '',
  rules: defaultRules(),
  showStart: true,
  showRemaining: true,
  showProfitTarget: true,
  showConsistency: true,
  showTradingDays: true,
  autoPass: true,
  payouts: [],
  ...patch,
})

/**
 * Changes an account's status. Ending the evaluation stamps today as the finish date unless one
 * is set. Passed and funded accounts no longer have a profit target, consistency rule or minimum
 * days, so those are hidden; going back to evaluation shows them again. Failing leaves them as
 * they were, to see what went wrong.
 */
export function withStatus(a: Account, status: AccountStatus, today: string): Account {
  const finished = status !== 'evaluation'
  const evalOnly = status === 'evaluation' ? true : status === 'failed' ? null : false
  return {
    ...a,
    status,
    evalEnd: finished ? a.evalEnd || today : '',
    ...(evalOnly === null ? {} : { showProfitTarget: evalOnly, showConsistency: evalOnly, showTradingDays: evalOnly }),
  }
}

const round = (n: number) => Math.round(n * 100) / 100

export const payoutTotal = (a: Account) => round(a.payouts.reduce((s, p) => s + p.amount, 0))

export interface Portfolio {
  accounts: number
  spent: number
  payoutCount: number
  paidOut: number
  /** Payouts minus what the accounts cost. */
  net: number
  /** net / spent, or null when nothing was spent. */
  roi: number | null
  byStatus: Record<AccountStatus, number>
}

export function portfolio(accounts: Account[]): Portfolio {
  const byStatus: Record<AccountStatus, number> = { evaluation: 0, passed: 0, funded: 0, failed: 0 }
  let spent = 0
  let paidOut = 0
  let payoutCount = 0
  for (const a of accounts) {
    byStatus[a.status]++
    spent += a.cost
    paidOut += payoutTotal(a)
    payoutCount += a.payouts.length
  }
  const net = round(paidOut - spent)
  return {
    accounts: accounts.length,
    spent: round(spent),
    payoutCount,
    paidOut: round(paidOut),
    net,
    roi: spent > 0 ? net / spent : null,
    byStatus,
  }
}

/** Whole days between two YYYY-MM-DD dates, counting both ends: Sep 21 → Sep 21 is day 1. */
export function daysInclusive(from: string, to: string): number | null {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null
  return Math.round((b - a) / 86_400_000) + 1
}

export const formatDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
