import { useState } from 'react'
import type { DayFlag } from '../challenge'
import { FLAG_INFO } from '../challenge'
import type { Account } from '../accounts'
import type { DayNote, Trade } from '../types'
import type { DaySummary } from '../stats'
import { formatMoney, netPnl } from '../stats'
import { parseMoney } from '../csv'
import { deleteImage, saveScreenshot } from '../images'
import { Screenshots } from './Screenshots'

interface Props {
  date: string
  summary: DaySummary | undefined
  trades: Trade[]
  note: DayNote | undefined
  currency: string
  commission: number
  flags?: DayFlag[]
  mistakeTags: string[]
  accounts: Account[]
  /** The account being viewed, or null for all accounts. */
  accountId: string | null
  /** Applies a change to this day's note, starting from its latest saved state. */
  onNoteChange: (update: (note: DayNote) => DayNote) => void
  onAddTrade: (trade: Omit<Trade, 'id' | 'date' | 'source'>) => void
  onTradeMistakes: (id: string, mistakes: string[]) => void
  onDeleteTrade: (id: string) => void
  onClose: () => void
  /** The "one thing to fix" from last week's review. */
  focus?: string
}

/** Which box a screenshot belongs to: the plan's or the review's. */
type Slot = 'planImages' | 'images'

/** Images pasted from the clipboard, if any. */
const pastedImages = (e: React.ClipboardEvent) => [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'))

const RESULT_LABEL = { profit: 'Green day', loss: 'Red day', breakeven: 'Breakeven' }

export function DayPanel({
  date,
  summary,
  trades,
  note,
  currency,
  commission,
  flags,
  mistakeTags,
  accounts,
  accountId,
  onNoteChange,
  onAddTrade,
  onTradeMistakes,
  onDeleteTrade,
  onClose,
  focus,
}: Props) {
  const [pnl, setPnl] = useState('')
  const [symbol, setSymbol] = useState('')
  const [addTo, setAddTo] = useState(accountId ?? accounts[0]?.id ?? '')
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name || 'Untitled'
  const [error, setError] = useState('')
  const [tagging, setTagging] = useState<string | null>(null)
  const [saving, setSaving] = useState<Slot | null>(null)

  const addImages = async (slot: Slot, files: File[]) => {
    if (!files.length) return
    setSaving(slot)
    try {
      const ids = await Promise.all(files.map(saveScreenshot))
      onNoteChange((n) => ({ ...n, [slot]: [...(n[slot] ?? []), ...ids] }))
    } catch {
      setError("Couldn't save that screenshot. Your browser may be out of storage space.")
    } finally {
      setSaving(null)
    }
  }

  const removeImage = (slot: Slot, id: string) => {
    onNoteChange((n) => ({ ...n, [slot]: n[slot]?.filter((i) => i !== id) }))
    deleteImage(id).catch(() => {})
  }

  /** Screenshot slot plus ⌘V handling for one box. */
  const shots = (slot: Slot) => ({
    onPaste: (e: React.ClipboardEvent) => {
      const files = pastedImages(e)
      if (files.length) {
        e.preventDefault()
        addImages(slot, files)
      }
    },
    slot: (
      <Screenshots
        ids={note?.[slot] ?? []}
        busy={saving === slot}
        onAdd={(files) => addImages(slot, files)}
        onRemove={(id) => removeImage(slot, id)}
      />
    ),
  })
  const plan = shots('planImages')
  const review = shots('images')

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
    onAddTrade({ pnl: value, symbol: symbol.trim() || undefined, accountId: accountId ?? addTo })
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

      {focus && (
        <p className="focus-note">
          🎯 This week's focus: <strong>{focus}</strong>
        </p>
      )}

      <section className="journal-box" onPaste={plan.onPaste}>
        <h3>Pre-market plan</h3>
        <textarea
          value={note?.plan ?? ''}
          onChange={(e) => onNoteChange((n) => ({ ...n, plan: e.target.value }))}
          placeholder={'Bias, key levels, setups I will take, max loss and max trades for today…'}
          rows={4}
        />
        {plan.slot}
      </section>

      <section className="journal-box" onPaste={review.onPaste}>
        <h3>Review</h3>
        <textarea
          value={note?.text ?? ''}
          onChange={(e) => onNoteChange((n) => ({ ...n, text: e.target.value }))}
          placeholder={note?.plan?.trim() ? 'Did you stick to the plan above? What went right, what went wrong?' : 'Setups taken, mistakes, emotions, what to do differently tomorrow…'}
          rows={6}
        />
        <div className="rating" role="radiogroup" aria-label="Followed my plan">
          <span className="muted">Followed my plan:</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={note?.rating === n}
              className={`star ${note?.rating && n <= note.rating ? 'on' : ''}`}
              onClick={() => onNoteChange((cur) => ({ ...cur, rating: cur.rating === n ? undefined : n }))}
            >
              ★
            </button>
          ))}
        </div>
        {review.slot}
      </section>

      <section>
        <h3>Trades {trades.length > 0 && <span className="muted">({trades.length})</span>}</h3>
        {trades.length > 0 && (
          <ul className="trade-list">
            {trades.map((t) => {
              const net = netPnl(t, commission)
              return (
                <li key={t.id}>
                  <div className="trade-row">
                    <span className="trade-meta">
                      {[t.time, t.symbol, t.side, t.qty != null ? `×${t.qty}` : null].filter(Boolean).join(' · ') ||
                        (t.source === 'manual' ? 'Manual entry' : 'Trade')}
                      {!accountId && accounts.length > 1 && <span className="trade-account"> · {accountName(t.accountId)}</span>}
                    </span>
                    <span className={net > 0 ? 'pos' : net < 0 ? 'neg' : ''}>{formatMoney(net, currency, true)}</span>
                    <button
                      className={`tag-btn ${t.mistakes?.length ? 'has' : ''}`}
                      onClick={() => setTagging(tagging === t.id ? null : t.id)}
                      aria-expanded={tagging === t.id}
                    >
                      {t.mistakes?.length ? `⚑ ${t.mistakes.length}` : 'Tag'}
                    </button>
                    <button className="icon-btn small" onClick={() => onDeleteTrade(t.id)} aria-label="Delete trade">
                      ×
                    </button>
                  </div>
                  {t.mistakes?.length && tagging !== t.id ? (
                    <div className="trade-tags">{t.mistakes.join(' · ')}</div>
                  ) : null}
                  {tagging === t.id && (
                    <div className="chips" role="group" aria-label="Mistakes on this trade">
                      {[...new Set([...mistakeTags, ...(t.mistakes ?? [])])].map((tag) => {
                        const on = t.mistakes?.includes(tag) ?? false
                        return (
                          <button
                            key={tag}
                            className={`chip ${on ? 'on' : ''}`}
                            aria-pressed={on}
                            onClick={() =>
                              onTradeMistakes(t.id, on ? (t.mistakes ?? []).filter((m) => m !== tag) : [...(t.mistakes ?? []), tag])
                            }
                          >
                            {tag}
                          </button>
                        )
                      })}
                    </div>
                  )}
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
        {!accountId && accounts.length > 1 && (
          <label className="add-to">
            <span className="muted">Add to</span>
            <select value={addTo} onChange={(e) => setAddTo(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name || 'Untitled'}
                </option>
              ))}
            </select>
          </label>
        )}
        {error && <p className="error">{error}</p>}
      </section>
    </aside>
  )
}
