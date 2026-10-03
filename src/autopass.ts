import { withStatus } from './accounts'
import { challengeStatus } from './challenge'
import { summarizeDays } from './stats'
import type { JournalData } from './types'

/**
 * Switches accounts still in evaluation to passed once every objective is met, dated the day it
 * happened, and flags them so the app can announce it. Applied to every change of the journal,
 * so imports, manual entries and rule edits all count.
 */
export function applyAutoPass(data: JournalData, today: string): JournalData {
  let changed = false
  const accounts = data.accounts.map((a) => {
    if (a.status !== 'evaluation' || !a.autoPass || !a.rules.enabled) return a
    const days = summarizeDays(
      data.trades.filter((t) => t.accountId === a.id),
      data.settings,
    )
    const { passedOn } = challengeStatus(days.values(), a.rules, today)
    if (!passedOn) return a
    changed = true
    return { ...withStatus(a, 'passed', passedOn), passNotice: true }
  })
  return changed ? { ...data, accounts } : data
}
