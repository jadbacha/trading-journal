import { useState } from 'react'
import type { JournalData, Settings } from '../types'
import { exportBackup } from '../backup'
import { clearImages, dataUrlToBlob, putImage } from '../images'
import { DEFAULT_MISTAKES } from '../mistakes'
import { normalize } from '../storage'
import { BreakevenFields } from './BreakevenFields'

interface Props {
  data: JournalData
  onSettings: (s: Settings) => void
  onReplace: (data: JournalData) => void
  onClose: () => void
}

export function SettingsDialog({ data, onSettings, onReplace, onClose }: Props) {
  const [message, setMessage] = useState('')
  const [tagsText, setTagsText] = useState(() => data.settings.mistakeTags.join(', '))
  const [busy, setBusy] = useState(false)
  const { settings } = data

  const saveTags = () => {
    const tags = [...new Set(tagsText.split(',').map((t) => t.trim()).filter(Boolean))]
    onSettings({ ...settings, mistakeTags: tags.length ? tags : DEFAULT_MISTAKES })
    setTagsText((tags.length ? tags : DEFAULT_MISTAKES).join(', '))
  }

  const backUp = async () => {
    setBusy(true)
    await exportBackup(data)
    setBusy(false)
    onSettings({ ...settings, lastBackupAt: new Date().toISOString(), backupSnoozeUntil: undefined })
    setMessage('Backup downloaded.')
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

        <h3>Breakeven range</h3>
        <BreakevenFields range={settings.breakeven} currency={settings.currency} onChange={(breakeven) => onSettings({ ...settings, breakeven })} />

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
          {settings.lastBackupAt ? ` Last backup: ${new Date(settings.lastBackupAt).toLocaleDateString()}.` : ' No backup yet.'}
        </p>
        <div className="row-buttons">
          <button onClick={backUp} disabled={busy}>
            {busy ? 'Working…' : 'Export backup'}
          </button>
          <label className="button ghost">
            Restore backup
            <input type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
          </label>
          <button
            className="danger"
            onClick={() => {
              if (confirm('Delete all trades, journal entries and screenshots? Your accounts and payouts are kept. This cannot be undone.')) {
                onReplace({ ...data, trades: [], notes: {} })
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
