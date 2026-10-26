import { z } from 'zod'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { occursOnDate } from './recurrence.js'
import type { ScheduleRule } from '../db/types.js'

export const timeZoneSchema = z.string().max(80).refine(value => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true } catch { return false }
}, 'Enter an IANA timezone, such as Asia/Colombo.')
export const reminderRuleSchema = z.object({
  id: z.string().min(1).max(100), label: z.string().min(1).max(160),
  type: z.enum(['lecture', 'lab']), dayOfWeek: z.number().int().min(0).max(6),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  repeatEveryWeeks: z.union([z.literal(1), z.literal(2)]),
  anchorDate: z.iso.date(), startDate: z.iso.date(), endDate: z.iso.date(),
}).strict().refine(rule => rule.startDate <= rule.anchorDate && rule.anchorDate <= rule.endDate, 'Invalid reminder dates.').refine(rule => occursOnDate({ ...rule, moduleId: '', startTime: '00:00' } as ScheduleRule, rule.anchorDate), 'First occurrence must match the weekday.')
export type ReminderRule = z.infer<typeof reminderRuleSchema>
export const subscriptionSchema = z.object({
  endpoint: z.url().max(2048).refine(value => {
    try {
      const url = new URL(value)
      return url.protocol === 'https:' && !url.username && !url.password && !url.port && (
        url.hostname.endsWith('.push.apple.com') || url.hostname === 'web.push.apple.com' ||
        url.hostname === 'fcm.googleapis.com' || url.hostname === 'updates.push.services.mozilla.com' || url.hostname.endsWith('.notify.windows.com'))
    } catch { return false }
  }, 'Unsupported push service.'),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().regex(/^[\w-]{87}=?$/), auth: z.string().regex(/^[\w-]{22}={0,2}$/) }).strict(),
}).strict()
export const reminderDeviceSchema = z.object({
  subscription: subscriptionSchema, timeZone: timeZoneSchema,
  rules: z.array(reminderRuleSchema).max(100).refine(rules => new Set(rules.map(rule => rule.id)).size === rules.length, 'Duplicate rules.'),
}).strict()
export type ReminderDevice = z.infer<typeof reminderDeviceSchema>

/** Timetable timezone is explicit, independent of the server and travelling phone. */
export function reminderInstant(rule: ReminderRule, date: string, timeZone: string): number | null {
  if (!occursOnDate({ ...rule, moduleId: '', startTime: '00:00' } as ScheduleRule, date)) return null
  const wallTime = `${date}T${rule.endTime}:00`
  const instant = fromZonedTime(wallTime, timeZone)
  // Reject a nonexistent DST wall time rather than silently moving it.
  if (!Number.isFinite(instant.getTime()) || formatInTimeZone(instant, timeZone, "yyyy-MM-dd'T'HH:mm:ss") !== wallTime) return null
  return instant.getTime()
}

/** A bounded catch-up window avoids delivering days of obsolete reminders after an outage. */
export function dueReminders(device: ReminderDevice, now: number) {
  const dates = new Set([now, now - 30 * 60_000].map(time => formatInTimeZone(time, device.timeZone, 'yyyy-MM-dd')))
  return device.rules.flatMap(rule => [...dates].flatMap(date => {
    const dueAt = reminderInstant(rule, date, device.timeZone)
    return dueAt !== null && dueAt <= now && dueAt > now - 30 * 60_000 ? [{ rule, date, dueAt }] : []
  }))
}
