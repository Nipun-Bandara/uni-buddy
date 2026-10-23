import { useRef, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { db } from '@/db/db'
import type { Semester } from '@/db/types'
import { parseCalendarDate } from '@/lib/dates'
import { createId } from '@/lib/ids'
import { semesterSchema } from '@/lib/semester'

type Fields = { name: string; startDate: string; endDate: string }
type Errors = Partial<Record<keyof Fields, string>>
const emptyFields: Fields = { name: '', startDate: '', endDate: '' }

function displayDate(value: string) {
  try { return format(parseCalendarDate(value), 'd MMM yyyy') }
  catch { return value }
}

export function SemesterSection() {
  // IDs have no creation timestamp: consistently choose the first primary-key record.
  const result = useLiveQuery(async () => {
    try { return { semester: await db.semesters.toCollection().first(), failed: false } }
    catch { return { semester: undefined, failed: true } }
  })
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [fields, setFields] = useState<Fields>(emptyFields)
  const [editing, setEditing] = useState<Semester>()
  const [errors, setErrors] = useState<Errors>({})
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const form = useRef<HTMLFormElement>(null)
  const semester = result?.semester

  function changeOpen(next: boolean) {
    if (pending.current) return
    if (next) {
      setEditing(semester)
      setFields(semester ? { name: semester.name, startDate: semester.startDate, endDate: semester.endDate } : emptyFields)
      setErrors({})
      setFailure('')
    }
    setOpen(next)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    const parsed = semesterSchema.safeParse(fields)
    if (!parsed.success) {
      const nextErrors: Errors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Fields
        nextErrors[key] ??= key === 'name' ? issue.message : fields[key] ? issue.message : 'Choose a date.'
      }
      setErrors(nextErrors)
      const first = Object.keys(nextErrors)[0]
      form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
      return
    }
    pending.current = true
    setBusy(true)
    setFailure('')
    try {
      await db.transaction('rw', db.semesters, async () => {
        if (editing) {
          const updated = await db.semesters.update(editing.id, parsed.data)
          if (!updated) throw new Error('Semester no longer exists')
        } else {
          // Recheck inside the transaction to avoid duplicates across tabs.
          if (await db.semesters.count()) throw new Error('Semester already exists')
          await db.semesters.add({ id: createId(), ...parsed.data })
        }
      })
      setOpen(false)
      setMessage(editing ? 'Semester updated.' : 'Semester created.')
    } catch {
      setFailure('Could not save the semester. Close this form and try again.')
    } finally { pending.current = false; setBusy(false) }
  }

  async function remove() {
    if (!semester || pending.current) return
    pending.current = true
    setBusy(true)
    setFailure('')
    try {
      const deleted = await db.transaction('rw', [db.semesters, db.academicDates, db.modules, db.scheduleRules, db.workSessions], async () => {
        const moduleIds = await db.modules.where('semesterId').equals(semester.id).primaryKeys()
        if (moduleIds.length && (await db.scheduleRules.where('moduleId').anyOf(moduleIds).count() ||
            await db.workSessions.where('moduleId').anyOf(moduleIds).count())) return false
        await db.modules.bulkDelete(moduleIds)
        await db.academicDates.where('semesterId').equals(semester.id).delete()
        await db.semesters.delete(semester.id)
        return true
      })
      if (!deleted) {
        setFailure('This semester has modules with timetable rules or work sessions. Remove or reassign those records first.')
        return
      }
      setConfirmOpen(false)
      setMessage('Semester deleted.')
    } catch { setFailure('Could not delete the semester. Please try again.') }
    finally { pending.current = false; setBusy(false) }
  }

  return (
    <section aria-labelledby="semester-heading" className="mt-8 space-y-4">
      <h2 id="semester-heading" className="border-b pb-3 text-lg font-semibold">Semester</h2>
      {result === undefined ? <p role="status" className="text-sm text-muted-foreground">Loading semester…</p> : result.failed ? (
        <p role="alert" className="text-sm text-destructive">Could not load your semester. Please reload to try again.</p>
      ) : <>
        {semester ? <div className="space-y-1">
          <h3 className="break-words font-medium">{semester.name}</h3>
          <p className="text-sm text-muted-foreground"><time dateTime={semester.startDate}>{displayDate(semester.startDate)}</time> – <time dateTime={semester.endDate}>{displayDate(semester.endDate)}</time></p>
        </div> : <p className="text-sm text-muted-foreground">No semester configured</p>}
        <div className="flex gap-3">
          <Dialog open={open} onOpenChange={changeOpen}>
            <DialogTrigger asChild><Button variant={semester ? 'outline' : 'default'} className="min-h-11">{semester ? 'Edit' : 'Create semester'}</Button></DialogTrigger>
            <DialogContent className="max-h-[85dvh] overflow-y-auto" showCloseButton={!busy} onEscapeKeyDown={event => { if (busy) event.preventDefault() }} onPointerDownOutside={event => { if (busy) event.preventDefault() }}>
              <DialogHeader>
                <DialogTitle>{editing ? 'Edit semester' : 'Create semester'}</DialogTitle>
                <DialogDescription>Set your semester name and calendar dates.</DialogDescription>
              </DialogHeader>
              <form ref={form} onSubmit={save} noValidate className="space-y-5" aria-busy={busy}>
                {(['name', 'startDate', 'endDate'] as const).map(key => <div key={key} className="space-y-2">
                  <label htmlFor={`semester-${key}`} className="text-sm font-medium">{key === 'name' ? 'Semester name' : key === 'startDate' ? 'Start date' : 'End date'}</label>
                  {key === 'name' ? <Input id={`semester-${key}`} name={key} required value={fields[key]} disabled={busy}
                    className="min-h-11 text-base" aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `semester-${key}-error` : undefined}
                    onChange={event => { setFields({ ...fields, [key]: event.target.value }); setErrors({ ...errors, [key]: undefined }) }} /> : <DatePicker id={`semester-${key}`} name={key} label={key === 'startDate' ? 'Start date' : 'End date'}
                    value={fields[key]} disabled={busy} invalid={!!errors[key]} describedBy={errors[key] ? `semester-${key}-error` : undefined}
                    defaultDate={fields.startDate} onChange={value => { setFields({ ...fields, [key]: value }); setErrors({ ...errors, [key]: undefined }) }} />}
                  {errors[key] && <p id={`semester-${key}-error`} role="alert" className="text-sm text-destructive">{errors[key]}</p>}
                </div>)}
                {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
                <DialogFooter>
                  <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => changeOpen(false)}>Cancel</Button>
                  <Button type="submit" className="min-h-11" disabled={busy}>{busy ? 'Saving…' : 'Save semester'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          {semester && <AlertDialog open={confirmOpen} onOpenChange={next => { if (!pending.current) { setConfirmOpen(next); setFailure('') } }}>
            <AlertDialogTrigger asChild><Button variant="outline" className="min-h-11 text-destructive">Delete</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete semester?</AlertDialogTitle>
                <AlertDialogDescription>Delete “{semester.name}”? Its modules and academic dates will also be deleted. This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
              <AlertDialogFooter>
                <AlertDialogCancel className="min-h-11" disabled={busy}>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" className="min-h-11" disabled={busy} onClick={event => { event.preventDefault(); void remove() }}>{busy ? 'Deleting…' : 'Delete semester'}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>}
        </div>
      </>}
      <p role="status" className="text-sm text-muted-foreground">{message}</p>
    </section>
  )
}
