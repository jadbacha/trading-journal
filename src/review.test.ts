import { describe, expect, it } from 'vitest'
import { addDays, disciplineStreak, weekReport, weekStart } from './review'
import type { DaySummary } from './stats'

const day = (date: string, pnl: number): DaySummary => ({ date, pnl, fees: 0, trades: 1, result: pnl > 0 ? 'profit' : pnl < 0 ? 'loss' : 'breakeven' })

describe('weeks', () => {
  it('finds the Monday of any day', () => {
    expect(weekStart('2026-10-01')).toBe('2026-09-28') // Thursday
    expect(weekStart('2026-09-28')).toBe('2026-09-28') // Monday
    expect(weekStart('2026-10-04')).toBe('2026-09-28') // Sunday
    expect(addDays('2026-09-28', 7)).toBe('2026-10-05')
  })

  it('summarises a week', () => {
    const days = new Map([['2026-09-28', day('2026-09-28', 400)], ['2026-09-29', day('2026-09-29', -150)], ['2026-10-01', day('2026-10-01', 0)], ['2026-10-05', day('2026-10-05', 999)]])
    const notes = { '2026-09-28': { text: '', plan: 'ORB only', rating: 5 }, '2026-09-29': { text: '', rating: 2 } }
    const r = weekReport('2026-09-28', days, notes)
    expect(r).toMatchObject({ end: '2026-10-04', pnl: 250, green: 1, red: 1, gray: 1, plans: 1, avgRating: 3.5, ratedDays: 2 })
    expect(r.bestDay?.date).toBe('2026-09-28')
    expect(r.worstDay?.date).toBe('2026-09-29')
  })
})

describe('disciplineStreak', () => {
  const good = { text: '', plan: 'plan', rating: 4 }
  it('counts consecutive trading days with a plan and a 4+ rating, skipping days off', () => {
    const notes = { '2026-09-25': good, '2026-09-28': good, '2026-09-29': { text: '', plan: 'plan', rating: 3 }, '2026-09-30': good, '2026-10-01': good, '2026-10-02': good }
    const days = ['2026-09-25', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']
    expect(disciplineStreak(days, notes)).toEqual({ current: 3, best: 3, days: 6 })
  })

  it('breaks on a trading day with no plan', () => {
    expect(disciplineStreak(['2026-10-01', '2026-10-02'], { '2026-10-01': good })).toMatchObject({ current: 0, best: 1 })
  })

  it('counts a rated day without trades', () => {
    expect(disciplineStreak([], { '2026-10-01': good })).toEqual({ current: 1, best: 1, days: 1 })
  })
})
