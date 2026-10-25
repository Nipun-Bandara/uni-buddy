import { describe, it, expect } from 'vitest'
import type { ClassOccurrence, ScheduleRule, WorkSession } from '@/db/types'
import { calculateInsights, formatInsightsDuration, getInsightsPeriod, type InsightsData } from '@/lib/insights'
import { localDateTimeToIso, toCalendarDate } from '@/lib/dates'

const now = new Date(2026, 9, 29, 22)
const hour = 3_600_000
function work(id: string, date: string, start: string, end: string, moduleId?: string): WorkSession {
  return { id, moduleId, startedAt: localDateTimeToIso(date, start), endedAt: localDateTimeToIso(date, end) }
}
function occurrence(id: string, rule: string, date: string, status: ClassOccurrence['status'], start = '10:00', end = '12:00'): ClassOccurrence {
  return { id, scheduleRuleId: rule, date, status, startAt: localDateTimeToIso(date, start), endAt: localDateTimeToIso(date, end) }
}
function fixture(): InsightsData {
  const base: ScheduleRule = { id: 'dm', moduleId: 'dm', type: 'lecture', dayOfWeek: 0, startTime: '10:00', endTime: '12:00', repeatEveryWeeks: 1, anchorDate: '2026-10-26', startDate: '2026-10-01', endDate: '2027-02-28' }
  return {
    modules: [{ id: 'dm', semesterId: 's', name: 'Data Mining', color: '#3b82f6' }, { id: 'se', semesterId: 's', name: 'Software Engineering' }],
    rules: [base, { ...base, id: 'se', moduleId: 'se' }, { ...base, id: 'dm-tuesday' }, { ...base, id: 'dm-missed' }, { ...base, id: 'se-cancelled', moduleId: 'se' }, { ...base, id: 'dm-pending' }],
    occurrences: [
      occurrence('a', 'dm', '2026-10-26', 'attended'), occurrence('b', 'dm-tuesday', '2026-10-27', 'attended'),
      occurrence('c', 'se', '2026-10-28', 'attended'), occurrence('d', 'dm-missed', '2026-10-29', 'missed'),
      occurrence('e', 'se-cancelled', '2026-10-28', 'cancelled', '12:00', '16:00'), occurrence('f', 'dm-pending', '2026-10-29', 'pending'),
      occurrence('older', 'se', '2026-10-20', 'attended'),
    ],
    sessions: [work('module', '2026-10-27', '13:00', '18:20', 'dm'), work('general', '2026-10-28', '16:00', '18:10'), work('older', '2026-10-20', '13:00', '14:00')],
  }
}
const empty: InsightsData = { sessions: [], occurrences: [], modules: [], rules: [] }

