import { useRef, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { Plus, ChevronRight } from 'lucide-react'
import { db } from '@/db/db'
import type { ScheduleRule } from '@/db/types'
import { createId } from '@/lib/ids'
import { weekdays, classTypes, scheduleRuleSchema } from '@/lib/schedule-rules'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'

type Fields = Omit<ScheduleRule, 'id' | 'dayOfWeek' | 'location'> & { dayOfWeek: number | ''; location: string }
const blank: Fields = { moduleId: '', type: 'lecture', dayOfWeek: '', startTime: '', endTime: '', repeatEveryWeeks: 1, anchorDate: '', startDate: '', endDate: '', location: '' }
type Errors = Partial<Record<keyof Fields, string>>

export function TimetableRules() {
  const result = useLiveQuery(async () => {
    try {
      const semester = await db.semesters.toCollection().first()
      const modules = semester ? await db.modules.where('semesterId').equals(semester.id).sortBy('name') : []
      const rules = modules.length ? await db.scheduleRules.where('moduleId').anyOf(modules.map(module => module.id)).toArray() : []
      rules.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id))
      return { semester, modules, rules, failed: false }
    } catch { return { semester: undefined, modules: [], rules: [], failed: true } }
  })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ScheduleRule>()
  const [semesterId, setSemesterId] = useState('')
  const [fields, setFields] = useState<Fields>(blank)
  const [errors, setErrors] = useState<Errors>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [status, setStatus] = useState('')
  const pending = useRef(false)
  const form = useRef<HTMLFormElement>(null)
  const addButton = useRef<HTMLButtonElement>(null)

  function begin(rule?: ScheduleRule) {
    if (!result?.semester) return
    setEditing(rule)
    setSemesterId(result.semester.id)
    setFields(rule ? { ...rule, location: rule.location ?? '' } : { ...blank, startDate: result.semester.startDate, endDate: result.semester.endDate })
    setErrors({}); setFailure(''); setConfirmOpen(false); setOpen(true)
  }
  function change<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields(previous => ({ ...previous, [key]: value }))
    setErrors(previous => ({ ...previous, [key]: undefined }))
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    const parsed = scheduleRuleSchema.safeParse(fields)
    if (!parsed.success) {
      const next: Errors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Fields
        next[key] ??= ['anchorDate', 'startDate', 'endDate'].includes(key) && !fields[key] ? 'Choose a date.' : ['startTime', 'endTime'].includes(key) && !fields[key] ? 'Choose a time.' : issue.message
      }
      setErrors(next)
      const first = form.current?.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`)
      first?.focus(); first?.scrollIntoView({ block: 'nearest' })
      return
    }
    pending.current = true; setBusy(true); setFailure('')
    try {
      await db.transaction('rw', db.semesters, db.modules, db.scheduleRules, async () => {
        const module = await db.modules.get(parsed.data.moduleId)
        if (!await db.semesters.get(semesterId) || module?.semesterId !== semesterId) throw new Error('Choose a module in the current semester')
        if (editing) {
          const existing = await db.scheduleRules.get(editing.id)
          if (!existing) throw new Error('Class no longer exists')
          const owner = await db.modules.get(existing.moduleId)
          if (owner?.semesterId !== semesterId) throw new Error('Class belongs to another semester')
          await db.scheduleRules.put({ id: editing.id, ...parsed.data })
        } else await db.scheduleRules.add({ id: createId(), ...parsed.data })
      })
      setOpen(false); setStatus(editing ? 'Class updated.' : 'Class added.')
    } catch { setFailure('Could not save. Check that the semester and module still exist, then try again.') }
    finally { pending.current = false; setBusy(false) }
  }
  async function remove() {
    if (!editing || pending.current) return
    pending.current = true; setBusy(true); setFailure('')
    try {
      const deleted = await db.transaction('rw', db.scheduleRules, db.classOccurrences, async () => {
        // Future occurrence cleanup belongs here. Preserve linked records until that policy exists.
        if (await db.classOccurrences.where('scheduleRuleId').equals(editing.id).count()) return false
        await db.scheduleRules.delete(editing.id)
        return true
      })
      if (!deleted) { setFailure('This class has linked occurrences and cannot be deleted yet.'); return }
      setConfirmOpen(false); setOpen(false); setStatus('Class deleted.')
    } catch { setFailure('Could not delete the class. Please try again.') }
    finally { pending.current = false; setBusy(false) }
  }
  const error = (key: keyof Fields) => errors[key] ? <p id={`class-${key}-error`} role="alert" className="text-sm text-destructive">{errors[key]}</p> : null
  const describedBy = (key: keyof Fields) => errors[key] ? `class-${key}-error` : undefined

  return <div className="mt-4 space-y-4">
    <p className="text-sm text-muted-foreground">Your weekly class rules. Dates and repeat patterns are saved for future timetable calculations.</p>
    {result === undefined ? <p role="status">Loading classes…</p> : result.failed ? <p role="alert">Could not load classes. Please reload.</p> : !result.semester ? <p className="text-sm text-muted-foreground">Create a semester in <Link to="/settings" className="underline">Settings</Link> before adding classes.</p> : result.modules.length === 0 ? <p className="text-sm text-muted-foreground">Add modules in <Link to="/settings" className="underline">Settings</Link> before adding classes.</p> : <>
      <Button ref={addButton} className="min-h-11" onClick={() => begin()}><Plus aria-hidden="true" />Add class</Button>
      {!result.rules.length && <p className="text-sm text-muted-foreground">No classes yet. Add a class to build your weekly timetable.</p>}
      {weekdays.map((day, index) => {
        const rules = result.rules.filter(rule => rule.dayOfWeek === index)
        if (!rules.length) return null
        return <section key={day} aria-labelledby={`weekday-${index}`}>
          <h2 id={`weekday-${index}`} className="border-b pb-2 text-lg font-semibold">{day}</h2>
          <ul className="divide-y">{rules.map(rule => {
            const module = result.modules.find(module => module.id === rule.moduleId)!
            return <li key={rule.id}><button type="button" onClick={() => begin(rule)} aria-label={`Edit ${module.name}, ${day}, ${rule.startTime}`} className="flex min-h-20 w-full items-center gap-3 rounded-md px-1 py-4 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
              <span aria-hidden="true" className="size-3 shrink-0 rounded-full border border-foreground/20 bg-muted" style={module.color ? { backgroundColor: module.color } : undefined} />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block text-sm font-medium tabular-nums">{rule.startTime} – {rule.endTime}</span>
                <span className="block break-words font-medium">{module.name}</span>
                <span className="block text-sm text-muted-foreground">{classTypes[rule.type]} · {rule.repeatEveryWeeks === 1 ? 'Every week' : 'Every 2 weeks'}</span>
                {rule.location && <span className="block break-words text-sm text-muted-foreground">{rule.location}</span>}
              </span><ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            </button></li>
          })}</ul>
        </section>
      })}
    </>}
    <p role="status" className="text-sm text-muted-foreground">{status}</p>
    <Drawer open={open} onOpenChange={next => { if (!pending.current && !confirmOpen) setOpen(next) }} dismissible={!busy && !confirmOpen}>
      <DrawerContent className="mx-auto w-full max-w-md" onCloseAutoFocus={event => { event.preventDefault(); addButton.current?.focus() }}>
        <DrawerHeader className="shrink-0"><DrawerTitle>{editing ? 'Edit class' : 'Add class'}</DrawerTitle><DrawerDescription>Set a weekly or alternating-week class rule.</DrawerDescription></DrawerHeader>
        <form ref={form} id="class-form" onSubmit={save} noValidate aria-busy={busy} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4" data-vaul-no-drag>
          <div className="space-y-2">
            <label htmlFor="class-moduleId" className="text-sm font-medium">Module</label>
            <Select value={fields.moduleId} onValueChange={value => change('moduleId', value)} disabled={busy}>
              <SelectTrigger id="class-moduleId" name="moduleId" className="min-h-11 w-full" aria-invalid={!!errors.moduleId} aria-describedby={describedBy('moduleId')}><SelectValue placeholder="Choose a module" /></SelectTrigger>
              <SelectContent>{result?.modules.map(module => <SelectItem key={module.id} value={module.id}>{module.code ? `${module.code} · ` : ''}{module.name}</SelectItem>)}</SelectContent>
            </Select>{error('moduleId')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><label htmlFor="class-type" className="text-sm font-medium">Type</label>
              <Select value={fields.type} onValueChange={value => change('type', value as Fields['type'])} disabled={busy}>
                <SelectTrigger id="class-type" name="type" className="min-h-11 w-full" aria-invalid={!!errors.type} aria-describedby={describedBy('type')}><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(classTypes).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>{error('type')}
            </div>
            <div className="space-y-2"><label htmlFor="class-dayOfWeek" className="text-sm font-medium">Day</label>
              <Select value={String(fields.dayOfWeek)} onValueChange={value => change('dayOfWeek', Number(value))} disabled={busy}>
                <SelectTrigger id="class-dayOfWeek" name="dayOfWeek" className="min-h-11 w-full" aria-invalid={!!errors.dayOfWeek} aria-describedby={describedBy('dayOfWeek')}><SelectValue placeholder="Choose a day" /></SelectTrigger>
                <SelectContent>{weekdays.map((day, index) => <SelectItem key={day} value={String(index)}>{day}</SelectItem>)}</SelectContent>
              </Select>{error('dayOfWeek')}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">{(['startTime', 'endTime'] as const).map(key => <div key={key} className="min-w-0 space-y-2">
            <label htmlFor={`class-${key}`} className="text-sm font-medium">{key === 'startTime' ? 'Start time' : 'End time'}</label>
            <Input id={`class-${key}`} name={key} type="time" step="60" required disabled={busy} value={fields[key]} onChange={event => change(key, event.target.value)} className="min-h-11 text-base" aria-invalid={!!errors[key]} aria-describedby={describedBy(key)} />{error(key)}
          </div>)}</div>
          <div className="space-y-2"><label htmlFor="class-repeat" className="text-sm font-medium">Repeat</label>
            <Select value={String(fields.repeatEveryWeeks)} onValueChange={value => change('repeatEveryWeeks', Number(value))} disabled={busy}>
              <SelectTrigger id="class-repeat" name="repeatEveryWeeks" className="min-h-11 w-full" aria-invalid={!!errors.repeatEveryWeeks} aria-describedby={describedBy('repeatEveryWeeks')}><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="1">Every week</SelectItem><SelectItem value="2">Every 2 weeks</SelectItem></SelectContent>
            </Select>{error('repeatEveryWeeks')}
          </div>
          {(['anchorDate', 'startDate', 'endDate'] as const).map(key => <div key={key} className="space-y-2">
            <label htmlFor={`class-${key}`} className="text-sm font-medium">{key === 'anchorDate' ? 'First occurrence' : key === 'startDate' ? 'Start date' : 'End date'}</label>
            <DatePicker id={`class-${key}`} name={key} label={key === 'anchorDate' ? 'First occurrence' : key === 'startDate' ? 'Start date' : 'End date'} value={fields[key]} defaultDate={fields.startDate} onChange={value => change(key, value)} disabled={busy} invalid={!!errors[key]} describedBy={[describedBy(key), key === 'anchorDate' ? 'class-anchor-help' : ''].filter(Boolean).join(' ') || undefined} />
            {key === 'anchorDate' && <p id="class-anchor-help" className="text-xs leading-5 text-muted-foreground">{fields.repeatEveryWeeks === 2 ? 'Choose a date when this class actually occurs. This determines alternating weeks. ' : ''}The date must match the selected weekday and fall within the schedule period.</p>}
            {error(key)}
          </div>)}
          <div className="space-y-2"><label htmlFor="class-location" className="text-sm font-medium">Location (optional)</label><Input id="class-location" name="location" value={fields.location} onChange={event => change('location', event.target.value)} disabled={busy} className="min-h-11 text-base" /></div>
          {failure && !confirmOpen && <p role="alert" className="text-sm text-destructive">{failure}</p>}
          {editing && <Button type="button" variant="ghost" disabled={busy} className="min-h-11 w-full text-destructive" onClick={() => { setFailure(''); setConfirmOpen(true) }}>Delete class</Button>}
        </form>
        <DrawerFooter className="shrink-0 border-t pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button type="submit" form="class-form" disabled={busy} className="min-h-11">{busy ? 'Saving…' : 'Save class'}</Button>
          <Button type="button" variant="outline" disabled={busy} className="min-h-11" onClick={() => setOpen(false)}>Cancel</Button>
        </DrawerFooter>
        <AlertDialog open={confirmOpen} onOpenChange={next => { if (!pending.current) { setConfirmOpen(next); setFailure('') } }}>
          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete class?</AlertDialogTitle><AlertDialogDescription>This removes the timetable rule. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
            {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
            <AlertDialogFooter><AlertDialogCancel disabled={busy} className="min-h-11">Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} variant="destructive" className="min-h-11" onClick={event => { event.preventDefault(); void remove() }}>{busy ? 'Deleting…' : 'Delete class'}</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DrawerContent>
    </Drawer>
  </div>
}
