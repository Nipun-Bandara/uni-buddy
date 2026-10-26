import 'fake-indexeddb/auto'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { db } from '@/db/db'
import { ActiveWorkSessionError, getActiveWorkSession, startWorkSession, stopWorkSession } from '@/db/work-sessions'

const start = '2026-10-29T04:30:00.000Z'
beforeEach(async () => { await db.delete(); await db.open() })
afterEach(async () => { vi.useRealTimers(); await db.delete() })

async function seedModule() {
  await db.semesters.add({ id: 's', name: 'Semester 7', startDate: '2026-10-01', endDate: '2027-02-28' })
  await db.modules.add({ id: 'm', semesterId: 's', name: 'Research Project' })
}

describe('work sessions', () => {
  it('starts General work without a semester, module or title, using the current ISO timestamp', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(start))
    expect(await getActiveWorkSession()).toBeUndefined()
    const session = await startWorkSession()
    expect(session.startedAt).toBe(start)
    expect(session.endedAt).toBeUndefined()
    expect(session.moduleId).toBeUndefined()
    expect(session.title).toBeUndefined()
    expect(await getActiveWorkSession()).toEqual(session)
    expect(await db.workSessions.count()).toBe(1)
  })

  it('starts with a module and optional title, trimming whitespace', async () => {
    await seedModule()
    const session = await startWorkSession({ moduleId: 'm', title: '  Literature review  ' })
    expect(session.moduleId).toBe('m')
    expect(session.title).toBe('Literature review')
  })

  it('starts with a module but no title', async () => {
    await seedModule()
    const session = await startWorkSession({ moduleId: 'm', title: '   ' })
    expect(session.moduleId).toBe('m')
    expect(session.title).toBeUndefined()
  })

  it('restores an active session after reopening storage without changing its start time', async () => {
    const session = await startWorkSession()
    db.close(); await db.open()
    expect(await getActiveWorkSession()).toEqual(session)
  })

  it('rejects another start while a session is active', async () => {
    const first = await startWorkSession()
    await expect(startWorkSession({ title: 'Second' })).rejects.toBeInstanceOf(ActiveWorkSessionError)
    expect(await db.workSessions.toArray()).toEqual([first])
  })

  it('allows only one concurrent start', async () => {
    const results = await Promise.allSettled([startWorkSession(), startWorkSession(), startWorkSession()])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(2)
    expect(await db.workSessions.count()).toBe(1)
  })

  it('stops at the current timestamp and permits a new session', async () => {
    await seedModule()
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(start))
    const first = await startWorkSession({ moduleId: 'm', title: 'First session' })
    vi.setSystemTime(new Date('2026-10-29T05:53:42.000Z'))
    const stopped = await stopWorkSession(first.id)
    expect(stopped.endedAt).toBe('2026-10-29T05:53:42.000Z')
    expect(stopped.startedAt).toBe(start)
    expect(await getActiveWorkSession()).toBeUndefined()
    const next = await startWorkSession()
    expect(next.id).not.toBe(first.id)
    expect(next.startedAt).toBe(stopped.endedAt)
    expect(next.moduleId).toBeUndefined()
    expect(next.title).toBeUndefined()
    expect(await db.workSessions.count()).toBe(2)
  })

  it('does not overwrite an existing end time on repeated or concurrent stops', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(start))
    const session = await startWorkSession()
    vi.setSystemTime(new Date('2026-10-29T05:00:00.000Z'))
    const stopped = await stopWorkSession(session.id)
    vi.setSystemTime(new Date('2026-10-29T06:00:00.000Z'))
    const repeats = await Promise.all([stopWorkSession(session.id), stopWorkSession(session.id)])
    expect(repeats).toEqual([stopped, stopped])
  })

  it('rejects removed modules and modules outside the active semester', async () => {
    await seedModule()
    await db.semesters.add({ id: 'z', name: 'Other', startDate: '2026-01-01', endDate: '2026-12-31' })
    await db.modules.add({ id: 'other', semesterId: 'z', name: 'Other module' })
    await expect(startWorkSession({ moduleId: 'missing' })).rejects.toThrow()
    await expect(startWorkSession({ moduleId: 'other' })).rejects.toThrow()
    expect(await db.workSessions.count()).toBe(0)
  })

  it('rejects a stop if the device clock moved before the start', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(start))
    const session = await startWorkSession()
    vi.setSystemTime(new Date('2026-10-29T03:00:00.000Z'))
    await expect(stopWorkSession(session.id)).rejects.toThrow('earlier')
    expect((await getActiveWorkSession())?.id).toBe(session.id)
  })
})
