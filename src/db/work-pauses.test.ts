import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db/db'
import { pauseWorkSession, resumeWorkSession, startWorkSession, stopWorkSession } from '@/db/work-sessions'
import { saveCompletedSession } from '@/db/session-history'
import { startSleepSession } from '@/db/sleep-sessions'
import { createBackup, restoreBackup } from '@/db/backup'
import { calculateRangeInsights } from '@/lib/insights'
import { sessionDurationLabel } from '@/lib/session-history'
import { clipPauses, pausedMs, workedMs } from '@/lib/work-pauses'
import { BackupValidationError, validateBackup } from '@/lib/backup'
import { backupFixture } from '@/test/fixtures/backup'

const at = (time: string) => new Date(`2026-11-19T${time}:00.000Z`)
beforeEach(async () => { await db.delete(); await db.open(); vi.useFakeTimers({ toFake: ['Date'] }) })
afterEach(async () => { vi.useRealTimers(); await db.delete() })

describe('work pauses', () => {
  it('excludes paused time from worked time and tolerates repeated taps', async () => {
    vi.setSystemTime(at('09:00')); const { id } = await startWorkSession()
    vi.setSystemTime(at('10:00')); await pauseWorkSession(id)
    vi.setSystemTime(at('10:05')); await pauseWorkSession(id)
    expect((await db.workSessions.get(id))?.pauses).toEqual([{ startedAt: at('10:00').toISOString() }])
    vi.setSystemTime(at('10:30')); await resumeWorkSession(id)
    vi.setSystemTime(at('10:40')); await resumeWorkSession(id)
    vi.setSystemTime(at('11:00')); await pauseWorkSession(id)
    vi.setSystemTime(at('11:15')); await resumeWorkSession(id)
    vi.setSystemTime(at('12:00')); const stopped = await stopWorkSession(id)
    expect(stopped.pauses).toHaveLength(2)
    expect(workedMs(stopped)).toBe(2 * 3_600_000 + 15 * 60_000)
    expect(pausedMs(stopped)).toBe(45 * 60_000)
    expect(sessionDurationLabel(stopped)).toBe('2h 15m')
  })

  it('ends a paused session at the pause time, dropping the open pause', async () => {
    vi.setSystemTime(at('09:00')); const { id } = await startWorkSession()
    vi.setSystemTime(at('09:30')); await pauseWorkSession(id)
    vi.setSystemTime(at('11:00')); const stopped = await stopWorkSession(id)
    expect(stopped.endedAt).toBe(at('09:30').toISOString())
    expect(stopped.pauses).toBeUndefined()
    expect(workedMs(stopped)).toBe(30 * 60_000)
  })

  it('ends a paused session at its pause time when sleep starts', async () => {
    vi.setSystemTime(at('20:00')); const { id } = await startWorkSession()
    vi.setSystemTime(at('21:00')); await pauseWorkSession(id)
    vi.setSystemTime(at('23:00')); const { endedWork } = await startSleepSession()
    expect(endedWork?.endedAt).toBe(at('21:00').toISOString())
    expect((await db.workSessions.get(id))?.endedAt).toBe(at('21:00').toISOString())
  })

  it('counts only worked time in insights, clipped to the range', () => {
    const session = { id: 'a', startedAt: at('09:00').toISOString(), endedAt: at('12:00').toISOString(), pauses: [{ startedAt: at('10:00').toISOString(), endedAt: at('11:00').toISOString() }] }
    const data = { sessions: [session], occurrences: [], rules: [], modules: [] }
    const totals = calculateRangeInsights(data, new Date(Date.UTC(2026, 10, 19, 0)), new Date(Date.UTC(2026, 10, 20, 0)), new Date(Date.UTC(2026, 10, 20, 1)))
    expect(totals.independentMs).toBe(2 * 3_600_000)
    expect(totals.generalMs).toBe(2 * 3_600_000)
  })

  it('keeps pauses that still fit when a completed session is edited', async () => {
    vi.setSystemTime(at('09:00')); const { id } = await startWorkSession()
    vi.setSystemTime(at('10:00')); await pauseWorkSession(id)
    vi.setSystemTime(at('10:30')); await resumeWorkSession(id)
    vi.setSystemTime(at('12:00')); const stopped = await stopWorkSession(id)
    expect(clipPauses(stopped.pauses, at('10:15').toISOString(), at('12:00').toISOString())).toEqual([{ startedAt: at('10:15').toISOString(), endedAt: at('10:30').toISOString() }])
    expect(clipPauses(stopped.pauses, at('10:45').toISOString(), at('12:00').toISOString())).toEqual([])
    vi.setSystemTime(at('13:00'))
    const local = (date: Date) => ({ date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`, time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` })
    const start = local(at('09:00')); const end = local(at('12:00'))
    const saved = await saveCompletedSession({ moduleId: '', title: 'x', date: start.date, startTime: start.time, endDate: end.date, endTime: end.time }, id)
    expect(saved.pauses).toEqual(stopped.pauses)
    expect(workedMs(saved)).toBe(workedMs(stopped))
  })

  it('round-trips pauses through backup and rejects invalid ones', async () => {
    vi.useRealTimers()
    const fixture = backupFixture()
    fixture.data.workSessions[0].pauses = [{ startedAt: '2026-10-28T10:10:00.000Z', endedAt: '2026-10-28T10:20:00.000Z' }]
    await restoreBackup(fixture)
    expect((await createBackup()).data.workSessions.find(row => row.id === 'completed')?.pauses).toEqual(fixture.data.workSessions[0].pauses)
    const outside = backupFixture(); outside.data.workSessions[0].pauses = [{ startedAt: '2026-10-28T09:00:00.000Z', endedAt: '2026-10-28T10:20:00.000Z' }]
    expect(() => validateBackup(outside)).toThrow(BackupValidationError)
    const openOnCompleted = backupFixture(); openOnCompleted.data.workSessions[0].pauses = [{ startedAt: '2026-10-28T10:10:00.000Z' }]
    expect(() => validateBackup(openOnCompleted)).toThrow(BackupValidationError)
    const openOnActive = backupFixture(); openOnActive.data.workSessions[1].pauses = [{ startedAt: '2026-10-29T09:10:00.000Z' }]
    expect(() => validateBackup(openOnActive)).not.toThrow()
  })
})
