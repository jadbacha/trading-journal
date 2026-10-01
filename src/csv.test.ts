import { describe, expect, it } from 'vitest'
import { guessMapping, parseCsv, parseDay, parseMoney, rowsToTrades } from './csv'
import { classify, summarizeDays } from './stats'

describe('parseMoney', () => {
  it.each([
    ['$1,234.50', 1234.5],
    ['-12.5', -12.5],
    ['$(12.50)', -12.5],
    ['(40)', -40],
    ['-$85.00', -85],
    ['12,50 €', 12.5],
    ['1.234,56', 1234.56],
    ['1,234', 1234],
    ['', null],
    ['n/a', null],
  ])('%s → %s', (raw, expected) => {
    expect(parseMoney(raw)).toBe(expected)
  })
})

describe('parseDay', () => {
  it('reads ISO dates', () => expect(parseDay('2026-03-05 14:31:00')).toBe('2026-03-05'))
  it('reads US dates', () => expect(parseDay('03/05/2026 2:31:00 PM')).toBe('2026-03-05'))
  it('detects day-first when the first part is over 12', () => expect(parseDay('25/03/2026')).toBe('2026-03-25'))
  it('treats dotted dates as day-first', () => expect(parseDay('05.03.2026 14:31')).toBe('2026-03-05'))
  it('honours an explicit order', () => expect(parseDay('03/05/2026', 'dmy')).toBe('2026-05-03'))
  it('rejects junk', () => expect(parseDay('hello')).toBeNull())
})

describe('importing platform exports', () => {
  it('handles a Tradovate performance export', () => {
    const csv = [
      'symbol,_priceFormat,buyFillId,sellFillId,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration',
      'MNQZ6,-2,1,2,1,21000.25,21010.25,$20.00,10/01/2026 09:31:02,10/01/2026 09:35:10,4min',
      'MNQZ6,-2,3,4,2,21020.00,21000.00,$(80.00),10/01/2026 10:02:00,10/01/2026 10:01:00,1min',
    ].join('\n')
    const parsed = parseCsv(csv)
    const mapping = guessMapping(parsed.headers)
    expect(mapping.date).toBe('soldTimestamp')
    expect(mapping.pnl).toBe('pnl')
    const { trades } = rowsToTrades(parsed, mapping, { subtractFees: false, dateOrder: 'auto' })
    expect(trades.map((t) => [t.date, t.pnl, t.qty, t.side, t.time])).toEqual([
      ['2026-10-01', 20, 1, 'Long', '09:35:10'],
      ['2026-10-01', -80, 2, 'Short', '10:02:00'],
    ])
  })

  it('dates a Tradovate short by its buy-to-cover, even across midnight', () => {
    const csv = [
      'symbol,qty,pnl,boughtTimestamp,soldTimestamp',
      'MNQZ6,1,$50.00,10/02/2026 00:10:00,10/01/2026 23:50:00',
    ].join('\n')
    const parsed = parseCsv(csv)
    const { trades } = rowsToTrades(parsed, guessMapping(parsed.headers), { subtractFees: false, dateOrder: 'auto' })
    expect(trades[0]).toMatchObject({ date: '2026-10-02', side: 'Short', time: '00:10:00' })
  })

  it('handles a NinjaTrader trades export and subtracts commission', () => {
    const csv = [
      'Trade number,Instrument,Account,Market pos.,Qty,Entry price,Exit price,Entry time,Exit time,Profit,Commission',
      '1,ES 12-26,TTP123,Long,1,5800,5802,30/09/2026 15:30,30/09/2026 15:45,$100.00,$4.50',
    ].join('\n')
    const parsed = parseCsv(csv)
    const mapping = guessMapping(parsed.headers)
    expect(mapping).toMatchObject({ date: 'Exit time', pnl: 'Profit', fees: 'Commission', side: 'Market pos.' })
    const { trades } = rowsToTrades(parsed, mapping, { subtractFees: true, dateOrder: 'auto' })
    expect(trades[0]).toMatchObject({ date: '2026-09-30', pnl: 95.5, symbol: 'ES 12-26', side: 'Long', time: '15:45' })
  })

  it('gives identical files identical ids but keeps duplicate rows within a file', () => {
    const csv = 'Date,Net P/L\n2026-10-01,10\n2026-10-01,10\n2026-10-02,oops'
    const run = () => rowsToTrades(parseCsv(csv), guessMapping(['Date', 'Net P/L']), { subtractFees: false, dateOrder: 'auto' })
    const a = run()
    expect(a.trades).toHaveLength(2)
    expect(a.skipped).toBe(1)
    expect(new Set(a.trades.map((t) => t.id)).size).toBe(2)
    expect(run().trades.map((t) => t.id)).toEqual(a.trades.map((t) => t.id))
  })
})

describe('day colouring', () => {
  it('classifies by net P&L with a breakeven band', () => {
    expect(classify(50, 0)).toBe('profit')
    expect(classify(-0.01, 0)).toBe('loss')
    expect(classify(0, 0)).toBe('breakeven')
    expect(classify(-8, 10)).toBe('breakeven')
  })

  it('nets all trades on a day before colouring', () => {
    const days = summarizeDays(
      [
        { id: 'a', date: '2026-10-01', pnl: 100, source: 'manual' },
        { id: 'b', date: '2026-10-01', pnl: -100, source: 'manual' },
        { id: 'c', date: '2026-10-02', pnl: -30, source: 'manual' },
      ],
      { breakevenThreshold: 0, commissionPerContract: 0 },
    )
    expect(days.get('2026-10-01')).toMatchObject({ pnl: 0, trades: 2, result: 'breakeven' })
    expect(days.get('2026-10-02')?.result).toBe('loss')
  })

  it('subtracts commission per contract from gross trades only', () => {
    const trades = [
      { id: 'a', date: '2026-10-01', pnl: 474, qty: 3, gross: true, source: 'import' as const },
      { id: 'b', date: '2026-10-01', pnl: -20, source: 'manual' as const },
      { id: 'c', date: '2026-10-02', pnl: 4, qty: 2, gross: true, source: 'import' as const },
    ]
    const days = summarizeDays(trades, { breakevenThreshold: 0, commissionPerContract: 2.5 })
    expect(days.get('2026-10-01')).toMatchObject({ pnl: 446.5, fees: 7.5, result: 'profit' })
    // A small gross win that commissions turn into a loss shows red.
    expect(days.get('2026-10-02')).toMatchObject({ pnl: -1, fees: 5, result: 'loss' })
  })

  it('marks Tradovate P&L as gross but not net or fee-adjusted columns', () => {
    const opts = { subtractFees: false, dateOrder: 'auto' as const }
    const gross = parseCsv('soldTimestamp,pnl\n10/01/2026 10:00:00,$10.00')
    expect(rowsToTrades(gross, guessMapping(gross.headers), opts).trades[0].gross).toBe(true)
    const net = parseCsv('Date,Net P/L\n2026-10-01,10')
    expect(rowsToTrades(net, guessMapping(net.headers), opts).trades[0].gross).toBeUndefined()
  })
})
