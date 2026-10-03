import type { Account } from './accounts'
import { defaultAccount } from './accounts'
import { defaultRules } from './challenge'
import { DEFAULT_MISTAKES } from './mistakes'
import type { JournalData, Trade } from './types'

const KEY = 'trading-journal:v1'

export const emptyData = (): JournalData => ({
  accounts: [defaultAccount()],
  trades: [],
  notes: {},
  settings: {
    breakevenThreshold: 0,
    currency: 'USD',
    commissionPerContract: 1.3,
    mistakeTags: DEFAULT_MISTAKES,
  },
})

export function loadData(): JournalData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyData()
    return normalize(JSON.parse(raw))
  } catch {
    return emptyData()
  }
}

export function saveData(data: JournalData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // Storage full or blocked; the in-memory state still works for this visit.
  }
}

/**
 * Accepts saved data or a parsed backup and fills in anything missing. Throws on garbage.
 * Journals from before multiple accounts had one challenge in settings and trades with no
 * account; those become the first account and its trades.
 */
export function normalize(value: unknown): JournalData {
  const base = emptyData()
  if (!value || typeof value !== 'object') throw new Error('Not a journal backup')
  const v = value as Partial<JournalData> & { settings?: { challenge?: Partial<Account['rules']> } }
  if (!Array.isArray(v.trades)) throw new Error('Backup has no trades list')

  const { challenge: legacyRules, ...settings } = v.settings ?? {}
  const accounts: Account[] =
    Array.isArray(v.accounts) && v.accounts.length
      ? v.accounts.map((a) => {
          const fresh = defaultAccount()
          return { ...fresh, ...a, rules: { ...fresh.rules, ...a.rules }, payouts: Array.isArray(a.payouts) ? a.payouts : [] }
        })
      : [defaultAccount({ rules: { ...defaultRules(), ...legacyRules } })]
  const known = new Set(accounts.map((a) => a.id))

  return {
    accounts,
    trades: v.trades
      .filter((t): t is Trade => !!t && typeof t.date === 'string' && typeof t.pnl === 'number')
      .map((t) => (known.has(t.accountId) ? t : { ...t, accountId: accounts[0].id })),
    notes: v.notes && typeof v.notes === 'object' ? v.notes : {},
    settings: { ...base.settings, ...settings },
  }
}
