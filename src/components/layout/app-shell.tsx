import { UpdateNotice } from '@/components/pwa/update-notice'
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
    main.current?.scrollTo({ top: 0 })
  }, [pathname])
  return (
    <div className="mx-auto flex h-dvh min-h-0 w-full max-w-md flex-col overflow-hidden bg-background text-foreground">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:p-4">Skip to content</a>
      <header className="flex shrink-0 items-center justify-between border-b pb-3 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <Link to="/" className="flex min-h-11 items-center text-sm font-semibold">Student Productivity</Link>
        <Link to="/settings" aria-label="Settings" className="rounded-md p-3 text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
          <Settings aria-hidden="true" size={20} />
        </Link>
      </header>
      <UpdateNotice />
      <main id="main-content" ref={main} tabIndex={-1} className="min-h-0 flex-1 scroll-py-8 overflow-y-auto overscroll-y-contain py-8 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] outline-none"><Outlet /></main>
      <BottomNav />
    </div>
  )
}