describe('insights calculations', () => {
  it('matches a hand-calculated week: 6h classes + 7h30 work = 13h30, attendance 3/4 = 75%', () => {
    const result = calculateInsights(fixture(), 'week', now)
    expect(result.classMs).toBe(6 * hour)
    expect(result.independentMs).toBe(7.5 * hour)
    expect(result.productiveMs).toBe(13.5 * hour)
    expect(result.generalMs).toBe((2 * 60 + 10) * 60_000)
    expect([result.attended, result.missed, result.cancelled, result.countedClasses, result.attendancePercent]).toEqual([3, 1, 1, 4, 75])
    expect(result.moduleBreakdown.map(row => [row.name, formatInsightsDuration(row.classMs), formatInsightsDuration(row.independentMs), formatInsightsDuration(row.totalMs)])).toEqual([
      ['Data Mining', '4h', '5h 20m', '9h 20m'], ['Software Engineering', '2h', '0m', '2h'],
    ])
  })
  it('includes earlier-month records in This month: 16h30 and 4/5 = 80%', () => {
    const result = calculateInsights(fixture(), 'month', now)
    expect(result.productiveMs).toBe(16.5 * hour)
    expect([result.attended, result.countedClasses, result.attendancePercent]).toEqual([4, 5, 80])
    expect(formatInsightsDuration(result.generalMs)).toBe('3h 10m')
  })
  it('excludes active work, pending/missed/cancelled class time, and unrecorded rules', () => {
    const data = fixture()
    data.sessions.push({ id: 'active', startedAt: localDateTimeToIso('2026-10-26', '00:00'), moduleId: 'dm' })
    const result = calculateInsights(data, 'week', now)
    expect(result.productiveMs).toBe(13.5 * hour)
    expect(result.countedClasses).toBe(4)
    expect(calculateInsights({ ...empty, rules: data.rules }, 'week', now).countedClasses).toBe(0)
  })
  it('uses no percentage rather than a misleading zero when no attended/missed records exist', () => {
    const result = calculateInsights(empty, 'week', now)
    expect(result.attendancePercent).toBeNull()
    expect(result.productiveMs).toBe(0)
    expect(result.countedClasses).toBe(0)
    expect(result.moduleBreakdown).toEqual([])
    expect(result.hasData).toBe(false)
    const cancelled = calculateInsights({ ...empty, occurrences: [occurrence('x', 'missing', '2026-10-28', 'cancelled')] }, 'week', now)
    expect(cancelled.attendancePercent).toBeNull(); expect(cancelled.classMs).toBe(0)
  })
  it('distinguishes 0% missed attendance from an empty denominator and rounds 13/15 to 87%', () => {
    expect(calculateInsights({ ...empty, occurrences: [occurrence('m', 'r', '2026-10-28', 'missed')] }, 'week', now).attendancePercent).toBe(0)
    const occurrences = Array.from({ length: 15 }, (_, index) => occurrence(String(index), `r${index}`, '2026-10-28', index < 13 ? 'attended' : 'missed'))
    expect(calculateInsights({ ...empty, occurrences }, 'week', now).attendancePercent).toBe(87)
  })
  it('counts only the overlap for work crossing Monday or month start', () => {
    const weekly = { id: 'w', startedAt: localDateTimeToIso('2026-10-25', '23:30'), endedAt: localDateTimeToIso('2026-10-26', '00:30') }
    expect(calculateInsights({ ...empty, sessions: [weekly] }, 'week', now).generalMs).toBe(0.5 * hour)
    const monthly = { id: 'm', startedAt: localDateTimeToIso('2026-09-30', '23:30'), endedAt: localDateTimeToIso('2026-10-01', '00:30') }
    expect(calculateInsights({ ...empty, sessions: [monthly] }, 'month', now).generalMs).toBe(0.5 * hour)
  })
  it('caps time at now and excludes future attendance dates', () => {
    const data = { ...empty, sessions: [work('x', '2026-10-29', '21:00', '23:00')], occurrences: [occurrence('future', 'r', '2026-10-30', 'attended')] }
    const result = calculateInsights(data, 'week', now)
    expect(result.generalMs).toBe(hour)
    expect(result.attended).toBe(0)
    expect(result.classMs).toBe(0)
  })
  it('sums partial minutes before formatting rather than losing them per session', () => {
    const sessions = [work('a', '2026-10-28', '10:00:00', '10:00:40'), work('b', '2026-10-28', '11:00:00', '11:00:40')]
    const result = calculateInsights({ ...empty, sessions }, 'week', now)
    expect(result.generalMs).toBe(80_000)
    expect(formatInsightsDuration(result.generalMs)).toBe('1m')
    expect(formatInsightsDuration(40_000)).toBe('<1m')
  })
  it('does not lose totals if an old module/rule is missing', () => {
    const result = calculateInsights({ ...empty, sessions: [work('a', '2026-10-28', '10:00', '11:00', 'gone')], occurrences: [occurrence('a', 'gone-rule', '2026-10-28', 'attended')] }, 'week', now)
    expect(result.productiveMs).toBe(3 * hour)
    expect(result.moduleBreakdown.map(row => row.name)).toEqual(['Unassigned classes', 'Unavailable module'])
    expect(result.generalMs).toBe(0)
  })
  it('ignores malformed/reversed timestamp durations and leaves input unchanged', () => {
    const data = fixture()
    const snapshot = structuredClone(data)
    calculateInsights(data, 'week', now)
    expect(data).toEqual(snapshot)
    const malformed = [{ id: 'bad', startedAt: 'bad', endedAt: 'bad' }, { id: 'reversed', startedAt: '2026-10-28T12:00:00Z', endedAt: '2026-10-28T10:00:00Z' }]
    expect(calculateInsights({ ...empty, sessions: malformed }, 'week', now).productiveMs).toBe(0)
  })
})

describe('insights period boundaries', () => {
  it('uses Monday through Sunday, including Sunday and excluding next Monday', () => {
    const sunday = new Date(2026, 10, 1, 22)
    const { start, end } = getInsightsPeriod('week', sunday)
    expect(toCalendarDate(start)).toBe('2026-10-26')
    expect(toCalendarDate(end)).toBe('2026-11-02')
    const result = calculateInsights({ ...empty, occurrences: [occurrence('mon', 'r', '2026-10-26', 'attended'), occurrence('sun', 'r', '2026-11-01', 'missed'), occurrence('next', 'r', '2026-11-02', 'attended')] }, 'week', sunday)
    expect([result.attended, result.missed]).toEqual([1, 1])
  })
  it('uses local midnight for weeks across years and leap-year months', () => {
    const week = getInsightsPeriod('week', new Date(2027, 0, 1, 12))
    expect([toCalendarDate(week.start), toCalendarDate(week.end)]).toEqual(['2026-12-28', '2027-01-04'])
    expect(week.start.getHours()).toBe(0)
    const month = getInsightsPeriod('month', new Date(2024, 1, 29, 12))
    expect([toCalendarDate(month.start), toCalendarDate(month.end)]).toEqual(['2024-02-01', '2024-03-01'])
  })
  it.skipIf(Intl.DateTimeFormat().resolvedOptions().timeZone !== 'America/New_York')('uses calendar weeks and actual elapsed durations across DST', () => {
    const spring = getInsightsPeriod('week', new Date(2026, 2, 8, 12))
    const fall = getInsightsPeriod('week', new Date(2026, 10, 1, 12))
    expect((spring.end.getTime() - spring.start.getTime()) / hour).toBe(167)
    expect((fall.end.getTime() - fall.start.getTime()) / hour).toBe(169)
    const sessions = [work('dst', '2026-11-01', '00:30', '02:30')]
    expect(calculateInsights({ ...empty, sessions }, 'week', new Date(2026, 10, 1, 12)).generalMs).toBe(3 * hour)
  })
})
