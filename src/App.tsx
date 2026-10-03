import { useEffect, useMemo, useState } from 'react'
import { challengeStatus } from './challenge'
import { AccountsDialog } from './components/AccountsDialog'
import { PortfolioCard } from './components/PortfolioCard'
import { Calendar } from './components/Calendar'
import { ChallengeCard } from './components/ChallengeCard'
import { DayPanel } from './components/DayPanel'
import { Performance } from './components/Performance'
import { ImportDialog } from './components/ImportDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { mistakeReport } from './mistakes'
import { loadData, saveData } from './storage'
import { formatMoney, isoDay, netPnl, periodStats, summarizeDays, tradeStats } from './stats'
import type { DayNote, JournalData } from './types'

const VIEW_KEY = 'trading-journal:view'

/** Which account was being viewed, remembered per browser. 'all' means every account. */
function loadView(): string {
  try {
    return localStorage.getItem(VIEW_KEY) ?? ''
  } catch {
    return ''
  }
}

const isEmptyNote = (n: DayNote) =>
  !n.text.trim() && !n.plan?.trim() && !n.rating && !n.images?.length && !n.planImages?.length

export default function App() {
  const [data, setData] = useState<JournalData>(loadData)
  const [now] = useState(() => new Date())
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [selected, setSelected] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'import' | 'settings' | 'accounts' | null>(null)
  const [openAccount, setOpenAccount] = useState<string | null>(null)
  const [perfScope, setPerfScope] = useState<'month' | 'all'>('month')
  const [savedView, setView] = useState(loadView)

  useEffect(() => saveData(data), [data])

  const { settings, accounts } = data
  // Fall back when the remembered account was deleted: one account is shown directly, several as "all".
  const view = savedView === 'all' && accounts.length > 1 ? 'all' : accounts.some((a) => a.id === savedView) ? savedView : accounts.length > 1 ? 'all' : accounts[0].id
  const account = accounts.find((a) => a.id === view) ?? null
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view)
    } catch {
      // Not remembering the view is fine.
    }
  }, [view])

  const viewTrades = useMemo(() => (account ? data.trades.filter((t) => t.accountId === account.id) : data.trades), [data.trades, account])
  const days = useMemo(() => summarizeDays(viewTrades, settings), [viewTrades, settings])
  const tradingPnl = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of data.trades) m.set(t.accountId, Math.round(((m.get(t.accountId) ?? 0) + netPnl(t, settings.commissionPerContract)) * 100) / 100)
    return m
  }, [data.trades, settings.commissionPerContract])
  const tradeCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of data.trades) m.set(t.accountId, (m.get(t.accountId) ?? 0) + 1)
    return m
  }, [data.trades])
  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`
  const month = useMemo(
    () => periodStats([...days.values()].filter((d) => d.date.startsWith(monthPrefix))),
    [days, monthPrefix],
  )
  const today = isoDay(now)
  const challenge = useMemo(() => (account ? challengeStatus(days.values(), account.rules, today) : null), [days, account, today])
  const flags = account?.rules.enabled ? challenge?.flags : undefined
  const scopedTrades = useMemo(
    () => (perfScope === 'month' ? viewTrades.filter((t) => t.date.startsWith(monthPrefix)) : viewTrades),
    [viewTrades, perfScope, monthPrefix],
  )
  const perf = useMemo(() => tradeStats(scopedTrades, settings.commissionPerContract), [scopedTrades, settings.commissionPerContract])
  const mistakes = useMemo(
    () => mistakeReport(scopedTrades, settings.commissionPerContract),
    [scopedTrades, settings.commissionPerContract],
  )
  const tradingDays = month.green + month.red + month.gray
  const existingIds = useMemo(() => new Set(data.trades.map((t) => t.id)), [data.trades])

  const updateAccount = (next: (typeof accounts)[number]) =>
    setData((d) => ({ ...d, accounts: d.accounts.map((a) => (a.id === next.id ? next : a)) }))
  const manage = (id: string | null) => {
    setOpenAccount(id)
    setDialog('accounts')
  }

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
          <select className="account-picker" value={view} onChange={(e) => setView(e.target.value)} aria-label="Account">
            {accounts.length > 1 && <option value="all">All accounts</option>}
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name || 'Untitled'}
              </option>
            ))}
          </select>
          <button className="ghost" onClick={() => manage(null)}>
            Accounts
          </button>
          <button onClick={() => setDialog('import')}>Import trades</button>
          <button className="ghost" onClick={() => setDialog('settings')}>
            Settings
          </button>
        </div>
      </header>

      <main className={selected ? 'with-panel' : ''}>
        <section className="month">
          {account && challenge ? (
            <ChallengeCard
              account={account}
              status={challenge}
              currency={settings.currency}
              onEdit={() => manage(account.id)}
              onAccount={updateAccount}
            />
          ) : (
            <PortfolioCard
              accounts={accounts}
              tradingPnl={tradingPnl}
              currency={settings.currency}
              onOpen={setView}
              onManage={() => manage(null)}
            />
          )}

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

          <Performance
            stats={perf}
            mistakes={mistakes}
            scope={perfScope}
            monthName={monthName}
            currency={settings.currency}
            onScope={setPerfScope}
          />

          <Calendar
            year={cursor.year}
            month={cursor.month}
            days={days}
            notes={data.notes}
            selected={selected}
            today={today}
            currency={settings.currency}
            flags={flags}
            onSelect={setSelected}
          />

          {viewTrades.length === 0 && (
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
            trades={viewTrades
              .filter((t) => t.date === selected)
              .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))}
            note={data.notes[selected]}
            currency={settings.currency}
            commission={settings.commissionPerContract}
            flags={flags?.get(selected)}
            mistakeTags={settings.mistakeTags}
            accounts={accounts}
            accountId={account?.id ?? null}
            onClose={() => setSelected(null)}
            onNoteChange={(update) =>
              setData((d) => {
                const note = update(d.notes[selected] ?? { text: '' })
                const notes = { ...d.notes }
                if (isEmptyNote(note)) delete notes[selected]
                else notes[selected] = note
                return { ...d, notes }
              })
            }
            onTradeMistakes={(id, tags) =>
              setData((d) => ({
                ...d,
                trades: d.trades.map((t) => (t.id === id ? { ...t, mistakes: tags.length ? tags : undefined } : t)),
              }))
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
          accounts={accounts}
          defaultAccountId={account?.id ?? accounts[0].id}
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
      {dialog === 'accounts' && (
        <AccountsDialog
          accounts={accounts}
          tradingPnl={tradingPnl}
          tradeCounts={tradeCounts}
          currency={settings.currency}
          initial={openAccount}
          onClose={() => setDialog(null)}
          onChange={updateAccount}
          onAdd={(a) => setData((d) => ({ ...d, accounts: [...d.accounts, a] }))}
          onDelete={(id) =>
            setData((d) => ({ ...d, accounts: d.accounts.filter((a) => a.id !== id), trades: d.trades.filter((t) => t.accountId !== id) }))
          }
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
