import { workCategories } from '@/lib/work-categories'
import { addMonths, addWeeks, startOfMonth, startOfWeek } from 'date-fns'
import type { ClassOccurrence, Module, ScheduleRule, WorkSession } from '@/db/types'
import { toCalendarDate } from '@/lib/dates'

export type InsightsPeriod = 'week' | 'month'
export type InsightsData = { sessions: WorkSession[]; occurrences: ClassOccurrence[]; rules: ScheduleRule[]; modules: Module[] }
export type ModuleInsights = { moduleId: string | null; name: string; color?: string; classMs: number; independentMs: number; totalMs: number }

/** Local calendar boundaries: Monday 00:00 → next Monday; month start → next month. */
export function getInsightsPeriod(period: InsightsPeriod, now: Date) {
  const start = period === 'week' ? startOfWeek(now, { weekStartsOn: 1 }) : startOfMonth(now)
  const end = period === 'week' ? addWeeks(start, 1) : addMonths(start, 1)
  return { start, end }
}

function overlap(startedAt: string, endedAt: string, start: number, end: number) {
  const first = Date.parse(startedAt)
  const last = Date.parse(endedAt)
  if (!Number.isFinite(first) || !Number.isFinite(last) || last <= first) return 0
  return Math.max(0, Math.min(last, end) - Math.max(first, start))
}

/**
 * Read-only aggregation across saved records, without generating missed/pending classes.
 * Attendance = attended / (attended + missed), by occurrence's local date label.
 * Productive time = attended class duration + completed independent work (including General).
 * Durations are clipped to the period and now; active sessions are excluded entirely.
 * Durations remain milliseconds until display, so fractional minutes are not lost per row.
 */
export function calculateInsights(data: InsightsData, period: InsightsPeriod, now: Date) {
  const { start, end } = getInsightsPeriod(period, now)
  const firstDate = toCalendarDate(start)
  const endDate = toCalendarDate(end)
  const today = toCalendarDate(now)
  const until = Math.min(end.getTime(), now.getTime())
  const modules = new Map(data.modules.map(module => [module.id, module]))
  const rules = new Map(data.rules.map(rule => [rule.id, rule]))
  const categories = new Map<string, number>()
  const breakdown = new Map<string | null, ModuleInsights>()
  let attended = 0, missed = 0, cancelled = 0, classMs = 0, independentMs = 0, generalMs = 0

  function moduleRow(moduleId: string | null) {
    let row = breakdown.get(moduleId)
    if (!row) {
      const module = moduleId ? modules.get(moduleId) : undefined
      row = { moduleId, name: module?.name ?? (moduleId ? 'Unavailable module' : 'Unassigned classes'), color: module?.color, classMs: 0, independentMs: 0, totalMs: 0 }
      breakdown.set(moduleId, row)
    }
    return row
  }

  for (const occurrence of data.occurrences) {
    const inDateRange = occurrence.date >= firstDate && occurrence.date < endDate && occurrence.date <= today
    if (inDateRange) {
      if (occurrence.status === 'attended') attended++
      if (occurrence.status === 'missed') missed++
      if (occurrence.status === 'cancelled') cancelled++
    }
    if (occurrence.status !== 'attended') continue
    const duration = overlap(occurrence.startAt, occurrence.endAt, start.getTime(), until)
    if (!duration) continue
    classMs += duration
    moduleRow(rules.get(occurrence.scheduleRuleId)?.moduleId ?? null).classMs += duration
  }
  for (const session of data.sessions) {
    if (session.endedAt === undefined) continue
    const duration = overlap(session.startedAt, session.endedAt, start.getTime(), until)
    if (!duration) continue
    independentMs += duration
    if (session.moduleId) moduleRow(session.moduleId).independentMs += duration
    else if (session.category) categories.set(session.category, (categories.get(session.category) ?? 0) + duration)
    else generalMs += duration
  }
  const moduleBreakdown = [...breakdown.values()].map(row => ({ ...row, totalMs: row.classMs + row.independentMs }))
    .sort((a, b) => b.totalMs - a.totalMs || a.name.localeCompare(b.name))
  const countedClasses = attended + missed
  return {
    start, end, attended, missed, cancelled, countedClasses,
    attendancePercent: countedClasses ? Math.round(attended / countedClasses * 100) : null,
    categoryBreakdown: workCategories.filter(item => categories.has(item.value)).map(item => ({ ...item, durationMs: categories.get(item.value)! })),
    classMs, independentMs, generalMs, productiveMs: classMs + independentMs, moduleBreakdown,
    hasData: classMs + independentMs > 0 || countedClasses > 0,
  }
}

export function formatInsightsDuration(milliseconds: number) {
  const minutes = Math.max(0, Math.floor(milliseconds / 60_000))
  const hours = Math.floor(minutes / 60)
  if (!minutes && milliseconds > 0) return '<1m'
  return hours ? `${hours}h${minutes % 60 ? ` ${minutes % 60}m` : ''}` : `${minutes}m`
}
