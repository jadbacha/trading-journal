import { useState } from 'react'
import type { EdgeDimension } from '../edge'
import { edgeBreakdown } from '../edge'
import { formatMoney } from '../stats'
import type { BreakevenRange, Trade } from '../types'

interface Props {
  trades: Trade[]
  commission: number
  breakeven: BreakevenRange
  currency: string
}

const TABS: { key: EdgeDimension; label: string }[] = [
  { key: 'hour', label: 'Hour' },
  { key: 'weekday', label: 'Weekday' },
  { key: 'symbol', label: 'Product' },
]

/** Where the P&L comes from: net result per hour of exit, weekday or product, as bars around zero. */
export function EdgeStats({ trades, commission, breakeven, currency }: Props) {
  const [dim, setDim] = useState<EdgeDimension>('hour')
  const { rows, skipped } = edgeBreakdown(trades, dim, commission, breakeven)
  const scale = Math.max(1, ...rows.map((r) => Math.abs(r.pnl)))

  return (
    <div className="edge">
      <div className="mistakes-head">
        <span className="stat-label">Where you make and lose money</span>
        <div className="segmented" role="tablist" aria-label="Group by">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={dim === t.key} className={dim === t.key ? 'on' : ''} onClick={() => setDim(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="muted">
          {dim === 'hour' ? 'No trade times yet. Imported trades carry their exit time.' : 'No trades in this period.'}
        </p>
      ) : (
        <table className="edge-table">
          <thead>
            <tr>
              <th>{TABS.find((t) => t.key === dim)!.label}</th>
              <th>Trades</th>
              <th>Win rate</th>
              <th className="edge-bar-col">Net P&L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const decided = r.wins + r.losses
              const pct = (Math.abs(r.pnl) / scale) * 50
              return (
                <tr key={r.key}>
                  <td>{r.label}</td>
                  <td>{r.trades}</td>
                  <td>{decided ? `${Math.round((r.wins / decided) * 100)}%` : '—'}</td>
                  <td className="edge-bar-col">
                    <div className="edge-cell">
                      <div className="edge-bar" title={formatMoney(r.pnl, currency, true)}>
                        <span className="edge-zero" />
                        <span
                          className={`edge-fill ${r.pnl >= 0 ? 'pos-bg' : 'neg-bg'}`}
                          style={r.pnl >= 0 ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }}
                        />
                      </div>
                      <span className="edge-value">{formatMoney(r.pnl, currency, true)}</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {skipped > 0 && rows.length > 0 && (
        <p className="muted small-note">
          {skipped} trade{skipped === 1 ? '' : 's'} without {dim === 'hour' ? 'a time' : 'a symbol'} not shown.
        </p>
      )}
    </div>
  )
}
