import { netPnl } from './stats'
import type { Trade } from './types'

export const DEFAULT_MISTAKES = [
  'Revenge trade',
  'Moved stop',
  'Oversized',
  'FOMO entry',
  'No setup',
  'Cut winner early',
  'Overtrading',
]

export interface MistakeCost {
  tag: string
  trades: number
  /** Net P&L of the tagged trades, after commissions. */
  pnl: number
}

export interface MistakeReport {
  rows: MistakeCost[]
  /** Trades without any mistake tag. */
  clean: { trades: number; pnl: number }
  /** Net P&L of all trades with at least one mistake, each trade counted once. */
  mistakePnl: number
}

/** What each mistake cost: the net result of every trade tagged with it, worst first. */
export function mistakeReport(trades: Trade[], commissionPerContract: number): MistakeReport {
  const byTag = new Map<string, MistakeCost>()
  const clean = { trades: 0, pnl: 0 }
  let mistakePnl = 0
  const round = (n: number) => Math.round(n * 100) / 100
  for (const t of trades) {
    const pnl = netPnl(t, commissionPerContract)
    if (!t.mistakes?.length) {
      clean.trades++
      clean.pnl += pnl
      continue
    }
    mistakePnl += pnl
    for (const tag of t.mistakes) {
      const row = byTag.get(tag) ?? { tag, trades: 0, pnl: 0 }
      row.trades++
      row.pnl += pnl
      byTag.set(tag, row)
    }
  }
  const rows = [...byTag.values()].map((r) => ({ ...r, pnl: round(r.pnl) })).sort((a, b) => a.pnl - b.pnl)
  return { rows, clean: { trades: clean.trades, pnl: round(clean.pnl) }, mistakePnl: round(mistakePnl) }
}
