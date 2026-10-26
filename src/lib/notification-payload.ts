import { z } from 'zod'

export const notificationPayloadSchema = z.object({
  title: z.string().min(1).max(160), body: z.string().min(1).max(240),
  ruleId: z.string().min(1).max(100).optional(), date: z.iso.date().optional(),
  tag: z.string().min(1).max(200),
}).strict()

export function attendanceReminderUrl(ruleId?: string, date?: string) {
  return ruleId && date && z.iso.date().safeParse(date).success
    ? `/attendance?${new URLSearchParams({ rule: ruleId, date })}` : '/'
}
