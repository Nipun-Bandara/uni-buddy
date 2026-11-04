import { describe, expect, it } from 'vitest'
import type { RescheduledClass } from '@/db/types'
import { calculateInsights, getInsightsPeriod } from '@/lib/insights'
import { localDateTimeToIso, toCalendarDate } from '@/lib/dates'
const now = new Date(2026, 10, 4, 18), module = { id: 'm', semesterId: 's', name: 'Data Mining' }
function oneOff(id: string, date: string, status: RescheduledClass['status']): RescheduledClass {
  return { id, moduleId: 'm', type: 'lecture', date, startTime: '10:00', endTime: '12:00', startAt: localDateTimeToIso(date, '10:00'), endAt: localDateTimeToIso(date, '12:00'), status }
}
describe('past productivity periods', () => {
  it('counts one-off attended/missed classes, excludes cancelled/pending and keeps original cancellation separate', () => {
    const result = calculateInsights({ modules: [module], rules: [], sessions: [], occurrences: [{ id: 'cancelled-original', scheduleRuleId: 'old', date: '2026-10-28', status: 'cancelled', startAt: localDateTimeToIso('2026-10-28', '08:00'), endAt: localDateTimeToIso('2026-10-28', '10:00') }], rescheduledClasses: [oneOff('a', '2026-10-28', 'attended'), oneOff('b', '2026-10-29', 'missed'), oneOff('c', '2026-10-30', 'cancelled'), oneOff('d', '2026-10-31', 'pending'), oneOff('outside', '2026-11-03', 'attended')] }, 'week', now, new Date(2026, 9, 28))
    expect(result.attended).toBe(1); expect(result.missed).toBe(1); expect(result.cancelled).toBe(2); expect(result.attendancePercent).toBe(50)
    expect(result.productiveMs).toBe(7200000); expect(result.moduleBreakdown[0].classMs).toBe(7200000)
    expect(toCalendarDate(result.start)).toBe('2026-10-26'); expect(toCalendarDate(result.end)).toBe('2026-11-02')
  })
  it('clips a boundary-spanning session into the chosen past month rather than the current month', () => {
    const data = { sessions: [{ id: 'w', category: 'competitions' as const, startedAt: localDateTimeToIso('2026-10-31', '23:00'), endedAt: localDateTimeToIso('2026-11-01', '01:00') }], modules: [], rules: [], occurrences: [] }
    const october = calculateInsights(data, 'month', now, new Date(2026, 9, 15))
    expect(october.productiveMs).toBe(3600000); expect(october.categoryBreakdown[0].durationMs).toBe(3600000)
    expect(calculateInsights(data, 'month', now).productiveMs).toBe(3600000)
  })
  it('handles year transitions, leap months, empty past periods and real-now clipping', () => {
    expect(toCalendarDate(getInsightsPeriod('week', new Date(2027, 0, 1)).start)).toBe('2026-12-28')
    expect(toCalendarDate(getInsightsPeriod('month', new Date(2024, 1, 29)).end)).toBe('2024-03-01')
    const data = { modules: [], rules: [], occurrences: [], sessions: [] }
    expect(calculateInsights(data, 'week', now, new Date(2020, 0, 1)).hasData).toBe(false)
    const future = { ...data, rescheduledClasses: [oneOff('future', '2026-11-05', 'attended')] }
    expect(calculateInsights(future, 'week', now).attended).toBe(0)
    expect(calculateInsights(future, 'week', now).productiveMs).toBe(0)
  })
})
