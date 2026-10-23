import type { AcademicDate } from '@/db/types'
import { academicDateLabels, academicDateRange } from '@/lib/academic-dates'

export function AcademicDateList({ dates, today }: { dates: AcademicDate[]; today?: string }) {
  return <ul className="divide-y">
    {dates.map(item => <li key={item.id} className="space-y-1 py-3">
      <p className="text-xs font-medium text-muted-foreground">{academicDateLabels[item.type]}{today && item.startDate <= today && item.endDate >= today ? ' · Today' : ''}</p>
      <h3 className="break-words text-sm font-medium">{item.title}</h3>
      <p className="text-sm text-muted-foreground">{academicDateRange(item.startDate, item.endDate)}</p>
    </li>)}
  </ul>
}
