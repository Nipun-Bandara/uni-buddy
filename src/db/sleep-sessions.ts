import { db } from '@/db/db'
import type { SleepSession, WorkSession } from '@/db/types'
import { createId } from '@/lib/ids'
import { completedSleepSchema, sleepsOverlap, type SleepFormValues } from '@/lib/sleep'

export class ActiveSleepSessionError extends Error {
  constructor() { super('Sleep is already being recorded.'); this.name = 'ActiveSleepSessionError' }
}
export class OverlappingSleepError extends Error {
  constructor() { super('This sleep overlaps another sleep record.'); this.name = 'OverlappingSleepError' }
}

/** Missing endedAt values are not indexed by IndexedDB: inspect the records instead. */
export function getActiveSleepSession(): Promise<SleepSession | undefined> {
  return db.sleepSessions.filter(session => session.endedAt === undefined).first()
}

/** Records bedtime now. An active work session is ended at the same instant. */
export async function startSleepSession(): Promise<{ sleep: SleepSession; endedWork?: WorkSession }> {
  return db.transaction('rw', db.sleepSessions, db.workSessions, async () => {
    if (await getActiveSleepSession()) throw new ActiveSleepSessionError()
    const startedAt = new Date().toISOString()
    let endedWork: WorkSession | undefined
    const work = await db.workSessions.filter(session => session.endedAt === undefined).first()
    if (work) {
      endedWork = { ...work, endedAt: Date.parse(startedAt) < Date.parse(work.startedAt) ? work.startedAt : startedAt }
      await db.workSessions.put(endedWork)
    }
    const sleep: SleepSession = { id: createId(), startedAt }
    await db.sleepSessions.add(sleep)
    return { sleep, endedWork }
  })
}

/** Idempotent: a repeated/stale tap never changes an already recorded wake-up time. */
export async function stopSleepSession(id: string): Promise<SleepSession> {
  return db.transaction('rw', db.sleepSessions, async () => {
    const session = await db.sleepSessions.get(id)
    if (!session) throw new Error('The sleep record no longer exists.')
    if (session.endedAt !== undefined) return session
    const endedAt = new Date().toISOString()
    if (Date.parse(endedAt) < Date.parse(session.startedAt)) throw new Error('Device time is earlier than this sleep’s bedtime.')
    const stopped = { ...session, endedAt }
    await db.sleepSessions.put(stopped)
    return stopped
  })
}

/** Manual add/edit of a completed sleep. Overlapping another sleep (including the active one) is rejected. */
export async function saveCompletedSleep(input: SleepFormValues, id?: string): Promise<SleepSession> {
  return db.transaction('rw', db.sleepSessions, async () => {
    const existing = id ? await db.sleepSessions.get(id) : undefined
    if (id && (!existing || existing.endedAt === undefined)) throw new Error('Only an existing completed sleep can be edited.')
    const fields = completedSleepSchema(existing).parse(input)
    const others = await db.sleepSessions.filter(session => session.id !== id).toArray()
    if (others.some(other => sleepsOverlap(fields, other))) throw new OverlappingSleepError()
    const session: SleepSession = { id: existing?.id ?? createId(), ...fields }
    await db.sleepSessions.put(session)
    return session
  })
}

export async function deleteSleepSession(id: string) {
  return db.transaction('rw', db.sleepSessions, async () => {
    const session = await db.sleepSessions.get(id)
    if (!session) return
    if (session.endedAt === undefined) throw new Error('Wake up before deleting the active sleep.')
    await db.sleepSessions.delete(id)
  })
}
