import { useEffect, useState } from 'react'
import { getElapsedSeconds } from '@/lib/work-duration'

/** Recompute from the stored start on every visible tick and foreground return. */
export function useSessionElapsed(startedAt: string) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let timer: number
    function refresh() {
      window.clearTimeout(timer)
      const current = Date.now()
      setNow(current)
      if (!document.hidden) timer = window.setTimeout(refresh, 1000 - current % 1000)
    }
    refresh()
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [startedAt])
  return getElapsedSeconds(startedAt, now)
}
