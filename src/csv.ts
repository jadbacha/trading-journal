import Papa from 'papaparse'
import type { Trade } from './types'

/**
 * Trade-history CSV import.
 *
 * The Trading Pit futures accounts run on third-party platforms (Quantower,
 * NinjaTrader, Tradovate, ATAS, R|Trader...) and each exports trades with
 * different column names, so columns are matched against lists of known names.
 * The import dialog lets the user override any guess.
 */

export interface ColumnMapping {
  date: string
  pnl: string
  fees: string
  symbol: string
  side: string
  qty: string
}

export type DateOrder = 'auto' | 'mdy' | 'dmy'

export interface ParsedCsv {
  headers: string[]
  rows: Record<string, string>[]
}

const CANDIDATES: Record<keyof ColumnMapping, string[]> = {
  // Prefer the exit/close time: P&L is realised when the position closes.
  date: [
    'exit time', 'close time', 'closed', 'soldtimestamp', 'exit date', 'close date',
    'date/time', 'datetime', 'date time', 'time', 'date', 'boughttimestamp', 'entry time', 'open time',
  ],
  // Net columns first, so fees are not subtracted twice.
  pnl: [
    'net p/l', 'net pnl', 'net p&l', 'net profit', 'realized net p/l', 'net', 'realized p/l',
    'realized pnl', 'realized p&l', 'p/l', 'pnl', 'p&l', 'profit', 'profit/loss', 'gross p/l', 'gross pnl',
  ],
  fees: ['commission', 'commissions', 'fee', 'fees', 'comm'],
  symbol: ['symbol', 'instrument', 'contract', 'ticker', 'product'],
  side: ['side', 'market pos.', 'market position', 'direction', 'position', 'b/s', 'buy/sell'],
  qty: ['qty', 'quantity', 'size', 'contracts', 'lots', 'filled qty'],
}

const clean = (h: string) => h.trim().toLowerCase().replace(/\s+/g, ' ')

export function parseCsv(text: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  })
  const headers = (result.meta.fields ?? []).filter((h) => h !== '')
  return { headers, rows: result.data }
}

export function guessMapping(headers: string[]): ColumnMapping {
  const byClean = new Map(headers.map((h) => [clean(h), h]))
  const pick = (names: string[]) => {
    for (const n of names) {
      const hit = byClean.get(n)
      if (hit) return hit
    }
    return ''
  }
  return {
    date: pick(CANDIDATES.date),
    pnl: pick(CANDIDATES.pnl),
    fees: pick(CANDIDATES.fees),
    symbol: pick(CANDIDATES.symbol),
    side: pick(CANDIDATES.side),
    qty: pick(CANDIDATES.qty),
  }
}

/** True when the chosen P&L column is already net of fees. */
export function isNetColumn(name: string): boolean {
  return /net/i.test(name)
}

/** Parses "$1,234.50", "-12.5", "(12.50)", "$(12.50)", "12,50 €" and similar. */
export function parseMoney(raw: string | undefined): number | null {
  if (raw == null) return null
  let s = raw.trim()
  if (s === '') return null
  const negative = s.includes('-') || /\(.*\)/.test(s)
  s = s.replace(/[^\d.,]/g, '')
  if (s === '') return null
  // Decide the decimal separator from whichever of . or , appears last.
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  if (lastComma > lastDot) {
    const decimals = s.length - lastComma - 1
    // "1,234" with three digits after the comma is a thousands separator.
    s = decimals === 3 && lastDot === -1 ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.')
  } else {
    s = s.replace(/,/g, '')
  }
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return negative ? -n : n
}

