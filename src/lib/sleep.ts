import { format } from 'date-fns'
import { z } from 'zod'
import type { SleepSession } from '@/db/types'
import { calendarDateSchema, localDateTimeToIso, toCalendarDate } from '@/lib/dates'

const time = (label: string) => z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, `Choose a valid ${label} time.`)
const formFields = z.object({
  bedDate: calendarDateSchema, bedTime: time('bed'),
  wakeDate: calendarDateSchema, wakeTime: time('wake-up'),
})
export type SleepFormValues = z.infer<typeof formFields>

/** Keep the original instant (seconds, DST ambiguity) when its local fields are unchanged. */
function timestamp(date: string, value: string, original?: string) {
  if (original) {
    const previous = new Date(original)
    if (Number.isFinite(previous.getTime()) && toCalendarDate(previous) === date && format(previous, value.length === 8 ? 'HH:mm:ss' : 'HH:mm') === value) return original
  }
  return localDateTimeToIso(date, value)
}

export function completedSleepSchema(existing?: SleepSession) {
  return formFields.superRefine((value, ctx) => {
    for (const [dateKey, timeKey, original] of [
      ['bedDate', 'bedTime', existing?.startedAt], ['wakeDate', 'wakeTime', existing?.endedAt],
    ] as const) {
      try { timestamp(value[dateKey], value[timeKey], original) }
      catch { ctx.addIssue({ code: 'custom', path: [timeKey], message: 'Choose a valid local date and time.' }) }
    }
  }).transform(value => ({
    startedAt: timestamp(value.bedDate, value.bedTime, existing?.startedAt),
    endedAt: timestamp(value.wakeDate, value.wakeTime, existing?.endedAt),
  })).superRefine((value, ctx) => {
    if (Date.parse(value.endedAt) <= Date.parse(value.startedAt)) ctx.addIssue({ code: 'custom', path: ['wakeTime'], message: 'Wake-up must be after bedtime. For overnight sleep, change the wake-up date.' })
    if (Date.parse(value.endedAt) > Date.now()) ctx.addIssue({ code: 'custom', path: ['wakeTime'], message: 'A completed sleep cannot end in the future.' })
  })
}

export function sleepFormValues(session: SleepSession): SleepFormValues {
  const start = new Date(session.startedAt)
  const end = new Date(session.endedAt ?? session.startedAt)
  return { bedDate: toCalendarDate(start), bedTime: format(start, 'HH:mm'), wakeDate: toCalendarDate(end), wakeTime: format(end, 'HH:mm') }
}

/** The local calendar date a completed sleep counts toward (the wake-up day). */
export function sleepWakeDate(session: SleepSession) {
  return session.endedAt === undefined ? undefined : toCalendarDate(new Date(session.endedAt))
}

export function sleepDurationMs(session: SleepSession) {
  if (session.endedAt === undefined) return 0
  const duration = Date.parse(session.endedAt) - Date.parse(session.startedAt)
  return Number.isFinite(duration) ? Math.max(0, duration) : 0
}

/** True when two sleeps share any time; touching end/start instants do not overlap. */
export function sleepsOverlap(a: Pick<SleepSession, 'startedAt' | 'endedAt'>, b: Pick<SleepSession, 'startedAt' | 'endedAt'>, now = Date.now()) {
  const aEnd = a.endedAt === undefined ? now : Date.parse(a.endedAt)
  const bEnd = b.endedAt === undefined ? now : Date.parse(b.endedAt)
  return Date.parse(a.startedAt) < bEnd && Date.parse(b.startedAt) < aEnd
}

/** Completed sleeps whose wake-up date is in [firstDate, endDate), each counted in full. */
export function sleepInDateRange(sessions: SleepSession[], firstDate: string, endDate: string) {
  const included = sessions.filter(session => {
    const date = sleepWakeDate(session)
    return date !== undefined && date >= firstDate && date < endDate
  })
  return { sessions: included, totalMs: included.reduce((sum, session) => sum + sleepDurationMs(session), 0), nights: new Set(included.map(sleepWakeDate)).size }
}
