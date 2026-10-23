import { useRef, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog'
import { db } from '@/db/db'
import { deleteModule } from '@/db/modules'
import type { Module } from '@/db/types'
import { createId } from '@/lib/ids'
import { moduleColors, moduleSchema } from '@/lib/modules'
import { cn } from '@/lib/utils'

type Fields = { name: string; code: string; color: string }
const blank: Fields = { name: '', code: '', color: '' }

export function ModulesSection() {
  const result = useLiveQuery(async () => {
    try {
      const semester = await db.semesters.toCollection().first()
      const modules = semester ? await db.modules.where('semesterId').equals(semester.id).sortBy('name') : []
      return { semester, modules, failed: false }
    } catch { return { semester: undefined, modules: [], failed: true } }
  })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Module>()
  const [semesterId, setSemesterId] = useState('')
  const [fields, setFields] = useState<Fields>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [failure, setFailure] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const form = useRef<HTMLFormElement>(null)
  const addButton = useRef<HTMLButtonElement>(null)

  function begin(module?: Module) {
    if (!result?.semester) return
    setEditing(module)
    setSemesterId(result.semester.id)
    setFields(module ? { name: module.name, code: module.code ?? '', color: module.color ?? '' } : blank)
    setErrors({})
    setFailure('')
    setConfirmOpen(false)
    setOpen(true)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    const parsed = moduleSchema.safeParse(fields)
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof Fields, string>> = {}
      for (const issue of parsed.error.issues) nextErrors[issue.path[0] as keyof Fields] ??= issue.message
      setErrors(nextErrors)
      form.current?.querySelector<HTMLElement>(`[name="${Object.keys(nextErrors)[0]}"]`)?.focus()
      return
    }
    pending.current = true
    setBusy(true)
    setFailure('')
    try {
      await db.transaction('rw', db.semesters, db.modules, async () => {
        if (!await db.semesters.get(semesterId)) throw new Error('Semester no longer exists')
        if (editing) {
          const existing = await db.modules.get(editing.id)
          if (!existing || existing.semesterId !== semesterId) throw new Error('Module no longer exists')
          await db.modules.put({ ...existing, ...parsed.data })
        } else await db.modules.add({ id: createId(), semesterId, ...parsed.data })
      })
      setOpen(false)
      setStatus(editing ? 'Module updated.' : 'Module added.')
    } catch { setFailure('Could not save the module. Close this form and try again.') }
    finally { pending.current = false; setBusy(false) }
  }

  async function remove() {
    if (!editing || pending.current) return
    pending.current = true
    setBusy(true)
    setFailure('')
    try {
      if (!await deleteModule(editing.id)) {
        setFailure('This module has timetable rules or work sessions. Remove or reassign those records before deleting it.')
        return
      }
      setConfirmOpen(false)
      setOpen(false)
      setStatus('Module deleted.')
    } catch { setFailure('Could not delete the module. Please try again.') }
    finally { pending.current = false; setBusy(false) }
  }

  function change<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields({ ...fields, [key]: value })
    setErrors({ ...errors, [key]: undefined })
  }

  return <section aria-labelledby="modules-heading" className="mt-8 space-y-4">
    <h2 id="modules-heading" className="border-b pb-3 text-lg font-semibold">Modules</h2>
    {result === undefined ? <p role="status">Loading modules…</p> : result.failed ? <p role="alert">Could not load modules. Please reload.</p> : !result.semester ? <p className="text-sm text-muted-foreground">Create a semester above to add modules.</p> : <>
      {result.modules.length === 0 ? <p className="text-sm leading-6 text-muted-foreground">No modules yet.<br />Add your university modules to build your timetable.</p> : <ul className="divide-y">
        {result.modules.map(module => <li key={module.id}>
          <button type="button" onClick={() => begin(module)} className="flex min-h-16 w-full items-center gap-3 rounded-md px-2 py-3 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring" aria-label={`Edit ${module.name}`}>
            <span aria-hidden="true" className="size-3 shrink-0 rounded-full border border-foreground/20 bg-muted" style={module.color ? { backgroundColor: module.color } : undefined} />
            <span className="min-w-0 flex-1 break-words">
              {module.code && <span className="mb-1 block text-xs font-medium text-muted-foreground">{module.code}</span>}
              <span className="block text-sm font-medium">{module.name}</span>
            </span>
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </li>)}
      </ul>}
      <Button ref={addButton} className="min-h-11" onClick={() => begin()}><Plus aria-hidden="true" />Add module</Button>
    </>}
    <p role="status" className="text-sm text-muted-foreground">{status}</p>
    <Dialog open={open} onOpenChange={next => { if (!pending.current && !confirmOpen) setOpen(next) }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto" showCloseButton={!busy} onCloseAutoFocus={event => { event.preventDefault(); addButton.current?.focus() }}>
        <DialogHeader><DialogTitle>{editing ? 'Edit module' : 'Add module'}</DialogTitle><DialogDescription>Modules belong to your current semester.</DialogDescription></DialogHeader>
        <form ref={form} onSubmit={save} noValidate aria-busy={busy} className="space-y-5">
          {(['name', 'code'] as const).map(key => <div key={key} className="space-y-2">
            <label htmlFor={`module-${key}`} className="text-sm font-medium">{key === 'name' ? 'Module name' : 'Module code (optional)'}</label>
            <Input id={`module-${key}`} name={key} value={fields[key]} required={key === 'name'} disabled={busy} className="min-h-11 text-base"
              onChange={event => change(key, event.target.value)} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `module-${key}-error` : undefined} />
            {errors[key] && <p id={`module-${key}-error`} role="alert" className="text-sm text-destructive">{errors[key]}</p>}
          </div>)}
          <fieldset disabled={busy} aria-describedby={errors.color ? 'module-color-error' : undefined}>
            <legend className="mb-2 text-sm font-medium">Color (optional)</legend>
            <div className="grid grid-cols-3 gap-2">
              {[{ name: 'No color', value: '' }, ...moduleColors].map(color => <label key={color.name}
                className={cn('flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border px-2 text-xs has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring', fields.color === color.value && 'border-primary bg-accent')}>
                <input type="radio" name="color" className="sr-only" value={color.value} checked={fields.color === color.value} onChange={() => change('color', color.value)} />
                {color.value && <span aria-hidden="true" className="size-3 shrink-0 rounded-full border border-foreground/20" style={{ backgroundColor: color.value }} />}
                {color.name}
              </label>)}
            </div>
            {errors.color && <p id="module-color-error" role="alert" className="mt-2 text-sm text-destructive">{errors.color}</p>}
          </fieldset>
          {failure && !confirmOpen && <p role="alert" className="text-sm text-destructive">{failure}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} className="min-h-11" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy} className="min-h-11">{busy ? 'Saving…' : 'Save module'}</Button>
          </DialogFooter>
          {editing && <Button type="button" variant="ghost" disabled={busy} className="min-h-11 w-full text-destructive" onClick={() => { setFailure(''); setConfirmOpen(true) }}>Delete module</Button>}
        </form>
        <AlertDialog open={confirmOpen} onOpenChange={next => { if (!pending.current) { setConfirmOpen(next); setFailure('') } }}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete module?</AlertDialogTitle><AlertDialogDescription>Delete “{editing?.name}”? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
            {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy} className="min-h-11">Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={busy} className="min-h-11" onClick={event => { event.preventDefault(); void remove() }}>{busy ? 'Deleting…' : 'Delete module'}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  </section>
}
