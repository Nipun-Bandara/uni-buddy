import { describe, expect, it } from 'vitest'
import { buildActivityChart, chartBuckets } from '@/lib/activity-chart'
import { localDateTimeToIso } from '@/lib/dates'
import type { InsightsData } from '@/lib/insights'

const at = (date: string, time: string) => localDateTimeToIso(date, time)
const now = new Date(at('2026-11-18', '20:00'))

describe('activity chart', () => {
  it('builds 7 daily buckets for a week and Monday–Sunday buckets clipped to the month', () => {
    expect(chartBuckets('week', new Date(at('2026-11-18', '12:00'))).map(bucket => bucket.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    // November 2026 starts on a Sunday and ends on a Monday.
    expect(chartBuckets('month', new Date(at('2026-11-18', '12:00'))).map(bucket => bucket.label)).toEqual(['1–1', '2–8', '9–15', '16–22', '23–29', '30–30'])
  })

  it('puts sleep on the wake-up day and stacks work by module, category and general', () => {
    const data: InsightsData = {
      modules: [{ id: 'm', semesterId: 's', name: 'Data Mining', color: '#3b82f6' }],
      rules: [{ id: 'r', moduleId: 'm', type: 'lecture', dayOfWeek: 1, startTime: '10:00', endTime: '12:00', repeatEveryWeeks: 1, anchorDate: '2026-11-17', startDate: '2026-11-01', endDate: '2026-12-31' }],
      occurrences: [{ id: 'o', scheduleRuleId: 'r', date: '2026-11-17', startAt: at('2026-11-17', '10:00'), endAt: at('2026-11-17', '12:00'), status: 'attended' }],
      sessions: [
        { id: 'a', moduleId: 'm', startedAt: at('2026-11-17', '14:00'), endedAt: at('2026-11-17', '15:00') },
        { id: 'b', category: 'competitions', startedAt: at('2026-11-17', '16:00'), endedAt: at('2026-11-17', '16:30') },
        { id: 'c', startedAt: at('2026-11-17', '17:00'), endedAt: at('2026-11-17', '17:15') },
      ],
    }
    const sleeps = [{ id: 's', startedAt: at('2026-11-16', '23:00'), endedAt: at('2026-11-17', '06:00') }]
    const { buckets, series } = buildActivityChart(data, sleeps, 'week', new Date(at('2026-11-18', '12:00')), now)
    const tuesday = buckets[1]
    expect(buckets[0].sleepMs).toBe(0)
    expect(tuesday.sleepMs).toBe(7 * 3_600_000)
    expect(tuesday.segments).toEqual({ 'module:m': 3 * 3_600_000, 'category:competitions': 30 * 60_000, general: 15 * 60_000 })
    expect(series.map(item => item.key)).toEqual(['module:m', 'category:competitions', 'general'])
  })
})
