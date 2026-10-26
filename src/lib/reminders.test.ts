import { describe, expect, it } from 'vitest'
import { dueReminders, reminderDeviceSchema, reminderInstant, reminderRuleSchema, subscriptionSchema, timeZoneSchema, type ReminderDevice, type ReminderRule } from './reminders'
import { attendanceReminderUrl, notificationPayloadSchema } from './notification-payload'
import { localDateTimeToIso } from './dates'
const rule: ReminderRule = { id: 'r', label: 'Data Mining', type: 'lecture', dayOfWeek: 3, endTime: '12:00', repeatEveryWeeks: 2, anchorDate: '2026-10-29', startDate: '2026-10-01', endDate: '2027-02-28' }
const subscription = { endpoint: 'https://web.push.apple.com/test', keys: { p256dh: 'A'.repeat(87), auth: 'B'.repeat(22) } }
const device: ReminderDevice = { subscription, rules: [rule], timeZone: 'Asia/Colombo' }

describe('reminder timing and privacy validation', () => {
  it('resolves timetable end time independently of the machine timezone', () => {
    expect(reminderInstant(rule, '2026-10-29', 'Asia/Colombo')).toBe(Date.parse('2026-10-29T06:30:00Z'))
    expect(localDateTimeToIso('2026-10-29', '10:00', 'Asia/Colombo')).toBe('2026-10-29T04:30:00.000Z')
  })
  it('uses weekly/alternating recurrence and inclusive bounds', () => {
    expect(reminderInstant(rule, '2026-11-05', 'Asia/Colombo')).toBeNull()
    expect(reminderInstant(rule, '2026-11-12', 'Asia/Colombo')).not.toBeNull()
    expect(reminderInstant(rule, '2027-03-04', 'Asia/Colombo')).toBeNull()
    expect(reminderInstant({ ...rule, repeatEveryWeeks: 1 }, '2026-11-05', 'Asia/Colombo')).not.toBeNull()
  })
  it('only sends once a class ends and within the thirty-minute catch-up window', () => {
    expect(dueReminders(device, Date.parse('2026-10-29T06:29:59Z'))).toEqual([])
    expect(dueReminders(device, Date.parse('2026-10-29T06:30:00Z'))).toHaveLength(1)
    expect(dueReminders(device, Date.parse('2026-10-29T06:59:59Z'))[0].date).toBe('2026-10-29')
    expect(dueReminders(device, Date.parse('2026-10-29T07:00:00Z'))).toEqual([])
  })
  it('finds a class from yesterday when a scheduler call crosses midnight', () => {
    const late = { ...device, rules: [{ ...rule, endTime: '23:55' }] }
    expect(dueReminders(late, Date.parse('2026-10-29T18:35:00Z'))[0].date).toBe('2026-10-29')
  })
  it('resolves DST offsets, rejects gaps, and gives one deterministic instant for repeated wall time', () => {
    const sunday = { ...rule, dayOfWeek: 6, repeatEveryWeeks: 1 as const, anchorDate: '2026-03-01', startDate: '2026-03-01', endDate: '2026-11-30', endTime: '02:30' }
    expect(reminderInstant(sunday, '2026-03-08', 'America/New_York')).toBeNull()
    expect(reminderInstant({ ...sunday, endTime: '12:00' }, '2026-03-01', 'America/New_York')).toBe(Date.parse('2026-03-01T17:00:00Z'))
    expect(reminderInstant({ ...sunday, endTime: '12:00' }, '2026-03-15', 'America/New_York')).toBe(Date.parse('2026-03-15T16:00:00Z'))
    const repeated = reminderInstant({ ...sunday, endTime: '01:30' }, '2026-11-01', 'America/New_York')
    expect([Date.parse('2026-11-01T05:30:00Z'), Date.parse('2026-11-01T06:30:00Z')]).toContain(repeated)
  })
  it('rejects unknown zones, malformed times, duplicated rules, and attendance/work payloads', () => {
    expect(timeZoneSchema.safeParse('Asia/Colombo').success).toBe(true)
    expect(timeZoneSchema.safeParse('Mars/Olympus').success).toBe(false)
    expect(reminderRuleSchema.safeParse({ ...rule, endTime: '24:00' }).success).toBe(false)
    expect(reminderDeviceSchema.safeParse({ ...device, rules: [rule, rule] }).success).toBe(false)
    expect(reminderDeviceSchema.safeParse({ ...device, classOccurrences: [] }).success).toBe(false)
    expect(reminderDeviceSchema.safeParse({ ...device, workSessions: [] }).success).toBe(false)
  })
  it.each(['not-a-url', 'http://web.push.apple.com/push', 'https://localhost/push', 'https://127.0.0.1/push', 'https://web.push.apple.com.evil.com/push', 'https://secret@web.push.apple.com/push'])('rejects an unsafe push destination: %s', endpoint => {
    expect(subscriptionSchema.safeParse({ ...subscription, endpoint }).success).toBe(false)
  })
  it('keeps deep links on a fixed local route and safely encodes IDs', () => {
    expect(attendanceReminderUrl('r&rule=bad', '2026-10-29')).toBe('/attendance?rule=r%26rule%3Dbad&date=2026-10-29')
    expect(attendanceReminderUrl('r', 'invalid')).toBe('/')
    expect(notificationPayloadSchema.safeParse({ title: 'A', body: 'B', tag: 't', url: 'https://evil.com' }).success).toBe(false)
  })
})
