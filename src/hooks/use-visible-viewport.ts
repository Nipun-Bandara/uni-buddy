import { useEffect, useState } from 'react'

/** Dialogs fit the visible area when Safari's keyboard covers the layout viewport. */
export function useVisibleViewport() {
  const [viewport, setViewport] = useState(() => ({
    height: window.visualViewport?.height ?? window.innerHeight,
    top: window.visualViewport?.offsetTop ?? 0,
  }))
  useEffect(() => {
    function refresh() {
      const next = { height: window.visualViewport?.height ?? window.innerHeight, top: window.visualViewport?.offsetTop ?? 0 }
      setViewport(previous => previous.height === next.height && previous.top === next.top ? previous : next)
    }
    refresh()
    const visual = window.visualViewport
    visual?.addEventListener('resize', refresh)
    visual?.addEventListener('scroll', refresh)
    window.addEventListener('resize', refresh)
    return () => {
      visual?.removeEventListener('resize', refresh)
      visual?.removeEventListener('scroll', refresh)
      window.removeEventListener('resize', refresh)
    }
  }, [])
  return viewport
}
