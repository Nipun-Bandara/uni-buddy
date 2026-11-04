import { z } from 'zod'
import { calendarDateSchema, isoTimestampSchema, localTimeSchema } from '@/lib/dates'

export const rescheduledClassFieldsSchema = z.object({
  moduleId: z.string().min(1, 'Choose a module.'),
  type: z.enum(['lecture', 'tutorial', 'lab', 'other']),
  date: calendarDateSchema,
  startTime: localTimeSchema, endTime: localTimeSchema,
  location: z.string().trim().transform(value => value || undefined),
}).refine(value => value.endTime > value.startTime, { path: ['endTime'], message: 'End time must be later than start time.' })

export const rescheduledClassSchema = z.strictObject({
  id: z.string().min(1), moduleId: z.string().min(1),
  type: z.enum(['lecture', 'tutorial', 'lab', 'other']),
  date: calendarDateSchema, startTime: localTimeSchema, endTime: localTimeSchema,
  location: z.string().optional(), startAt: isoTimestampSchema, endAt: isoTimestampSchema,
  status: z.enum(['pending', 'attended', 'missed', 'cancelled']),
}).refine(value => value.endTime > value.startTime && Date.parse(value.endAt) > Date.parse(value.startAt), 'Class end must be after start.')
export type RescheduledClassFields = z.input<typeof rescheduledClassFieldsSchema>
