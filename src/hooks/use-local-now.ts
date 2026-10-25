import { useEffect, useState } from 'react'

/** Refresh at minute boundaries and immediately after the app returns to the foreground. */
export function useLocalNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timer: number
    function refresh() {
      window.clearTimeout(timer)
      const current = new Date()
      setNow(current)
      timer = window.setTimeout(refresh, 60_000 - current.getTime() % 60_000)
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') refresh()
    }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])
  return now
}
