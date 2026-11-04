import { useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { calendarDateSchema, parseCalendarDate, toCalendarDate } from '@/lib/dates'
import { ClassAttendanceHistory } from '@/components/today/class-attendance-history'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { addMonths, addWeeks, format, subDays } from 'date-fns'
import { db } from '@/db/db'
import { useLocalNow } from '@/hooks/use-local-now'
import { calculateInsights, formatInsightsDuration, getInsightsPeriod, type InsightsPeriod } from '@/lib/insights'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

function InsightsContent({ period, referenceDate }: { period: InsightsPeriod; referenceDate: Date }) {
  const now = useLocalNow()
  const data = useLiveQuery(async () => {
    try {
      const [sessions, occurrences, rules, modules, rescheduledClasses] = await Promise.all([
        db.workSessions.toArray(), db.classOccurrences.toArray(), db.scheduleRules.toArray(), db.modules.toArray(), db.rescheduledClasses.toArray(),
      ])
      return { sessions, occurrences, rules, modules, rescheduledClasses }
    } catch { return null }
  })
  if (data === undefined) return <p role="status" className="py-6 text-sm text-muted-foreground">Loading insights…</p>
  if (data === null) return <p role="alert" className="py-6 text-sm text-destructive">Could not load insights. Please reload.</p>
  const totals = calculateInsights(data, period, now, referenceDate)
  const current = getInsightsPeriod(period, now).start.getTime() === totals.start.getTime()
  return <div className="space-y-6 pt-3">
    <p className="text-sm text-muted-foreground">{format(totals.start, 'd MMM')} – {format(subDays(totals.end, 1), 'd MMM yyyy')}{current ? ' · so far' : ''}</p>
    <Card className="gap-4 p-5 shadow-none">
      <dl className="space-y-4">
        <div className="border-b pb-4"><dt className="text-sm text-muted-foreground">Productive time</dt><dd className="mt-1 text-3xl font-semibold tabular-nums">{formatInsightsDuration(totals.productiveMs)}</dd></div>
        <div className="grid grid-cols-2 gap-4">
          <div><dt className="text-sm text-muted-foreground">Attendance</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{totals.attendancePercent === null ? '—' : `${totals.attendancePercent}%`}</dd></div>
          <div><dt className="text-sm text-muted-foreground">Classes</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{totals.attended} / {totals.countedClasses}</dd></div>
        </div>
      </dl>
      <p className="text-xs leading-5 text-muted-foreground">Productive time includes attended classes and completed work. Attendance is attended ÷ (attended + missed); pending and cancelled classes are excluded.</p>
      {totals.cancelled > 0 && <p className="text-xs text-muted-foreground">{totals.cancelled} cancelled {totals.cancelled === 1 ? 'class' : 'classes'} excluded.</p>}
    </Card>
    {!totals.hasData && <div className="space-y-2">
      <p className="font-medium">No productive time or counted attendance for this {period}.</p>
      <p className="text-sm leading-6 text-muted-foreground">Complete a work session or record attended/missed classes to see insights. Active timers and unrecorded classes are not included.</p>
      <Link to="/" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Go to Today</Link>
    </div>}
    <section aria-labelledby={`module-insights-${period}`} className="space-y-3">
      <h2 id={`module-insights-${period}`} className="text-lg font-semibold">By module</h2>
      {totals.moduleBreakdown.length ? <ul className="divide-y">{totals.moduleBreakdown.map(module => <li key={module.moduleId ?? 'unassigned-classes'} className="space-y-3 py-4">
        <h3 className="flex items-center gap-2 font-medium"><span aria-hidden="true" className="size-2.5 shrink-0 rounded-full border border-foreground/20 bg-muted" style={module.color ? { backgroundColor: module.color } : undefined} /><span className="min-w-0 break-words">{module.name}</span></h3>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div><dt className="text-xs text-muted-foreground">Class time</dt><dd className="mt-1 tabular-nums">{formatInsightsDuration(module.classMs)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Independent work</dt><dd className="mt-1 tabular-nums">{formatInsightsDuration(module.independentMs)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Total</dt><dd className="mt-1 font-medium tabular-nums">{formatInsightsDuration(module.totalMs)}</dd></div>
        </dl>
        <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, module.totalMs / Math.max(1, totals.productiveMs) * 100)}%` }} /></div>
      </li>)}</ul> : <p className="text-sm text-muted-foreground">No module time recorded in this period.</p>}
    </section>
    <section aria-labelledby={`general-insights-${period}`} className="border-t pt-4">
      <h2 id={`general-insights-${period}`} className="text-lg font-semibold">General</h2>
      <p className="mt-1 text-xl font-medium tabular-nums">{formatInsightsDuration(totals.generalMs)}</p>
      <p className="mt-1 text-xs text-muted-foreground">Completed work without a module or work category.</p>
    </section>
    {totals.categoryBreakdown.map(item => <section key={item.value} aria-label={`${item.label} work`} className="border-t pt-4">
      <h2 className="text-lg font-semibold">{item.label}</h2>
      <p className="mt-1 text-xl font-medium tabular-nums">{formatInsightsDuration(item.durationMs)}</p>
    </section>)}
    <ClassAttendanceHistory occurrences={data.occurrences} rescheduledClasses={data.rescheduledClasses} rules={data.rules} modules={data.modules} start={totals.start} end={totals.end} now={now} />
    <p className="text-xs leading-5 text-muted-foreground">Weeks run Monday–Sunday in your device's timezone. Work crossing a boundary contributes only time within this period. Durations are calculated from saved timestamps; no records are generated for insights.</p>
  </div>
}

export function InsightsPage() {
  const now = useLocalNow()
  const [params, setParams] = useSearchParams()
  const period: InsightsPeriod = params.get('period') === 'month' ? 'month' : 'week'
  const value = params.get('date') ?? ''
  const today = toCalendarDate(now)
  const selectedDate = calendarDateSchema.safeParse(value).success && value <= today ? value : today
  const referenceDate = parseCalendarDate(selectedDate)
  const { start, end } = getInsightsPeriod(period, referenceDate)
  const currentStart = getInsightsPeriod(period, now).start
  const isCurrent = start.getTime() === currentStart.getTime()
  const move = (amount: number) => toCalendarDate(period === 'week' ? addWeeks(start, amount) : addMonths(start, amount))
  function select(date: string, nextPeriod: InsightsPeriod = period) { setParams({ period: nextPeriod, date }) }
  return <section aria-labelledby="page-heading">
    <h1 id="page-heading" className="text-2xl font-semibold tracking-tight">Insights</h1>
    <Tabs value={period} onValueChange={value => select(selectedDate, value as InsightsPeriod)} className="mt-6">
      <TabsList className="h-11 w-full"><TabsTrigger value="week" className="min-h-10 flex-1">Week</TabsTrigger><TabsTrigger value="month" className="min-h-10 flex-1">Month</TabsTrigger></TabsList>
      <div className="mt-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" aria-label={`Previous ${period}`} onClick={() => select(move(-1))}><ChevronLeft aria-hidden="true" /></Button>
          <h2 aria-live="polite" className="min-w-0 text-center text-sm font-semibold">{period === 'month' ? format(start, 'MMMM yyyy') : `${format(start, 'd MMM')} – ${format(subDays(end, 1), 'd MMM yyyy')}`}</h2>
          <Button variant="outline" aria-label={`Next ${period}`} disabled={isCurrent} onClick={() => select(move(1))}><ChevronRight aria-hidden="true" /></Button>
        </div>
        <div className="space-y-2"><label htmlFor="insights-date" className="text-sm font-medium">{period === 'week' ? 'Choose a date in the week' : 'Choose a date in the month'}</label>
          <DatePicker id="insights-date" name="date" label={period === 'week' ? 'Week date' : 'Month date'} value={selectedDate} maxDate={today} onChange={date => select(date)} />
        </div>
        <Button variant="ghost" className="w-full" disabled={isCurrent} onClick={() => setParams({ period })}>{period === 'week' ? 'Current week' : 'Current month'}</Button>
      </div>
      <TabsContent value="week"><InsightsContent period="week" referenceDate={referenceDate} /></TabsContent>
      <TabsContent value="month"><InsightsContent period="month" referenceDate={referenceDate} /></TabsContent>
    </Tabs>
  </section>
}
