import { describe, expect, it } from 'vitest'
import { getClassTimeState } from '@/lib/class-time-state'

describe('getClassTimeState', () => {
  it.each([
    ['00:00', 'upcoming'], ['09:59', 'upcoming'], ['10:00', 'current'],
    ['10:01', 'current'], ['11:59', 'current'], ['12:00', 'completed'], ['23:59', 'completed'],
  ] as const)('at %s, a 10:00–12:00 slot is %s', (time, expected) => {
    expect(getClassTimeState('10:00', '12:00', time)).toBe(expected)
  })

  it('handles the last minute of the day', () => {
    expect(getClassTimeState('23:00', '23:59', '23:58')).toBe('current')
    expect(getClassTimeState('23:00', '23:59', '23:59')).toBe('completed')
  })
})
