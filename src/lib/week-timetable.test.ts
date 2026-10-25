import { describe, expect, it } from 'vitest'
import type { Module, ScheduleRule } from '@/db/types'
import { layoutTimetable, moduleShortCode, timetableMinimumSlotHeight, timetablePixelsPerMinute } from '@/lib/week-timetable'

const module: Module = { id: 'm', semesterId: 's', name: 'Data Mining' }
const rule: ScheduleRule = { id: 'r', moduleId: 'm', type: 'lecture', dayOfWeek: 0, startTime: '10:00', endTime: '12:00', repeatEveryWeeks: 1, anchorDate: '2026-10-26', startDate: '2026-10-01', endDate: '2027-02-28' }

describe('weekly timetable labels', () => {
  it('uses the saved module code or readable initials', () => {
    expect(moduleShortCode({ ...module, code: ' IT4010 ' })).toBe('IT4010')
    expect(moduleShortCode(module)).toBe('DM')
    expect(moduleShortCode({ ...module, name: 'Mathematics', code: ' ' })).toBe('MATH')
    expect(moduleShortCode({ ...module, name: '  Research   Project  ' })).toBe('RP')
  })
})

describe('weekly timetable layout', () => {
  it('positions times on Monday–Sunday columns without mutating rules', () => {
    const rules = [{ ...rule, id: 'sun', dayOfWeek: 6, startTime: '08:30', endTime: '09:30' }, rule]
    const result = layoutTimetable(rules)
    expect(result.days).toHaveLength(7)
    expect(result.start).toBe(8 * 60)
    expect(result.end).toBe(12 * 60)
    expect(result.days[0].slots[0].start).toBe(10 * 60)
    expect(result.days[6].slots[0].start).toBe(8 * 60 + 30)
    expect(rules[0].id).toBe('sun')
    expect(result.days[1].slots).toEqual([])
  })

  it('keeps simultaneous and partially overlapping classes in separate lanes', () => {
    const { days } = layoutTimetable([rule, { ...rule, id: 'lab', startTime: '11:00', endTime: '13:00', repeatEveryWeeks: 2 }, { ...rule, id: 'later', startTime: '12:00', endTime: '14:00' }])
    expect(days[0].lanes).toBe(2)
    expect(days[0].slots.map(slot => slot.lane)).toEqual([0, 1, 0])
    expect(days[0].slots[1].rule.repeatEveryWeeks).toBe(2)
  })

  it('lets back-to-back classes share a lane', () => {
    const { days } = layoutTimetable([rule, { ...rule, id: 'next', startTime: '12:00', endTime: '13:00' }])
    expect(days[0].lanes).toBe(1)
  })

  it('reserves touch-target space for short classes without hiding their neighbours', () => {
    const { days } = layoutTimetable([{ ...rule, endTime: '10:10' }, { ...rule, id: 'next', startTime: '10:15', endTime: '10:25' }])
    expect(days[0].lanes).toBe(2)
    const short = days[0].slots[0]
    expect((short.end - short.start) * timetablePixelsPerMinute - 2).toBeCloseTo(timetableMinimumSlotHeight)
  })

  it('contains a late-night short class without clipping its tap target', () => {
    const result = layoutTimetable([{ ...rule, startTime: '23:50', endTime: '23:59' }])
    expect(result.start).toBe(23 * 60)
    expect(result.end).toBeGreaterThanOrEqual(result.days[0].slots[0].end)
    expect(result.end).toBeLessThan(25 * 60)
  })
})
