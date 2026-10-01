export interface Trade {
  id: string
  /** Trading day the P&L belongs to, YYYY-MM-DD (taken from the exit/close time). */
  date: string
  /** Net P&L after fees, in account currency. */
  pnl: number
  symbol?: string
  side?: string
  qty?: number
  time?: string
  source: 'import' | 'manual'
}

export interface DayNote {
  text: string
  /** 1–5 self-rating of how well the plan was followed. */
  rating?: number
}

export interface Settings {
  /** A day whose |net P&L| is at or below this amount counts as breakeven (gray). */
  breakevenThreshold: number
  currency: string
}

export interface JournalData {
  trades: Trade[]
  notes: Record<string, DayNote>
  settings: Settings
}

export type DayResult = 'profit' | 'loss' | 'breakeven'
