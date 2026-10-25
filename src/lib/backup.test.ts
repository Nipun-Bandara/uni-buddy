import { backupFixture } from '@/test/fixtures/backup'
import { describe, it, expect } from 'vitest'
import { parseBackup, validateBackup } from '@/lib/backup'

describe('backup validation', () => {
  it('round-trips every table, date-only values, precision, and nested settings', () => {
    const backup = backupFixture()
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup)
    expect(backup.data.scheduleRules[0].dayOfWeek).toBe(3)
  })
  it('accepts six-table backups with absent academic dates as an empty array', () => {
    const { academicDates: omitted, ...data } = backupFixture().data
    expect(omitted).toHaveLength(1)
    expect(validateBackup({ ...backupFixture(), data }).data.academicDates).toEqual([])
  })
  it('identifies invalid JSON and unsupported format versions', () => {
    expect(() => parseBackup('{')).toThrow('Invalid JSON')
    expect(() => validateBackup({ ...backupFixture(), version: 2 })).toThrow('Unsupported backup version 2')
    expect(() => parseBackup('null')).toThrow('Invalid backup structure')
  })
  it('rejects missing tables, invalid field types, invalid dates/times and unknown fields', () => {
    const value = backupFixture()
    for (const data of [
      { ...value.data, modules: undefined },
      { ...value.data, semesters: [{ ...value.data.semesters[0], name: 123 }] },
      { ...value.data, scheduleRules: [{ ...value.data.scheduleRules[0], dayOfWeek: 7 }] },
      { ...value.data, scheduleRules: [{ ...value.data.scheduleRules[0], startTime: '25:00' }] },
      { ...value.data, semesters: [{ ...value.data.semesters[0], startDate: '2026-02-30' }] },
      { ...value.data, modules: [{ ...value.data.modules[0], unexpected: true }] },
    ]) expect(() => validateBackup({ ...value, data })).toThrow('Invalid backup structure')
  })
  it('rejects duplicate IDs, keys, rule/date occurrences, and multiple active timers', () => {
    const value = backupFixture()
    for (const data of [
      { ...value.data, modules: [...value.data.modules, value.data.modules[0]] },
      { ...value.data, settings: [...value.data.settings, value.data.settings[0]] },
      { ...value.data, classOccurrences: [...value.data.classOccurrences, { ...value.data.classOccurrences[0], id: 'duplicate' }] },
      { ...value.data, workSessions: [...value.data.workSessions, { id: 'second-active', startedAt: value.exportedAt }] },
    ]) expect(() => validateBackup({ ...value, data })).toThrow('Invalid backup structure')
  })
  it('rejects missing related semesters, modules and timetable rules', () => {
    const value = backupFixture()
    for (const data of [
      { ...value.data, semesters: [] }, { ...value.data, modules: [] }, { ...value.data, scheduleRules: [] },
      { ...value.data, workSessions: [{ ...value.data.workSessions[0], moduleId: 'missing' }] },
      { ...value.data, academicDates: [{ ...value.data.academicDates[0], semesterId: 'missing' }] },
    ]) expect(() => validateBackup({ ...value, data })).toThrow('Referenced')
  })
  it('rejects reversed intervals but permits a legitimate zero-length stopped timer', () => {
    const value = backupFixture()
    expect(() => validateBackup({ ...value, data: { ...value.data, workSessions: [{ ...value.data.workSessions[0], endedAt: '2025-01-01T00:00:00Z' }] } })).toThrow()
    const same = { ...value.data.workSessions[0], endedAt: value.data.workSessions[0].startedAt }
    expect(validateBackup({ ...value, data: { ...value.data, workSessions: [same] } }).data.workSessions).toEqual([same])
  })
  it('rejects settings values that cannot round-trip through JSON', () => {
    const value = backupFixture()
    for (const invalid of [undefined, NaN, Infinity, new Date(), () => 'value']) {
      expect(() => validateBackup({ ...value, data: { ...value.data, settings: [{ key: 'bad', value: invalid }] } })).toThrow()
    }
  })
})
