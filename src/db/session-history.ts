import { db } from '@/db/db'
import { createId } from '@/lib/ids'
import { completedSessionSchema, type SessionFormValues } from '@/lib/session-history'

/** Manual entries are completed immediately and do not affect the active timer. */
export async function saveCompletedSession(input: SessionFormValues, id?: string) {
  return db.transaction('rw', db.workSessions, db.modules, async () => {
    const existing = id ? await db.workSessions.get(id) : undefined
    if (id && (!existing || existing.endedAt === undefined)) throw new Error('Only an existing completed session can be edited.')
    const fields = completedSessionSchema(existing).parse(input)
    if (fields.moduleId && !await db.modules.get(fields.moduleId)) throw new Error('The selected module no longer exists.')
    const session = { id: existing?.id ?? createId(), ...fields }
    await db.workSessions.put(session)
    return session
  })
}

export async function deleteCompletedSession(id: string) {
  return db.transaction('rw', db.workSessions, async () => {
    const session = await db.workSessions.get(id)
    if (!session) return
    if (session.endedAt === undefined) throw new Error('Stop the active timer before deleting the session.')
    await db.workSessions.delete(id)
  })
}
