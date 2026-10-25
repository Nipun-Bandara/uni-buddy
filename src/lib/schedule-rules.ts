import { z } from 'zod'
import { calendarDateSchema, localTimeSchema, parseCalendarDate } from '@/lib/dates'

/** Stored convention: Monday = 0, Tuesday = 1, … Sunday = 6. */
export const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
export const classTypes = { lecture: 'Lecture', tutorial: 'Tutorial', lab: 'Lab', other: 'Other' } as const

export const scheduleRuleSchema = z.object({
  moduleId: z.string().min(1, 'Choose a module.'),
  type: z.enum(['lecture', 'tutorial', 'lab', 'other'], { error: 'Choose a class type.' }),
  dayOfWeek: z.number({ error: 'Choose a weekday.' }).int().min(0).max(6),
  startTime: localTimeSchema,
  endTime: localTimeSchema,
  repeatEveryWeeks: z.union([z.literal(1), z.literal(2)], { error: 'Choose every week or every 2 weeks.' }),
  anchorDate: calendarDateSchema,
  startDate: calendarDateSchema,
  endDate: calendarDateSchema,
  location: z.string().trim().transform(value => value || undefined),
}).superRefine((value, ctx) => {
  if (localTimeSchema.safeParse(value.startTime).success && localTimeSchema.safeParse(value.endTime).success && value.endTime <= value.startTime) {
    ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'End time must be later than start time.' })
  }
  if (calendarDateSchema.safeParse(value.startDate).success && calendarDateSchema.safeParse(value.endDate).success) {
    if (value.endDate < value.startDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date cannot be before start date.' })
    if (calendarDateSchema.safeParse(value.anchorDate).success && (value.anchorDate < value.startDate || value.anchorDate > value.endDate)) {
      ctx.addIssue({ code: 'custom', path: ['anchorDate'], message: 'First occurrence must be within the start and end dates.' })
    }
  }
  if (calendarDateSchema.safeParse(value.anchorDate).success && (parseCalendarDate(value.anchorDate).getDay() + 6) % 7 !== value.dayOfWeek) {
    ctx.addIssue({ code: 'custom', path: ['anchorDate'], message: 'First occurrence must match the selected weekday.' })
  }
})
