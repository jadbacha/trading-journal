import type { MistakeReport } from '../mistakes'
import type { TradeStats } from '../stats'
import { formatMoney, GOOD_WIN_RATE } from '../stats'

interface Props {
  stats: TradeStats
  mistakes: MistakeReport
  scope: 'month' | 'all'
  monthName: string
  currency: string
}

const pf = (n: number | null) => (n === null ? '—' : n === Infinity ? '∞' : n.toFixed(2))

export function Performance({ stats: s, mistakes, scope, monthName, currency }: Props) {
  const winTone = s.winRate === null ? '' : s.winRate >= GOOD_WIN_RATE ? 'pos' : 'neg'
  const pfTone = s.profitFactor === null ? '' : s.profitFactor >= 1 ? 'pos' : 'neg'
  return (
    <section className="perf" aria-label="Trade performance">
      <div className="perf-head">
        <h3>Performance · {scope === 'month' ? monthName : 'All time'}</h3>
      </div>
      <div className="stats perf-stats">
        <div className="stat">
          <span className="stat-label">Win rate (trades)</span>
          <span className={`stat-value ${winTone}`}>{s.winRate === null ? '—' : `${Math.round(s.winRate * 100)}%`}</span>
          <span className="meter-detail">
            {s.wins}W / {s.losses}L{s.breakeven ? ` / ${s.breakeven} BE` : ''} · {s.trades} trade{s.trades === 1 ? '' : 's'}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Avg win</span>
          <span className="stat-value pos">{s.wins ? formatMoney(s.avgWin, currency, true) : '—'}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Avg loss</span>
          <span className="stat-value neg">{s.losses ? formatMoney(-s.avgLoss, currency) : '—'}</span>
          <span className="meter-detail">
            {s.winLossRatio === null ? 'Win/loss ratio —' : `Win/loss ratio ${s.winLossRatio.toFixed(2)}`}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Profit factor</span>
          <span className={`stat-value ${pfTone}`}>{pf(s.profitFactor)}</span>
          <span className="meter-detail">Total won ÷ total lost</span>
        </div>
      </div>

      <div className="mistakes">
        <div className="mistakes-head">
          <span className="stat-label">Mistakes</span>
          {mistakes.rows.length > 0 && (
            <span className="meter-detail">
              Trades with mistakes{' '}
              <strong className={mistakes.mistakePnl < 0 ? 'neg' : 'pos'}>{formatMoney(mistakes.mistakePnl, currency, true)}</strong>
              {' · '}clean trades ({mistakes.clean.trades}){' '}
              <strong className={mistakes.clean.pnl < 0 ? 'neg' : 'pos'}>{formatMoney(mistakes.clean.pnl, currency, true)}</strong>
            </span>
          )}
        </div>
        {mistakes.rows.length === 0 ? (
          <p className="muted">Tag trades in a day's panel (the Tag button) to see what each mistake costs you.</p>
        ) : (
          <ul className="mistake-list">
            {mistakes.rows.map((r) => (
              <li key={r.tag}>
                <span>{r.tag}</span>
                <span className="muted">
                  {r.trades} trade{r.trades === 1 ? '' : 's'}
                </span>
                <strong className={r.pnl < 0 ? 'neg' : r.pnl > 0 ? 'pos' : ''}>{formatMoney(r.pnl, currency, true)}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
