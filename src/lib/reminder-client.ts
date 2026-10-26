import { db } from '@/db/db'
import { reminderDeviceSchema } from '@/lib/reminders'

const storageKey = 'uni-buddy-reminder-device-v1'
export type ReminderState = { token: string; enabled: boolean; timeZone: string; pendingRemoval?: boolean; syncedAt?: string; signature?: string; error?: string }
export function readReminderState(): ReminderState | null {
  try { const value = JSON.parse(localStorage.getItem(storageKey) ?? 'null'); return value && typeof value.token === 'string' && /^[\w-]{43}$/.test(value.token) && typeof value.timeZone === 'string' && typeof value.enabled === 'boolean' ? value : null } catch { return null }
}
export function writeReminderState(state: ReminderState) { localStorage.setItem(storageKey, JSON.stringify(state)); window.dispatchEvent(new Event('reminder-settings-change')) }
export function clearReminderState() { localStorage.removeItem(storageKey); window.dispatchEvent(new Event('reminder-settings-change')) }
export async function reminderRules() {
  const semester = await db.semesters.toCollection().first()
  const modules = semester ? await db.modules.where('semesterId').equals(semester.id).toArray() : []
  const rules = modules.length ? await db.scheduleRules.where('moduleId').anyOf(modules.map(module => module.id)).toArray() : []
  return rules.filter(rule => rule.type === 'lecture' || rule.type === 'lab').sort((a, b) => a.id.localeCompare(b.id)).map(rule => ({
    id: rule.id, label: (modules.find(module => module.id === rule.moduleId)?.name ?? 'Class').slice(0, 160), type: rule.type,
    dayOfWeek: rule.dayOfWeek, endTime: rule.endTime, repeatEveryWeeks: rule.repeatEveryWeeks,
    anchorDate: rule.anchorDate, startDate: rule.startDate, endDate: rule.endDate,
  }))
}
export async function reminderRequest(path: string, token: string, method: string, data?: unknown) {
  const response = await fetch(`/api/reminders/${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(15000) })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Reminder service unavailable. Try again online.')
  return result as { syncedAt?: string }
}
let queue = Promise.resolve()
export function syncReminders(setupKey?: string, enabling = false): Promise<void> {
  const task = queue.catch(() => {}).then(async () => {
    const state = readReminderState()
    if (!state) return
    try {
      if (state.pendingRemoval) {
        await reminderRequest('device', state.token, 'DELETE')
        const registration = await navigator.serviceWorker.getRegistration()
        await (await registration?.pushManager.getSubscription())?.unsubscribe()
        clearReminderState(); return
      }
      if (!state.enabled && !enabling) return
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (!subscription || Notification.permission !== 'granted') throw new Error('Notification permission or subscription is missing. Disable and reconnect reminders.')
      const parsed = reminderDeviceSchema.safeParse({ subscription: subscription.toJSON(), timeZone: state.timeZone, rules: await reminderRules() })
      if (!parsed.success) throw new Error('Could not sync this timetable. Check its dates, times, timezone, and the limit of 100 lecture/lab rules.')
      const device = parsed.data
      const signature = JSON.stringify(device)
      // Foreground sync also renews remote storage at least once a day.
      if (!enabling && signature === state.signature && Date.now() - Date.parse(state.syncedAt ?? '') < 86400000) return
      const result = await reminderRequest('device', state.token, 'POST', { device, setupKey })
      const current = readReminderState()
      if (current?.token === state.token && !current.pendingRemoval) writeReminderState({ ...current, enabled: true, signature, syncedAt: result.syncedAt, error: undefined })
    } catch (error) {
      const current = readReminderState()
      if (current?.token === state.token) writeReminderState({ ...current, error: error instanceof Error ? error.message : 'Could not sync reminders.' })
      throw error
    }
  })
  queue = task
  return task
}
