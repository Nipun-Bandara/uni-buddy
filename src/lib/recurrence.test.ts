import { describe, expect, it } from 'vitest'
import type { ScheduleRule } from '@/db/types'
import { occursOnDate, getScheduleForDate } from '@/lib/recurrence'

function rule(overrides: Partial<ScheduleRule> = {}): ScheduleRule {
  return {
    id: 'lecture', moduleId: 'module', type: 'lecture', dayOfWeek: 3,
    startTime: '10:00', endTime: '12:00', repeatEveryWeeks: 1,
    anchorDate: '2026-10-29', startDate: '2026-10-01', endDate: '2027-02-28',
    ...overrides,
  }
}

describe('occursOnDate', () => {
  it.each([
    ['2026-10-29', true, 'weekly anchor date'],
    ['2026-11-05', true, 'following weekly occurrence'],
    ['2026-11-12', true, 'later weekly occurrence'],
    ['2026-10-30', false, 'wrong weekday'],
    ['2026-09-24', false, 'before start on matching weekday'],
    ['2027-03-04', false, 'after end on matching weekday'],
    ['2026-10-01', true, 'inclusive start before the anchor'],
  ])('%s: %s (%s)', (date, expected) => {
    expect(occursOnDate(rule(), date)).toBe(expected)
  })

  it('includes both range boundaries and a single-day schedule', () => {
    const bounded = rule({ startDate: '2026-10-29', endDate: '2026-11-12', repeatEveryWeeks: 2 })
    expect(occursOnDate(bounded, '2026-10-29')).toBe(true)
    expect(occursOnDate(bounded, '2026-11-12')).toBe(true)
    expect(occursOnDate(rule({ startDate: '2026-10-29', endDate: '2026-10-29' }), '2026-10-29')).toBe(true)
  })

  it.each([
    ['2026-10-15', true], ['2026-10-22', false], ['2026-10-29', true],
    ['2026-11-05', false], ['2026-11-12', true], ['2026-11-19', false], ['2026-11-26', true],
  ])('alternating weeks across months and before the anchor: %s → %s', (date, expected) => {
    expect(occursOnDate(rule({ repeatEveryWeeks: 2 }), date)).toBe(expected)
  })

  it.each([
    ['2026-12-31', true], ['2027-01-07', false], ['2027-01-14', true],
  ])('alternating weeks across years: %s → %s', (date, expected) => {
    expect(occursOnDate(rule({ anchorDate: '2026-12-31', repeatEveryWeeks: 2 }), date)).toBe(expected)
  })

  it.each([
    [0, '2026-10-26', '2026-10-26', true],
    [0, '2026-10-26', '2026-11-02', false],
    [0, '2026-10-26', '2026-11-09', true],
    [0, '2026-10-26', '2026-10-25', false],
    [6, '2026-10-25', '2026-10-25', true],
    [6, '2026-10-25', '2026-11-01', false],
    [6, '2026-10-25', '2026-11-08', true],
    [6, '2026-10-25', '2026-10-26', false],
    // A known occurrence week can be identified by a different day in that same week.
    [0, '2026-11-01', '2026-10-26', true],
    [0, '2026-11-01', '2026-11-02', false],
    [6, '2026-10-26', '2026-11-01', true],
    [6, '2026-10-26', '2026-11-08', false],
  ])('Monday/Sunday boundaries: weekday %s, anchor %s, date %s → %s', (dayOfWeek, anchorDate, date, expected) => {
    expect(occursOnDate(rule({ dayOfWeek, anchorDate, repeatEveryWeeks: 2 }), date)).toBe(expected)
  })

  it.each([
    ['2026-03-01', '2026-03-08', false], // US spring DST
    ['2026-03-01', '2026-03-15', true],
    ['2026-10-25', '2026-11-01', false], // US fall DST; European transition too
    ['2026-10-25', '2026-11-08', true],
  ])('calendar weeks across daylight-saving changes: %s → %s', (anchorDate, date, expected) => {
    expect(occursOnDate(rule({ dayOfWeek: 6, anchorDate, repeatEveryWeeks: 2, startDate: '2026-01-01', endDate: '2026-12-31' }), date)).toBe(expected)
  })

  it('handles leap days', () => {
    const leap = rule({ startDate: '2024-02-01', endDate: '2024-03-31', anchorDate: '2024-02-29', repeatEveryWeeks: 2 })
    expect(occursOnDate(leap, '2024-02-29')).toBe(true)
    expect(occursOnDate(leap, '2024-03-07')).toBe(false)
    expect(occursOnDate(leap, '2024-03-14')).toBe(true)
  })

  it('handles dates before 1970 without negative-modulo weekday errors', () => {
    expect(occursOnDate(rule({ startDate: '1969-12-01', endDate: '1970-01-31', anchorDate: '1969-12-25', repeatEveryWeeks: 2 }), '1970-01-08')).toBe(true)
  })

  it('keeps year 0099 distinct from 1999', () => {
    expect(occursOnDate(rule({ dayOfWeek: 3, startDate: '0099-01-01', endDate: '0099-12-31', anchorDate: '0099-01-01' }), '0099-01-01')).toBe(true)
  })

  it('uses calendar dates even when the device zone skipped a whole day', () => {
    // Pacific/Apia skipped Friday 30 Dec 2011; its Gregorian date remains a Friday.
    expect(occursOnDate(rule({ dayOfWeek: 4, startDate: '2011-12-01', endDate: '2012-01-31', anchorDate: '2011-12-16', repeatEveryWeeks: 2 }), '2011-12-30')).toBe(true)
  })

  it.each(['', '2026-2-01', '2026-02-30', '2026-13-01', '2026-10-29T00:00:00Z'])('returns false for invalid input date %s', date => {
    expect(occursOnDate(rule(), date)).toBe(false)
  })

  it.each([
    { startDate: 'invalid' }, { endDate: '2026-02-30' }, { anchorDate: '' },
    { startDate: '2027-02-28', endDate: '2026-10-01' },
    { dayOfWeek: -1 }, { dayOfWeek: 7 }, { dayOfWeek: 1.5 },
    { repeatEveryWeeks: 0 }, { repeatEveryWeeks: 3 }, { repeatEveryWeeks: 1.5 },
  ])('returns false for malformed/unsupported recurrence fields %j', overrides => {
    expect(occursOnDate(rule(overrides), '2026-10-29')).toBe(false)
  })
})

