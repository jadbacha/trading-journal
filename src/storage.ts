import type { JournalData } from './types'

const KEY = 'trading-journal:v1'

export const emptyData = (): JournalData => ({
  trades: [],
  notes: {},
  settings: { breakevenThreshold: 0, currency: 'USD', commissionPerContract: 0 },
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

/** Accepts a parsed backup file and fills in anything missing. Throws on garbage. */
export function normalize(value: unknown): JournalData {
  const base = emptyData()
  if (!value || typeof value !== 'object') throw new Error('Not a journal backup')
  const v = value as Partial<JournalData>
  if (!Array.isArray(v.trades)) throw new Error('Backup has no trades list')
  return {
    trades: v.trades.filter(
      (t) => t && typeof t.date === 'string' && typeof t.pnl === 'number',
    ),
    notes: v.notes && typeof v.notes === 'object' ? v.notes : {},
    settings: { ...base.settings, ...v.settings },
  }
}
