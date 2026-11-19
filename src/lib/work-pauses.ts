import type { WorkPause, WorkSession } from '@/db/types'

/** True while the session is active and its last pause has not been resumed. */
export function isPaused(session: Pick<WorkSession, 'endedAt' | 'pauses'>) {
  return session.endedAt === undefined && session.pauses?.at(-1)?.endedAt === undefined && !!session.pauses?.length
}

export function openPause(session: Pick<WorkSession, 'pauses'>): WorkPause | undefined {
  const last = session.pauses?.at(-1)
  return last && last.endedAt === undefined ? last : undefined
}

/**
 * The [start, end] millisecond intervals a completed session was actually worked:
 * the session span minus its pauses. Active sessions have no worked intervals yet.
 */
export function workIntervals(session: Pick<WorkSession, 'startedAt' | 'endedAt' | 'pauses'>): [number, number][] {
  if (session.endedAt === undefined) return []
  const start = Date.parse(session.startedAt)
  const end = Date.parse(session.endedAt)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return []
  const pauses = (session.pauses ?? [])
    .map(pause => [Date.parse(pause.startedAt), pause.endedAt === undefined ? end : Date.parse(pause.endedAt)] as const)
    .filter(([first, last]) => Number.isFinite(first) && Number.isFinite(last))
    .sort((a, b) => a[0] - b[0])
  const intervals: [number, number][] = []
  let cursor = start
  for (const [first, last] of pauses) {
    const from = Math.max(first, cursor)
    const to = Math.min(last, end)
    if (to <= from) continue
    if (from > cursor) intervals.push([cursor, from])
    cursor = to
  }
  if (cursor < end) intervals.push([cursor, end])
  return intervals
}

/** Worked milliseconds of a completed session, excluding pauses. */
export function workedMs(session: Pick<WorkSession, 'startedAt' | 'endedAt' | 'pauses'>) {
  return workIntervals(session).reduce((sum, [first, last]) => sum + last - first, 0)
}

/** Paused milliseconds inside a completed session. */
export function pausedMs(session: Pick<WorkSession, 'startedAt' | 'endedAt' | 'pauses'>) {
  if (session.endedAt === undefined) return 0
  const span = Date.parse(session.endedAt) - Date.parse(session.startedAt)
  return Number.isFinite(span) && span > 0 ? Math.max(0, span - workedMs(session)) : 0
}

/** Keep only the parts of existing pauses that still fall inside a corrected start/end. */
export function clipPauses(pauses: WorkPause[] | undefined, startedAt: string, endedAt: string): WorkPause[] {
  const start = Date.parse(startedAt)
  const end = Date.parse(endedAt)
  const kept: WorkPause[] = []
  for (const pause of pauses ?? []) {
    const first = Math.max(start, Date.parse(pause.startedAt))
    const last = Math.min(end, pause.endedAt === undefined ? end : Date.parse(pause.endedAt))
    if (Number.isFinite(first) && Number.isFinite(last) && last > first) {
      kept.push({ startedAt: new Date(first).toISOString(), endedAt: new Date(last).toISOString() })
    }
  }
  return kept
}
