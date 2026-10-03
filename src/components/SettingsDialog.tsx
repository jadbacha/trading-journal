import { useState } from 'react'
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
