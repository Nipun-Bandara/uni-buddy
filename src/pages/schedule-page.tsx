import { useState } from 'react'
import { Link } from 'react-router'
import { format } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { AcademicDateList } from '@/components/academic/academic-date-list'
import { useAcademicDates } from '@/hooks/use-academic-dates'
import { toCalendarDate } from '@/lib/dates'

export function SchedulePage() {
  const result = useAcademicDates()
  const [selected, setSelected] = useState(() => new Date())
  const selectedDate = toCalendarDate(selected)
  const entries = result?.dates.filter(item => item.startDate <= selectedDate && item.endDate >= selectedDate) ?? []
  return <section aria-labelledby="page-heading">
    <h1 id="page-heading" className="text-2xl font-semibold tracking-tight">Schedule</h1>
    <p className="mt-3 text-sm text-muted-foreground">Your academic calendar. Choose a marked day to see its dates and weeks.</p>
    <div className="mt-6 rounded-lg border">
      <Calendar mode="single" required selected={selected} onSelect={date => { if (date) setSelected(date) }}
        className="mx-auto [--cell-size:2.5rem]" captionLayout="dropdown"
        startMonth={new Date(1900, 0)} endMonth={new Date(2100, 11)}
        modifiers={{ academic: date => {
          const value = toCalendarDate(date)
          return result?.dates.some(item => item.startDate <= value && item.endDate >= value) ?? false
        } }}
        modifiersClassNames={{ academic: 'rounded-md ring-1 ring-inset ring-primary' }}
        labels={{ labelDayButton: date => {
          const value = toCalendarDate(date)
          const count = result?.dates.filter(item => item.startDate <= value && item.endDate >= value).length ?? 0
          return `${format(date, 'EEEE, d MMMM yyyy')}${count ? `, ${count} academic ${count === 1 ? 'entry' : 'entries'}` : ''}`
        } }} />
    </div>
    <p className="mt-3 text-xs text-muted-foreground">Outlined days have a break, holiday, exam week, exam, or assignment.</p>
    <section aria-labelledby="selected-date-heading" className="mt-6">
      <h2 id="selected-date-heading" className="text-lg font-semibold">{format(selected, 'd MMMM yyyy')}</h2>
      <div aria-live="polite">
        {result === undefined ? <p role="status">Loading dates…</p> : result.failed ? <p role="alert">Could not load academic dates. Please reload.</p> : entries.length ? <AcademicDateList dates={entries} /> : <p className="mt-3 text-sm text-muted-foreground">No academic dates for this day.</p>}
      </div>
      <Link to="/settings" className="mt-3 inline-flex min-h-11 items-center text-sm underline underline-offset-4">Manage academic dates in Settings</Link>
    </section>
  </section>
}
