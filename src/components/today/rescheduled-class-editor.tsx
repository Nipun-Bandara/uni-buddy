import { useRef, useState, type FormEvent } from 'react'
import { format } from 'date-fns'
import type { Module, RescheduledClass } from '@/db/types'
import { saveRescheduledClass, deleteRescheduledClass } from '@/db/rescheduled-classes'
import { rescheduledClassFieldsSchema, type RescheduledClassFields } from '@/lib/rescheduled-classes'
import { parseCalendarDate } from '@/lib/dates'
import { classTypes } from '@/lib/schedule-rules'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'

type Props = { date: string; modules: Module[]; record?: RescheduledClass; onClose: () => void; onSaved: (message: string) => void; returnFocus: () => void }
export function RescheduledClassEditor({ date, modules, record, onClose, onSaved, returnFocus }: Props) {
  const [fields, setFields] = useState<RescheduledClassFields>(() => record ? { ...record, location: record.location ?? '' } : { moduleId: '', type: 'lecture', date, startTime: '', endTime: '', location: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof RescheduledClassFields, string>>>({})
  const [failure, setFailure] = useState(''), [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(false)
  const pending = useRef(false), form = useRef<HTMLFormElement>(null)
  const owner = record ? modules.find(module => module.id === record.moduleId)?.semesterId : undefined
  const choices = record ? modules.filter(module => module.semesterId === owner) : modules
  function change<K extends keyof RescheduledClassFields>(key: K, value: RescheduledClassFields[K]) {
    setFields(previous => ({ ...previous, [key]: value })); setErrors(previous => ({ ...previous, [key]: undefined }))
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    const parsed = rescheduledClassFieldsSchema.safeParse(fields)
    if (!parsed.success) {
      const next: typeof errors = {}
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof typeof errors] ??= issue.message
      setErrors(next); form.current?.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`)?.focus(); return
    }
    pending.current = true; setBusy(true); setFailure('')
    try { await saveRescheduledClass(fields, record?.id); onSaved(record ? 'Rescheduled class updated.' : 'Rescheduled class added for today.'); onClose() }
    catch { setFailure('Could not save. Check the module, date, and valid local start/end times, then try again.') }
    finally { pending.current = false; setBusy(false) }
  }
  async function remove() {
    if (!record || pending.current) return
    pending.current = true; setBusy(true); setFailure('')
    try { await deleteRescheduledClass(record.id); onSaved('Rescheduled class deleted.'); setConfirm(false); onClose() }
    catch { setFailure('Could not delete this class. Please try again.') }
    finally { pending.current = false; setBusy(false) }
  }
  const error = (key: keyof typeof errors) => errors[key] ? <p id={`rescheduled-${key}-error`} role="alert" className="text-sm text-destructive">{errors[key]}</p> : null
  return <Drawer open onOpenChange={open => { if (!open && !pending.current && !confirm) onClose() }} dismissible={!busy && !confirm}>
    <DrawerContent className="mx-auto w-full max-w-md" onCloseAutoFocus={event => { event.preventDefault(); returnFocus() }}>
      <DrawerHeader><DrawerTitle>{record ? 'Edit rescheduled class' : 'Add rescheduled class'}</DrawerTitle><DrawerDescription>{format(parseCalendarDate(fields.date), 'd MMM yyyy')} · One class for this date. Your weekly timetable stays unchanged.</DrawerDescription></DrawerHeader>
      <form id="rescheduled-form" ref={form} onSubmit={save} noValidate className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4" data-vaul-no-drag aria-busy={busy}>
        <div className="space-y-2"><label htmlFor="rescheduled-module" className="text-sm font-medium">Module</label>
          <Select value={fields.moduleId} onValueChange={value => change('moduleId', value)} disabled={busy}>
            <SelectTrigger id="rescheduled-module" name="moduleId" className="w-full" aria-invalid={!!errors.moduleId} aria-describedby={errors.moduleId ? 'rescheduled-moduleId-error' : undefined}><SelectValue placeholder="Choose a module" /></SelectTrigger>
            <SelectContent>{choices.map(module => <SelectItem key={module.id} value={module.id}>{module.code ? `${module.code} · ` : ''}{module.name}</SelectItem>)}</SelectContent>
          </Select>{error('moduleId')}
        </div>
        <div className="space-y-2"><label htmlFor="rescheduled-type" className="text-sm font-medium">Class type</label>
          <Select value={fields.type} onValueChange={value => change('type', value as RescheduledClassFields['type'])} disabled={busy}>
            <SelectTrigger id="rescheduled-type" name="type" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(classTypes).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">{(['startTime', 'endTime'] as const).map(key => <div key={key} className="min-w-0 space-y-2"><label htmlFor={`rescheduled-${key}`} className="text-sm font-medium">{key === 'startTime' ? 'Start time' : 'End time'}</label><Input id={`rescheduled-${key}`} name={key} type="time" step="60" value={fields[key]} onChange={event => change(key, event.target.value)} required disabled={busy} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `rescheduled-${key}-error` : undefined} />{error(key)}</div>)}</div>
        <div className="space-y-2"><label htmlFor="rescheduled-location" className="text-sm font-medium">Location (optional)</label><Input id="rescheduled-location" value={fields.location} onChange={event => change('location', event.target.value)} disabled={busy} /></div>
        {failure && !confirm && <p role="alert" className="text-sm text-destructive">{failure}</p>}
        {record && <Button type="button" variant="ghost" className="w-full text-destructive" disabled={busy} onClick={() => setConfirm(true)}>Delete rescheduled class</Button>}
      </form>
      <DrawerFooter className="border-t"><Button form="rescheduled-form" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save class'}</Button><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button></DrawerFooter>
      <AlertDialog open={confirm} onOpenChange={open => { if (!pending.current) setConfirm(open) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete rescheduled class?</AlertDialogTitle><AlertDialogDescription>This removes this one-off class and its attendance record. The weekly timetable and original cancelled class stay unchanged.</AlertDialogDescription></AlertDialogHeader>{failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}<AlertDialogFooter><AlertDialogCancel disabled={busy}>Keep class</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={busy} onClick={event => { event.preventDefault(); void remove() }}>Delete class</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </DrawerContent>
  </Drawer>
}
