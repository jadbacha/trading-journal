import { describe, expect, it } from 'vitest'
import { mistakeReport } from './mistakes'
import type { Trade } from './types'

const t = (pnl: number, mistakes?: string[], extra: Partial<Trade> = {}): Trade => ({
  id: String(Math.random()),
  date: '2026-10-01',
  pnl,
  source: 'manual',
  mistakes,
  ...extra,
})

describe('mistakeReport', () => {
  it('totals each mistake, worst first, and splits clean from mistake trades', () => {
    const r = mistakeReport(
      [
        t(-300, ['Revenge trade', 'Oversized']),
        t(-120, ['Revenge trade']),
        t(80, ['Cut winner early']),
        t(-50, ['Moved stop']),
        t(400),
        t(-100),
      ],
      0,
    )
    expect(r.rows).toEqual([
      { tag: 'Revenge trade', trades: 2, pnl: -420 },
      { tag: 'Oversized', trades: 1, pnl: -300 },
      { tag: 'Moved stop', trades: 1, pnl: -50 },
      { tag: 'Cut winner early', trades: 1, pnl: 80 },
    ])
    // A trade with two mistakes counts once in the overall total.
    expect(r.mistakePnl).toBe(-390)
    expect(r.clean).toEqual({ trades: 2, pnl: 300 })
  })

  it('uses P&L after commissions', () => {
    const r = mistakeReport([t(-100, ['FOMO entry'], { qty: 3, gross: true })], 1.3)
    expect(r.rows[0].pnl).toBe(-103.9)
  })

  it('is empty without tags', () => {
    expect(mistakeReport([t(10)], 0)).toEqual({ rows: [], clean: { trades: 1, pnl: 10 }, mistakePnl: 0 })
  })
})
