import { useRef, useState } from 'react'
import { format } from 'date-fns'
import { ChevronRight, Plus } from 'lucide-react'
import type { SleepSession } from '@/db/types'
import { categoryColors, generalColor } from '@/lib/activity-chart'
import { formatInsightsDuration, type calculateRangeInsights } from '@/lib/insights'
import { sleepDurationMs } from '@/lib/sleep'
import { workCategories } from '@/lib/work-categories'
import { SleepEditor } from '@/components/sleep/sleep-editor'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

type Totals = ReturnType<typeof calculateRangeInsights>
type Sleep = { sessions: SleepSession[]; totalMs: number; nights: number }

function Swatch({ color }: { color?: string }) {
  return <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full border border-foreground/20 bg-muted" style={color ? { backgroundColor: color } : undefined} />
}

/** Sleep records for one wake-up date, with add/edit/delete. */
export function SleepRecords({ date, sessions, allowAdd }: { date: string; sessions: SleepSession[]; allowAdd: boolean }) {
  const [editor, setEditor] = useState<{ session?: SleepSession }>()
  const [message, setMessage] = useState('')
  const addButton = useRef<HTMLButtonElement>(null)
  const sorted = [...sessions].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))
  return <div className="space-y-2">
    {sorted.length ? <ul className="divide-y">{sorted.map(session => <li key={session.id}>
      <button type="button" onClick={() => setEditor({ session })} aria-label={`Edit sleep ${format(new Date(session.startedAt), 'd MMM p')} to ${format(new Date(session.endedAt!), 'd MMM p')}`}
        className="flex min-h-12 w-full items-center gap-3 rounded-md px-1 py-2 text-left text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
        <span className="flex-1"><span className="font-medium tabular-nums">{formatInsightsDuration(sleepDurationMs(session))}</span>
          <span className="block text-muted-foreground"><time dateTime={session.startedAt}>{format(new Date(session.startedAt), 'EEE p')}</time> – <time dateTime={session.endedAt}>{format(new Date(session.endedAt!), 'EEE p')}</time></span></span>
        <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
      </button></li>)}</ul> : <p className="text-sm text-muted-foreground">No sleep recorded for this day.</p>}
    {allowAdd && <Button ref={addButton} variant="outline" className="min-h-11 w-full" onClick={() => setEditor({})}><Plus aria-hidden="true" />Add sleep</Button>}
    <p role="status" className="sr-only">{message}</p>
    {editor && <SleepEditor session={editor.session} wakeDate={date} onClose={() => setEditor(undefined)} onSaved={setMessage} returnFocus={() => addButton.current?.focus()} />}
  </div>
}

/** Sleep and productive time per module / work category for a selected day or week. */
export function ActivityBreakdown({ title, totals, sleep, date }: { title: string; totals: Totals; sleep: Sleep; date?: string }) {
  const nightly = sleep.nights ? sleep.totalMs / sleep.nights : 0
  return <Card className="gap-4 p-4 shadow-none" aria-label={`Details for ${title}`}>
    <h3 className="font-semibold">{title}</h3>
    <dl className="grid grid-cols-2 gap-4">
      <div><dt className="flex items-center gap-1.5 text-sm text-muted-foreground"><span aria-hidden="true" className="size-2.5 rounded-sm bg-sleep" />Sleep</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{formatInsightsDuration(sleep.totalMs)}</dd>
        {!date && sleep.nights > 0 && <dd className="text-xs text-muted-foreground">{formatInsightsDuration(nightly)} avg over {sleep.nights} {sleep.nights === 1 ? 'day' : 'days'}</dd>}</div>
      <div><dt className="text-sm text-muted-foreground">Work</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{formatInsightsDuration(totals.productiveMs)}</dd>
        <dd className="text-xs text-muted-foreground">{formatInsightsDuration(totals.classMs)} classes · {formatInsightsDuration(totals.independentMs)} sessions</dd></div>
    </dl>
    {date && <section aria-label="Sleep records" className="space-y-1 border-t pt-3"><h4 className="text-sm font-medium">Sleep records</h4><SleepRecords date={date} sessions={sleep.sessions} allowAdd /></section>}
    <section aria-label="Work by module" className="space-y-2 border-t pt-3">
      <h4 className="text-sm font-medium">Modules</h4>
      {totals.moduleBreakdown.some(row => row.totalMs) ? <ul className="space-y-2">{totals.moduleBreakdown.filter(row => row.totalMs).map(row => <li key={row.moduleId ?? 'none'} className="text-sm">
        <p className="flex items-center gap-2"><Swatch color={row.color} /><span className="min-w-0 flex-1 break-words">{row.name}</span><span className="font-medium tabular-nums">{formatInsightsDuration(row.totalMs)}</span></p>
        <p className="pl-4.5 text-xs text-muted-foreground">{formatInsightsDuration(row.classMs)} classes · {formatInsightsDuration(row.independentMs)} sessions</p>
      </li>)}</ul> : <p className="text-sm text-muted-foreground">No module time.</p>}
    </section>
    <section aria-label="Other work" className="space-y-2 border-t pt-3">
      <h4 className="text-sm font-medium">Competitions & other work</h4>
      <ul className="space-y-2 text-sm">
        {workCategories.map(({ value, label }) => {
          const row = totals.categoryBreakdown.find(item => item.value === value)
          return <li key={value} className="flex items-center gap-2"><Swatch color={categoryColors[value]} /><span className="flex-1">{label}</span><span className="tabular-nums">{formatInsightsDuration(row?.durationMs ?? 0)}</span></li>
        })}
        <li className="flex items-center gap-2"><Swatch color={generalColor} /><span className="flex-1">General</span><span className="tabular-nums">{formatInsightsDuration(totals.generalMs)}</span></li>
      </ul>
    </section>
  </Card>
}
