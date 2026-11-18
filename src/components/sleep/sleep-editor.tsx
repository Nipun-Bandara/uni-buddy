import { useRef, useState, type FormEvent } from 'react'
import { format, subDays } from 'date-fns'
import type { SleepSession } from '@/db/types'
import { parseCalendarDate, toCalendarDate } from '@/lib/dates'
import { completedSleepSchema, sleepFormValues, type SleepFormValues } from '@/lib/sleep'
import { deleteSleepSession, OverlappingSleepError, saveCompletedSleep } from '@/db/sleep-sessions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'

type Props = { session?: SleepSession; wakeDate?: string; onClose: () => void; onSaved: (message: string) => void; returnFocus: () => void }
const labels: Record<keyof SleepFormValues, string> = { bedDate: 'Bed date', bedTime: 'Bedtime', wakeDate: 'Wake-up date', wakeTime: 'Wake-up time' }

export function SleepEditor({ session, wakeDate, onClose, onSaved, returnFocus }: Props) {
  const [fields, setFields] = useState<SleepFormValues>(() => {
    if (session) return sleepFormValues(session)
    const wake = wakeDate ?? toCalendarDate(new Date())
    return { bedDate: toCalendarDate(subDays(parseCalendarDate(wake), 1)), bedTime: '', wakeDate: wake, wakeTime: '' }
  })
  const [today] = useState(() => toCalendarDate(new Date()))
  const [errors, setErrors] = useState<Partial<Record<keyof SleepFormValues, string>>>({})
  const [failure, setFailure] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const pending = useRef(false)
  const form = useRef<HTMLFormElement>(null)
  function change<K extends keyof SleepFormValues>(key: K, value: SleepFormValues[K]) {
    setFields(previous => ({ ...previous, [key]: value }))
    setErrors(previous => ({ ...previous, [key]: undefined }))
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    const parsed = completedSleepSchema(session).safeParse(fields)
    if (!parsed.success) {
      const next: Partial<Record<keyof SleepFormValues, string>> = {}
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof SleepFormValues] ??= issue.message
      setErrors(next)
      form.current?.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`)?.focus()
      return
    }
    pending.current = true; setBusy(true); setFailure('')
    try { await saveCompletedSleep(fields, session?.id); onSaved(session ? 'Sleep updated.' : 'Sleep added.'); onClose() }
    catch (error) { setFailure(error instanceof OverlappingSleepError ? 'This sleep overlaps another sleep record. Adjust the times.' : 'Could not save the sleep. Please try again.') }
    finally { pending.current = false; setBusy(false) }
  }
  async function remove() {
    if (!session || pending.current) return
    pending.current = true; setBusy(true); setFailure('')
    try { await deleteSleepSession(session.id); onSaved('Sleep deleted.'); setConfirmOpen(false); onClose() }
    catch { setFailure('Could not delete the sleep. Please try again.') }
    finally { pending.current = false; setBusy(false) }
  }
  const describedBy = (key: keyof SleepFormValues) => errors[key] ? `sleep-${key}-error` : undefined
  return <Drawer open onOpenChange={next => { if (!next && !pending.current && !confirmOpen) onClose() }} dismissible={!busy && !confirmOpen}>
    <DrawerContent className="mx-auto w-full max-w-md" onCloseAutoFocus={event => { event.preventDefault(); returnFocus() }}>
      <DrawerHeader><DrawerTitle>{session ? 'Edit sleep' : 'Add sleep'}</DrawerTitle><DrawerDescription>Sleep counts toward the day you woke up.</DrawerDescription></DrawerHeader>
      <form id="sleep-editor" ref={form} onSubmit={save} noValidate aria-busy={busy} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4" data-vaul-no-drag>
        {(['bedDate', 'bedTime', 'wakeDate', 'wakeTime'] as const).map(key => <div key={key} className="space-y-2">
          <label htmlFor={`sleep-${key}`} className="text-sm font-medium">{labels[key]}</label>
          {key === 'bedDate' || key === 'wakeDate'
            ? <DatePicker id={`sleep-${key}`} name={key} label={labels[key]} value={fields[key]} defaultDate={fields[key]} maxDate={today} onChange={value => change(key, value)} disabled={busy} invalid={!!errors[key]} describedBy={describedBy(key)} />
            : <Input id={`sleep-${key}`} name={key} type="time" required disabled={busy} value={fields[key]} onChange={event => change(key, event.target.value)} className="min-h-11 text-base" aria-invalid={!!errors[key]} aria-describedby={describedBy(key)} />}
          {errors[key] && <p role="alert" id={`sleep-${key}-error`} className="text-sm text-destructive">{errors[key]}</p>}
        </div>)}
        {session?.endedAt && <p className="text-xs text-muted-foreground">Recorded {format(new Date(session.startedAt), 'd MMM, p')} – {format(new Date(session.endedAt), 'd MMM, p')}</p>}
        {failure && !confirmOpen && <p role="alert" className="text-sm text-destructive">{failure}</p>}
        {session && <Button type="button" variant="ghost" className="min-h-11 w-full text-destructive" disabled={busy} onClick={() => { setFailure(''); setConfirmOpen(true) }}>Delete sleep</Button>}
      </form>
      <DrawerFooter className="shrink-0 border-t pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button type="submit" form="sleep-editor" className="min-h-11" disabled={busy}>{busy ? 'Saving…' : 'Save sleep'}</Button>
        <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={onClose}>Cancel</Button>
      </DrawerFooter>
      <AlertDialog open={confirmOpen} onOpenChange={next => { if (!pending.current) { setConfirmOpen(next); setFailure('') } }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete sleep?</AlertDialogTitle><AlertDialogDescription>This permanently removes the sleep record.</AlertDialogDescription></AlertDialogHeader>
          {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
          <AlertDialogFooter><AlertDialogCancel disabled={busy} className="min-h-11">Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={busy} className="min-h-11" onClick={event => { event.preventDefault(); void remove() }}>{busy ? 'Deleting…' : 'Delete sleep'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DrawerContent>
  </Drawer>
}
