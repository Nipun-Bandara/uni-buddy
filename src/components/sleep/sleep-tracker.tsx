import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { Moon, Sun } from 'lucide-react'
import { db } from '@/db/db'
import { ActiveSleepSessionError, getActiveSleepSession, startSleepSession, stopSleepSession } from '@/db/sleep-sessions'
import { formatInsightsDuration } from '@/lib/insights'
import { sleepDurationMs } from '@/lib/sleep'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

/** Records bedtime and wake-up timestamps only — nothing runs while the app is closed. */
export function SleepTracker() {
  const result = useLiveQuery(async () => {
    try {
      const [active, workActive] = await Promise.all([
        getActiveSleepSession(),
        db.workSessions.filter(session => session.endedAt === undefined).count().then(count => count > 0),
      ])
      return { active, workActive, failed: false }
    } catch { return { active: undefined, workActive: false, failed: true } }
  })
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [message, setMessage] = useState('')
  const pending = useRef(false)

  async function sleep() {
    if (pending.current || !result || result.active) return
    pending.current = true; setBusy(true); setFailure(''); setMessage('')
    try {
      const { endedWork } = await startSleepSession()
      setMessage(endedWork ? 'Sleep started. Your work session was ended and saved.' : 'Sleep started. Good night!')
    } catch (error) {
      if (error instanceof ActiveSleepSessionError) setMessage('Sleep is already being recorded.')
      else setFailure('Could not start sleep. Please try again.')
    } finally { pending.current = false; setBusy(false) }
  }
  async function wake() {
    if (pending.current || !result?.active) return
    pending.current = true; setBusy(true); setFailure(''); setMessage('')
    try {
      const stopped = await stopSleepSession(result.active.id)
      setMessage(`Good morning! You slept ${formatInsightsDuration(sleepDurationMs(stopped))}.`)
    } catch { setFailure('Could not record wake-up. Check your device time and try again.') }
    finally { pending.current = false; setBusy(false) }
  }

  return <section aria-labelledby="sleep-heading" className="mt-3 space-y-2">
    <h2 id="sleep-heading" className="sr-only">Sleep</h2>
    {result === undefined ? <p role="status" className="text-sm text-muted-foreground">Loading sleep…</p>
      : result.failed ? <p role="alert" className="text-sm text-destructive">Could not load sleep. Please reload.</p>
      : result.active ? <Card className="gap-1 p-5 shadow-none">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Sleeping</p>
        <p className="text-sm text-muted-foreground">Bedtime <time dateTime={result.active.startedAt}>{format(new Date(result.active.startedAt), 'd MMM yyyy, p')}</time></p>
        <Button className="mt-3 min-h-12 w-full text-base" disabled={busy} onClick={() => { void wake() }}><Sun aria-hidden="true" />{busy ? 'Saving…' : 'I’m awake'}</Button>
      </Card>
      : <>
        <Button variant="outline" className="min-h-12 w-full text-base" disabled={busy} onClick={() => { void sleep() }}><Moon aria-hidden="true" />{busy ? 'Saving…' : 'Going to sleep'}</Button>
        {result.workActive && <p className="text-xs text-muted-foreground">Your active work session will end when sleep starts.</p>}
      </>}
    {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
    <p role="status" className={message ? 'text-sm text-muted-foreground' : 'sr-only'}>{message}</p>
  </section>
}
