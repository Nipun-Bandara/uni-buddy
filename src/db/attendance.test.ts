import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, StudentProductivityDatabase } from '@/db/db'
import { schemaV2 } from '@/db/schema'
import { getAttendanceForClass, occurrenceTimestamps, setAttendance } from '@/db/attendance'
import type { AttendanceStatus, ClassOccurrence, ScheduleRule } from '@/db/types'

const rule: ScheduleRule = {
  id: 'rule', moduleId: 'module', type: 'lecture', dayOfWeek: 3,
  startTime: '10:00', endTime: '12:00', repeatEveryWeeks: 1,
  anchorDate: '2026-10-29', startDate: '2026-10-01', endDate: '2027-02-28',
}
const date = '2026-10-29'

beforeEach(async () => {
  await db.delete()
  await db.open()
  await db.scheduleRules.add(rule)
})
afterEach(async () => { await db.delete() })

describe('attendance service', () => {
  it('reads an unrecorded class without generating rows', async () => {
    expect(await getAttendanceForClass(rule.id, date)).toBeUndefined()
    expect(await db.classOccurrences.count()).toBe(0)
  })

  it.each(['attended', 'missed', 'cancelled', 'pending'] as const)('saves %s with local-date ISO timestamps', async status => {
    const saved = await setAttendance(rule, date, status)
    expect(await getAttendanceForClass(rule.id, date)).toEqual(saved)
    expect(saved.status).toBe(status)
    expect(saved.date).toBe(date)
    expect(saved.scheduleRuleId).toBe(rule.id)
    expect(saved.id).toBeTruthy()
    const start = new Date(saved.startAt)
    const end = new Date(saved.endAt)
    expect([start.getFullYear(), start.getMonth() + 1, start.getDate(), start.getHours(), start.getMinutes()]).toEqual([2026, 10, 29, 10, 0])
    expect([end.getFullYear(), end.getMonth() + 1, end.getDate(), end.getHours(), end.getMinutes()]).toEqual([2026, 10, 29, 12, 0])
    expect(start.toISOString()).toBe(saved.startAt)
    expect(end.toISOString()).toBe(saved.endAt)
    expect(await db.classOccurrences.count()).toBe(1)
  })

  it('changes all statuses using the same row and survives reopening storage', async () => {
    const first = await setAttendance(rule, date, 'attended')
    for (const status of ['missed', 'cancelled', 'pending', 'attended'] as const) {
      expect((await setAttendance(rule, date, status)).id).toBe(first.id)
      expect(await db.classOccurrences.count()).toBe(1)
    }
    db.close()
    await db.open()
    expect(await getAttendanceForClass(rule.id, date)).toEqual(first)
  })

  it('serializes concurrent status writes without duplicates', async () => {
    const saved = await Promise.all([
      setAttendance(rule, date, 'attended'), setAttendance(rule, date, 'missed'),
      setAttendance(rule, date, 'cancelled'), setAttendance(rule, date, 'attended'),
    ])
    expect(new Set(saved.map(row => row.id)).size).toBe(1)
    expect(await db.classOccurrences.count()).toBe(1)
  })

  it('enforces uniqueness even if callers bypass the service', async () => {
    const first = await setAttendance(rule, date, 'attended')
    await expect(db.classOccurrences.add({ ...first, id: 'duplicate' })).rejects.toMatchObject({ name: 'ConstraintError' })
    expect(await db.classOccurrences.count()).toBe(1)
  })

  it('keeps separate rows for different dates and different rules', async () => {
    await db.scheduleRules.add({ ...rule, id: 'second-rule' })
    await setAttendance(rule, date, 'attended')
    await setAttendance(rule, '2026-11-05', 'missed')
    await setAttendance({ ...rule, id: 'second-rule' }, date, 'cancelled')
    expect(await db.classOccurrences.count()).toBe(3)
  })

  it('uses current saved rule times when creating a record from a stale UI snapshot', async () => {
    await db.scheduleRules.update(rule.id, { startTime: '14:00', endTime: '16:00' })
    const saved = await setAttendance(rule, date, 'attended')
    expect(new Date(saved.startAt).getHours()).toBe(14)
    expect(new Date(saved.endAt).getHours()).toBe(16)
  })

  it('preserves historical timestamps when changing a recorded status after rule edits', async () => {
    const first = await setAttendance(rule, date, 'attended')
    await db.scheduleRules.update(rule.id, { startTime: '14:00', endTime: '16:00', dayOfWeek: 0 })
    const updated = await setAttendance(rule, date, 'missed')
    expect(updated).toEqual({ ...first, status: 'missed' })
  })

  it('rejects deleted rules, invalid dates/statuses, and non-occurring dates without writing', async () => {
    await expect(setAttendance(rule, '2026-10-30', 'attended')).rejects.toThrow()
    await expect(setAttendance(rule, '2026-02-30', 'attended')).rejects.toThrow()
    await expect(setAttendance(rule, date, 'invalid' as AttendanceStatus)).rejects.toThrow()
    await db.scheduleRules.delete(rule.id)
    await expect(setAttendance(rule, date, 'attended')).rejects.toThrow('no longer exists')
    expect(await db.classOccurrences.count()).toBe(0)
  })
})

describe('local occurrence timestamps', () => {
  it('rejects invalid time ranges', () => {
    expect(() => occurrenceTimestamps({ ...rule, startTime: '25:00' }, date)).toThrow()
    expect(() => occurrenceTimestamps({ ...rule, endTime: '09:00' }, date)).toThrow()
  })
  it.skipIf(Intl.DateTimeFormat().resolvedOptions().timeZone !== 'America/New_York')('rejects nonexistent spring DST times rather than shifting them', () => {
    expect(() => occurrenceTimestamps({ ...rule, startTime: '02:30', endTime: '04:00' }, '2026-03-08')).toThrow('does not exist')
  })
})

describe('occurrence migration', () => {
  it('deduplicates v3 records before enforcing the unique rule/date index', async () => {
    const name = 'AttendanceMigrationTest'
    await Dexie.delete(name)
    const old = new Dexie(name)
    old.version(3).stores(schemaV2)
    await old.open()
    const base: ClassOccurrence = { id: 'a', scheduleRuleId: rule.id, date, status: 'attended', ...occurrenceTimestamps(rule, date) }
    await old.table('classOccurrences').bulkAdd([
      base, { ...base, id: 'z', status: 'pending' },
      { ...base, id: 'c', date: '2026-11-05', status: 'missed' },
      { ...base, id: 'd', date: '2026-11-05', status: 'cancelled' },
    ])
    await old.table('settings').add({ key: 'preserved', value: true })
    old.close()
    const upgraded = new StudentProductivityDatabase(name)
    try {
      await upgraded.open()
      expect(await upgraded.classOccurrences.toArray()).toEqual([
        base, { ...base, id: 'd', date: '2026-11-05', status: 'cancelled' },
      ])
      expect((await upgraded.settings.get('preserved'))?.value).toBe(true)
      await expect(upgraded.classOccurrences.add({ ...base, id: 'new-duplicate' })).rejects.toMatchObject({ name: 'ConstraintError' })
      expect(upgraded.verno).toBe(5)
    } finally { await upgraded.delete() }
  })
})
