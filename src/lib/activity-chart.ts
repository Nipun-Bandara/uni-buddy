import { addDays, addWeeks, format, max as latest, min as earliest, startOfWeek, subDays } from 'date-fns'
import type { SleepSession } from '@/db/types'
import { toCalendarDate } from '@/lib/dates'
import { calculateRangeInsights, getInsightsPeriod, type InsightsData } from '@/lib/insights'
import { sleepInDateRange } from '@/lib/sleep'
import { workCategories } from '@/lib/work-categories'

export type ChartPeriod = 'week' | 'month'
export type ActivitySeries = { key: string; name: string; color: string }
export type ActivityBucket = {
  key: string
  /** Short axis label, e.g. "Mon" or "3–9". */
  label: string
  /** Longer label for tooltips and detail headings. */
  title: string
  start: Date
  end: Date
  sleepMs: number
  workMs: number
  /** Productive milliseconds per series key (module / category / general). */
  segments: Record<string, number>
}

/** Fixed identity colors for non-module work; modules keep their own chosen color. */
export const categoryColors: Record<string, string> = {
  competitions: '#0891b2',
  'project-development': '#65a30d',
  'university-work': '#c026d3',
}
export const generalColor = '#78716c'
export const noModuleColor = '#a1a1aa'

/** Week → 7 daily buckets. Month → Monday–Sunday weeks, clipped to the month. */
export function chartBuckets(period: ChartPeriod, referenceDate: Date) {
  const { start, end } = getInsightsPeriod(period, referenceDate)
  const buckets: { start: Date; end: Date; label: string; title: string }[] = []
  if (period === 'week') {
    for (let day = start; day < end; day = addDays(day, 1)) buckets.push({ start: day, end: addDays(day, 1), label: format(day, 'EEE'), title: format(day, 'EEEE d MMM') })
  } else {
    for (let week = startOfWeek(start, { weekStartsOn: 1 }); week < end; week = addWeeks(week, 1)) {
      const first = latest([week, start]); const last = earliest([addWeeks(week, 1), end])
      const label = `${format(first, 'd')}–${format(subDays(last, 1), 'd')}`
      buckets.push({ start: first, end: last, label, title: `${format(first, 'd MMM')} – ${format(subDays(last, 1), 'd MMM')}` })
    }
  }
  return buckets
}

export function moduleSeriesKey(moduleId: string | null) { return moduleId ? `module:${moduleId}` : 'module:none' }

/**
 * Per-bucket sleep (by wake-up date) and productive time (attended classes + completed work,
 * clipped to the bucket). Series appear only when they have time, in a stable order.
 */
export function buildActivityChart(data: InsightsData, sleeps: SleepSession[], period: ChartPeriod, referenceDate: Date, now: Date) {
  const names = new Map<string, ActivitySeries>()
  const buckets: ActivityBucket[] = chartBuckets(period, referenceDate).map(bucket => {
    const totals = calculateRangeInsights(data, bucket.start, bucket.end, now)
    const segments: Record<string, number> = {}
    for (const row of totals.moduleBreakdown) {
      if (!row.totalMs) continue
      const key = moduleSeriesKey(row.moduleId)
      segments[key] = row.totalMs
      names.set(key, { key, name: row.name, color: row.color ?? noModuleColor })
    }
    for (const row of totals.categoryBreakdown) {
      const key = `category:${row.value}`
      segments[key] = row.durationMs
      names.set(key, { key, name: row.label, color: categoryColors[row.value] })
    }
    if (totals.generalMs) { segments.general = totals.generalMs; names.set('general', { key: 'general', name: 'General', color: generalColor }) }
    const sleep = sleepInDateRange(sleeps, toCalendarDate(bucket.start), toCalendarDate(bucket.end))
    return { ...bucket, key: toCalendarDate(bucket.start), sleepMs: sleep.totalMs, workMs: totals.productiveMs, segments }
  })
  const moduleOrder = new Map([...data.modules].sort((a, b) => a.name.localeCompare(b.name)).map((module, index) => [moduleSeriesKey(module.id), index]))
  const rank = (key: string) => key.startsWith('module:') ? (moduleOrder.get(key) ?? moduleOrder.size)
    : key.startsWith('category:') ? 1000 + workCategories.findIndex(item => `category:${item.value}` === key) : 2000
  const series = [...names.values()].sort((a, b) => rank(a.key) - rank(b.key) || a.name.localeCompare(b.name))
  return { buckets, series }
}
