import type { ScheduleRule } from '@/db/types'
import { calendarDateSchema } from '@/lib/dates'

const millisecondsPerDay = 86_400_000

/**
 * An integer Gregorian calendar day, independent of the device timezone.
 * UTC is used only as a fixed arithmetic axis, never to convert a local instant.
 * Explicit components also avoid the Date constructor's special handling of years 0–99.
 */
function calendarDay(value: string): number | null {
  if (!calendarDateSchema.safeParse(value).success) return null
  const [year, month, day] = value.split('-').map(Number)
  const calendar = new Date(0)
  calendar.setUTCFullYear(year, month - 1, day)
  return calendar.getTime() / millisecondsPerDay
}

/** Monday = 0 through Sunday = 6; 1970-01-01 (day 0) was a Thursday. */
function weekday(day: number): number {
  return ((day + 3) % 7 + 7) % 7
}

/**
 * Match a date-only label against a weekly/fortnightly rule. Bounds are inclusive.
 * The anchor identifies an occurrence week (Monday–Sunday), not a lower bound:
 * matching weeks before it are included when they fall inside the rule's period.
 * Invalid calendar dates, reversed periods, or unsupported rules return false.
 * This does not apply academic breaks/holidays or create occurrence records.
 */
export function occursOnDate(rule: ScheduleRule, date: string): boolean {
  const day = calendarDay(date)
  const start = calendarDay(rule.startDate)
  const end = calendarDay(rule.endDate)
  const anchor = calendarDay(rule.anchorDate)
  if (day === null || start === null || end === null || anchor === null) return false
  if (start > end || day < start || day > end) return false
  if (!Number.isInteger(rule.dayOfWeek) || rule.dayOfWeek < 0 || rule.dayOfWeek > 6) return false
  if (rule.repeatEveryWeeks !== 1 && rule.repeatEveryWeeks !== 2) return false
  if (weekday(day) !== rule.dayOfWeek) return false

  const weekStart = day - weekday(day)
  const anchorWeekStart = anchor - weekday(anchor)
  const weeksFromAnchor = (weekStart - anchorWeekStart) / 7
  return weeksFromAnchor % rule.repeatEveryWeeks === 0
}

/** Returns a new array, leaving the input and its rules unchanged. Equal times retain input order. */
export function getScheduleForDate(rules: ScheduleRule[], date: string): ScheduleRule[] {
  return rules.filter(rule => occursOnDate(rule, date))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}
