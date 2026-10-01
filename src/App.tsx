import { useEffect, useMemo, useState } from 'react'
import { Calendar } from './components/Calendar'
import { DayPanel } from './components/DayPanel'
import { ImportDialog } from './components/ImportDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { loadData, saveData } from './storage'
import { formatMoney, isoDay, periodStats, summarizeDays } from './stats'
import type { JournalData } from './types'

export default function App() {
  const [data, setData] = useState<JournalData>(loadData)
  const [now] = useState(() => new Date())
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [selected, setSelected] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'import' | 'settings' | null>(null)

  useEffect(() => saveData(data), [data])

  const { settings } = data
  const days = useMemo(
    () => summarizeDays(data.trades, settings),
    [data.trades, settings],
  )
  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`
  const month = useMemo(
    () => periodStats([...days.values()].filter((d) => d.date.startsWith(monthPrefix))),
    [days, monthPrefix],
  )
  const tradingDays = month.green + month.red + month.gray
  const existingIds = useMemo(() => new Set(data.trades.map((t) => t.id)), [data.trades])

  const shift = (delta: number) => {
    const d = new Date(cursor.year, cursor.month + delta, 1)
    setCursor({ year: d.getFullYear(), month: d.getMonth() })
  }

  const monthName = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="app">
      <header className="topbar">
        <h1>Trading Journal</h1>
        <div className="topbar-actions">
          <button onClick={() => setDialog('import')}>Import trades</button>
          <button className="ghost" onClick={() => setDialog('settings')}>
            Settings
          </button>
        </div>
      </header>

      <main className={selected ? 'with-panel' : ''}>
        <section className="month">
          <div className="month-nav">
            <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">
              ‹
            </button>
            <h2>{monthName}</h2>
            <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month">
              ›
            </button>
            <button className="ghost small" onClick={() => setCursor({ year: now.getFullYear(), month: now.getMonth() })}>
              Today
            </button>
          </div>

          <div className="stats">
            <div className="stat">
              <span className="stat-label">Month P&L</span>
              <span className={`stat-value ${month.pnl > 0 ? 'pos' : month.pnl < 0 ? 'neg' : ''}`}>
                {formatMoney(month.pnl, settings.currency, true)}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Green / Red / BE</span>
              <span className="stat-value">
                <span className="pos">{month.green}</span> / <span className="neg">{month.red}</span> /{' '}
                <span className="be">{month.gray}</span>
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Green-day rate</span>
              <span className="stat-value">{tradingDays ? `${Math.round((month.green / tradingDays) * 100)}%` : '—'}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Best / worst day</span>
              <span className="stat-value small">
                <span className="pos">{formatMoney(month.bestDay, settings.currency, true)}</span>
                {' / '}
                <span className="neg">{formatMoney(month.worstDay, settings.currency, true)}</span>
              </span>
            </div>
          </div>

          <Calendar
            year={cursor.year}
            month={cursor.month}
            days={days}
            notes={data.notes}
            selected={selected}
            today={isoDay(now)}
            currency={settings.currency}
            onSelect={setSelected}
          />

          {data.trades.length === 0 && (
            <p className="empty">
              No trades yet.{' '}
              <button className="link" onClick={() => setDialog('import')}>
                Import a CSV
              </button>{' '}
              from your Trading Pit platform, or click any day to log its P&L by hand.
            </p>
          )}
        </section>

        {selected && (
          <DayPanel
            key={selected}
            date={selected}
            summary={days.get(selected)}
            trades={data.trades
              .filter((t) => t.date === selected)
              .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))}
            note={data.notes[selected]}
            currency={settings.currency}
            commission={settings.commissionPerContract}
            onClose={() => setSelected(null)}
            onNoteChange={(note) =>
              setData((d) => {
                const notes = { ...d.notes }
                if (!note.text.trim() && !note.rating) delete notes[selected]
                else notes[selected] = note
                return { ...d, notes }
              })
            }
            onAddTrade={(t) =>
              setData((d) => ({
                ...d,
                trades: [...d.trades, { ...t, id: `man-${crypto.randomUUID()}`, date: selected, source: 'manual' }],
              }))
            }
            onDeleteTrade={(id) => setData((d) => ({ ...d, trades: d.trades.filter((t) => t.id !== id) }))}
          />
        )}
      </main>

      {dialog === 'import' && (
        <ImportDialog
          existingIds={existingIds}
          currency={settings.currency}
          commission={settings.commissionPerContract}
          onClose={() => setDialog(null)}
          onImport={(trades) => {
            setData((d) => ({ ...d, trades: [...d.trades, ...trades] }))
            // Jump to the month of the latest imported trade.
            const last = trades.map((t) => t.date).sort().at(-1)
            if (last) setCursor({ year: +last.slice(0, 4), month: +last.slice(5, 7) - 1 })
            setDialog(null)
          }}
        />
      )}
      {dialog === 'settings' && (
        <SettingsDialog
          data={data}
          onClose={() => setDialog(null)}
          onSettings={(s) => setData((d) => ({ ...d, settings: s }))}
          onReplace={(next) => {
            setData(next)
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}
