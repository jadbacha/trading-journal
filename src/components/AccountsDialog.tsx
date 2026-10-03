import { useState } from 'react'
import type { Account, AccountStatus } from '../accounts'
import { daysInclusive, defaultAccount, formatDay, newId, payoutTotal, STATUS_LABEL } from '../accounts'
import type { ChallengeRules } from '../challenge'
import { formatRemaining, parseDuration, toLocalInput } from '../challenge'
import { parseMoney } from '../csv'
import { formatMoney, isoDay } from '../stats'
import { PortfolioSummary } from './PortfolioCard'

interface Props {
  accounts: Account[]
  /** Net trading P&L per account id, after commissions. */
  tradingPnl: Map<string, number>
  tradeCounts: Map<string, number>
  currency: string
  /** Account to open straight away, if any. */
  initial: string | null
  onChange: (account: Account) => void
  onAdd: (account: Account) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export function AccountsDialog({ accounts, tradingPnl, tradeCounts, currency, initial, onChange, onAdd, onDelete, onClose }: Props) {
  const [editing, setEditing] = useState<string | null>(initial)
  const account = accounts.find((a) => a.id === editing)
  const money = (n: number, signed = false) => formatMoney(n, currency, signed)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-label="Accounts" onClick={(e) => e.stopPropagation()}>
        <header className="panel-head">
          <h2>
            {account ? (
              <>
                <button className="link back" onClick={() => setEditing(null)}>
                  ‹ Accounts
                </button>{' '}
                / {account.name || 'Untitled'}
              </>
            ) : (
              'Accounts'
            )}
          </h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        {account ? (
          <AccountEditor
            key={account.id}
            account={account}
            currency={currency}
            trades={tradeCounts.get(account.id) ?? 0}
            canDelete={accounts.length > 1}
            onChange={onChange}
            onDelete={() => {
              setEditing(null)
              onDelete(account.id)
            }}
          />
        ) : (
          <>
            <PortfolioSummary accounts={accounts} currency={currency} />
            <ul className="account-list">
              {accounts.map((a) => (
                <li key={a.id}>
                  <button className="account-row" onClick={() => setEditing(a.id)}>
                    <span className="account-name">
                      <strong>{a.name || 'Untitled'}</strong>
                      <span className={`badge status-${a.status}`}>{STATUS_LABEL[a.status]}</span>
                    </span>
                    <span className="account-figures">
                      <span>
                        <span className="muted">Cost</span> {money(a.cost)}
                      </span>
                      <span>
                        <span className="muted">Payouts</span> <span className="pos">{money(payoutTotal(a))}</span>
                      </span>
                      <span>
                        <span className="muted">Trading P&L</span>{' '}
                        <span className={(tradingPnl.get(a.id) ?? 0) < 0 ? 'neg' : 'pos'}>{money(tradingPnl.get(a.id) ?? 0, true)}</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <footer className="modal-foot">
              <button
                onClick={() => {
                  const a = defaultAccount({ name: `Account ${accounts.length + 1}`, purchasedAt: isoDay(new Date()) })
                  onAdd(a)
                  setEditing(a.id)
                }}
              >
                + Add account
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}

function AccountEditor({
  account: a,
  currency,
  trades,
  canDelete,
  onChange,
  onDelete,
}: {
  account: Account
  currency: string
  trades: number
  canDelete: boolean
  onChange: (a: Account) => void
  onDelete: () => void
}) {
  const set = (patch: Partial<Account>) => onChange({ ...a, ...patch })
  const setRules = (patch: Partial<ChallengeRules>) => set({ rules: { ...a.rules, ...patch } })
  const rules = a.rules
  const [remaining, setRemaining] = useState('')
  const [payDate, setPayDate] = useState(() => isoDay(new Date()))
  const [payAmount, setPayAmount] = useState('')
  const [message, setMessage] = useState('')
  const [today] = useState(() => isoDay(new Date()))

  const number = (key: 'startBalance' | 'profitTarget' | 'dailyLossLimit' | 'maxDrawdown' | 'consistencyPct' | 'minTradingDays', label: string) => (
    <label>
      <span>{label}</span>
      <input type="number" min={0} value={rules[key]} onChange={(e) => setRules({ [key]: Math.max(0, Number(e.target.value) || 0) })} />
    </label>
  )

  const setStatus = (status: AccountStatus) => {
    // Finishing the evaluation stamps today's date unless one is already set.
    const finished = status === 'passed' || status === 'failed' || status === 'funded'
    set({ status, evalEnd: finished ? a.evalEnd || today : '' })
  }

  const evalDays = rules.startDate ? daysInclusive(rules.startDate, a.evalEnd || today) : null
  const payouts = [...a.payouts].sort((x, y) => y.date.localeCompare(x.date))

  return (
    <div className="account-editor">
      <h3>Account</h3>
      <div className="mapping">
        <label>
          <span>Name</span>
          <input value={a.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. P289435 · $50K Prime" />
        </label>
        <label>
          <span>Status</span>
          <select value={a.status} onChange={(e) => setStatus(e.target.value as AccountStatus)}>
            {(Object.keys(STATUS_LABEL) as AccountStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Price paid</span>
          <input type="number" min={0} step={0.01} value={a.cost} onChange={(e) => set({ cost: Math.max(0, Number(e.target.value) || 0) })} />
        </label>
        <label>
          <span>Bought on</span>
          <input type="date" value={a.purchasedAt} onChange={(e) => set({ purchasedAt: e.target.value })} />
        </label>
      </div>

      <h3>Evaluation</h3>
      <div className="mapping">
        <label>
          <span>Started</span>
          <input type="date" value={rules.startDate} onChange={(e) => setRules({ startDate: e.target.value })} />
        </label>
        <label>
          <span>Finished</span>
          <input type="date" value={a.evalEnd} min={rules.startDate || undefined} onChange={(e) => set({ evalEnd: e.target.value })} />
        </label>
      </div>
      <p className="muted">
        {evalDays
          ? a.evalEnd
            ? `Evaluation took ${evalDays} day${evalDays === 1 ? '' : 's'} (${formatDay(rules.startDate)} → ${formatDay(a.evalEnd)}).`
            : `Day ${evalDays} of the evaluation.`
          : 'Set the start date to track how long the evaluation takes. Only trades from that day on count toward the objectives.'}{' '}
        Setting the status to Passed, Funded or Failed fills in today as the finish date if it's empty.
      </p>

      <h3>Show on the tracker</h3>
      <div className="row-checks">
        <label className="check">
          <input type="checkbox" checked={a.showStart} onChange={(e) => set({ showStart: e.target.checked })} />
          Start date
        </label>
        <label className="check">
          <input type="checkbox" checked={a.showRemaining} onChange={(e) => set({ showRemaining: e.target.checked })} />
          Remaining time
        </label>
        <label className="check">
          <input type="checkbox" checked={rules.enabled} onChange={(e) => setRules({ enabled: e.target.checked })} />
          Objectives
        </label>
      </div>

      <div className="mapping deadline">
        <label>
          <span>Deadline (your local time)</span>
          <div className="inline-field">
            <input
              type="datetime-local"
              value={toLocalInput(rules.endsAt)}
              onChange={(e) => setRules({ endsAt: e.target.value ? new Date(e.target.value).toISOString() : '' })}
            />
            {rules.endsAt && (
              <button type="button" className="ghost" onClick={() => setRules({ endsAt: '' })}>
                Remove
              </button>
            )}
          </div>
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const ms = parseDuration(remaining)
            if (ms === null) return setMessage('Enter the time left like 15d 12h 26m')
            setRules({ endsAt: new Date(Date.now() + ms).toISOString() })
            setRemaining('')
            setMessage(`Deadline set: ${formatRemaining(ms)} from now.`)
          }}
        >
          <label>
            <span>…or paste the time left from your dashboard</span>
            <div className="inline-field">
              <input placeholder="15d 12h 26m" value={remaining} onChange={(e) => setRemaining(e.target.value)} />
              <button type="submit" className="ghost">
                Set
              </button>
            </div>
          </label>
        </form>
      </div>
      {message && <p className="muted">{message}</p>}

      {rules.enabled && (
        <>
          <h3>Rules</h3>
          <div className="mapping">
            {number('startBalance', 'Starting balance')}
            {number('profitTarget', 'Profit target')}
            {number('dailyLossLimit', 'Daily loss limit')}
            {number('maxDrawdown', 'Max drawdown')}
            {number('consistencyPct', 'Consistency (% of target)')}
            {number('minTradingDays', 'Min trading days')}
          </div>
          <label className="check">
            <input type="checkbox" checked={rules.trailing} onChange={(e) => setRules({ trailing: e.target.checked })} />
            Drawdown trails the highest end-of-day balance
          </label>
        </>
      )}

      <h3>Payouts</h3>
      {payouts.length > 0 && (
        <ul className="payout-list">
          {payouts.map((p) => (
            <li key={p.id}>
              <span>{formatDay(p.date)}</span>
              <strong className="pos">{formatMoney(p.amount, currency)}</strong>
              <button
                className="icon-btn small"
                aria-label="Delete payout"
                onClick={() => set({ payouts: a.payouts.filter((x) => x.id !== p.id) })}
              >
                ×
              </button>
            </li>
          ))}
          <li className="payout-total">
            <span>
              Total · {payouts.length} payout{payouts.length === 1 ? '' : 's'}
            </span>
            <strong className="pos">{formatMoney(payoutTotal(a), currency)}</strong>
            <span />
          </li>
        </ul>
      )}
      <form
        className="add-payout"
        onSubmit={(e) => {
          e.preventDefault()
          const amount = parseMoney(payAmount)
          if (amount === null || amount <= 0 || !payDate) return setMessage('Enter the payout date and amount')
          set({ payouts: [...a.payouts, { id: newId('pay'), date: payDate, amount: Math.round(amount * 100) / 100 }] })
          setPayAmount('')
          setMessage('')
        }}
      >
        <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} aria-label="Payout date" />
        <input inputMode="decimal" placeholder="Amount, e.g. 1200" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} aria-label="Payout amount" />
        <button type="submit">Add payout</button>
      </form>

      <footer className="modal-foot spread">
        <button
          className="danger"
          disabled={!canDelete}
          title={canDelete ? undefined : 'You need at least one account'}
          onClick={() => {
            const what = trades ? ` and its ${trades} trade${trades === 1 ? '' : 's'}` : ''
            if (confirm(`Delete "${a.name || 'this account'}"${what}? This cannot be undone.`)) onDelete()
          }}
        >
          Delete account
        </button>
      </footer>
    </div>
  )
}
