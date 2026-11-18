import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, StudentProductivityDatabase } from '@/db/db'
import { schemaV5 } from '@/db/schema'
import { saveRescheduledClass, setRescheduledAttendance, deleteRescheduledClass } from '@/db/rescheduled-classes'
import { deleteModule } from '@/db/modules'
import { createBackup, restoreBackup } from '@/db/backup'
import { parseBackup } from '@/lib/backup'

const fields = { moduleId: 'm', type: 'lecture' as const, date: '2026-11-04', startTime: '10:00', endTime: '12:00', location: ' Hall 2 ' }
beforeEach(async () => {
  await db.delete(); await db.open(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 4, 18))
  await db.semesters.add({ id: 's', name: 'Semester 7', startDate: '2026-10-01', endDate: '2027-02-28' })
  await db.modules.add({ id: 'm', semesterId: 's', name: 'Data Mining' })
})
afterEach(async () => { vi.useRealTimers(); await db.delete() })

describe('one-off rescheduled classes', () => {
  it('persists a pending class without making any timetable rule or recurring occurrence', async () => {
    const saved = await saveRescheduledClass(fields)
    expect(saved.status).toBe('pending'); expect(saved.location).toBe('Hall 2')
    expect(Date.parse(saved.endAt) - Date.parse(saved.startAt)).toBe(7200000)
    expect(await db.scheduleRules.count()).toBe(0); expect(await db.classOccurrences.count()).toBe(0)
    db.close(); await db.open(); expect(await db.rescheduledClasses.get(saved.id)).toEqual(saved)
  })
  it.each(['attended', 'missed', 'cancelled'] as const)('records %s and updates status on the same row', async status => {
    const record = await saveRescheduledClass(fields)
    await Promise.all([setRescheduledAttendance(record.id, status), setRescheduledAttendance(record.id, status)])
    expect((await db.rescheduledClasses.get(record.id))?.status).toBe(status)
    expect(await db.rescheduledClasses.count()).toBe(1)
    await setRescheduledAttendance(record.id, 'attended')
    expect((await db.rescheduledClasses.get(record.id))?.status).toBe('attended')
  })
  it('does not allow attendance before class end or invalid/current-date/module input', async () => {
    const future = await saveRescheduledClass({ ...fields, startTime: '19:00', endTime: '20:00' })
    await expect(setRescheduledAttendance(future.id, 'attended')).rejects.toThrow('not ended')
    for (const changes of [{ endTime: '09:00' }, { startTime: '25:00' }, { date: '2026-02-30' }, { date: '2026-11-05' }, { moduleId: 'missing' }]) await expect(saveRescheduledClass({ ...fields, ...changes })).rejects.toThrow()
    expect(await db.rescheduledClasses.count()).toBe(1)
  })
  it('lets a past one-off be reviewed/edited without moving the original date or losing attendance', async () => {
    const saved = await saveRescheduledClass(fields)
    await setRescheduledAttendance(saved.id, 'attended')
    vi.setSystemTime(new Date(2026, 10, 6, 18))
    const updated = await saveRescheduledClass({ ...fields, location: 'Online' }, saved.id)
    expect(updated.date).toBe(fields.date); expect(updated.status).toBe('attended'); expect(updated.startAt).toBe(saved.startAt)
    await expect(saveRescheduledClass({ ...fields, date: '2026-11-06' }, saved.id)).rejects.toThrow()
    expect(await deleteModule('m')).toBe(false)
    await deleteRescheduledClass(saved.id); expect(await db.rescheduledClasses.count()).toBe(0)
    expect(await deleteModule('m')).toBe(true)
  })
  it('round trips through backup and restores old backups with no one-offs', async () => {
    const saved = await saveRescheduledClass(fields); await setRescheduledAttendance(saved.id, 'missed')
    const snapshot = await createBackup(); await db.rescheduledClasses.clear()
    await restoreBackup(parseBackup(JSON.stringify(snapshot)))
    expect((await db.rescheduledClasses.get(saved.id))?.status).toBe('missed')
    const { rescheduledClasses: omitted, ...legacyData } = snapshot.data
    expect(omitted).toHaveLength(1)
    await restoreBackup({ ...snapshot, data: legacyData }); expect(await db.rescheduledClasses.count()).toBe(0)
    await expect(restoreBackup({ ...snapshot, data: { ...snapshot.data, rescheduledClasses: [{ ...saved, moduleId: 'unknown' }] } })).rejects.toThrow('Referenced')
  })
  it('rolls back the entire backup replacement if the new one-off table cannot be written', async () => {
    await saveRescheduledClass(fields)
    const snapshot = await createBackup()
    await db.modules.update('m', { name: 'Keep this change' })
    const before = await createBackup()
    function failWrite() { throw new Error('One-off storage failure') }
    db.rescheduledClasses.hook('creating', failWrite)
    try { await expect(restoreBackup(snapshot)).rejects.toThrow('One-off storage failure') }
    finally { db.rescheduledClasses.hook('creating').unsubscribe(failWrite) }
    expect((await createBackup()).data).toEqual(before.data)
  })
  it('migrates a v5 database additively, retaining its existing data', async () => {
    const name = 'rescheduled-migration-test', old = new Dexie(name)
    old.version(5).stores(schemaV5)
    await old.open(); await old.table('settings').add({ key: 'kept', value: true }); old.close()
    const upgraded = new StudentProductivityDatabase(name)
    try { await upgraded.open(); expect(upgraded.verno).toBe(7); expect((await upgraded.settings.get('kept'))?.value).toBe(true); expect(await upgraded.rescheduledClasses.count()).toBe(0) }
    finally { await upgraded.delete() }
  })
})
