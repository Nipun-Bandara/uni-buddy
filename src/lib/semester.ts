import { z } from 'zod'
import { calendarDateSchema } from '@/lib/dates'

export const semesterSchema = z.object({
  name: z.string().trim().min(1, 'Enter a semester name.'),
  startDate: calendarDateSchema,
  endDate: calendarDateSchema,
}).refine(({ startDate, endDate }) => endDate >= startDate, {
  path: ['endDate'], message: 'End date cannot be before start date.',
})
