import { describe, it, expect } from 'vitest'
import { getElapsedSeconds, formatWorkDuration } from '@/lib/work-duration'

const startedAt = '2026-10-29T10:00:00.000Z'
describe('timestamp-derived work duration', () => {
  it('derives elapsed time directly after a long gap without ticks', () => {
    expect(getElapsedSeconds(startedAt, Date.parse('2026-10-29T11:23:42.000Z'))).toBe(5022)
    expect(formatWorkDuration(5022)).toBe('01:23:42')
  })
  it('floors partial seconds and clamps a clock moved backwards', () => {
    expect(getElapsedSeconds(startedAt, Date.parse(startedAt) + 1999)).toBe(1)
    expect(getElapsedSeconds(startedAt, Date.parse(startedAt) - 1000)).toBe(0)
  })
  it('handles midnight and multiple days without wrapping at 24 hours', () => {
    expect(formatWorkDuration(getElapsedSeconds('2026-10-29T23:59:00Z', Date.parse('2026-10-30T00:01:00Z')))).toBe('00:02:00')
    expect(formatWorkDuration(25 * 3600 + 61)).toBe('25:01:01')
  })
  it('handles invalid inputs without rendering NaN', () => {
    expect(getElapsedSeconds('invalid', 0)).toBe(0)
    expect(formatWorkDuration(NaN)).toBe('00:00:00')
    expect(formatWorkDuration(-5)).toBe('00:00:00')
  })
})
