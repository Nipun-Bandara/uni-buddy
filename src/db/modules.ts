import { db } from '@/db/db'

/** Keep reference checks and deletion atomic. Future cascade/archive policies belong here. */
export async function deleteModule(id: string): Promise<boolean> {
  return db.transaction('rw', db.modules, db.scheduleRules, db.workSessions, async () => {
    if (await db.scheduleRules.where('moduleId').equals(id).count() ||
        await db.workSessions.where('moduleId').equals(id).count()) return false
    await db.modules.delete(id)
    return true
  })
}
