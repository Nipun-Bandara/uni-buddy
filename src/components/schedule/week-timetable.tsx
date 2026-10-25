import type { Module, ScheduleRule } from '@/db/types'
import { classTypes, weekdays } from '@/lib/schedule-rules'
import { layoutTimetable, moduleShortCode, timetablePixelsPerMinute } from '@/lib/week-timetable'

type Props = {
  rules: ScheduleRule[]
  modules: Module[]
  onEdit: (rule: ScheduleRule) => void
}

export function WeekTimetable({ rules, modules, onEdit }: Props) {
  const { start, end, days } = layoutTimetable(rules)
  const hours = Array.from({ length: Math.ceil((end - start) / 60) + 1 }, (_, index) => start + index * 60)
  const height = (end - start) * timetablePixelsPerMinute
  const usedModules = modules.filter(module => rules.some(rule => rule.moduleId === module.id))
  return <section aria-label="Weekly timetable" className="min-w-0 space-y-4">
    <div>
      <h2 className="font-semibold">Weekly timetable</h2>
      <p id="timetable-help" className="mt-1 text-sm text-muted-foreground">Weekly pattern. Swipe across days; tap a class to edit.</p>
    </div>
    <div role="region" aria-label="Scrollable weekly timetable" aria-describedby="timetable-help" tabIndex={0}
      className="isolate max-h-[60dvh] max-w-full overflow-auto rounded-lg border focus-visible:outline-2 focus-visible:outline-ring">
      <div className="grid w-max min-w-full" style={{ gridTemplateColumns: `3.5rem ${days.map(day => `${day.lanes * 128}px`).join(' ')}` }}>
        <div className="sticky top-0 left-0 z-30 border-r border-b bg-muted px-2 py-3 text-xs font-medium text-muted-foreground">Time</div>
        {weekdays.map(day => <h3 key={day} className="sticky top-0 z-20 border-r border-b bg-muted px-2 py-3 text-center text-sm font-medium last:border-r-0">{day}</h3>)}
        <div aria-hidden="true" className="sticky left-0 z-10 border-r bg-background text-[11px] tabular-nums text-muted-foreground" style={{ height }}>
          {hours.filter(time => time <= 1440).map(time => <span key={time} className="absolute right-2" style={{ top: (time - start) * timetablePixelsPerMinute, transform: time === end ? 'translateY(-100%)' : undefined }}>
            {`${String(Math.floor(time / 60)).padStart(2, '0')}:00`}
          </span>)}
        </div>
        {days.map((day, index) => <div key={weekdays[index]} aria-label={`${weekdays[index]} classes`} className="relative border-r last:border-r-0" style={{ height }}>
          {hours.slice(0, -1).map(time => <div key={time} aria-hidden="true" className="pointer-events-none absolute inset-x-0 border-t border-border/60" style={{ top: (time - start) * timetablePixelsPerMinute }} />)}
          {!day.slots.length && <p className="px-2 py-6 text-center text-xs text-muted-foreground">No classes</p>}
          {day.slots.map(({ rule, start: slotStart, end: slotEnd, lane }) => {
            const module = modules.find(module => module.id === rule.moduleId)
            if (!module) return null
            const repeat = rule.repeatEveryWeeks === 1 ? 'Every week' : 'Every 2 weeks'
            const label = `${module.name}${module.code ? ` (${module.code})` : ''}, ${weekdays[index]}, ${rule.startTime}–${rule.endTime}, ${classTypes[rule.type]}, ${repeat}${rule.location ? `, ${rule.location}` : ''}`
            const color = module.color || 'var(--primary)'
            return <button key={rule.id} type="button" onClick={() => onEdit(rule)} aria-label={`Edit ${label}`} title={label}
              className="absolute flex min-h-12 min-w-0 flex-col items-start overflow-hidden rounded-md border border-l-4 px-1.5 py-1 text-left text-foreground shadow-xs hover:brightness-95 focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              style={{ top: (slotStart - start) * timetablePixelsPerMinute, height: (slotEnd - slotStart) * timetablePixelsPerMinute - 2,
                left: `calc(${lane / day.lanes * 100}% + 3px)`, width: `calc(${100 / day.lanes}% - 6px)`,
                borderLeftColor: color, backgroundColor: `color-mix(in oklab, ${color} 18%, var(--background))` }}>
              <span className="flex w-full items-center gap-1"><span className="min-w-0 flex-1 truncate text-sm font-semibold">{moduleShortCode(module)}</span>
                {rule.repeatEveryWeeks === 2 && <span aria-hidden="true" className="shrink-0 text-[10px] font-medium">2wk</span>}</span>
              <span className="block text-[11px] leading-4 tabular-nums">{rule.startTime} – {rule.endTime}</span>
              {(slotEnd - slotStart) * timetablePixelsPerMinute >= 72 && <span className="block text-xs leading-4">{classTypes[rule.type]}{rule.repeatEveryWeeks === 2 && <span className="block">Every 2 weeks</span>}</span>}
            </button>
          })}
        </div>)}
      </div>
    </div>
    <ul aria-label="Module key" className="space-y-2">{usedModules.map(module => <li key={module.id} className="flex items-start gap-2 text-sm">
      <span aria-hidden="true" className="mt-1 size-3 shrink-0 rounded-full border" style={{ backgroundColor: module.color || 'var(--primary)' }} />
      <span className="min-w-0 break-words"><span className="font-semibold">{moduleShortCode(module)}</span><span className="text-muted-foreground"> · {module.name}</span></span>
    </li>)}</ul>
  </section>
}
