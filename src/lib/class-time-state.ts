/** HH:mm local wall-clock comparisons; the start is inclusive and the end is exclusive. */
export function getClassTimeState(startTime: string, endTime: string, localTime: string): 'completed' | 'current' | 'upcoming' {
  if (localTime >= endTime) return 'completed'
  if (localTime >= startTime) return 'current'
  return 'upcoming'
}
