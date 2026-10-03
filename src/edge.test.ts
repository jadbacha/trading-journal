import { describe, expect, it } from 'vitest'
import { edgeBreakdown, symbolRoot, tradeHour } from './edge'
import type { Trade } from './types'

const t = (pnl: number, extra: Partial<Trade>): Trade => ({ id: String(Math.random()), accountId: 'a', date: '2026-10-01', pnl, source: 'import', ...extra })
const zero = { low: 0, high: 0 }

describe('edge helpers', () => {
  it('groups contracts by product', () => {
    expect(symbolRoot('MNQZ6')).toBe('MNQ')
    expect(symbolRoot('MESH27')).toBe('MES')
    expect(symbolRoot('ES 12-26')).toBe('ES')
    expect(symbolRoot('NQ')).toBe('NQ')
  })

  it('reads hours from 24h and 12h times', () => {
    expect(tradeHour('17:36:50')).toBe(17)
    expect(tradeHour('09:31')).toBe(9)
    expect(tradeHour('2:31:00 PM')).toBe(14)
    expect(tradeHour('12:05 AM')).toBe(0)
    expect(tradeHour(undefined)).toBeNull()
  })
})

describe('edgeBreakdown', () => {
  const trades = [
    t(200, { time: '09:40', symbol: 'MNQZ6', date: '2026-09-28' }),
    t(-80, { time: '09:55', symbol: 'MNQZ6', date: '2026-09-29' }),
    t(-150, { time: '11:20', symbol: 'MESZ6', date: '2026-09-28' }),
    t(50, { symbol: 'MNQZ6', date: '2026-10-02', source: 'manual' }),
  ]

  it('splits by hour, skipping trades without a time', () => {
    const { rows, skipped } = edgeBreakdown(trades, 'hour', 0, zero)
    expect(rows.map((r) => [r.label, r.trades, r.wins, r.losses, r.pnl])).toEqual([
      ['09:00', 2, 1, 1, 120],
      ['11:00', 1, 0, 1, -150],
    ])
    expect(skipped).toBe(1)
  })

  it('splits by weekday in order', () => {
    const { rows } = edgeBreakdown(trades, 'weekday', 0, zero)
    expect(rows.map((r) => [r.label, r.pnl])).toEqual([['Mon', 50], ['Tue', -80], ['Fri', 50]])
  })

  it('splits by product, best first, after commissions', () => {
    const { rows } = edgeBreakdown(trades.map((x) => ({ ...x, qty: 1, gross: true })), 'symbol', 1.3, zero)
    expect(rows.map((r) => [r.label, r.trades, r.pnl])).toEqual([['MNQ', 3, 166.1], ['MES', 1, -151.3]])
  })
})
