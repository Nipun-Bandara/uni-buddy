import { Settings } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router'
import { useEffect, useRef } from 'react'
import { BottomNav } from '@/components/navigation/bottom-nav'

export function AppShell() {
  const { pathname } = useLocation()
  const main = useRef<HTMLElement>(null)
  useEffect(() => {
    const heading = main.current?.querySelector('h1')
    document.title = `${heading?.textContent ?? 'Student Productivity'} · Student Productivity`
    main.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [pathname])
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background text-foreground">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:p-4">Skip to content</a>
      <header className="flex items-center justify-between border-b px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link to="/" className="text-sm font-semibold">Student Productivity</Link>
        <Link to="/settings" aria-label="Settings" className="rounded-md p-3 text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
          <Settings aria-hidden="true" size={20} />
        </Link>
      </header>
      <main id="main-content" ref={main} tabIndex={-1} className="flex-1 px-5 py-8 outline-none"><Outlet /></main>
      <BottomNav />
    </div>
  )
}
