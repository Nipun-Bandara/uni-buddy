import { format, isValid, parse } from 'date-fns'
import { z } from 'zod'

/** Calendar values are local labels, never passed to new Date('YYYY-MM-DD'). */
export const calendarDateSchema = z.iso.date()
export const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm')
export const isoTimestampSchema = z.iso.datetime({ offset: true })

/** Parse at local midnight; do not serialize the result with toISOString(). */
export function parseCalendarDate(value: string): Date {
  calendarDateSchema.parse(value)
  const date = parse(value, 'yyyy-MM-dd', new Date(2000, 0, 1))
  if (!isValid(date)) throw new RangeError('Invalid calendar date')
  return date
}

export function toCalendarDate(date: Date): string {
  return calendarDateSchema.parse(format(date, 'yyyy-MM-dd'))
}

export function toLocalTime(date: Date): string {
  return localTimeSchema.parse(format(date, 'HH:mm'))
}

/** An instant in UTC, separate from date-only and wall-clock values. */
export function toIsoTimestamp(date: Date): string {
  return date.toISOString()
}

/** Explicit local components → ISO instant. Optional seconds support session corrections. */
export function localDateTimeToIso(date: string, time: string): string {
  calendarDateSchema.parse(date)
  if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) throw new RangeError('Choose a valid local time.')
  const instant = parseCalendarDate(date)
  const [hours, minutes, seconds = 0] = time.split(':').map(Number)
  instant.setHours(hours, minutes, seconds, 0)
  if (toCalendarDate(instant) !== date || format(instant, time.length === 8 ? 'HH:mm:ss' : 'HH:mm') !== time) {
    throw new RangeError('This local date/time does not exist in the device timezone.')
  }
  return instant.toISOString()
}