describe('getScheduleForDate', () => {
  it('filters and sorts matches by HH:mm without changing its input', () => {
    const late = rule({ id: 'late', startTime: '14:00', endTime: '16:00' })
    const early = rule({ id: 'early', startTime: '09:00', endTime: '10:00' })
    const skipped = rule({ id: 'skipped', repeatEveryWeeks: 2 })
    const otherDay = rule({ id: 'other-day', dayOfWeek: 4 })
    const rules = [late, skipped, otherDay, early]
    rules.forEach(Object.freeze)
    Object.freeze(rules)
    const result = getScheduleForDate(rules, '2026-11-05')
    expect(result).toEqual([early, late])
    expect(result).not.toBe(rules)
    expect(rules).toEqual([late, skipped, otherDay, early])
  })

  it('retains input order for equal start times', () => {
    const first = rule({ id: 'first' })
    const second = rule({ id: 'second' })
    expect(getScheduleForDate([first, second], '2026-10-29')).toEqual([first, second])
  })

  it('returns empty results for no rules, no matches, or an invalid date', () => {
    expect(getScheduleForDate([], '2026-10-29')).toEqual([])
    expect(getScheduleForDate([rule()], '2026-10-30')).toEqual([])
    expect(getScheduleForDate([rule()], 'invalid')).toEqual([])
  })
})
