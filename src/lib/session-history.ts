import { format, subDays } from 'date-fns'
import { z } from 'zod'
import { getElapsedSeconds } from '@/lib/work-duration'
import type { WorkSession } from '@/db/types'
import { calendarDateSchema, localDateTimeToIso, parseCalendarDate, toCalendarDate } from '@/lib/dates'

const formFields = z.object({
  moduleId: z.string().trim(), title: z.string().trim(),
  date: calendarDateSchema, endDate: calendarDateSchema,
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, 'Choose a valid start time.'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, 'Choose a valid end time.'),
})
export type SessionFormValues = z.infer<typeof formFields>

function timestamp(date: string, time: string, original?: string) {
  if (original) {
    const previous = new Date(original)
    if (Number.isFinite(previous.getTime()) && toCalendarDate(previous) === date && format(previous, time.length === 8 ? 'HH:mm:ss' : 'HH:mm') === time) return original
  }
  return localDateTimeToIso(date, time)
}

/** Preserve fractional seconds and ambiguous-DST instants when their local fields are unchanged. */
export function completedSessionSchema(existing?: WorkSession) {
  return formFields.superRefine((value, ctx) => {
    for (const [dateKey, timeKey, original] of [
      ['date', 'startTime', existing?.startedAt], ['endDate', 'endTime', existing?.endedAt],
    ] as const) {
      if (!calendarDateSchema.safeParse(value[dateKey]).success) continue
      try { timestamp(value[dateKey], value[timeKey], original) }
      catch { ctx.addIssue({ code: 'custom', path: [timeKey], message: 'Choose a valid local date and time.' }) }
    }
  }).transform(value => ({
    moduleId: value.moduleId || undefined,
    title: value.title || undefined,
    startedAt: timestamp(value.date, value.startTime, existing?.startedAt),
    endedAt: timestamp(value.endDate, value.endTime, existing?.endedAt),
  })).superRefine((value, ctx) => {
    if (Date.parse(value.endedAt) <= Date.parse(value.startedAt)) ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'End must be after start. For overnight work, change the end date.' })
    if (Date.parse(value.endedAt) > Date.now()) ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'A completed session cannot end in the future.' })
  })
}

export function sessionFormValues(session: WorkSession): SessionFormValues {
  const start = new Date(session.startedAt)
  const end = new Date(session.endedAt ?? session.startedAt)
  return { moduleId: session.moduleId ?? '', title: session.title ?? '', date: toCalendarDate(start), endDate: toCalendarDate(end), startTime: format(start, 'HH:mm:ss'), endTime: format(end, 'HH:mm:ss') }
}

/** Group completed sessions by local start date, newest days and starts first; never mutate input. */
export function groupSessionHistory(sessions: WorkSession[]) {
  const groups = new Map<string, WorkSession[]>()
  const completed = sessions.filter(session => session.endedAt !== undefined)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt) || a.id.localeCompare(b.id))
  for (const session of completed) {
    const date = toCalendarDate(new Date(session.startedAt))
    const rows = groups.get(date) ?? []
    rows.push(session); groups.set(date, rows)
  }
  return [...groups].map(([date, sessions]) => ({ date, sessions }))
}

export function historyDateLabel(date: string, today: string) {
  if (date === today) return 'Today'
  if (date === toCalendarDate(subDays(parseCalendarDate(today), 1))) return 'Yesterday'
  return format(parseCalendarDate(date), date.slice(0, 4) === today.slice(0, 4) ? 'd MMMM' : 'd MMMM yyyy')
}

export function sessionDurationLabel(session: WorkSession) {
  const seconds = getElapsedSeconds(session.startedAt, Date.parse(session.endedAt ?? session.startedAt))
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  if (hours) return `${hours}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`
  return minutes ? `${minutes}m` : `${seconds}s`
}
