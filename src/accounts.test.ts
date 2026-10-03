import { describe, expect, it } from 'vitest'
import { daysInclusive, defaultAccount, followingPhase, nextPhase, portfolio, withStatus } from './accounts'

describe('portfolio', () => {
  it('totals costs and payouts and computes ROI', () => {
    const p = portfolio([
      defaultAccount({ cost: 150, status: 'funded', payouts: [{ id: 'a', date: '2026-10-10', amount: 800 }, { id: 'b', date: '2026-10-24', amount: 450.5 }] }),
      defaultAccount({ cost: 150, status: 'failed' }),
      defaultAccount({ cost: 99.99, status: 'evaluation' }),
    ])
    expect(p).toMatchObject({ accounts: 3, spent: 399.99, payoutCount: 2, paidOut: 1250.5, net: 850.51 })
    expect(p.roi).toBeCloseTo(850.51 / 399.99)
    expect(p.byStatus).toEqual({ evaluation: 1, passed: 0, funded: 1, failed: 1 })
  })

  it('has no ROI when nothing was spent', () => {
    expect(portfolio([defaultAccount()]).roi).toBeNull()
    expect(portfolio([]).accounts).toBe(0)
  })

  it('shows a negative ROI before any payout', () => {
    expect(portfolio([defaultAccount({ cost: 200 })]).roi).toBe(-1)
  })
})

describe('daysInclusive', () => {
  it('counts both the first and last day', () => {
    expect(daysInclusive('2026-09-21', '2026-09-21')).toBe(1)
    expect(daysInclusive('2026-09-21', '2026-10-05')).toBe(15)
    expect(daysInclusive('2026-10-05', '2026-09-21')).toBeNull()
    expect(daysInclusive('', '2026-09-21')).toBeNull()
  })
})

describe('withStatus', () => {
  const base = defaultAccount({ rules: { ...defaultAccount().rules, startDate: '2026-09-21' } })

  it('hides evaluation-only objectives when passed or funded and stamps the finish date', () => {
    for (const status of ['passed', 'funded'] as const) {
      expect(withStatus(base, status, '2026-10-03')).toMatchObject({
        status,
        evalEnd: '2026-10-03',
        showProfitTarget: false,
        showConsistency: false,
        showTradingDays: false,
      })
    }
  })

  it('leaves the objectives alone when failed', () => {
    const custom = { ...base, showConsistency: false }
    expect(withStatus(custom, 'failed', '2026-10-03')).toMatchObject({ evalEnd: '2026-10-03', showProfitTarget: true, showConsistency: false })
  })

  it('brings them back and clears the finish date on returning to evaluation', () => {
    const passed = withStatus(base, 'passed', '2026-10-03')
    expect(withStatus(passed, 'evaluation', '2026-10-04')).toMatchObject({ evalEnd: '', showProfitTarget: true, showConsistency: true, showTradingDays: true })
  })

  it('keeps an existing finish date', () => {
    expect(withStatus({ ...base, evalEnd: '2026-10-01' }, 'funded', '2026-10-09').evalEnd).toBe('2026-10-01')
  })
})

describe('nextPhase', () => {
  const p1 = defaultAccount({ id: 'p1', name: 'P289435 · Phase 1', cost: 150, status: 'passed', rules: { ...defaultAccount().rules, startDate: '2026-09-21', endsAt: '2026-10-17T12:00:00.000Z' } })

  it('starts phase 2 as a fresh evaluation linked to the previous phase', () => {
    const p2 = nextPhase(p1, 'Phase 2', '2026-10-06')
    expect(p2).toMatchObject({ name: 'P289435 · Phase 2', phase: 'Phase 2', previousId: 'p1', cost: 0, status: 'evaluation', evalEnd: '' })
    expect(p2.rules).toMatchObject({ startDate: '2026-10-06', endsAt: '', profitTarget: 3000 })
    expect(p2.id).not.toBe('p1')
  })

  it('starts a funded account already funded, without evaluation objectives', () => {
    const f = nextPhase(p1, 'Funded', '2026-10-20')
    expect(f).toMatchObject({ name: 'P289435 · Funded', status: 'funded', evalEnd: '', showProfitTarget: false })
  })

  it('suggests the following phase', () => {
    expect(followingPhase('Phase 1')).toBe('Phase 2')
    expect(followingPhase('Phase 2')).toBe('Funded')
    expect(followingPhase('Funded')).toBe('Funded')
  })
})
