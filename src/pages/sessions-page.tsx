import { workSessionLabel } from '@/lib/work-categories'
import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { Plus, ChevronRight } from 'lucide-react'
import { db } from '@/db/db'
import type { WorkSession } from '@/db/types'
import { useLocalNow } from '@/hooks/use-local-now'
import { toCalendarDate } from '@/lib/dates'
import { groupSessionHistory, historyDateLabel, sessionDurationLabel } from '@/lib/session-history'
import { WorkTimer } from '@/components/work/work-timer'
import { SessionEditor } from '@/components/sessions/session-editor'
import { Button } from '@/components/ui/button'

export function SessionsPage() {
  const now = useLocalNow()
  const result = useLiveQuery(async () => {
    try {
      const sessions = await db.workSessions.toArray()
      const modules = await db.modules.toCollection().sortBy('name')
      return { groups: groupSessionHistory(sessions), active: sessions.some(session => session.endedAt === undefined), modules, failed: false }
    } catch { return { groups: [], active: false, modules: [], failed: true } }
  })
  const [editor, setEditor] = useState<{ session?: WorkSession }>()
  const [message, setMessage] = useState('')
  const addButton = useRef<HTMLButtonElement>(null)
  const previouslyActive = useRef(false)
  useEffect(() => {
    if (previouslyActive.current && result && !result.active && !result.failed && !editor) addButton.current?.focus()
    previouslyActive.current = !!result?.active
  }, [result, editor])
  return <section aria-labelledby="page-heading">
    <h1 id="page-heading" className="text-2xl font-semibold tracking-tight">Sessions</h1>
    {result?.active && <WorkTimer />}
    <Button ref={addButton} className="mt-6 min-h-11" disabled={!result || result.failed} onClick={() => setEditor({})}><Plus aria-hidden="true" />Add session</Button>
    <p role="status" className="sr-only">{message}</p>
    {result === undefined ? <p role="status" className="mt-6 text-sm text-muted-foreground">Loading sessions…</p> : result.failed ? <p role="alert" className="mt-6 text-sm text-destructive">Could not load sessions. Please reload.</p> : !result.groups.length ? <p className="mt-6 text-sm text-muted-foreground">No completed sessions yet. Start work on Today or add a session manually.</p> : <div className="mt-6 space-y-6">
      {result.groups.map(group => <section key={group.date} aria-labelledby={`history-${group.date}`}>
        <h2 id={`history-${group.date}`} className="border-b pb-2 text-lg font-semibold">{historyDateLabel(group.date, toCalendarDate(now))}</h2>
        <ul className="divide-y">{group.sessions.map(session => {
          const module = result.modules.find(module => module.id === session.moduleId)
          const startedAt = new Date(session.startedAt)
          const endedAt = new Date(session.endedAt!)
          const endDate = toCalendarDate(endedAt)
          return <li key={session.id}><button type="button" aria-label={`Edit ${session.title || workSessionLabel(session, module)}, ${format(startedAt, 'd MMM yyyy h:mm a')}`} onClick={() => setEditor({ session })} className="flex min-h-20 w-full items-center gap-3 rounded-md px-1 py-4 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full border border-foreground/20 bg-muted" style={module?.color ? { backgroundColor: module.color } : undefined} />
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block break-words font-medium">{workSessionLabel(session, module)}</span>
              {session.title && <span className="block break-words text-sm">{session.title}</span>}
              <span className="block text-sm font-medium">{sessionDurationLabel(session)}</span>
              <span className="block text-sm text-muted-foreground"><time dateTime={session.startedAt}>{format(startedAt, 'h:mm a')}</time> – <time dateTime={session.endedAt}>{endDate !== group.date ? `${format(endedAt, 'd MMM yyyy')} · ` : ''}{format(endedAt, 'h:mm a')}</time></span>
            </span><ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          </button></li>
        })}</ul>
      </section>)}
    </div>}
    {editor && <SessionEditor session={editor.session} modules={result?.modules ?? []} onClose={() => setEditor(undefined)} onSaved={setMessage} returnFocus={() => addButton.current?.focus()} />}
  </section>
}
