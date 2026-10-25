import { useRef, useState, type FormEvent } from 'react'
import { format } from 'date-fns'
import type { Module, WorkSession } from '@/db/types'
import { toCalendarDate } from '@/lib/dates'
import { completedSessionSchema, sessionFormValues, type SessionFormValues } from '@/lib/session-history'
import { saveCompletedSession, deleteCompletedSession } from '@/db/session-history'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'

type Props = { session?: WorkSession; modules: Module[]; onClose: () => void; onSaved: (message: string) => void; returnFocus: () => void }
export function SessionEditor({ session, modules, onClose, onSaved, returnFocus }: Props) {
  const [fields, setFields] = useState<SessionFormValues>(() => {
    if (session) return sessionFormValues(session)
    const now = new Date()
    return { moduleId: '', title: '', date: toCalendarDate(now), endDate: toCalendarDate(now), startTime: '', endTime: format(now, 'HH:mm') }
  })
  const [errors, setErrors] = useState<Partial<Record<keyof SessionFormValues, string>>>({})
  const [failure, setFailure] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const pending = useRef(false)
  const form = useRef<HTMLFormElement>(null)
  function change<K extends keyof SessionFormValues>(key: K, value: SessionFormValues[K]) {
    setFields(previous => ({ ...previous, [key]: value, ...(key === 'date' && previous.endDate === previous.date ? { endDate: value } : {}) }))
    setErrors(previous => ({ ...previous, [key]: undefined }))
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    const parsed = completedSessionSchema(session).safeParse(fields)
    if (!parsed.success) {
      const next: Partial<Record<keyof SessionFormValues, string>> = {}
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof SessionFormValues] ??= issue.message
      setErrors(next)
      const first = form.current?.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`)
      first?.focus(); first?.scrollIntoView({ block: 'nearest' })
      return
    }
    pending.current = true; setBusy(true); setFailure('')
    try { await saveCompletedSession(fields, session?.id); onSaved(session ? 'Session updated.' : 'Session added.'); onClose() }
    catch { setFailure('Could not save. Check that the session and selected module still exist, then try again.') }
    finally { pending.current = false; setBusy(false) }
  }
  async function remove() {
    if (!session || pending.current) return
    pending.current = true; setBusy(true); setFailure('')
    try { await deleteCompletedSession(session.id); onSaved('Session deleted.'); setConfirmOpen(false); onClose() }
    catch { setFailure('Could not delete the session. Please try again.') }
    finally { pending.current = false; setBusy(false) }
  }
  const error = (key: keyof SessionFormValues) => errors[key] ? <p role="alert" id={`session-${key}-error`} className="text-sm text-destructive">{errors[key]}</p> : null
  const describedBy = (key: keyof SessionFormValues) => errors[key] ? `session-${key}-error` : undefined
  return <Drawer open onOpenChange={next => { if (!next && !pending.current && !confirmOpen) onClose() }} dismissible={!busy && !confirmOpen}>
    <DrawerContent className="mx-auto w-full max-w-md" onCloseAutoFocus={event => { event.preventDefault(); returnFocus() }}>
      <DrawerHeader><DrawerTitle>{session ? 'Edit session' : 'Add session'}</DrawerTitle><DrawerDescription>Correct a completed work session. Use the end date for overnight work.</DrawerDescription></DrawerHeader>
      <form id="session-editor" ref={form} onSubmit={save} noValidate aria-busy={busy} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4" data-vaul-no-drag>
        <div className="space-y-2"><label htmlFor="session-module" className="text-sm font-medium">Module (optional)</label>
          <Select value={fields.moduleId || 'general'} onValueChange={value => change('moduleId', value === 'general' ? '' : value)} disabled={busy}>
            <SelectTrigger id="session-module" className="min-h-11 w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="general">General / no module</SelectItem>{modules.map(module => <SelectItem key={module.id} value={module.id}>{module.code ? `${module.code} · ` : ''}{module.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><label htmlFor="session-title" className="text-sm font-medium">Title (optional)</label><Input id="session-title" name="title" value={fields.title} onChange={event => change('title', event.target.value)} className="min-h-11 text-base" disabled={busy} /></div>
        {(['date', 'startTime', 'endDate', 'endTime'] as const).map(key => <div key={key} className="space-y-2">
          <label htmlFor={`session-${key}`} className="text-sm font-medium">{key === 'date' ? 'Date' : key === 'endDate' ? 'End date' : key === 'startTime' ? 'Start time' : 'End time'}</label>
          {key === 'date' || key === 'endDate' ? <DatePicker id={`session-${key}`} name={key} label={key === 'date' ? 'Date' : 'End date'} value={fields[key]} defaultDate={fields.date} onChange={value => change(key, value)} disabled={busy} invalid={!!errors[key]} describedBy={describedBy(key)} /> : <Input id={`session-${key}`} name={key} type="time" step="1" required disabled={busy} value={fields[key]} onChange={event => change(key, event.target.value)} className="min-h-11 text-base" aria-invalid={!!errors[key]} aria-describedby={describedBy(key)} />}
          {error(key)}
        </div>)}
        {failure && !confirmOpen && <p role="alert" className="text-sm text-destructive">{failure}</p>}
        {session && <Button type="button" variant="ghost" className="min-h-11 w-full text-destructive" disabled={busy} onClick={() => { setFailure(''); setConfirmOpen(true) }}>Delete session</Button>}
      </form>
      <DrawerFooter className="shrink-0 border-t pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button type="submit" form="session-editor" className="min-h-11" disabled={busy}>{busy ? 'Saving…' : 'Save session'}</Button>
        <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={onClose}>Cancel</Button>
      </DrawerFooter>
      <AlertDialog open={confirmOpen} onOpenChange={next => { if (!pending.current) { setConfirmOpen(next); setFailure('') } }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete session?</AlertDialogTitle><AlertDialogDescription>This permanently removes the completed session.</AlertDialogDescription></AlertDialogHeader>
          {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
          <AlertDialogFooter><AlertDialogCancel disabled={busy} className="min-h-11">Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={busy} className="min-h-11" onClick={event => { event.preventDefault(); void remove() }}>{busy ? 'Deleting…' : 'Delete session'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DrawerContent>
  </Drawer>
}
