import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { format, subDays } from 'date-fns'
import { db } from '@/db/db'
import { useLocalNow } from '@/hooks/use-local-now'
import { calculateInsights, formatInsightsDuration, type InsightsPeriod } from '@/lib/insights'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

function InsightsContent({ period }: { period: InsightsPeriod }) {
  const now = useLocalNow()
  const data = useLiveQuery(async () => {
    try {
      const [sessions, occurrences, rules, modules] = await Promise.all([
        db.workSessions.toArray(), db.classOccurrences.toArray(), db.scheduleRules.toArray(), db.modules.toArray(),
      ])
      return { sessions, occurrences, rules, modules }
    } catch { return null }
  })
  if (data === undefined) return <p role="status" className="py-6 text-sm text-muted-foreground">Loading insights…</p>
  if (data === null) return <p role="alert" className="py-6 text-sm text-destructive">Could not load insights. Please reload.</p>
  const totals = calculateInsights(data, period, now)
  return <div className="space-y-6 pt-3">
    <p className="text-sm text-muted-foreground">{format(totals.start, 'd MMM')} – {format(subDays(totals.end, 1), 'd MMM yyyy')} · so far</p>
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
      <p className="font-medium">No activity yet this {period}.</p>
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
    <p className="text-xs leading-5 text-muted-foreground">Weeks run Monday–Sunday in your device's timezone. Work crossing a boundary contributes only time within this period. Durations are calculated from saved timestamps; no records are generated for insights.</p>
  </div>
}

export function InsightsPage() {
  return <section aria-labelledby="page-heading">
    <h1 id="page-heading" className="text-2xl font-semibold tracking-tight">Insights</h1>
    <Tabs defaultValue="week" className="mt-6">
      <TabsList className="h-11 w-full"><TabsTrigger value="week" className="min-h-10 flex-1">This week</TabsTrigger><TabsTrigger value="month" className="min-h-10 flex-1">This month</TabsTrigger></TabsList>
      <TabsContent value="week"><InsightsContent period="week" /></TabsContent>
      <TabsContent value="month"><InsightsContent period="month" /></TabsContent>
    </Tabs>
  </section>
}
