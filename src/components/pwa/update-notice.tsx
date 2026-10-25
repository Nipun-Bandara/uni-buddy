import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/button'

/** Updates wait for an explicit reload, preserving unsaved form input and local writes. */
export function UpdateNotice() {
  const registration = useRef<ServiceWorkerRegistration | undefined>(undefined)
  const lastCheck = useRef(0)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, value) { registration.current = value },
  })
  useEffect(() => {
    function check() {
      if (document.hidden || !navigator.onLine || Date.now() - lastCheck.current < 60_000) return
      lastCheck.current = Date.now()
      void registration.current?.update().catch(() => { /* Keep the cached version when offline/unreachable. */ })
    }
    window.addEventListener('focus', check)
    window.addEventListener('online', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.removeEventListener('focus', check)
      window.removeEventListener('online', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  if (!needRefresh) return null
  return <aside role="status" aria-label="App update" className="shrink-0 space-y-2 border-b bg-muted px-4 py-3">
    <p className="text-sm">An update is ready. Finish any edits, then reload.</p>
    <div className="flex gap-2">
      <Button className="min-h-11" disabled={busy} onClick={async () => {
        setBusy(true); setFailure('')
        try { await updateServiceWorker(true) }
        catch { setFailure('Could not apply the update. Please try again.') }
        finally { setBusy(false) }
      }}>{busy ? 'Updating…' : 'Reload'}</Button>
      <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => setNeedRefresh(false)}>Later</Button>
    </div>
    {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
  </aside>
}