/** Extracts the calendar day as YYYY-MM-DD without any timezone conversion. */
export function parseDay(raw: string | undefined, order: DateOrder = 'auto'): string | null {
  if (!raw) return null
  const s = raw.trim()
  const pad = (n: number) => String(n).padStart(2, '0')
  const valid = (y: number, m: number, d: number) =>
    y > 1970 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return valid(+m[1], +m[2], +m[3])

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (m) {
    const a = +m[1]
    const b = +m[2]
    let y = +m[3]
    if (y < 100) y += 2000
    // Dots are almost always day-first (European format).
    let dayFirst = order === 'dmy' || (order === 'auto' && (s[m[1].length] === '.' || a > 12))
    if (order === 'mdy') dayFirst = false
    return dayFirst ? valid(y, b, a) : valid(y, a, b)
  }

  // Last resort for formats like "Jan 5, 2026 3:04 PM".
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) return valid(d.getFullYear(), d.getMonth() + 1, d.getDate())
  return null
}

const timeOf = (raw: string | undefined) => raw?.match(/\d{1,2}:\d{2}(:\d{2})?(\s?[AP]M)?/i)?.[0]

export interface ImportResult {
  trades: Trade[]
  skipped: number
}

export function rowsToTrades(
  parsed: ParsedCsv,
  mapping: ColumnMapping,
  options: { subtractFees: boolean; dateOrder: DateOrder; accountId?: string },
): ImportResult {
  const trades: Trade[] = []
  let skipped = 0
  const seen = new Map<string, number>()
  for (const row of parsed.rows) {
    const pair = tradovatePair(row, mapping, options.dateOrder)
    const closeTime = pair?.closeTime ?? row[mapping.date]
    const date = parseDay(closeTime, options.dateOrder)
    let pnl = parseMoney(row[mapping.pnl])
    if (!date || pnl === null) {
      skipped++
      continue
    }
    if (options.subtractFees && mapping.fees) {
      pnl -= Math.abs(parseMoney(row[mapping.fees]) ?? 0)
    }
    const qty = mapping.qty ? parseMoney(row[mapping.qty]) : null
    // Identical rows in one file are distinct trades; number them so they survive dedup.
    const base = rowId(row)
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    trades.push({
      id: n === 0 ? base : `${base}-${n}`,
      accountId: options.accountId ?? '',
      date,
      pnl: Math.round(pnl * 100) / 100,
      gross: !(options.subtractFees && mapping.fees) && !isNetColumn(mapping.pnl) ? true : undefined,
      symbol: mapping.symbol ? row[mapping.symbol]?.trim() || undefined : undefined,
      side: (mapping.side ? row[mapping.side]?.trim() : pair?.side) || undefined,
      qty: qty === null ? undefined : Math.abs(qty),
      time: timeOf(closeTime),
      source: 'import',
    })
  }
  return { trades, skipped }
}

/**
 * Tradovate's Performance export has no side column, only boughtTimestamp and
 * soldTimestamp. Whichever fill came first opened the trade: buy first is a long,
 * sell first is a short, and the later of the two is when the P&L was realised.
 */
function tradovatePair(row: Record<string, string>, mapping: ColumnMapping, order: DateOrder) {
  const bought = row.boughtTimestamp
  const sold = row.soldTimestamp
  if (!bought || !sold || (mapping.date !== 'boughtTimestamp' && mapping.date !== 'soldTimestamp')) return null
  const sortKey = (raw: string) => {
    const [h = '0', m = '0', sec = '0'] = (timeOf(raw) ?? '').replace(/\s?[AP]M$/i, '').split(':')
    let hour = Number(h)
    if (/PM/i.test(raw) && hour < 12) hour += 12
    if (/AM/i.test(raw) && hour === 12) hour = 0
    return `${parseDay(raw, order)} ${[hour, m, sec].map((x) => String(x).padStart(2, '0')).join(':')}`
  }
  const isLong = sortKey(bought) <= sortKey(sold)
  return { side: isLong ? 'Long' : 'Short', closeTime: isLong ? sold : bought }
}

/** Stable id from the row's contents, so importing the same file twice adds nothing. */
function rowId(row: Record<string, string>): string {
  const text = Object.keys(row)
    .sort()
    .map((k) => `${k}=${row[k]}`)
    .join('|')
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 16777619)
    h2 = Math.imul(h2 ^ c, 2246822519)
  }
  return `imp-${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`
}
