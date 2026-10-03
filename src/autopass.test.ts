import { describe, expect, it } from 'vitest'
import { defaultAccount } from './accounts'
import { applyAutoPass } from './autopass'
import { emptyData } from './storage'
import type { JournalData } from './types'

const journal = (pnls: [string, number][], patch = {}): JournalData => {
  const base = emptyData()
  const account = defaultAccount({ id: 'a1', ...patch })
  return {
    ...base,
    accounts: [account],
    trades: pnls.map(([date, pnl], i) => ({ id: `t${i}`, accountId: 'a1', date, pnl, source: 'manual' })),
  }
}

describe('applyAutoPass', () => {
  const passing: [string, number][] = [['2026-10-01', 1100], ['2026-10-02', 1000], ['2026-10-05', 950]]

  it('marks an account passed on the day the objectives were met', () => {
    const [a] = applyAutoPass(journal(passing), '2026-10-09').accounts
    expect(a).toMatchObject({ status: 'passed', evalEnd: '2026-10-05', passNotice: true, showProfitTarget: false })
  })

  it('leaves accounts that have not passed untouched', () => {
    const data = journal([['2026-10-01', 2000], ['2026-10-02', 1000]])
    expect(applyAutoPass(data, '2026-10-09')).toBe(data)
  })

  it('respects the auto-pass switch and objectives being off', () => {
    expect(applyAutoPass(journal(passing, { autoPass: false }), '2026-10-09').accounts[0].status).toBe('evaluation')
    const off = journal(passing)
    off.accounts[0].rules.enabled = false
    expect(applyAutoPass(off, '2026-10-09').accounts[0].status).toBe('evaluation')
  })

  it('does not touch accounts already past evaluation', () => {
    const data = journal(passing, { status: 'funded' })
    expect(applyAutoPass(data, '2026-10-09')).toBe(data)
  })

  it('counts commissions when deciding', () => {
    // 3,001 gross meets the 3,000 target, but $3.90 of commissions leaves 2,997.10.
    const data = journal([['2026-10-01', 1000], ['2026-10-02', 1000], ['2026-10-05', 1001]])
    data.trades = data.trades.map((t) => ({ ...t, qty: 1, gross: true }))
    expect(applyAutoPass({ ...data, settings: { ...data.settings, commissionPerContract: 1.3 } }, '2026-10-09').accounts[0].status).toBe('evaluation')
    expect(applyAutoPass({ ...data, settings: { ...data.settings, commissionPerContract: 0 } }, '2026-10-09').accounts[0].status).toBe('passed')
  })
})
