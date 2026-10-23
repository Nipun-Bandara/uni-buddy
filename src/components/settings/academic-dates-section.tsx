import { useRef, useState, type FormEvent } from 'react'
import { useAcademicDates } from '@/hooks/use-academic-dates'
import { differenceInCalendarDays } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog'
import { db } from '@/db/db'
import type { AcademicDate, AcademicDateType } from '@/db/types'
import { academicDateLabels, academicDateRange, academicDateSchema, isWeekType, weekEnd } from '@/lib/academic-dates'
import { parseCalendarDate } from '@/lib/dates'
import { createId } from '@/lib/ids'

type Fields = { title: string; type: AcademicDateType; startDate: string; weeks: string }
type FieldErrors = Partial<Record<keyof Fields, string>>
const blank: Fields = { title: '', type: 'break', startDate: '', weeks: '1' }

export function AcademicDatesSection() {
  const result = useAcademicDates()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AcademicDate>()
  const [deleting, setDeleting] = useState<AcademicDate>()
  const [fields, setFields] = useState<Fields>(blank)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [failure, setFailure] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const form = useRef<HTMLFormElement>(null)
  const addButton = useRef<HTMLButtonElement>(null)
  const semester = result?.semester
  const weekType = isWeekType(fields.type)

  function begin(item?: AcademicDate) {
    setEditing(item)
    setFields(item ? {
      title: item.title, type: item.type, startDate: item.startDate,
      weeks: String((differenceInCalendarDays(parseCalendarDate(item.endDate), parseCalendarDate(item.startDate)) + 1) / 7),
    } : blank)
    setErrors({})
    setFailure('')
    setOpen(true)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current || !semester) return
    const weeks = Number(fields.weeks)
    const nextErrors: FieldErrors = {}
    if (weekType && (!Number.isInteger(weeks) || weeks < 1 || weeks > 52)) nextErrors.weeks = 'Enter a whole number of weeks from 1 to 52.'
    let endDate = fields.startDate
    if (weekType && !nextErrors.weeks && /^\d{4}-\d{2}-\d{2}$/.test(fields.startDate)) {
      try { endDate = weekEnd(fields.startDate, weeks) } catch { /* Zod reports invalid date below. */ }
    }
    const parsed = academicDateSchema.safeParse({ ...fields, endDate })
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === 'endDate' ? 'startDate' : issue.path[0] as keyof Fields
        nextErrors[key] ??= key === 'startDate' ? 'Choose a valid date.' : issue.message
      }
    }
    if (Object.keys(nextErrors).length || !parsed.success) {
      setErrors(nextErrors)
      form.current?.querySelector<HTMLElement>(`[name="${Object.keys(nextErrors)[0]}"]`)?.focus()
      return
    }
    pending.current = true
    setBusy(true)
    setFailure('')
    try {
      await db.transaction('rw', db.semesters, db.academicDates, async () => {
        if (!await db.semesters.get(semester.id)) throw new Error('Semester no longer exists')
        if (editing) {
          if (!await db.academicDates.update(editing.id, parsed.data)) throw new Error('Date no longer exists')
        } else await db.academicDates.add({ id: createId(), semesterId: semester.id, ...parsed.data })
      })
      setOpen(false)
      setStatus(editing ? 'Academic date updated.' : 'Academic date added.')
    } catch { setFailure('Could not save. Please close the form and try again.') }
    finally { pending.current = false; setBusy(false) }
  }

  async function remove() {
    if (!deleting || pending.current) return
    pending.current = true
    setBusy(true)
    try {
      await db.academicDates.delete(deleting.id)
      setDeleting(undefined)
      setStatus('Academic date deleted.')
    } catch { setFailure('Could not delete. Please try again.') }
    finally { pending.current = false; setBusy(false) }
  }

  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields({ ...fields, [key]: value })
    setErrors({ ...errors, [key]: undefined })
  }

  return <section aria-labelledby="academic-dates-heading" className="mt-8 space-y-4">
    <h2 id="academic-dates-heading" className="border-b pb-3 text-lg font-semibold">Academic dates</h2>
    <p className="text-sm text-muted-foreground">Plan break, holiday, and exam weeks. Mark individual exams and assignment due dates.</p>
    {result === undefined ? <p role="status">Loading academic dates…</p> : result.failed ? <p role="alert">Could not load academic dates. Please reload.</p> : !semester ? <p className="text-sm text-muted-foreground">Create a semester above to add academic dates.</p> : <>
      <Button ref={addButton} className="min-h-11" onClick={() => begin()}>Add academic date</Button>
      {result.dates.length === 0 ? <p className="text-sm text-muted-foreground">No academic dates added.</p> : <ul className="divide-y">
        {result.dates.map(item => <li key={item.id} className="space-y-2 py-4">
          <p className="text-xs font-medium text-muted-foreground">{academicDateLabels[item.type]}</p>
          <h3 className="break-words font-medium">{item.title}</h3>
          <p className="text-sm text-muted-foreground">{academicDateRange(item.startDate, item.endDate)}</p>
          <div className="flex gap-2">
            <Button variant="outline" className="min-h-11" aria-label={`Edit ${item.title}`} onClick={() => begin(item)}>Edit</Button>
            <Button variant="outline" className="min-h-11 text-destructive" aria-label={`Delete ${item.title}`} onClick={() => { setFailure(''); setDeleting(item) }}>Delete</Button>
          </div>
        </li>)}
      </ul>}
    </>}
    <p role="status" className="text-sm text-muted-foreground">{status}</p>
    <Dialog open={open} onOpenChange={next => { if (!pending.current) setOpen(next) }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto" showCloseButton={!busy} onCloseAutoFocus={event => { event.preventDefault(); addButton.current?.focus() }}>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit academic date' : 'Add academic date'}</DialogTitle>
          <DialogDescription>Weeks run for seven days from your selected start date. Exams and assignments use a single date.</DialogDescription>
        </DialogHeader>
        <form ref={form} onSubmit={save} noValidate aria-busy={busy} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="academic-type" className="text-sm font-medium">Type</label>
            <Select value={fields.type} onValueChange={value => update('type', value as AcademicDateType)} disabled={busy}>
              <SelectTrigger id="academic-type" className="min-h-11 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(academicDateLabels).map(([type, label]) => <SelectItem key={type} value={type}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor="academic-title" className="text-sm font-medium">Title</label>
            <Input id="academic-title" name="title" value={fields.title} onChange={event => update('title', event.target.value)} required disabled={busy} className="min-h-11 text-base"
              aria-invalid={!!errors.title} aria-describedby={errors.title ? 'academic-title-error' : undefined} />
            {errors.title && <p id="academic-title-error" role="alert" className="text-sm text-destructive">{errors.title}</p>}
          </div>
          <div className="space-y-2">
            <label htmlFor="academic-start" className="text-sm font-medium">{weekType ? 'Start date' : fields.type === 'assignment' ? 'Due date' : 'Exam date'}</label>
            <DatePicker id="academic-start" name="startDate" label={weekType ? 'Start date' : fields.type === 'assignment' ? 'Due date' : 'Exam date'} value={fields.startDate}
              onChange={value => update('startDate', value)} disabled={busy} invalid={!!errors.startDate} describedBy={errors.startDate ? 'academic-start-error' : undefined} defaultDate={semester?.startDate} />
            {errors.startDate && <p id="academic-start-error" role="alert" className="text-sm text-destructive">{errors.startDate}</p>}
          </div>
          {weekType && <div className="space-y-2">
            <label htmlFor="academic-weeks" className="text-sm font-medium">Number of weeks</label>
            <Input id="academic-weeks" name="weeks" type="number" inputMode="numeric" min="1" max="52" step="1" required value={fields.weeks} disabled={busy}
              className="min-h-11 text-base" onChange={event => update('weeks', event.target.value)} aria-invalid={!!errors.weeks} aria-describedby={errors.weeks ? 'academic-weeks-error' : undefined} />
            {errors.weeks && <p id="academic-weeks-error" role="alert" className="text-sm text-destructive">{errors.weeks}</p>}
            {fields.startDate && Number.isInteger(Number(fields.weeks)) && Number(fields.weeks) >= 1 && Number(fields.weeks) <= 52 && <p className="text-sm text-muted-foreground">{academicDateRange(fields.startDate, weekEnd(fields.startDate, Number(fields.weeks)))}</p>}
          </div>}
          {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} className="min-h-11" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy} className="min-h-11">{busy ? 'Saving…' : 'Save academic date'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <AlertDialog open={!!deleting} onOpenChange={next => { if (!next && !pending.current) setDeleting(undefined) }}>
      <AlertDialogContent onCloseAutoFocus={event => { event.preventDefault(); addButton.current?.focus() }}>
        <AlertDialogHeader><AlertDialogTitle>Delete academic date?</AlertDialogTitle><AlertDialogDescription>Delete “{deleting?.title}”? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
        {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} className="min-h-11">Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={busy} className="min-h-11" variant="destructive" onClick={event => { event.preventDefault(); void remove() }}>{busy ? 'Deleting…' : 'Delete academic date'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
}
