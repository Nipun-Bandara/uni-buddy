import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { useReminderState } from '@/hooks/use-reminder-state'
import { readReminderState, reminderRequest, syncReminders, writeReminderState } from '@/lib/reminder-client'
import { timeZoneSchema } from '@/lib/reminders'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function RemindersSection() {
  const state = useReminderState()
  const [config, setConfig] = useState<{ available: boolean; publicKey?: string }>()
  const [setupKey, setSetupKey] = useState('')
  const [zone, setZone] = useState(state?.timeZone ?? 'Asia/Colombo')
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [failure, setFailure] = useState('')
  const supported = typeof Notification !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const installed = matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true)
  useEffect(() => { void fetch('/api/reminders/config', { cache: 'no-store' }).then(response => response.ok ? response.json() : undefined).then(value => setConfig(value ?? { available: false })).catch(() => setConfig({ available: false })) }, [])
  async function enable() {
    if (!supported || !config?.publicKey || busy) return
    const parsed = timeZoneSchema.safeParse(zone)
    if (!parsed.success) { setFailure('Enter an IANA timezone, such as Asia/Colombo.'); return }
    // Permission is requested directly from the tap, before other asynchronous work.
    const permission = Notification.requestPermission()
    setBusy(true); setFailure(''); setMessage('')
    try {
      if (await permission !== 'granted') throw new Error('Notifications were not allowed. You can change this in your phone’s notification settings.')
      const registration = await navigator.serviceWorker.ready
      const bytes = Uint8Array.from(atob(config.publicKey.replace(/-/g, '+').replace(/_/g, '/')), character => character.charCodeAt(0))
      await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes })
      const token = readReminderState()?.token ?? btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      writeReminderState({ token, enabled: false, timeZone: parsed.data })
      await syncReminders(setupKey || undefined, true)
      setMessage('Reminders connected. Send a test notification to check your phone.')
    } catch (error) { setFailure(error instanceof Error ? error.message : 'Could not enable reminders.') }
    finally { setSetupKey(''); setBusy(false) }
  }
  async function perform(action: 'disable' | 'sync' | 'test') {
    const current = readReminderState()
    if (!current || busy) return
    setBusy(true); setFailure(''); setMessage('')
    try {
      if (action === 'disable') { writeReminderState({ ...current, enabled: false, pendingRemoval: true }); await syncReminders(); setMessage('Remote reminder data deleted and this device unsubscribed.') }
      else if (action === 'test') { await reminderRequest('test', current.token, 'POST'); setMessage('Test sent. Delivery depends on your phone and connection.') }
      else { const parsed = timeZoneSchema.safeParse(zone); if (!parsed.success) throw new Error('Enter an IANA timezone, such as Asia/Colombo.'); writeReminderState({ ...current, timeZone: parsed.data, signature: undefined }); await syncReminders(); setMessage('Reminder schedule synced.') }
    } catch (error) { setFailure(error instanceof Error ? error.message : 'Could not complete this action. Try online.') }
    finally { setBusy(false) }
  }
  return <section aria-labelledby="reminders-heading" className="mt-8 space-y-4">
    <h2 id="reminders-heading" className="border-b pb-3 text-lg font-semibold">Attendance reminders</h2>
    <p className="text-sm leading-6 text-muted-foreground">Get a push after lectures and labs end. Timing is approximate. Enabling uploads class names, reminder times, timezone, and this device’s push subscription to your reminder service. Attendance and work history stay local.</p>
    <p className="text-sm text-muted-foreground">Class names may appear on your Lock Screen. Reminders can still arrive after you mark attendance. Offline timetable edits sync when you reopen the app online.</p>
    {!supported || (ios && !installed) ? <p className="text-sm">On iPhone, add this app to the Home Screen, open that icon, then enable reminders. iOS 16.4 or later is required.</p> : config === undefined ? <p role="status" className="text-sm">Checking reminder service…</p> : !config.available ? <p className="text-sm text-muted-foreground">The reminder service is not configured or is unreachable. The rest of the app works normally.</p> : <>
      <div className="space-y-2"><label htmlFor="reminder-zone" className="text-sm font-medium">Timetable timezone</label><Input id="reminder-zone" value={zone} onChange={event => setZone(event.target.value)} placeholder="Asia/Colombo" disabled={busy} /><p className="text-xs text-muted-foreground">Stays fixed when you travel. Change it only if the timetable’s timezone changes.</p></div>
      {!state?.enabled && !state?.pendingRemoval && <><div className="space-y-2"><label htmlFor="reminder-setup" className="text-sm font-medium">Private setup key</label><Input id="reminder-setup" type="password" autoComplete="off" value={setupKey} onChange={event => setSetupKey(event.target.value)} disabled={busy} /><p className="text-xs text-muted-foreground">From your Vercel setup. Used to connect this device; not saved in backups.</p></div><Button disabled={busy} onClick={() => { void enable() }}><Bell aria-hidden="true" />Enable reminders</Button></>}
      {state?.enabled && <div className="flex flex-col gap-2"><p className="text-sm font-medium">Reminders enabled</p><Button variant="outline" disabled={busy} onClick={() => { void perform('sync') }}>Save timezone & sync</Button><Button variant="outline" disabled={busy} onClick={() => { void perform('test') }}>Send test notification</Button></div>}
    </>}
    {(state?.enabled || state?.pendingRemoval || state?.token) && <Button variant="outline" disabled={busy} onClick={() => { void perform('disable') }}>{state.pendingRemoval ? 'Retry disabling reminders' : 'Disable reminders & delete remote data'}</Button>}
    {state?.pendingRemoval && <p role="status" className="text-sm">Remote deletion is pending. Reminders may continue until this app reconnects and deletion succeeds.</p>}
    {state?.syncedAt && <p className="text-xs text-muted-foreground">Last synced: {new Date(state.syncedAt).toLocaleString()}</p>}
    {(failure || state?.error) && <p role="alert" className="text-sm text-destructive">{failure || state?.error}</p>}
    <p role="status" className="text-sm text-muted-foreground">{busy ? 'Working…' : message}</p>
  </section>
}
