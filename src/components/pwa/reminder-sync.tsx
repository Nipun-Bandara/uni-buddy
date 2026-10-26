import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useReminderState } from '@/hooks/use-reminder-state'
import { reminderRules, syncReminders } from '@/lib/reminder-client'

/** Only sync reminder configuration; never read/upload attendance or work sessions. */
export function ReminderSync() {
  const state = useReminderState()
  const rules = useLiveQuery(async () => JSON.stringify(await reminderRules()))
  const enabled = state?.enabled, removing = state?.pendingRemoval, zone = state?.timeZone
  useEffect(() => {
    if ((!enabled && !removing) || rules === undefined) return
    const sync = () => { if (!document.hidden && navigator.onLine) void syncReminders().catch(() => {}) }
    const timer = window.setTimeout(sync, 1000)
    window.addEventListener('online', sync); window.addEventListener('focus', sync); document.addEventListener('visibilitychange', sync)
    return () => { clearTimeout(timer); window.removeEventListener('online', sync); window.removeEventListener('focus', sync); document.removeEventListener('visibilitychange', sync) }
  }, [enabled, removing, zone, rules])
  return null
}
