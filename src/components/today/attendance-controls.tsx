import { useEffect, useRef, useState } from 'react'
import { Check, Pencil, X, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AttendanceStatus, ClassOccurrence, ScheduleRule } from '@/db/types'
import { setAttendance } from '@/db/attendance'
import { cn } from '@/lib/utils'

const statuses = [
  { value: 'attended', label: 'Attended', icon: Check },
  { value: 'missed', label: 'Missed', icon: X },
  { value: 'cancelled', label: 'Cancelled', icon: Minus },
] as const

export function AttendanceControls({ rule, date, occurrence, ended, label, timeZone }: {
  rule: ScheduleRule; date: string; occurrence?: ClassOccurrence; ended: boolean; label: string; timeZone?: string
}) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [message, setMessage] = useState('')
  const pending = useRef(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const status = occurrence?.status ?? 'pending'
  const recorded = status !== 'pending'
  const restoreFocus = useRef(false)
  useEffect(() => {
    if (restoreFocus.current && recorded && !editing) {
      trigger.current?.focus()
      restoreFocus.current = false
    }
  }, [recorded, editing, status])
  if (!ended && !recorded) return null

  async function save(next: AttendanceStatus) {
    if (pending.current) return
    pending.current = true; setBusy(true); setFailure('')
    try {
      await setAttendance(rule, date, next, timeZone)
      restoreFocus.current = true
      setEditing(false)
      setMessage(`Attendance saved: ${statuses.find(item => item.value === next)?.label ?? next}.`)
    } catch { setFailure('Could not save attendance. Please try again.') }
    finally { pending.current = false; setBusy(false) }
  }
  const current = statuses.find(item => item.value === status)
  const Icon = current?.icon ?? Minus
  return <div role="group" aria-label={`${label} attendance`} aria-busy={busy} className="mt-4 space-y-2 border-t pt-3">
    {recorded && !editing ? <Button ref={trigger} variant="ghost" className={cn('min-h-11 w-full justify-between px-2', status === 'attended' ? 'text-primary' : status === 'missed' ? 'text-destructive' : 'text-muted-foreground')}
      aria-label={`${current?.label}. Change attendance`} onClick={() => { setEditing(true); setFailure('') }}>
      <span className="flex items-center gap-2"><Icon aria-hidden="true" />{current?.label}</span><Pencil aria-hidden="true" className="size-3.5" />
    </Button> : <>
      <p className="text-sm font-medium">{recorded ? 'Change attendance' : 'Did you attend?'}</p>
      <div className="grid grid-cols-2 gap-2">
        {statuses.map(item => <Button key={item.value} type="button" disabled={busy} variant="outline" aria-pressed={status === item.value}
          className={cn('min-h-11', item.value === 'attended' && 'text-primary', item.value === 'missed' && 'text-destructive', item.value === 'cancelled' && 'col-span-2 text-muted-foreground')}
          onClick={() => { void save(item.value) }}><item.icon aria-hidden="true" />{item.label}</Button>)}
      </div>
      {recorded && <Button variant="ghost" disabled={busy} className="min-h-11 w-full" onClick={() => { setEditing(false); setFailure(''); window.requestAnimationFrame(() => trigger.current?.focus()) }}>Keep current status</Button>}
    </>}
    {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
    <span role="status" className="sr-only">{busy ? 'Saving attendance…' : message}</span>
  </div>
}
