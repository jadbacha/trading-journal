import { describe, expect, it } from 'vitest'
import { challengeStatus, defaultRules, formatRemaining, parseDuration } from './challenge'
import type { DaySummary } from './stats'

const day = (date: string, pnl: number): DaySummary => ({ date, pnl, fees: 0, trades: 1, result: pnl > 0 ? 'profit' : pnl < 0 ? 'loss' : 'breakeven' })

describe('challengeStatus', () => {
  it('matches the Trading Pit dashboard: balance, trailing floor and consistency', () => {
    // Nine sessions netting +$1,056.80 with a best day of $585.20.
    const days = [
      day('2026-09-21', 585.2),
      day('2026-09-22', -400),
      day('2026-09-23', 528.8),
      day('2026-09-24', -560),
      day('2026-09-25', 486.8),
      day('2026-09-28', -100),
      day('2026-09-29', 119.6),
      day('2026-09-30', -73.7),
      day('2026-10-01', 470.1),
    ]
    const s = challengeStatus(days, defaultRules(), '2026-10-01')
    expect(s.balance).toBe(51056.8)
    expect(s.profit).toBe(1056.8)
    expect(s.bestDay).toBe(585.2)
    expect(s.consistencyCap).toBe(1200)
    expect(s.floor).toBe(49056.8)
    expect(s.tradingDays).toBe(9)
    expect(s.todayPnl).toBe(470.1)
    expect(s.drawdownBreached).toBe(false)
    expect(s.passed).toBe(false)
  })

  it('keeps the floor where it was when the balance falls', () => {
    const s = challengeStatus([day('2026-10-01', 1000), day('2026-10-02', -500)], defaultRules(), '2026-10-02')
    expect(s.floor).toBe(49000)
  })

  it('does not trail when trailing is off', () => {
    const s = challengeStatus([day('2026-10-01', 1000)], { ...defaultRules(), trailing: false }, '')
    expect(s.floor).toBe(48000)
  })

  it('detects a drawdown breach', () => {
    const s = challengeStatus([day('2026-10-01', 900), day('2026-10-02', -950), day('2026-10-05', -1100)], defaultRules(), '')
    expect(s.drawdownBreached).toBe(true)
  })

  it('flags close calls, daily limit hits and days over the consistency cap', () => {
    const s = challengeStatus([day('2026-10-01', -850), day('2026-10-02', -1000), day('2026-10-05', 1300)], defaultRules(), '')
    expect(s.flags.get('2026-10-01')).toEqual(['near-limit'])
    expect(s.flags.get('2026-10-02')).toEqual(['limit-hit'])
    expect(s.flags.get('2026-10-05')).toEqual(['over-cap'])
  })

  it('passes when target, days and consistency are all met', () => {
    const days = [day('2026-10-01', 1100), day('2026-10-02', 1000), day('2026-10-05', 950)]
    expect(challengeStatus(days, defaultRules(), '').passed).toBe(true)
  })

  it('ignores days before the start date', () => {
    const s = challengeStatus([day('2026-09-01', -500), day('2026-10-01', 200)], { ...defaultRules(), startDate: '2026-09-15' }, '')
    expect(s.balance).toBe(50200)
    expect(s.tradingDays).toBe(1)
  })
})

describe('time limit', () => {
  it('parses dashboard-style durations', () => {
    expect(parseDuration('15d 12h 26m')).toBe(((15 * 24 + 12) * 60 + 26) * 60_000)
    expect(parseDuration('3D')).toBe(3 * 86_400_000)
    expect(parseDuration('soon')).toBeNull()
  })

  it('formats remaining time like the dashboard', () => {
    expect(formatRemaining(parseDuration('15d 12h 26m')!)).toBe('15d 12h 26m')
    expect(formatRemaining(parseDuration('5h 3m')! + 59_000)).toBe('5h 3m')
    expect(formatRemaining(-1000)).toBe('0m')
  })
})

describe('drawdown lock', () => {
  it('stops trailing once the floor reaches the starting balance', () => {
    // Balance goes 50,000 → 51,500 → 52,600 → 53,000 → 50,500.
    const days = [day('2026-10-01', 1500), day('2026-10-02', 1100), day('2026-10-05', 400), day('2026-10-06', -2500)]
    const s = challengeStatus(days, defaultRules(), '')
    expect(s.floor).toBe(50000)
    expect(s.balance).toBe(50500)
    expect(s.drawdownBreached).toBe(false)
  })

  it('locks exactly at a 52,000 balance', () => {
    expect(challengeStatus([day('2026-10-01', 2000)], defaultRules(), '').floor).toBe(50000)
    expect(challengeStatus([day('2026-10-01', 1999)], defaultRules(), '').floor).toBe(49999)
  })

  it('keeps trailing above the start when the lock is off', () => {
    const s = challengeStatus([day('2026-10-01', 3000), day('2026-10-02', -500)], { ...defaultRules(), lockAtStart: false }, '')
    expect(s.floor).toBe(51000)
  })

  it('breaches at the locked floor', () => {
    const s = challengeStatus([day('2026-10-01', 2500), day('2026-10-02', -2500)], defaultRules(), '')
    expect(s.floor).toBe(50000)
    expect(s.drawdownBreached).toBe(true)
  })
})
