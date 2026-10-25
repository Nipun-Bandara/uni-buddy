import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAcademicDates } from '@/hooks/use-academic-dates'
import { AcademicDateList } from '@/components/academic/academic-date-list'
import { toCalendarDate } from '@/lib/dates'

export function TodayPage() {
  const result = useAcademicDates()
  const [today, setToday] = useState(() => toCalendarDate(new Date()))
  useEffect(() => {
    const refresh = () => setToday(toCalendarDate(new Date()))
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  const upcoming = result?.dates.filter(item => item.endDate >= today) ?? []
  return (
    <section aria-labelledby="page-heading">
      <h1 id="page-heading" className="text-2xl font-semibold tracking-tight">Today</h1>
      <section aria-labelledby="upcoming-heading" className="mt-8 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="upcoming-heading" className="text-lg font-semibold">Current & upcoming</h2>
          <Link to="/schedule?view=calendar" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">View calendar</Link>
        </div>
        {result === undefined ? <p role="status">Loading dates…</p> : result.failed ? <p role="alert">Could not load academic dates. Please reload.</p> : !result.semester ? <p className="text-sm text-muted-foreground">Set up your semester and academic dates in <Link to="/settings" className="underline">Settings</Link>.</p> : upcoming.length ? <AcademicDateList dates={upcoming.slice(0, 6)} today={today} /> : <p className="text-sm text-muted-foreground">No upcoming academic dates. Add breaks, exams, and assignment deadlines in <Link to="/settings" className="underline">Settings</Link>.</p>}
      </section>
    </section>
  )
}
