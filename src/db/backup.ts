import { db } from '@/db/db'
import { validateBackup, type Backup } from '@/lib/backup'

/** A consistent read snapshot, including an active timer and academic dates. */
export async function createBackup(): Promise<Backup> {
  const snapshot = await db.transaction('r', db.tables, async () => {
    const [semesters, modules, scheduleRules, classOccurrences, workSessions, settings, academicDates] = await Promise.all([
      db.semesters.toArray(), db.modules.toArray(), db.scheduleRules.toArray(), db.classOccurrences.toArray(),
      db.workSessions.toArray(), db.settings.toArray(), db.academicDates.toArray(),
    ])
    return { version: 1, exportedAt: new Date().toISOString(), data: { semesters, modules, scheduleRules, classOccurrences, workSessions, settings, academicDates } }
  })
  return validateBackup(snapshot)
}

/** All tables replace together, or the entire transaction rolls back. */
export async function restoreBackup(value: unknown) {
  const { data } = validateBackup(value)
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map(table => table.clear()))
    await db.semesters.bulkAdd(data.semesters)
    await db.modules.bulkAdd(data.modules)
    await db.scheduleRules.bulkAdd(data.scheduleRules)
    await db.classOccurrences.bulkAdd(data.classOccurrences)
    await db.workSessions.bulkAdd(data.workSessions)
    await db.settings.bulkAdd(data.settings)
    await db.academicDates.bulkAdd(data.academicDates)
  })
}
