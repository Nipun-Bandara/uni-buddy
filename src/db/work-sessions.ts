import { z } from 'zod'
import { db } from '@/db/db'
import type { WorkSession } from '@/db/types'
import { createId } from '@/lib/ids'

const startSessionSchema = z.object({
  moduleId: z.string().trim().optional().transform(value => value || undefined),
  title: z.string().trim().optional().transform(value => value || undefined),
})

export class ActiveWorkSessionError extends Error {
  constructor() { super('A work session is already active.'); this.name = 'ActiveWorkSessionError' }
}

/** Missing endedAt values are not indexed by IndexedDB: inspect the records instead. */
export function getActiveWorkSession(): Promise<WorkSession | undefined> {
  return db.workSessions.filter(session => session.endedAt === undefined).first()
}

/** The write transaction serializes active checks and inserts, including across tabs. */
export async function startWorkSession(input: { moduleId?: string; title?: string } = {}): Promise<WorkSession> {
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

/** Idempotent stop: a repeated/stale tap never changes an already recorded end time. */
export async function stopWorkSession(id: string): Promise<WorkSession> {
  return db.transaction('rw', db.workSessions, async () => {
    const session = await db.workSessions.get(id)
    if (!session) throw new Error('The work session no longer exists.')
    if (session.endedAt !== undefined) return session
    const endedAt = new Date().toISOString()
    if (Date.parse(endedAt) < Date.parse(session.startedAt)) throw new Error('Device time is earlier than this session’s start time.')
    const stopped = { ...session, endedAt }
    await db.workSessions.put(stopped)
    return stopped
  })
}
