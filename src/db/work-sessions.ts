import { z } from 'zod'
import { workCategorySchema } from '@/lib/work-categories'
import { db } from '@/db/db'
import type { WorkSession } from '@/db/types'
import { createId } from '@/lib/ids'
import { openPause } from '@/lib/work-pauses'

const startSessionSchema = z.object({
  moduleId: z.string().trim().optional().transform(value => value || undefined),
  category: workCategorySchema.optional(),
  title: z.string().trim().optional().transform(value => value || undefined),
}).refine(value => !value.moduleId || !value.category, 'Choose a module or a work category.')

export class ActiveWorkSessionError extends Error {
  constructor() { super('A work session is already active.'); this.name = 'ActiveWorkSessionError' }
}

/** Missing endedAt values are not indexed by IndexedDB: inspect the records instead. */
export function getActiveWorkSession(): Promise<WorkSession | undefined> {
  return db.workSessions.filter(session => session.endedAt === undefined).first()
}

/** The write transaction serializes active checks and inserts, including across tabs. */
export async function startWorkSession(input: { moduleId?: string; category?: WorkSession['category']; title?: string } = {}): Promise<WorkSession> {
  const fields = startSessionSchema.parse(input)
  return db.transaction('rw', db.workSessions, db.modules, db.semesters, async () => {
    if (await getActiveWorkSession()) throw new ActiveWorkSessionError()
    if (fields.moduleId) {
      const semester = await db.semesters.toCollection().first()
      const module = await db.modules.get(fields.moduleId)
      if (!module || module.semesterId !== semester?.id) throw new Error('Choose a module from the current semester.')
    }
    const session: WorkSession = { id: createId(), ...fields, startedAt: new Date().toISOString() }
    await db.workSessions.add(session)
    return session
  })
}

/**
 * Completes a session at `endedAtIso`. A paused session ends at the moment it was paused,
 * so the break is never counted and the open pause is dropped.
 */
export function finishWorkSession(session: WorkSession, endedAtIso: string): WorkSession {
  const open = openPause(session)
  const endedAt = open ? open.startedAt : endedAtIso
  if (Date.parse(endedAt) < Date.parse(session.startedAt)) throw new Error('Device time is earlier than this session’s start time.')
  const { pauses, ...rest } = session
  const closed = open ? pauses!.slice(0, -1) : pauses
  return { ...rest, endedAt, ...(closed?.length ? { pauses: closed } : {}) }
}

/** Idempotent stop: a repeated/stale tap never changes an already recorded end time. */
export async function stopWorkSession(id: string): Promise<WorkSession> {
  return db.transaction('rw', db.workSessions, async () => {
    const session = await db.workSessions.get(id)
    if (!session) throw new Error('The work session no longer exists.')
    if (session.endedAt !== undefined) return session
    const stopped = finishWorkSession(session, new Date().toISOString())
    await db.workSessions.put(stopped)
    return stopped
  })
}

/** Idempotent: pausing an already paused (or finished) session changes nothing. */
export async function pauseWorkSession(id: string): Promise<WorkSession> {
  return db.transaction('rw', db.workSessions, async () => {
    const session = await db.workSessions.get(id)
    if (!session) throw new Error('The work session no longer exists.')
    if (session.endedAt !== undefined || openPause(session)) return session
    const startedAt = new Date().toISOString()
    const lastEnd = session.pauses?.at(-1)?.endedAt ?? session.startedAt
    if (Date.parse(startedAt) < Date.parse(lastEnd)) throw new Error('Device time is earlier than this session’s last activity.')
    const paused = { ...session, pauses: [...(session.pauses ?? []), { startedAt }] }
    await db.workSessions.put(paused)
    return paused
  })
}

/** Idempotent: resuming a session that is not paused changes nothing. */
export async function resumeWorkSession(id: string): Promise<WorkSession> {
  return db.transaction('rw', db.workSessions, async () => {
    const session = await db.workSessions.get(id)
    if (!session) throw new Error('The work session no longer exists.')
    const open = openPause(session)
    if (session.endedAt !== undefined || !open) return session
    const endedAt = new Date().toISOString()
    if (Date.parse(endedAt) < Date.parse(open.startedAt)) throw new Error('Device time is earlier than the pause start.')
    const resumed = { ...session, pauses: [...session.pauses!.slice(0, -1), { ...open, endedAt }] }
    await db.workSessions.put(resumed)
    return resumed
  })
}
