import { useState } from 'react'
import type { DayFlag } from '../challenge'
import { FLAG_INFO } from '../challenge'
import type { DayNote, Trade } from '../types'
import type { DaySummary } from '../stats'
import { formatMoney, netPnl } from '../stats'
import { parseMoney } from '../csv'

interface Props {
  date: string
  summary: DaySummary | undefined
  trades: Trade[]
  note: DayNote | undefined
  currency: string
  commission: number
  flags?: DayFlag[]
  onNoteChange: (note: DayNote) => void
  onAddTrade: (trade: Omit<Trade, 'id' | 'date' | 'source'>) => void
  onDeleteTrade: (id: string) => void
  onClose: () => void
}

const RESULT_LABEL = { profit: 'Green day', loss: 'Red day', breakeven: 'Breakeven' }

export function DayPanel({
  date,
  summary,
  trades,
  note,
  currency,
  commission,
  flags,
  onNoteChange,
  onAddTrade,
  onDeleteTrade,
  onClose,
}: Props) {
  const [pnl, setPnl] = useState('')
  const [symbol, setSymbol] = useState('')
  const [error, setError] = useState('')

  const title = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    const value = parseMoney(pnl)
    if (value === null) {
      setError('Enter a P&L amount, e.g. 250 or -120.50')
      return
    }
    onAddTrade({ pnl: value, symbol: symbol.trim() || undefined })
    setPnl('')
    setSymbol('')
    setError('')
  }

  return (
    <aside className="panel" aria-label={`Journal for ${title}`}>
      <header className="panel-head">
        <div>
          <h2>{title}</h2>
          {summary ? (
            <p className={`panel-pnl day-text-${summary.result}`}>
              {formatMoney(summary.pnl, currency, true)}
              <span className={`badge badge-${summary.result}`}>{RESULT_LABEL[summary.result]}</span>
            </p>
          ) : (
            <p className="muted">No trades logged</p>
          )}
          {flags?.map((f) => (
            <p key={f} className={`flag-note flag-${f}`}>
              {FLAG_INFO[f].icon} {FLAG_INFO[f].label}
            </p>
          ))}
          {summary && summary.fees > 0 && (
            <p className="muted">after {formatMoney(summary.fees, currency)} commissions</p>
          )}
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close day">
          ×
        </button>
      </header>

      <section>
        <h3>Journal</h3>
        <textarea
          value={note?.text ?? ''}
          onChange={(e) => onNoteChange({ ...note, text: e.target.value })}
          placeholder="Setups taken, mistakes, emotions, what to do differently tomorrow…"
          rows={7}
        />
        <div className="rating" role="radiogroup" aria-label="Followed my plan">
          <span className="muted">Followed my plan:</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={note?.rating === n}
              className={`star ${note?.rating && n <= note.rating ? 'on' : ''}`}
              onClick={() => onNoteChange({ text: note?.text ?? '', rating: note?.rating === n ? undefined : n })}
            >
              ★
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>Trades {trades.length > 0 && <span className="muted">({trades.length})</span>}</h3>
        {trades.length > 0 && (
          <ul className="trade-list">
            {trades.map((t) => {
              const net = netPnl(t, commission)
              return (
                <li key={t.id}>
                  <span className="trade-meta">
                    {[t.time, t.symbol, t.side, t.qty != null ? `×${t.qty}` : null].filter(Boolean).join(' · ') ||
                      (t.source === 'manual' ? 'Manual entry' : 'Trade')}
                  </span>
                  <span className={net > 0 ? 'pos' : net < 0 ? 'neg' : ''}>{formatMoney(net, currency, true)}</span>
                  <button className="icon-btn small" onClick={() => onDeleteTrade(t.id)} aria-label="Delete trade">
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <form className="add-trade" onSubmit={add}>
          <input
            inputMode="decimal"
            placeholder="Net P&L (e.g. -85)"
            value={pnl}
            onChange={(e) => setPnl(e.target.value)}
            aria-label="Net P&L"
          />
          <input placeholder="Symbol (optional)" value={symbol} onChange={(e) => setSymbol(e.target.value)} aria-label="Symbol" />
          <button type="submit">Add</button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>
    </aside>
  )
}
