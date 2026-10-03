import type { Account } from '../accounts'
import { payoutTotal, portfolio, STATUS_LABEL } from '../accounts'
import { formatMoney } from '../stats'

/** Spend, payouts and ROI across every account. */
export function PortfolioSummary({ accounts, currency }: { accounts: Account[]; currency: string }) {
  const p = portfolio(accounts)
  const money = (n: number, signed = false) => formatMoney(n, currency, signed)
  const counts = (Object.keys(p.byStatus) as (keyof typeof p.byStatus)[])
    .filter((s) => p.byStatus[s])
    .map((s) => `${p.byStatus[s]} ${STATUS_LABEL[s].toLowerCase()}`)
    .join(' · ')
  return (
    <div className="stats portfolio">
      <div className="stat">
        <span className="stat-label">Accounts bought</span>
        <span className="stat-value">{p.accounts}</span>
        <span className="meter-detail">{counts}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Total spent</span>
        <span className="stat-value neg">{money(p.spent)}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Total payouts</span>
        <span className="stat-value pos">{money(p.paidOut)}</span>
        <span className="meter-detail">
          {p.payoutCount} payout{p.payoutCount === 1 ? '' : 's'}
        </span>
      </div>
      <div className="stat">
        <span className="stat-label">ROI</span>
        <span className={`stat-value ${p.roi === null ? '' : p.roi >= 0 ? 'pos' : 'neg'}`}>
          {p.roi === null ? '—' : `${p.roi >= 0 ? '+' : '−'}${Math.abs(Math.round(p.roi * 100))}%`}
        </span>
        <span className="meter-detail">
          Net {money(p.net, true)}
          {p.roi === null ? ' · add what you paid' : ''}
        </span>
      </div>
    </div>
  )
}

interface Props {
  accounts: Account[]
  tradingPnl: Map<string, number>
  currency: string
  onOpen: (id: string) => void
  onManage: () => void
}

/** Shown for "All accounts": the portfolio plus one row per account. */
export function PortfolioCard({ accounts, tradingPnl, currency, onOpen, onManage }: Props) {
  const money = (n: number, signed = false) => formatMoney(n, currency, signed)
  return (
    <section className="challenge" aria-label="All accounts">
      <header className="challenge-head">
        <h2>All accounts</h2>
        <button className="ghost small" onClick={onManage}>
          Manage accounts
        </button>
      </header>
      <PortfolioSummary accounts={accounts} currency={currency} />
      <ul className="account-list compact">
        {accounts.map((a) => (
          <li key={a.id}>
            <button className="account-row" onClick={() => onOpen(a.id)}>
              <span className="account-name">
                <strong>{a.name || 'Untitled'}</strong>
                <span className={`badge status-${a.status}`}>{STATUS_LABEL[a.status]}</span>
              </span>
              <span className="account-figures">
                <span>
                  <span className="muted">Trading P&L</span>{' '}
                  <span className={(tradingPnl.get(a.id) ?? 0) < 0 ? 'neg' : 'pos'}>{money(tradingPnl.get(a.id) ?? 0, true)}</span>
                </span>
                <span>
                  <span className="muted">Payouts</span> <span className="pos">{money(payoutTotal(a))}</span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
