import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Play, Square } from 'lucide-react'
import { db } from '@/db/db'
import { ActiveWorkSessionError, getActiveWorkSession, startWorkSession, stopWorkSession } from '@/db/work-sessions'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer'

/** Records start/end timestamps without a ticking counter or background session loop. */
export function WorkTimer() {
  const result = useLiveQuery(async () => {
    try {
      const active = await getActiveWorkSession()
      const activeModule = active?.moduleId ? await db.modules.get(active.moduleId) : undefined
      const semester = await db.semesters.toCollection().first()
      const modules = semester ? await db.modules.where('semesterId').equals(semester.id).sortBy('name') : []
      return { active, activeModule, modules, failed: false }
    } catch { return { active: undefined, activeModule: undefined, modules: [], failed: true } }
  })
  const [open, setOpen] = useState(false)
  const [moduleId, setModuleId] = useState('general')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [status, setStatus] = useState('')
  const pending = useRef(false)
  const focusAfterStop = useRef(false)
  const startButton = useRef<HTMLButtonElement>(null)
  const stopButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (focusAfterStop.current && result && !result.active && !busy) {
      startButton.current?.focus()
      focusAfterStop.current = false
    }
  }, [result, busy])

  function begin() {
    if (!result || result.active || result.failed) return
    setModuleId('general'); setTitle(''); setFailure(''); setOpen(true)
  }
  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    pending.current = true; setBusy(true); setFailure('')
    try {
      await startWorkSession({ moduleId: moduleId === 'general' ? undefined : moduleId, title })
      setOpen(false); setStatus('Work session started.')
    } catch (error) {
      if (error instanceof ActiveWorkSessionError) {
        setOpen(false); setStatus('A work session is already active.')
      } else setFailure('Could not start work. Check the selected module and try again.')
    } finally { pending.current = false; setBusy(false) }
  }
  async function stop() {
    if (!result?.active || pending.current) return
    pending.current = true; setBusy(true); setFailure('')
    try {
      await stopWorkSession(result.active.id)
      focusAfterStop.current = true
      setStatus('Work session ended and saved.')
    } catch { setFailure('Could not stop the session. Check your device time and try again.') }
    finally { pending.current = false; setBusy(false) }
  }

  return <section aria-labelledby="work-heading" className="mt-6 space-y-3">
    <h2 id="work-heading" className="sr-only">Work session</h2>
    {result === undefined ? <p role="status" className="text-sm text-muted-foreground">Loading work session…</p> : result.failed ? <p role="alert" className="text-sm text-destructive">Could not load your work session. Please reload.</p> : result.active ? <Card className="gap-1 border-primary/40 p-5 shadow-none">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Working now</p>
      <div className="flex items-center gap-2">
        {result.activeModule?.color && <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: result.activeModule.color }} />}
        <h3 className="min-w-0 break-words font-semibold">{result.activeModule?.name ?? 'General'}</h3>
      </div>
      {result.active.title && <p className="break-words text-sm text-muted-foreground">{result.active.title}</p>}
      <p className="py-3 text-sm text-muted-foreground">Started <time dateTime={result.active.startedAt}>{format(new Date(result.active.startedAt), 'd MMM yyyy, p')}</time></p>
      <Button ref={stopButton} className="min-h-12 w-full" disabled={busy} onClick={() => { void stop() }}><Square aria-hidden="true" />{busy ? 'Ending…' : 'End session'}</Button>
    </Card> : <Button ref={startButton} className="min-h-12 w-full text-base" disabled={busy} onClick={begin}><Play aria-hidden="true" />Start work</Button>}
    {failure && !open && <p role="alert" className="text-sm text-destructive">{failure}</p>}
    <span role="status" className="sr-only">{status}</span>
    <Drawer open={open} onOpenChange={next => { if (!pending.current) setOpen(next) }} dismissible={!busy}>
      <DrawerContent className="mx-auto w-full max-w-md" onCloseAutoFocus={event => { event.preventDefault(); (stopButton.current ?? startButton.current)?.focus() }}>
        <DrawerHeader><DrawerTitle>Start work</DrawerTitle><DrawerDescription>Choose a module or work on something general. A title is optional.</DrawerDescription></DrawerHeader>
        <form id="start-work-form" onSubmit={start} className="min-h-0 space-y-5 overflow-y-auto px-4 pb-4" aria-busy={busy} data-vaul-no-drag>
          <div className="space-y-2"><label htmlFor="work-module" className="text-sm font-medium">Module (optional)</label>
            <Select value={moduleId} onValueChange={setModuleId} disabled={busy}>
              <SelectTrigger id="work-module" className="min-h-11 w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="general">General / no module</SelectItem>{result?.modules.map(module => <SelectItem key={module.id} value={module.id}>{module.code ? `${module.code} · ` : ''}{module.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><label htmlFor="work-title" className="text-sm font-medium">Title (optional)</label><Input id="work-title" className="min-h-11 text-base" placeholder="e.g. Literature review" value={title} onChange={event => setTitle(event.target.value)} disabled={busy} /></div>
          {result?.active && <p role="status" className="text-sm text-muted-foreground">A work session is already active. Close this form to return to it.</p>}
          {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
        </form>
        <DrawerFooter className="shrink-0 border-t pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button form="start-work-form" type="submit" className="min-h-12" disabled={busy || !!result?.active}>{busy ? 'Starting…' : 'Start'}</Button>
          <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  </section>
}
