import { useState } from 'react'
import type { ChallengeRules } from '../challenge'
import { formatRemaining, parseDuration } from '../challenge'
import type { JournalData, Settings } from '../types'
import { blobToDataUrl, clearImages, dataUrlToBlob, getImage, putImage } from '../images'
import { DEFAULT_MISTAKES } from '../mistakes'
import { normalize } from '../storage'

interface Props {
  data: JournalData
  onSettings: (s: Settings) => void
  onReplace: (data: JournalData) => void
  onClose: () => void
}

/** ISO timestamp → value for a datetime-local input, in the viewer's timezone. */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  if (!iso || Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function SettingsDialog({ data, onSettings, onReplace, onClose }: Props) {
  const [message, setMessage] = useState('')
  const [remaining, setRemaining] = useState('')
  const [tagsText, setTagsText] = useState(() => data.settings.mistakeTags.join(', '))
  const [busy, setBusy] = useState(false)
  const { settings } = data
  const rules = settings.challenge
  const setRules = (patch: Partial<ChallengeRules>) => onSettings({ ...settings, challenge: { ...rules, ...patch } })
  const amount = (key: 'startBalance' | 'profitTarget' | 'dailyLossLimit' | 'maxDrawdown' | 'consistencyPct' | 'minTradingDays', label: string) => (
    <label>
      <span>{label}</span>
      <input
        type="number"
        min={0}
        value={rules[key]}
        onChange={(e) => setRules({ [key]: Math.max(0, Number(e.target.value) || 0) })}
      />
    </label>
  )

  const saveTags = () => {
    const tags = [...new Set(tagsText.split(',').map((t) => t.trim()).filter(Boolean))]
    onSettings({ ...settings, mistakeTags: tags.length ? tags : DEFAULT_MISTAKES })
    setTagsText((tags.length ? tags : DEFAULT_MISTAKES).join(', '))
  }

  const exportBackup = async () => {
    setBusy(true)
    // Screenshots live outside the journal data, so embed them to make the backup complete.
    const images: Record<string, string> = {}
    for (const id of Object.values(data.notes).flatMap((n) => [...(n.planImages ?? []), ...(n.images ?? [])])) {
      const img = await getImage(id).catch(() => undefined)
      if (img) images[id] = await blobToDataUrl(img)
    }
    setBusy(false)
    const blob = new Blob([JSON.stringify({ ...data, images })], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trading-journal-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const restore = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text())
      const restored = normalize(raw)
      if (!confirm(`Replace your current journal with this backup (${restored.trades.length} trades)?`)) return
      const images: Record<string, string> = raw.images && typeof raw.images === 'object' ? raw.images : {}
      setBusy(true)
      await clearImages()
      for (const [id, url] of Object.entries(images)) await putImage(id, await dataUrlToBlob(url))
      setBusy(false)
      onReplace(restored)
      setMessage('Backup restored.')
    } catch (e) {
      setMessage(`Couldn't read that backup: ${(e as Error).message}`)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <header className="panel-head">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="mapping">
          <label>
            <span>Breakeven range (±)</span>
            <input
              type="number"
              min={0}
              step={1}
              value={settings.breakevenThreshold}
              onChange={(e) => onSettings({ ...settings, breakevenThreshold: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
          <label>
            <span>Currency</span>
            <select value={settings.currency} onChange={(e) => onSettings({ ...settings, currency: e.target.value })}>
              {['USD', 'EUR', 'GBP', 'CHF', 'AUD', 'CAD'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Commission per contract (round trip)</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={settings.commissionPerContract}
              onChange={(e) =>
                onSettings({ ...settings, commissionPerContract: Math.max(0, Number(e.target.value) || 0) })
              }
            />
          </label>
        </div>
        <p className="muted">
          The commission is subtracted from trades whose P&L came in before fees (like Tradovate's Performance
          export), on every day, including ones already imported.
        </p>
        <p className="muted">
          Days with a net P&L within ±{settings.breakevenThreshold} show gray. Set it to e.g. 10 if you want tiny
          scratch days counted as breakeven.
        </p>

        <h3>Challenge</h3>
        <label className="check">
          <input type="checkbox" checked={rules.enabled} onChange={(e) => setRules({ enabled: e.target.checked })} />
          Track a prop-firm challenge
        </label>
        {rules.enabled && (
          <>
            <div className="mapping">
              {amount('startBalance', 'Starting balance')}
              {amount('profitTarget', 'Profit target')}
              {amount('dailyLossLimit', 'Daily loss limit')}
              {amount('maxDrawdown', 'Max drawdown')}
              {amount('consistencyPct', 'Consistency (% of target)')}
              {amount('minTradingDays', 'Min trading days')}
              <label>
                <span>Challenge start date</span>
                <input type="date" value={rules.startDate} onChange={(e) => setRules({ startDate: e.target.value })} />
              </label>
            </div>
            <div className="mapping deadline">
              <label>
                <span>Challenge ends (your local time)</span>
                <input
                  type="datetime-local"
                  value={toLocalInput(rules.endsAt)}
                  onChange={(e) => setRules({ endsAt: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                />
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
            <label className="check">
              <input type="checkbox" checked={rules.trailing} onChange={(e) => setRules({ trailing: e.target.checked })} />
              Drawdown trails the highest end-of-day balance
            </label>
            <p className="muted">
              Only trades on or after the start date count. Leave it empty to count everything. Breaches are
              checked on end-of-day balances, so an intraday dip won't show here.
            </p>
          </>
        )}

        <h3>Mistake tags</h3>
        <label className="stack">
          <span className="muted">Comma-separated. These are the options when you tag a trade.</span>
          <input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            onBlur={saveTags}
            onKeyDown={(e) => e.key === 'Enter' && saveTags()}
          />
        </label>

        <h3>Your data</h3>
        <p className="muted">
          Everything is stored in this browser only. Export a backup now and then, or to move to another device.
        </p>
        <div className="row-buttons">
          <button onClick={exportBackup} disabled={busy}>
            {busy ? 'Working…' : 'Export backup'}
          </button>
          <label className="button ghost">
            Restore backup
            <input type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
          </label>
          <button
            className="danger"
            onClick={() => {
              if (confirm('Delete all trades and journal entries? This cannot be undone.')) {
                onReplace({ trades: [], notes: {}, settings })
                clearImages().catch(() => {})
                setMessage('All data cleared.')
              }
            }}
          >
            Clear all data
          </button>
        </div>
        {message && <p className="muted">{message}</p>}
      </div>
    </div>
  )
}
