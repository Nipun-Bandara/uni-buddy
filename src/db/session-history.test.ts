import 'fake-indexeddb/auto'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { db } from '@/db/db'
import { saveCompletedSession, deleteCompletedSession } from '@/db/session-history'
import { startWorkSession, getActiveWorkSession } from '@/db/work-sessions'
import { sessionFormValues } from '@/lib/session-history'

const fields = { moduleId: '', title: '', date: '2026-10-28', endDate: '2026-10-28', startTime: '16:12', endTime: '17:04' }
beforeEach(async () => { await db.delete(); await db.open(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-29T20:00:00Z')) })
afterEach(async () => { vi.useRealTimers(); await db.delete() })

describe('completed session CRUD', () => {
  it('adds a manual General session without title, persisting after reopening', async () => {
    const saved = await saveCompletedSession(fields)
    expect(saved.moduleId).toBeUndefined(); expect(saved.title).toBeUndefined()
    expect(Date.parse(saved.endedAt) - Date.parse(saved.startedAt)).toBe(52 * 60_000)
    db.close(); await db.open()
    expect(await db.workSessions.get(saved.id)).toEqual(saved)
  })
  it('edits module, title and times on the same row and can clear optional fields', async () => {
    await db.modules.add({ id: 'm', semesterId: 's', name: 'Research Project' })
    const saved = await saveCompletedSession(fields)
    const changed = await saveCompletedSession({ ...fields, moduleId: 'm', title: ' Review ', endTime: '18:00' }, saved.id)
    expect(changed.id).toBe(saved.id); expect(changed.moduleId).toBe('m'); expect(changed.title).toBe('Review')
    expect(await db.workSessions.count()).toBe(1)
    const cleared = await saveCompletedSession({ ...sessionFormValues(changed), title: '', moduleId: '' }, saved.id)
    expect(cleared.title).toBeUndefined(); expect(cleared.moduleId).toBeUndefined()
  })
  it('adds completed work without replacing or stopping an active timer', async () => {
    const active = await startWorkSession()
    await saveCompletedSession(fields)
    expect(await getActiveWorkSession()).toEqual(active)
    expect(await db.workSessions.count()).toBe(2)
  })
  it('deletes a completed session while protecting active sessions', async () => {
    const completed = await saveCompletedSession(fields)
    const active = await startWorkSession()
    await deleteCompletedSession(completed.id)
    expect(await db.workSessions.get(completed.id)).toBeUndefined()
    await expect(deleteCompletedSession(active.id)).rejects.toThrow('Stop')
    await expect(saveCompletedSession(fields, active.id)).rejects.toThrow('completed')
    expect(await getActiveWorkSession()).toEqual(active)
  })
  it('rejects invalid ranges, deleted sessions and missing modules without extra rows', async () => {
    await expect(saveCompletedSession({ ...fields, endTime: '15:00' })).rejects.toThrow()
    await expect(saveCompletedSession({ ...fields, moduleId: 'missing' })).rejects.toThrow()
    await expect(saveCompletedSession(fields, 'missing')).rejects.toThrow()
    expect(await db.workSessions.count()).toBe(0)
  })
})
