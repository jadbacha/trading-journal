import { blobToDataUrl, getImage } from './images'
import type { JournalData } from './types'

/** Days after which the app reminds you to export a backup. */
export const BACKUP_EVERY_DAYS = 7

/**
 * Downloads the whole journal as JSON. Screenshots live outside the journal data, so they are
 * embedded to make the backup complete.
 */
export async function exportBackup(data: JournalData): Promise<void> {
  const images: Record<string, string> = {}
  for (const id of Object.values(data.notes).flatMap((n) => [...(n.planImages ?? []), ...(n.images ?? [])])) {
    const img = await getImage(id).catch(() => undefined)
    if (img) images[id] = await blobToDataUrl(img)
  }
  const blob = new Blob([JSON.stringify({ ...data, images })], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `trading-journal-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Whether to show the backup reminder: there is something to lose and no recent backup or snooze. */
export function backupDue(data: JournalData, now: number): { due: boolean; daysSince: number | null } {
  const last = data.settings.lastBackupAt ? Date.parse(data.settings.lastBackupAt) : NaN
  const daysSince = Number.isNaN(last) ? null : Math.floor((now - last) / 86_400_000)
  const snoozed = data.settings.backupSnoozeUntil ? Date.parse(data.settings.backupSnoozeUntil) > now : false
  const hasData = data.trades.length > 0 || Object.keys(data.notes).length > 0
  return { due: hasData && !snoozed && (daysSince === null || daysSince >= BACKUP_EVERY_DAYS), daysSince }
}
