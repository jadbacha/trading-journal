import type { TradeStats } from '../stats'
import { formatMoney } from '../stats'

interface Props {
  stats: TradeStats
  scope: 'month' | 'all'
  monthName: string
  currency: string
  onScope: (scope: 'month' | 'all') => void
}

const pf = (n: number | null) => (n === null ? '—' : n === Infinity ? '∞' : n.toFixed(2))

export function Performance({ stats: s, scope, monthName, currency, onScope }: Props) {
  const winTone = s.winRate === null ? '' : s.winRate >= 0.5 ? 'pos' : 'neg'
  const pfTone = s.profitFactor === null ? '' : s.profitFactor >= 1 ? 'pos' : 'neg'
  return (
    <section className="perf" aria-label="Trade performance">
      <div className="perf-head">
        <h3>Performance · {scope === 'month' ? monthName : 'All time'}</h3>
        <div className="segmented" role="tablist">
          {(['month', 'all'] as const).map((v) => (
            <button key={v} role="tab" aria-selected={scope === v} className={scope === v ? 'on' : ''} onClick={() => onScope(v)}>
              {v === 'month' ? 'This month' : 'All time'}
            </button>
          ))}
        </div>
      </div>
      <div className="stats">
        <div className="stat">
          <span className="stat-label">Win rate</span>
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
    </section>
  )
}
