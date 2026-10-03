import { describe, expect, it } from 'vitest'
import { backupDue } from './backup'
import { emptyData } from './storage'

const now = Date.parse('2026-10-10T12:00:00Z')
const withTrade = (settings = {}) => {
  const d = emptyData()
  return { ...d, trades: [{ id: 't', accountId: d.accounts[0].id, date: '2026-10-01', pnl: 1, source: 'manual' as const }], settings: { ...d.settings, ...settings } }
}

describe('backupDue', () => {
  it('is due when there is data and no backup yet', () => {
    expect(backupDue(withTrade(), now)).toEqual({ due: true, daysSince: null })
  })
  it('is not due with nothing to back up', () => {
    expect(backupDue(emptyData(), now).due).toBe(false)
  })
  it('is due a week after the last backup', () => {
    expect(backupDue(withTrade({ lastBackupAt: '2026-10-05T12:00:00Z' }), now)).toEqual({ due: false, daysSince: 5 })
    expect(backupDue(withTrade({ lastBackupAt: '2026-10-03T12:00:00Z' }), now)).toEqual({ due: true, daysSince: 7 })
  })
  it('respects a snooze', () => {
    expect(backupDue(withTrade({ backupSnoozeUntil: '2026-10-12T00:00:00Z' }), now).due).toBe(false)
  })
})
