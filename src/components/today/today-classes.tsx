import { useRef, useState } from 'react'
import { Plus, Pencil } from 'lucide-react'
import type { RescheduledClass } from '@/db/types'
import { Button } from '@/components/ui/button'
import { RescheduledClassEditor } from '@/components/today/rescheduled-class-editor'
import { AttendanceControls } from '@/components/today/attendance-controls'
import { Card } from '@/components/ui/card'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { db } from '@/db/db'
import { getScheduleForDate } from '@/lib/recurrence'
import { classTypes } from '@/lib/schedule-rules'
import { getClassTimeState } from '@/lib/class-time-state'
import { cn } from '@/lib/utils'

export function TodayClasses({ date, localTime, now }: { date: string; localTime: string; now: Date }) {
  const result = useLiveQuery(async () => {
    try {
      const semester = await db.semesters.toCollection().first()
      const modules = semester ? await db.modules.where('semesterId').equals(semester.id).toArray() : []
      const rules = modules.length ? await db.scheduleRules.where('moduleId').anyOf(modules.map(module => module.id)).toArray() : []
      const occurrences = await db.classOccurrences.where('date').equals(date).toArray()
      const rescheduled = modules.length ? await db.rescheduledClasses.where('date').equals(date).filter(item => modules.some(module => module.id === item.moduleId)).toArray() : []
      return { semester, modules, occurrences, rescheduled, rules: getScheduleForDate(rules, date), failed: false }
    } catch { return { semester: undefined, modules: [], occurrences: [], rescheduled: [], rules: [], failed: true } }
  }, [date])

  const [editor, setEditor] = useState<{ record?: RescheduledClass }>()
  const [message, setMessage] = useState('')
  const addButton = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const classes = result ? [
    ...result.rules.map(rule => ({ ...rule, rescheduled: undefined as RescheduledClass | undefined })),
    ...result.rescheduled.map(record => ({ ...record, rescheduled: record })),
  ].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id)) : []
  return <section aria-labelledby="today-classes-heading" className="mt-8 space-y-4">
    <h2 id="today-classes-heading" className="text-lg font-semibold">Today's classes</h2>
    <Button ref={addButton} variant="outline" className="w-full" disabled={!result?.modules.length || result.failed} onClick={() => { previousFocus.current = addButton.current; setEditor({}) }}><Plus aria-hidden="true" />Add rescheduled class</Button>
    {result?.semester && !result.modules.length && <p className="text-sm text-muted-foreground">Add modules in <Link to="/settings" className="underline">Settings</Link> to add a rescheduled class.</p>}
    <p role="status" className="sr-only">{message}</p>
    {result === undefined ? <p role="status" className="text-sm text-muted-foreground">Loading classes…</p> : result.failed ? <p role="alert" className="text-sm text-destructive">Could not load today's classes. Please reload.</p> : classes.length === 0 ? <Card className="gap-3 p-4 shadow-none">
      <p className="font-medium">No classes today</p>
      {!result.semester ? <p className="text-sm text-muted-foreground">Create your semester and modules in <Link to="/settings" className="underline">Settings</Link> to get started.</p> : <Link to="/schedule" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">View schedule</Link>}
    </Card> : <ul className="space-y-3">
      {classes.map(rule => {
        const module = result.modules.find(module => module.id === rule.moduleId)!
        const state = getClassTimeState(rule.startTime, rule.endTime, localTime)
        return <li key={`${rule.rescheduled ? 'one-off' : 'rule'}:${date}:${rule.id}`}><Card className={cn('gap-0 p-4 shadow-none', state === 'current' && 'border-primary/50 bg-accent/40')}>
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-1.5 size-2.5 shrink-0 rounded-full border border-foreground/20 bg-muted" style={module.color ? { backgroundColor: module.color } : undefined} />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className={cn('text-sm font-medium tabular-nums', state === 'completed' && 'text-muted-foreground')}><time dateTime={`${date}T${rule.startTime}`}>{rule.startTime}</time> – <time dateTime={`${date}T${rule.endTime}`}>{rule.endTime}</time></p>
                <span className={cn('text-xs', state === 'current' ? 'font-semibold text-primary' : 'text-muted-foreground')}>{state === 'current' ? 'NOW' : state === 'completed' ? 'Ended' : 'Upcoming'}</span>
              </div>
              <h3 className={cn('break-words font-medium', state === 'completed' && 'text-muted-foreground')}>{module.name}</h3>
              <p className="text-sm text-muted-foreground">{classTypes[rule.type]}</p>
              {rule.rescheduled && <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-primary">Rescheduled · today only</span><Button variant="ghost" className="min-h-11" aria-label={`Edit rescheduled ${module.name}, ${rule.startTime}`} onClick={event => { previousFocus.current = event.currentTarget; setEditor({ record: rule.rescheduled }) }}><Pencil aria-hidden="true" />Edit</Button></div>}
              {rule.location && <p className="break-words text-sm text-muted-foreground">{rule.location}</p>}
            </div>
          </div>
          {rule.rescheduled ? <AttendanceControls rescheduledClass={rule.rescheduled} ended={Date.parse(rule.rescheduled.endAt) <= now.getTime()} label={`${module.name}, ${rule.startTime}, rescheduled`} /> : 'dayOfWeek' in rule && <AttendanceControls rule={rule} date={date} ended={state === 'completed'} label={`${module.name}, ${rule.startTime}`} occurrence={result.occurrences.find(occurrence => occurrence.scheduleRuleId === rule.id)} />}
        </Card></li>
      })}
    </ul>}
    {editor && result && <RescheduledClassEditor key={editor.record?.id ?? date} date={date} modules={result.modules} record={editor.record} onClose={() => setEditor(undefined)} onSaved={setMessage} returnFocus={() => { if (previousFocus.current?.isConnected) previousFocus.current.focus(); else addButton.current?.focus() }} />}
  </section>
}
