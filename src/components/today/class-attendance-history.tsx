import { useRef, useState } from 'react'
import { format } from 'date-fns'
import { Pencil } from 'lucide-react'
import type { ClassOccurrence, Module, RescheduledClass, ScheduleRule } from '@/db/types'
import { AttendanceControls } from '@/components/today/attendance-controls'
import { RescheduledClassEditor } from '@/components/today/rescheduled-class-editor'
import { Button } from '@/components/ui/button'
import { parseCalendarDate, toCalendarDate } from '@/lib/dates'
import { classTypes } from '@/lib/schedule-rules'

type Props = { occurrences: ClassOccurrence[]; rescheduledClasses: RescheduledClass[]; rules: ScheduleRule[]; modules: Module[]; start: Date; end: Date; now: Date }
export function ClassAttendanceHistory({ occurrences, rescheduledClasses, rules, modules, start, end, now }: Props) {
  const [editing, setEditing] = useState<RescheduledClass>(), [message, setMessage] = useState('')
  const previousFocus = useRef<HTMLElement | null>(null), heading = useRef<HTMLHeadingElement>(null)
  const first = toCalendarDate(start), last = toCalendarDate(end), today = toCalendarDate(now)
  const rows = [
    ...occurrences.map(occurrence => ({ occurrence, rescheduled: undefined as RescheduledClass | undefined, rule: rules.find(rule => rule.id === occurrence.scheduleRuleId), ...occurrence })),
    ...rescheduledClasses.map(record => ({ occurrence: undefined, rescheduled: record, rule: undefined, ...record })),
  ].filter(row => row.date >= first && row.date < last && row.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date) || b.startAt.localeCompare(a.startAt) || a.id.localeCompare(b.id))
  return <section aria-labelledby="class-history-heading" className="space-y-3">
    <h2 id="class-history-heading" ref={heading} tabIndex={-1} className="text-lg font-semibold outline-none">Class attendance</h2>
    <p className="text-xs leading-5 text-muted-foreground">Saved attendance and rescheduled classes for this period. Unmarked rescheduled classes remain here so you can record attendance later.</p>
    {!rows.length ? <p className="text-sm text-muted-foreground">No class records in this period.</p> : <ul className="divide-y">{rows.map(row => {
      const module = modules.find(module => module.id === (row.rescheduled?.moduleId ?? row.rule?.moduleId))
      const label = module?.name ?? 'Unavailable module'
      const type = row.rescheduled?.type ?? row.rule?.type
      return <li key={`${row.rescheduled ? 'one-off' : 'rule'}:${row.id}`} className="py-4">
        <div className="flex items-start justify-between gap-2"><div className="min-w-0 space-y-1"><h3 className="break-words font-medium">{label}</h3>
          <p className="text-sm text-muted-foreground">{format(parseCalendarDate(row.date), 'd MMM yyyy')} · {format(new Date(row.startAt), 'HH:mm')} – {format(new Date(row.endAt), 'HH:mm')}</p>
          <p className="text-xs text-muted-foreground">{type ? classTypes[type] : 'Class'}{row.rescheduled ? ' · Rescheduled' : ''}</p></div>
          {row.rescheduled && <Button variant="ghost" aria-label={`Edit rescheduled ${label}, ${row.date}`} onClick={event => { previousFocus.current = event.currentTarget; setEditing(row.rescheduled) }}><Pencil aria-hidden="true" />Edit</Button>}
        </div>
        {row.rescheduled ? <AttendanceControls rescheduledClass={row.rescheduled} ended={Date.parse(row.endAt) <= now.getTime()} label={`${label}, ${row.date}, rescheduled`} /> : row.rule && <AttendanceControls rule={row.rule} date={row.date} occurrence={row.occurrence} ended={Date.parse(row.endAt) <= now.getTime()} label={`${label}, ${row.date}`} />}
      </li>
    })}</ul>}
    <span role="status" className="sr-only">{message}</span>
    {editing && <RescheduledClassEditor key={editing.id} record={editing} modules={modules} date={editing.date} onClose={() => setEditing(undefined)} onSaved={setMessage} returnFocus={() => { if (previousFocus.current?.isConnected) previousFocus.current.focus(); else heading.current?.focus() }} />}
  </section>
}
