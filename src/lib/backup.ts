import { z } from 'zod'
import type { SettingValue } from '@/db/types'
import { calendarDateSchema, isoTimestampSchema, localTimeSchema } from '@/lib/dates'

const id = z.string().min(1)
const name = z.string().refine(value => value.trim().length > 0, 'Name is required.')
const timestamp = isoTimestampSchema.refine(value => Number.isFinite(Date.parse(value)), 'Invalid timestamp.')
const dateRange = <T extends { startDate: string; endDate: string }>(value: T) => value.endDate >= value.startDate
const orderedTimestamps = <T extends { startAt: string; endAt: string }>(value: T) => Date.parse(value.endAt) > Date.parse(value.startAt)
const settingValue: z.ZodType<SettingValue> = z.lazy(() => z.union([
  z.null(), z.boolean(), z.number().finite(), z.string(), z.array(settingValue), z.record(z.string(), settingValue),
]))

const semester = z.strictObject({ id, name, startDate: calendarDateSchema, endDate: calendarDateSchema }).refine(dateRange, 'Semester end date is before start date.')
const module = z.strictObject({ id, semesterId: id, code: z.string().optional(), name, color: z.string().optional() })
const rule = z.strictObject({
  id, moduleId: id, type: z.enum(['lecture', 'tutorial', 'lab', 'other']),
  dayOfWeek: z.number().int().min(0).max(6), startTime: localTimeSchema, endTime: localTimeSchema,
  repeatEveryWeeks: z.union([z.literal(1), z.literal(2)]), anchorDate: calendarDateSchema,
  startDate: calendarDateSchema, endDate: calendarDateSchema, location: z.string().optional(),
}).refine(dateRange, 'Rule end date is before start date.')
  .refine(value => value.endTime > value.startTime, 'Rule end time must be after start time.')
  .refine(value => value.anchorDate >= value.startDate && value.anchorDate <= value.endDate, 'Anchor date must be inside the rule period.')
const occurrence = z.strictObject({
  id, scheduleRuleId: id, date: calendarDateSchema, startAt: timestamp, endAt: timestamp,
  status: z.enum(['pending', 'attended', 'missed', 'cancelled']),
}).refine(orderedTimestamps, 'Occurrence end must be after start.')
const session = z.strictObject({ id, moduleId: id.optional(), title: z.string().optional(), startedAt: timestamp, endedAt: timestamp.optional() })
  .refine(value => value.endedAt === undefined || Date.parse(value.endedAt) >= Date.parse(value.startedAt), 'Session end is before start.')
const setting = z.strictObject({ key: id, value: settingValue })
const academicDate = z.strictObject({
  id, semesterId: id, type: z.enum(['break', 'holiday', 'exam-week', 'exam', 'assignment']), title: name,
  startDate: calendarDateSchema, endDate: calendarDateSchema,
}).refine(dateRange, 'Academic end date is before start date.')
  .refine(value => !['exam', 'assignment'].includes(value.type) || value.startDate === value.endDate, 'Exams and assignments require a single date.')

/** Backup format v1 uses Monday = 0 weekdays; independent of the IndexedDB schema version. */
export const backupSchema = z.strictObject({
  version: z.literal(1), exportedAt: timestamp,
  data: z.strictObject({
    semesters: z.array(semester), modules: z.array(module), scheduleRules: z.array(rule),
    classOccurrences: z.array(occurrence), workSessions: z.array(session), settings: z.array(setting),
    // Optional for six-table v1 backups; replacement restores missing academic dates as empty.
    academicDates: z.array(academicDate).default([]),
  }),
}).superRefine(({ data }, ctx) => {
  function issue(path: (string | number)[], message: string) { ctx.addIssue({ code: 'custom', path: ['data', ...path], message }) }
  for (const [table, rows] of Object.entries(data)) {
    const keys = new Set<string>()
    rows.forEach((row, index) => {
      const key = 'id' in row ? row.id : row.key
      if (keys.has(key)) issue([table, index], 'Duplicate record ID/key.')
      keys.add(key)
    })
  }
  const semesters = new Set(data.semesters.map(row => row.id))
  const modules = new Set(data.modules.map(row => row.id))
  const rules = new Set(data.scheduleRules.map(row => row.id))
  data.modules.forEach((row, index) => { if (!semesters.has(row.semesterId)) issue(['modules', index, 'semesterId'], 'Referenced semester is missing.') })
  data.scheduleRules.forEach((row, index) => { if (!modules.has(row.moduleId)) issue(['scheduleRules', index, 'moduleId'], 'Referenced module is missing.') })
  const occurrenceKeys = new Set<string>()
  data.classOccurrences.forEach((row, index) => {
    if (!rules.has(row.scheduleRuleId)) issue(['classOccurrences', index, 'scheduleRuleId'], 'Referenced timetable rule is missing.')
    const key = JSON.stringify([row.scheduleRuleId, row.date])
    if (occurrenceKeys.has(key)) issue(['classOccurrences', index], 'Duplicate timetable rule/date occurrence.')
    occurrenceKeys.add(key)
  })
  data.workSessions.forEach((row, index) => { if (row.moduleId && !modules.has(row.moduleId)) issue(['workSessions', index, 'moduleId'], 'Referenced module is missing.') })
  if (data.workSessions.filter(row => row.endedAt === undefined).length > 1) issue(['workSessions'], 'More than one active work session.')
  data.academicDates.forEach((row, index) => { if (!semesters.has(row.semesterId)) issue(['academicDates', index, 'semesterId'], 'Referenced semester is missing.') })
})
export type Backup = z.infer<typeof backupSchema>
export class BackupValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'BackupValidationError' }
}

/** All validation is completed before any replacement transaction is started. */
export function validateBackup(value: unknown): Backup {
  const version = z.object({ version: z.number().int() }).safeParse(value)
  if (version.success && version.data.version !== 1) throw new BackupValidationError(`Unsupported backup version ${version.data.version}. This app supports version 1.`)
  const parsed = backupSchema.safeParse(value)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new BackupValidationError(`Invalid backup structure at ${first.path.join('.') || 'backup'}: ${first.message}`)
  }
  return parsed.data
}

export function parseBackup(text: string): Backup {
  let value: unknown
  try { value = JSON.parse(text) }
  catch { throw new BackupValidationError('Invalid JSON. Choose a JSON backup exported by this app.') }
  try { return validateBackup(value) }
  catch (error) {
    if (error instanceof BackupValidationError) throw error
    throw new BackupValidationError('Invalid backup structure. The file could not be validated.')
  }
}
