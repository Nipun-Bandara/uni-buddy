import { describe, it, expect, afterEach, vi } from 'vitest'
import type { WorkSession } from '@/db/types'
import { completedSessionSchema, groupSessionHistory, historyDateLabel, sessionDurationLabel, sessionFormValues } from '@/lib/session-history'

const input = { moduleId: '', title: '', date: '2026-10-28', endDate: '2026-10-28', startTime: '20:10', endTime: '21:37' }
afterEach(() => vi.useRealTimers())

function session(id: string, day: number, hour: number): WorkSession {
  return { id, startedAt: new Date(2026, 9, day, hour).toISOString(), endedAt: new Date(2026, 9, day, hour + 1).toISOString() }
}

describe('session history', () => {
  it('groups completed sessions by local start day, newest first and newest within each day', () => {
    const yesterday = session('yesterday', 28, 22)
    const early = session('early', 29, 9)
    const late = session('late', 29, 20)
    const active = { id: 'active', startedAt: new Date(2026, 9, 29, 23).toISOString() }
    const original = [yesterday, early, active, late]
    expect(groupSessionHistory(original)).toEqual([{ date: '2026-10-29', sessions: [late, early] }, { date: '2026-10-28', sessions: [yesterday] }])
    expect(original).toEqual([yesterday, early, active, late])
  })
  it('labels Today, Yesterday, and older dates including previous years', () => {
    expect(historyDateLabel('2026-10-29', '2026-10-29')).toBe('Today')
    expect(historyDateLabel('2026-10-28', '2026-10-29')).toBe('Yesterday')
    expect(historyDateLabel('2026-10-27', '2026-10-29')).toBe('27 October')
    expect(historyDateLabel('2025-12-31', '2026-01-01')).toBe('Yesterday')
    expect(historyDateLabel('2025-12-30', '2026-01-01')).toBe('30 December 2025')
  })
  it('calculates durations across hour, midnight, and day boundaries', () => {
    expect(sessionDurationLabel({ id: 'a', startedAt: '2026-10-28T20:10:00Z', endedAt: '2026-10-28T21:37:00Z' })).toBe('1h 27m')
    expect(sessionDurationLabel({ id: 'a', startedAt: '2026-10-28T16:12:00Z', endedAt: '2026-10-28T17:04:00Z' })).toBe('52m')
    expect(sessionDurationLabel({ id: 'a', startedAt: '2026-10-28T23:30:00Z', endedAt: '2026-10-29T01:00:00Z' })).toBe('1h 30m')
    expect(sessionDurationLabel({ id: 'a', startedAt: '2026-10-28T00:00:00Z', endedAt: '2026-10-29T01:00:00Z' })).toBe('25h')
    expect(sessionDurationLabel({ id: 'a', startedAt: '2026-10-28T00:00:00Z', endedAt: '2026-10-28T00:00:30Z' })).toBe('30s')
  })
  it('validates time order, dates, required times, and future completions', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-29T20:00:00Z'))
    expect(completedSessionSchema().safeParse(input).success).toBe(true)
    for (const change of [{ startTime: '' }, { endTime: '25:00' }, { date: '2026-02-30' }, { endTime: '19:00' }, { endTime: '20:10' }, { date: '2100-01-01', endDate: '2100-01-01' }]) {
      expect(completedSessionSchema().safeParse({ ...input, ...change }).success).toBe(false)
    }
  })
  it('supports overnight manual sessions and trims optional fields', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-01T00:00:00Z'))
    const result = completedSessionSchema().parse({ ...input, startTime: '23:30', endDate: '2026-10-29', endTime: '01:00', title: '  Review  ' })
    expect(Date.parse(result.endedAt) - Date.parse(result.startedAt)).toBe(90 * 60_000)
    expect(result.title).toBe('Review')
    expect(result.moduleId).toBeUndefined()
  })
  it('preserves fractional timestamp precision during metadata-only editing, including subsecond sessions', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-01T00:00:00Z'))
    const existing = { id: 'a', startedAt: '2026-10-28T10:00:00.123Z', endedAt: '2026-10-28T10:00:00.789Z' }
    const result = completedSessionSchema(existing).parse({ ...sessionFormValues(existing), title: 'New title' })
    expect(result.startedAt).toBe(existing.startedAt)
    expect(result.endedAt).toBe(existing.endedAt)
  })
  it.skipIf(Intl.DateTimeFormat().resolvedOptions().timeZone !== 'America/New_York')('rejects DST gaps and preserves ambiguous fall-back instants', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2027-01-01T00:00:00Z'))
    expect(completedSessionSchema().safeParse({ ...input, date: '2026-03-08', endDate: '2026-03-08', startTime: '02:30', endTime: '04:00' }).success).toBe(false)
    const existing = { id: 'a', startedAt: '2026-11-01T05:30:00.123Z', endedAt: '2026-11-01T06:30:00.789Z' }
    const result = completedSessionSchema(existing).parse(sessionFormValues(existing))
    expect(result.startedAt).toBe(existing.startedAt)
    expect(result.endedAt).toBe(existing.endedAt)
  })
})
