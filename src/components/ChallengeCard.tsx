import type { ChallengeRules, ChallengeStatus } from '../challenge'
import { NEAR_LIMIT } from '../challenge'
import { formatMoney } from '../stats'

interface Props {
  rules: ChallengeRules
  status: ChallengeStatus
  currency: string
  onEdit: () => void
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

export function ChallengeCard({ rules, status: s, currency, onEdit }: Props) {
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
