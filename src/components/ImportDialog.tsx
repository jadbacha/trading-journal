import { useMemo, useState } from 'react'
import type { ColumnMapping, DateOrder, ParsedCsv } from '../csv'
import { guessMapping, isNetColumn, parseCsv, rowsToTrades } from '../csv'
import type { Account } from '../accounts'
import type { Trade } from '../types'
import { formatMoney, netPnl } from '../stats'

interface Props {
  accounts: Account[]
  defaultAccountId: string
  existingIds: Set<string>
  currency: string
  commission: number
  onImport: (trades: Trade[]) => void
  onClose: () => void
}

const FIELDS: { key: keyof ColumnMapping; label: string; required?: boolean }[] = [
  { key: 'date', label: 'Close date/time', required: true },
  { key: 'pnl', label: 'P&L', required: true },
  { key: 'fees', label: 'Commission / fees' },
  { key: 'symbol', label: 'Symbol' },
  { key: 'side', label: 'Side' },
  { key: 'qty', label: 'Quantity' },
]

export function ImportDialog({ accounts, defaultAccountId, existingIds, currency, commission, onImport, onClose }: Props) {
  const [accountId, setAccountId] = useState(defaultAccountId)
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<ParsedCsv | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping | null>(null)
  const [subtractFees, setSubtractFees] = useState(false)
  const [dateOrder, setDateOrder] = useState<DateOrder>('auto')
  const [error, setError] = useState('')

  const load = async (file: File) => {
    setError('')
    setFileName(file.name)
    const result = parseCsv(await file.text())
    if (result.headers.length === 0 || result.rows.length === 0) {
      setParsed(null)
      setError('That file has no rows. Export your trade history as CSV and try again.')
      return
    }
    const guess = guessMapping(result.headers)
    setParsed(result)
    setMapping(guess)
    setSubtractFees(!!guess.fees && !!guess.pnl && !isNetColumn(guess.pnl))
  }

  const preview = useMemo(() => {
    if (!parsed || !mapping?.date || !mapping.pnl) return null
    const { trades, skipped } = rowsToTrades(parsed, mapping, { subtractFees, dateOrder, accountId })
    const fresh = trades.filter((t) => !existingIds.has(t.id))
    const dates = trades.map((t) => t.date).sort()
    return {
      trades: fresh,
      duplicates: trades.length - fresh.length,
      skipped,
      total: fresh.reduce((s, t) => s + netPnl(t, commission), 0),
      gross: fresh.some((t) => t.gross),
      from: dates[0],
      to: dates[dates.length - 1],
    }
  }, [parsed, mapping, subtractFees, dateOrder, existingIds, commission, accountId])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Import trades" onClick={(e) => e.stopPropagation()}>
        <header className="panel-head">
          <h2>Import trades</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <p className="muted">
          Export your trade history as CSV from your Trading Pit platform (Quantower, NinjaTrader, Tradovate, ATAS…) and
          drop it here. Re-importing the same file won't create duplicates.
        </p>

        <label className="stack import-account">
          <span className="muted">Import into</span>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name || 'Untitled'}
              </option>
            ))}
          </select>
        </label>

        <label className="dropzone">
          <input
            type="file"
            accept=".csv,text/csv,.txt"
            onChange={(e) => e.target.files?.[0] && load(e.target.files[0])}
          />
          {fileName ? <strong>{fileName}</strong> : <span>Choose a CSV file</span>}
        </label>
        {error && <p className="error">{error}</p>}

        {parsed && mapping && (
          <>
            <h3>Columns</h3>
            <div className="mapping">
              {FIELDS.map((f) => (
                <label key={f.key}>
                  <span>
                    {f.label}
                    {f.required && ' *'}
                  </span>
                  <select
                    value={mapping[f.key]}
                    onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                  >
                    <option value="">{f.required ? 'Select a column…' : '— none —'}</option>
                    {parsed.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label>
                <span>Date format</span>
                <select value={dateOrder} onChange={(e) => setDateOrder(e.target.value as DateOrder)}>
                  <option value="auto">Auto-detect</option>
                  <option value="mdy">Month/Day/Year</option>
                  <option value="dmy">Day/Month/Year</option>
                </select>
              </label>
            </div>
            {mapping.fees && (
              <label className="check">
                <input type="checkbox" checked={subtractFees} onChange={(e) => setSubtractFees(e.target.checked)} />
                Subtract fees from P&L (turn off if the P&L column is already net)
              </label>
            )}

            {preview ? (
              <div className="preview">
                <div>
                  <strong>{preview.trades.length}</strong> new trades
                  {preview.from && (
                    <span className="muted">
                      {' '}
                      · {preview.from} → {preview.to}
                    </span>
                  )}
                </div>
                <div>
                  Net: <strong className={preview.total >= 0 ? 'pos' : 'neg'}>{formatMoney(preview.total, currency, true)}</strong>
                </div>
                {preview.gross && (
                  <div className="muted">
                    {commission > 0
                      ? `After ${formatMoney(commission, currency)} commission per contract.`
                      : 'This P&L is before commissions. Set your commission per contract in Settings.'}
                  </div>
                )}
                {(preview.duplicates > 0 || preview.skipped > 0) && (
                  <div className="muted">
                    {preview.duplicates > 0 && `${preview.duplicates} already imported. `}
                    {preview.skipped > 0 && `${preview.skipped} rows skipped (no date or P&L).`}
                  </div>
                )}
              </div>
            ) : (
              <p className="error">Pick the date and P&L columns to continue.</p>
            )}
          </>
        )}

        <footer className="modal-foot">
          <button className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            disabled={!preview || preview.trades.length === 0}
            onClick={() => preview && onImport(preview.trades)}
          >
            Import {preview?.trades.length ? preview.trades.length : ''} trades
          </button>
        </footer>
      </div>
    </div>
  )
}
