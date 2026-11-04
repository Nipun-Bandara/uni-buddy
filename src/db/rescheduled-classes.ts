import { z } from 'zod'
import { db } from '@/db/db'
import type { AttendanceStatus, RescheduledClass } from '@/db/types'
import { createId } from '@/lib/ids'
import { localDateTimeToIso, toCalendarDate } from '@/lib/dates'
import { rescheduledClassFieldsSchema, type RescheduledClassFields } from '@/lib/rescheduled-classes'

/** One dated class, never a ScheduleRule or a generated recurrence occurrence. */
export async function saveRescheduledClass(input: RescheduledClassFields, id?: string): Promise<RescheduledClass> {
  const fields = rescheduledClassFieldsSchema.parse(input)
  return db.transaction('rw', db.rescheduledClasses, db.modules, db.semesters, async () => {
    const existing = id ? await db.rescheduledClasses.get(id) : undefined
    if (id && !existing) throw new Error('This rescheduled class no longer exists.')
    if (existing ? fields.date !== existing.date : fields.date !== toCalendarDate(new Date())) throw new Error('Add rescheduled classes for today only.')
    const semester = await db.semesters.toCollection().first()
    const module = await db.modules.get(fields.moduleId)
    const owner = existing ? await db.modules.get(existing.moduleId) : undefined
    if (!module || module.semesterId !== (existing ? owner?.semesterId : semester?.id)) throw new Error('Choose a module from this semester.')
    const unchangedTimes = existing && fields.date === existing.date && fields.startTime === existing.startTime && fields.endTime === existing.endTime
    const record: RescheduledClass = { id: existing?.id ?? createId(), ...fields,
      startAt: unchangedTimes ? existing.startAt : localDateTimeToIso(fields.date, fields.startTime),
      endAt: unchangedTimes ? existing.endAt : localDateTimeToIso(fields.date, fields.endTime),
      status: existing?.status ?? 'pending' }
    await db.rescheduledClasses.put(record)
    return record
  })
}

export async function setRescheduledAttendance(id: string, status: AttendanceStatus) {
  z.enum(['pending', 'attended', 'missed', 'cancelled']).parse(status)
  return db.transaction('rw', db.rescheduledClasses, async () => {
    const record = await db.rescheduledClasses.get(id)
    if (!record) throw new Error('This class no longer exists.')
    if (Date.parse(record.endAt) > Date.now()) throw new Error('This class has not ended yet.')
    await db.rescheduledClasses.update(id, { status })
  })
}
export async function deleteRescheduledClass(id: string) { await db.rescheduledClasses.delete(id) }
