import { describe, expect, it } from 'vitest'
import { normalize } from './storage'

describe('normalize', () => {
  it('moves a single-challenge journal into its first account', () => {
    const old = {
      trades: [{ id: 't1', date: '2026-10-01', pnl: 474, source: 'import' }],
      notes: { '2026-10-01': { text: 'ok' } },
      settings: { currency: 'USD', commissionPerContract: 1.3, challenge: { startBalance: 50000, endsAt: '2026-10-17T12:00:00.000Z' } },
    }
    const data = normalize(old)
    expect(data.accounts).toHaveLength(1)
    expect(data.accounts[0].rules).toMatchObject({ startBalance: 50000, endsAt: '2026-10-17T12:00:00.000Z', profitTarget: 3000 })
    expect(data.trades[0].accountId).toBe(data.accounts[0].id)
    expect(data.settings).not.toHaveProperty('challenge')
    expect(data.notes['2026-10-01'].text).toBe('ok')
  })

  it('keeps accounts and fills fields added later', () => {
    const data = normalize({
      accounts: [{ id: 'a1', name: 'Funded #1', cost: 150, status: 'funded', rules: { profitTarget: 0 } }],
      trades: [{ id: 't', accountId: 'a1', date: '2026-10-01', pnl: 1, source: 'manual' }, { id: 'u', accountId: 'gone', date: '2026-10-01', pnl: 1, source: 'manual' }],
    })
    expect(data.accounts[0]).toMatchObject({ id: 'a1', name: 'Funded #1', payouts: [], showRemaining: true })
    expect(data.accounts[0].rules).toMatchObject({ profitTarget: 0, maxDrawdown: 2000 })
    expect(data.trades.map((t) => t.accountId)).toEqual(['a1', 'a1'])
  })

  it('hides evaluation-only objectives on accounts that had already passed', () => {
    const data = normalize({
      accounts: [{ id: 'p', status: 'passed' }, { id: 'e', status: 'evaluation' }, { id: 'x', status: 'funded', showConsistency: true }],
      trades: [],
    })
    expect(data.accounts.map((a) => [a.showProfitTarget, a.showConsistency, a.showTradingDays])).toEqual([
      [false, false, false],
      [true, true, true],
      [false, true, false],
    ])
  })

  it('turns the old ±threshold into a breakeven range', () => {
    expect(normalize({ trades: [], settings: { breakevenThreshold: 10 } }).settings.breakeven).toEqual({ low: -10, high: 10 })
    expect(normalize({ trades: [], settings: { breakeven: { low: -20, high: 5 } } }).settings.breakeven).toEqual({ low: -20, high: 5 })
    expect(normalize({ trades: [] }).settings.breakeven).toEqual({ low: 0, high: 0 })
    expect(normalize({ trades: [], settings: { breakevenThreshold: 10 } }).settings).not.toHaveProperty('breakevenThreshold')
  })

  it('rejects files that are not backups', () => {
    expect(() => normalize({ hello: 1 })).toThrow()
  })
})
