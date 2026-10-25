import { Card } from '@/components/ui/card'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { db } from '@/db/db'
import { getScheduleForDate } from '@/lib/recurrence'
import { classTypes } from '@/lib/schedule-rules'
import { getClassTimeState } from '@/lib/class-time-state'
import { cn } from '@/lib/utils'

export function TodayClasses({ date, localTime }: { date: string; localTime: string }) {
  const result = useLiveQuery(async () => {
    try {
      const semester = await db.semesters.toCollection().first()
      const modules = semester ? await db.modules.where('semesterId').equals(semester.id).toArray() : []
      const rules = modules.length ? await db.scheduleRules.where('moduleId').anyOf(modules.map(module => module.id)).toArray() : []
      return { semester, modules, rules: getScheduleForDate(rules, date), failed: false }
    } catch { return { semester: undefined, modules: [], rules: [], failed: true } }
  }, [date])

  return <section aria-labelledby="today-classes-heading" className="mt-8 space-y-4">
    <h2 id="today-classes-heading" className="text-lg font-semibold">Today's classes</h2>
    {result === undefined ? <p role="status" className="text-sm text-muted-foreground">Loading classes…</p> : result.failed ? <p role="alert" className="text-sm text-destructive">Could not load today's classes. Please reload.</p> : result.rules.length === 0 ? <Card className="gap-3 p-4 shadow-none">
      <p className="font-medium">No classes today</p>
      {!result.semester ? <p className="text-sm text-muted-foreground">Create your semester and modules in <Link to="/settings" className="underline">Settings</Link> to get started.</p> : <Link to="/schedule" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">View schedule</Link>}
    </Card> : <ul className="space-y-3">
      {result.rules.map(rule => {
        const module = result.modules.find(module => module.id === rule.moduleId)!
        const state = getClassTimeState(rule.startTime, rule.endTime, localTime)
        return <li key={rule.id}><Card className={cn('gap-0 p-4 shadow-none', state === 'current' && 'border-primary/50 bg-accent/40')}>
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-1.5 size-2.5 shrink-0 rounded-full border border-foreground/20 bg-muted" style={module.color ? { backgroundColor: module.color } : undefined} />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className={cn('text-sm font-medium tabular-nums', state === 'completed' && 'text-muted-foreground')}><time dateTime={`${date}T${rule.startTime}`}>{rule.startTime}</time> – <time dateTime={`${date}T${rule.endTime}`}>{rule.endTime}</time></p>
                <span className={cn('text-xs', state === 'current' ? 'font-semibold text-primary' : 'text-muted-foreground')}>{state === 'current' ? 'NOW' : state === 'completed' ? 'Ended' : 'Upcoming'}</span>
              </div>
              <h3 className={cn('break-words font-medium', state === 'completed' && 'text-muted-foreground')}>{module.name}</h3>
              <p className="text-sm text-muted-foreground">{classTypes[rule.type]}</p>
              {rule.location && <p className="break-words text-sm text-muted-foreground">{rule.location}</p>}
            </div>
          </div>
        </Card></li>
      })}
    </ul>}
  </section>
}
