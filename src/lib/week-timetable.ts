import type { Module, ScheduleRule } from '@/db/types'

export const timetablePixelsPerMinute = 1.5
export const timetableMinimumSlotHeight = 48

export function moduleShortCode(module: Module): string {
  if (module.code?.trim()) return module.code.trim()
  const words = module.name.trim().split(/\s+/).filter(Boolean)
  return words.length > 1
    ? words.slice(0, 4).map(word => Array.from(word)[0]).join('').toLocaleUpperCase()
    : Array.from(words[0] ?? 'Class').slice(0, 4).join('').toLocaleUpperCase()
}

function minutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

/** Monday = 0. Lanes keep overlapping rules and minimum-size touch targets separate. */
export function layoutTimetable(rules: ScheduleRule[]) {
  const minimumMinutes = (timetableMinimumSlotHeight + 2) / timetablePixelsPerMinute
  const slots = [...rules]
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id))
    .map(rule => ({ rule, start: minutes(rule.startTime), end: Math.max(minutes(rule.endTime), minutes(rule.startTime) + minimumMinutes) }))
  const start = slots.length ? Math.floor(Math.min(...slots.map(slot => slot.start)) / 60) * 60 : 8 * 60
  const end = slots.length ? Math.max(Math.ceil(Math.max(...slots.map(slot => minutes(slot.rule.endTime))) / 60) * 60, ...slots.map(slot => slot.end)) : 18 * 60
  const days = Array.from({ length: 7 }, (_, day) => {
    const laneEnds: number[] = []
    const daySlots = slots.filter(slot => slot.rule.dayOfWeek === day).map(slot => {
      let lane = laneEnds.findIndex(end => end <= slot.start)
      if (lane < 0) lane = laneEnds.length
      laneEnds[lane] = slot.end
      return { ...slot, lane }
    })
    return { slots: daySlots, lanes: Math.max(1, laneEnds.length) }
  })
  return { start, end, days }
}
