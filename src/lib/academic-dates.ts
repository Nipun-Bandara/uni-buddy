import { addDays, format } from 'date-fns'
import { z } from 'zod'
import { calendarDateSchema, parseCalendarDate, toCalendarDate } from '@/lib/dates'
import type { AcademicDateType } from '@/db/types'

export const academicDateLabels: Record<AcademicDateType, string> = {
  break: 'Mid-semester break', holiday: 'Holiday weeks', 'exam-week': 'Exam weeks',
  exam: 'Exam', assignment: 'Assignment',
}
export const academicDateSchema = z.object({
  type: z.enum(['break', 'holiday', 'exam-week', 'exam', 'assignment']),
  title: z.string().trim().min(1, 'Enter a title.'),
  startDate: calendarDateSchema,
  endDate: calendarDateSchema,
}).refine(value => value.endDate >= value.startDate, {
  path: ['endDate'], message: 'End date cannot be before start date.',
}).refine(value => isWeekType(value.type) || value.startDate === value.endDate, {
  path: ['endDate'], message: 'Exams and assignments need a single date.',
})

export function isWeekType(type: AcademicDateType) {
  return type === 'break' || type === 'holiday' || type === 'exam-week'
}

/** Whole consecutive weeks starting on the selected date; end date is inclusive. */
export function weekEnd(startDate: string, weeks: number) {
  return toCalendarDate(addDays(parseCalendarDate(startDate), weeks * 7 - 1))
}

export function academicDateRange(start: string, end: string) {
  const first = format(parseCalendarDate(start), 'd MMM yyyy')
  return start === end ? first : `${first} – ${format(parseCalendarDate(end), 'd MMM yyyy')}`
}
