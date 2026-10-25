import { z } from 'zod'
import { db } from '@/db/db'
import type { AttendanceStatus, ClassOccurrence, ScheduleRule } from '@/db/types'
import { calendarDateSchema, localTimeSchema, parseCalendarDate, toCalendarDate, toLocalTime } from '@/lib/dates'
import { createId } from '@/lib/ids'
import { occursOnDate } from '@/lib/recurrence'

const attendanceStatusSchema = z.enum(['pending', 'attended', 'missed', 'cancelled'])

/** Combine local date/time components, then serialize the resulting instant to ISO. */
export function occurrenceTimestamps(rule: ScheduleRule, date: string) {
  calendarDateSchema.parse(date)
  function timestamp(time: string) {
    localTimeSchema.parse(time)
    const instant = parseCalendarDate(date)
    const [hours, minutes] = time.split(':').map(Number)
    instant.setHours(hours, minutes, 0, 0)
    // Reject nonexistent wall-clock times instead of silently shifting them across a DST gap.
    if (toCalendarDate(instant) !== date || toLocalTime(instant) !== time) {
      throw new RangeError('This local date/time does not exist in the device timezone.')
    }
    return instant.toISOString()
  }
  const startAt = timestamp(rule.startTime)
  const endAt = timestamp(rule.endTime)
  if (endAt <= startAt) throw new RangeError('Class end must be after class start.')
  return { startAt, endAt }
}

/** Missing records are unrecorded/pending; reading never creates a row. */
export async function getAttendanceForClass(ruleId: string, date: string): Promise<ClassOccurrence | undefined> {
  calendarDateSchema.parse(date)
  return db.classOccurrences.where('[scheduleRuleId+date]').equals([ruleId, date]).first()
}

/** Atomic upsert, safe across rapid taps/tabs. Existing per-date timestamps are preserved. */
export async function setAttendance(rule: ScheduleRule, date: string, status: AttendanceStatus): Promise<ClassOccurrence> {
  calendarDateSchema.parse(date)
  attendanceStatusSchema.parse(status)
  return db.transaction('rw', db.scheduleRules, db.classOccurrences, async () => {
    const savedRule = await db.scheduleRules.get(rule.id)
    if (!savedRule) throw new Error('The timetable rule no longer exists.')
    const existing = await getAttendanceForClass(rule.id, date)
    if (existing) {
      const updated = { ...existing, status }
      await db.classOccurrences.put(updated)
      return updated
    }
    if (!occursOnDate(savedRule, date)) throw new RangeError('This rule does not occur on the selected date.')
    const occurrence: ClassOccurrence = {
      id: createId(), scheduleRuleId: rule.id, date,
      ...occurrenceTimestamps(savedRule, date), status,
    }
    await db.classOccurrences.add(occurrence)
    return occurrence
  })
}
