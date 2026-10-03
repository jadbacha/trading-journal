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
  payouts: [],
  ...patch,
})

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
