import { useEffect, useState } from 'react'
import type { ChallengeRules, ChallengeStatus } from '../challenge'
import { formatRemaining, NEAR_LIMIT, parseDuration, toLocalInput } from '../challenge'
import { formatMoney } from '../stats'

interface Props {
  rules: ChallengeRules
  status: ChallengeStatus
  currency: string
  onEdit: () => void
  /** Sets the deadline as an ISO timestamp, or '' to remove it. */
  onDeadline: (endsAt: string) => void
}

type Tone = 'good' | 'warn' | 'bad' | 'neutral'

function Meter({ label, value, detail, ratio, tone }: { label: string; value: string; detail: string; ratio: number; tone: Tone }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100
  return (
    <div className="meter">
      <div className="meter-top">
        <span className="stat-label">{label}</span>
        <span className={`meter-value tone-${tone}`}>{value}</span>
      </div>
      <div className="meter-track" role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`meter-fill tone-${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="meter-detail">{detail}</span>
    </div>
  )
}

/** Inline editor: paste the time left from the dashboard, or pick the exact end. */
function DeadlineEditor({ endsAt, onSave, onCancel }: { endsAt: string; onSave: (iso: string) => void; onCancel: () => void }) {
  const [left, setLeft] = useState('')
  const [at, setAt] = useState(() => toLocalInput(endsAt))
  const [error, setError] = useState('')
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (left.trim()) {
      const ms = parseDuration(left)
      if (ms === null) return setError('Use a format like 15d 12h 26m')
      return onSave(new Date(Date.now() + ms).toISOString())
    }
    if (!at) return setError('Enter the time left or pick a date')
    onSave(new Date(at).toISOString())
  }
  return (
    <form className="countdown deadline-edit" onSubmit={save}>
      <span className="stat-label">{endsAt ? 'Edit deadline' : 'Add deadline'}</span>
      <input placeholder="Time left, e.g. 15d 12h 26m" value={left} onChange={(e) => setLeft(e.target.value)} aria-label="Time left" autoFocus />
      <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} disabled={!!left.trim()} aria-label="Ends at" />
      {error && <span className="error">{error}</span>}
      <div className="inline-field">
        <button type="button" className="ghost small" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="small">
          Save
        </button>
      </div>
    </form>
  )
}

/** Live countdown to the challenge deadline, refreshed every 15 seconds, with edit and remove. */
function Countdown({ endsAt, done, onChange }: { endsAt: string; done: boolean; onChange: (iso: string) => void }) {
  const [now, setNow] = useState(() => Date.now())
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [])

  if (editing) {
    return (
      <DeadlineEditor
        endsAt={endsAt}
        onCancel={() => setEditing(false)}
        onSave={(iso) => {
          onChange(iso)
          setNow(Date.now())
          setEditing(false)
        }}
      />
    )
  }

  const end = Date.parse(endsAt)
  if (!endsAt || Number.isNaN(end)) {
    return (
      <div className="countdown">
        <button className="ghost small" onClick={() => setEditing(true)}>
          + Add deadline
        </button>
      </div>
    )
  }

  const left = end - now
  const deadline = new Date(end).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const tone = left <= 0 ? (done ? 'neutral' : 'bad') : left < 3 * 86_400_000 ? 'warn' : 'neutral'
  return (
    <div className="countdown" title={`Deadline: ${deadline}`}>
      <span className="stat-label">Remaining time</span>
      <strong className={`countdown-value tone-${tone}`}>{left > 0 ? formatRemaining(left) : "Time's up"}</strong>
      <span className="meter-detail">ends {deadline}</span>
      <span className="deadline-actions">
        <button className="link" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button
          className="link danger-link"
          onClick={() => confirm('Remove the challenge deadline?') && onChange('')}
        >
          Remove
        </button>
      </span>
    </div>
  )
}

export function ChallengeCard({ rules, status: s, currency, onEdit, onDeadline }: Props) {
  const money = (n: number, signed = false) => formatMoney(n, currency, signed)

  const consistencyRatio = s.consistencyCap ? s.bestDay / s.consistencyCap : 0
  const todayLoss = Math.max(0, -s.todayPnl)
  const dailyRatio = rules.dailyLossLimit ? todayLoss / rules.dailyLossLimit : 0
  const roomToFloor = s.balance - s.floor
  const drawdownUsed = rules.maxDrawdown ? 1 - roomToFloor / rules.maxDrawdown : 0

  const badge = s.drawdownBreached
    ? { text: 'Max drawdown breached', tone: 'bad' }
    : s.passed
      ? { text: 'All objectives met', tone: 'good' }
      : { text: 'In progress', tone: 'neutral' }

  return (
    <section className="challenge" aria-label="Challenge objectives">
      <header className="challenge-head">
        <div>
          <h2>
            Challenge <span className="muted">· {money(rules.startBalance)}</span>
          </h2>
          <span className="challenge-balance">
            Balance <strong>{money(s.balance)}</strong>
          </span>
        </div>
        <Countdown endsAt={rules.endsAt} done={s.passed} onChange={onDeadline} />
        <div className="challenge-actions">
          <span className={`badge tone-bg-${badge.tone}`}>{badge.text}</span>
          <button className="ghost small" onClick={onEdit}>
            Edit rules
          </button>
        </div>
      </header>

      <div className="meters">
        <Meter
          label="Profit target"
          value={money(s.profit, true)}
          detail={`${money(Math.max(0, rules.profitTarget - s.profit))} to go of ${money(rules.profitTarget)}`}
          ratio={rules.profitTarget ? s.profit / rules.profitTarget : 0}
          tone={s.profit >= rules.profitTarget ? 'good' : s.profit < 0 ? 'bad' : 'good'}
        />
        <Meter
          label={`Consistency (${rules.consistencyPct}%)`}
          value={money(s.bestDay)}
          detail={
            consistencyRatio > 1
              ? `Best day is ${money(s.bestDay - s.consistencyCap)} over the ${money(s.consistencyCap)} cap`
              : `Best day · cap ${money(s.consistencyCap)}`
          }
          ratio={consistencyRatio}
          tone={consistencyRatio > 1 ? 'bad' : consistencyRatio >= NEAR_LIMIT ? 'warn' : 'good'}
        />
        <Meter
          label="Daily loss today"
          value={money(-todayLoss)}
          detail={
            dailyRatio >= 1
              ? 'Daily limit hit: stop for today'
              : `${money(rules.dailyLossLimit - todayLoss)} left of ${money(rules.dailyLossLimit)}`
          }
          ratio={dailyRatio}
          tone={dailyRatio >= 1 ? 'bad' : dailyRatio >= NEAR_LIMIT ? 'warn' : dailyRatio > 0 ? 'neutral' : 'good'}
        />
        <Meter
          label={`Max drawdown${rules.trailing ? ' (trailing)' : ''}`}
          value={money(Math.max(0, roomToFloor))}
          detail={`room left · floor ${money(s.floor)}`}
          ratio={drawdownUsed}
          tone={s.drawdownBreached || drawdownUsed >= 1 ? 'bad' : drawdownUsed >= NEAR_LIMIT ? 'warn' : 'neutral'}
        />
        <Meter
          label="Trading days"
          value={`${s.tradingDays} / ${rules.minTradingDays}`}
          detail={s.tradingDays >= rules.minTradingDays ? 'Minimum reached' : `${rules.minTradingDays - s.tradingDays} more needed`}
          ratio={rules.minTradingDays ? s.tradingDays / rules.minTradingDays : 1}
          tone="good"
        />
      </div>
    </section>
  )
}
