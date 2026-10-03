import { useEffect, useRef, useState } from 'react'
import { formatDay } from '../accounts'
import { formatMoney } from '../stats'

interface Props {
  series: { date: string; balance: number; floor: number }[]
  startBalance: number
  /** Balance that hits the profit target, or null to leave the line out. */
  target: number | null
  currency: string
}

const HEIGHT = 190
const PAD = { top: 12, right: 118, bottom: 22, left: 8 }

/**
 * End-of-day balance against the drawdown floor (and the profit target while it applies).
 * One series, so no legend: the reference lines are labelled at their right end.
 */
export function EquityChart({ series, startBalance, target, currency }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (series.length < 2) {
    return (
      <div ref={ref} className="equity empty-chart">
        The equity curve appears after two trading days.
      </div>
    )
  }

  // Start the curve from the starting balance the day before the first trade.
  const points = [{ date: '', balance: startBalance, floor: series[0].floor }, ...series]
  const values = points.flatMap((p) => [p.balance, p.floor]).concat(target ? [target] : [])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const lo = min - span * 0.08
  const hi = max + span * 0.08

  const plotW = width - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * plotW
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH

  const balancePath = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.balance).toFixed(1)}`).join('')
  // The floor changes after each close, so draw it as steps.
  const floorPath = points
    .map((p, i) => (i ? `H${x(i).toFixed(1)}V${y(p.floor).toFixed(1)}` : `M${x(0).toFixed(1)},${y(p.floor).toFixed(1)}`))
    .join('')
  const last = points[points.length - 1]
  const money = (n: number) => formatMoney(n, currency)

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - box.left - PAD.left) / plotW) * (points.length - 1))
    setHover(i >= 1 && i < points.length ? i : null)
  }
  const h = hover !== null ? points[hover] : null

  return (
    <div ref={ref} className="equity">
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        style={{ width: '100%', height: HEIGHT }}
        role="img"
        aria-label={`Equity curve: balance ${money(last.balance)}, drawdown floor ${money(last.floor)}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <line className="eq-start" x1={PAD.left} x2={PAD.left + plotW} y1={y(startBalance)} y2={y(startBalance)} />
        {target !== null && (
          <>
            <line className="eq-target" x1={PAD.left} x2={PAD.left + plotW} y1={y(target)} y2={y(target)} />
            <text className="eq-label" x={PAD.left + plotW + 6} y={y(target) + 4}>
              Target {money(target)}
            </text>
          </>
        )}
        <path className="eq-floor" d={floorPath} />
        <text className="eq-label" x={PAD.left + plotW + 6} y={y(last.floor) + 4}>
          Floor {money(last.floor)}
        </text>
        <path className="eq-balance" d={balancePath} />
        <circle className="eq-dot" cx={x(points.length - 1)} cy={y(last.balance)} r={4} />
        <text className="eq-label strong" x={PAD.left + plotW + 6} y={y(last.balance) + 4}>
          {money(last.balance)}
        </text>
        {h && hover !== null && (
          <>
            <line className="eq-cross" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} />
            <circle className="eq-dot" cx={x(hover)} cy={y(h.balance)} r={4} />
          </>
        )}
      </svg>
      {h && hover !== null && (
        <div className="eq-tip" style={{ left: Math.min(x(hover) + 10, width - 170) }}>
          <strong>{formatDay(h.date)}</strong>
          <span>Balance {money(h.balance)}</span>
          <span>Floor {money(h.floor)}</span>
          <span className="muted">Room {money(h.balance - h.floor)}</span>
        </div>
      )}
    </div>
  )
}
