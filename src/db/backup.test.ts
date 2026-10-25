import 'fake-indexeddb/auto'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { db } from '@/db/db'
import { createBackup, restoreBackup } from '@/db/backup'
import { parseBackup } from '@/lib/backup'
import { backupFixture } from '@/test/fixtures/backup'

beforeEach(async () => { await db.delete(); await db.open(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-29T10:00:00Z')) })
afterEach(async () => { vi.useRealTimers(); await db.delete() })

describe('backup persistence', () => {
  it('exports, changes/deletes data, then restores every original record', async () => {
    await restoreBackup(backupFixture())
    const snapshot = await createBackup()
    const json = JSON.stringify(snapshot)
    await db.transaction('rw', db.tables, async () => {
      await Promise.all(db.tables.map(table => table.clear()))
      await db.semesters.add({ id: 'new', name: 'Changed', startDate: '2026-01-01', endDate: '2026-12-31' })
    })
    await restoreBackup(parseBackup(json))
    expect((await createBackup()).data).toEqual(snapshot.data)
    expect(await db.workSessions.filter(row => row.endedAt === undefined).count()).toBe(1)
    db.close(); await db.open()
    expect((await createBackup()).data).toEqual(snapshot.data)
  })
  it('does not modify data when validation fails', async () => {
    await restoreBackup(backupFixture())
    const before = await createBackup()
    await expect(restoreBackup({ ...before, version: 999 })).rejects.toThrow('Unsupported')
    expect((await createBackup()).data).toEqual(before.data)
  })
  it('rolls back clears and earlier table inserts when a later insert fails', async () => {
    await db.semesters.add({ id: 'original', name: 'Original', startDate: '2026-01-01', endDate: '2026-12-31' })
    await db.settings.add({ key: 'original', value: ['preserve', true] })
    const before = await createBackup()
    function failWrite() { throw new Error('Simulated storage failure') }
    db.workSessions.hook('creating', failWrite)
    try { await expect(restoreBackup(backupFixture())).rejects.toThrow('Simulated storage failure') }
    finally { db.workSessions.hook('creating').unsubscribe(failWrite) }
    expect((await createBackup()).data).toEqual(before.data)
  })
  it('restores an empty backup and clears optional academic dates when absent', async () => {
    await restoreBackup(backupFixture())
    const value = backupFixture()
    const data = { semesters: [], modules: [], scheduleRules: [], classOccurrences: [], workSessions: [], settings: [] }
    await restoreBackup({ ...value, data })
    expect((await createBackup()).data).toEqual({ ...data, academicDates: [] })
  })
})
