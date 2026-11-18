import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db/db'
import { ActiveSleepSessionError, deleteSleepSession, getActiveSleepSession, OverlappingSleepError, saveCompletedSleep, startSleepSession, stopSleepSession } from '@/db/sleep-sessions'
import { createBackup, restoreBackup } from '@/db/backup'
import { sleepInDateRange, sleepWakeDate } from '@/lib/sleep'

beforeEach(async () => { await db.delete(); await db.open() })
afterEach(async () => { vi.useRealTimers(); await db.delete() })

describe('sleep sessions', () => {
  it('records bedtime and wake-up timestamps without a timer', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-17T17:30:00.000Z'))
    const { sleep, endedWork } = await startSleepSession()
    expect(endedWork).toBeUndefined()
    expect(sleep.startedAt).toBe('2026-11-17T17:30:00.000Z')
    expect(await getActiveSleepSession()).toEqual(sleep)
    await expect(startSleepSession()).rejects.toBeInstanceOf(ActiveSleepSessionError)
    vi.setSystemTime(new Date('2026-11-18T01:00:00.000Z'))
    const stopped = await stopSleepSession(sleep.id)
    expect(stopped.endedAt).toBe('2026-11-18T01:00:00.000Z')
    vi.setSystemTime(new Date('2026-11-18T02:00:00.000Z'))
    expect((await stopSleepSession(sleep.id)).endedAt).toBe('2026-11-18T01:00:00.000Z')
    expect(await getActiveSleepSession()).toBeUndefined()
  })

  it('ends an active work session at the same instant sleep starts', async () => {
    await db.workSessions.add({ id: 'w', startedAt: '2026-11-17T15:00:00.000Z' })
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-17T17:30:00.000Z'))
    const { sleep, endedWork } = await startSleepSession()
    expect(endedWork?.endedAt).toBe(sleep.startedAt)
    expect((await db.workSessions.get('w'))?.endedAt).toBe('2026-11-17T17:30:00.000Z')
  })

  it('adds, edits and deletes completed sleep, rejecting overlaps and invalid times', async () => {
    const first = await saveCompletedSleep({ bedDate: '2026-11-10', bedTime: '23:00', wakeDate: '2026-11-11', wakeTime: '06:30' })
    await expect(saveCompletedSleep({ bedDate: '2026-11-11', bedTime: '05:00', wakeDate: '2026-11-11', wakeTime: '08:00' })).rejects.toBeInstanceOf(OverlappingSleepError)
    await expect(saveCompletedSleep({ bedDate: '2026-11-11', bedTime: '08:00', wakeDate: '2026-11-11', wakeTime: '07:00' })).rejects.toThrow()
    const nap = await saveCompletedSleep({ bedDate: '2026-11-11', bedTime: '14:00', wakeDate: '2026-11-11', wakeTime: '14:45' })
    const edited = await saveCompletedSleep({ bedDate: '2026-11-10', bedTime: '23:30', wakeDate: '2026-11-11', wakeTime: '06:30' }, first.id)
    expect(edited.id).toBe(first.id)
    const day = sleepInDateRange(await db.sleepSessions.toArray(), '2026-11-11', '2026-11-12')
    expect(day.totalMs).toBe(7 * 3_600_000 + 45 * 60_000)
    expect(day.nights).toBe(1)
    await deleteSleepSession(nap.id)
    expect(await db.sleepSessions.count()).toBe(1)
  })

  it('counts an overnight sleep toward the wake-up date', async () => {
    const sleep = await saveCompletedSleep({ bedDate: '2026-11-10', bedTime: '23:00', wakeDate: '2026-11-11', wakeTime: '06:00' })
    expect(sleepWakeDate(sleep)).toBe('2026-11-11')
    expect(sleepInDateRange([sleep], '2026-11-10', '2026-11-11').totalMs).toBe(0)
  })

  it('round-trips sleep records through backup', async () => {
    await saveCompletedSleep({ bedDate: '2026-11-10', bedTime: '23:00', wakeDate: '2026-11-11', wakeTime: '06:00' })
    const backup = await createBackup()
    expect(backup.data.sleepSessions).toHaveLength(1)
    await db.sleepSessions.clear()
    await restoreBackup(backup)
    expect(await db.sleepSessions.count()).toBe(1)
  })
})
