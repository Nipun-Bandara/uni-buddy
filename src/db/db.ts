import { deduplicateOccurrences } from '@/db/occurrence-migration'
import Dexie, { type EntityTable } from 'dexie'
import { schemaV1, schemaV2, schemaV5 } from '@/db/schema'
import type { AcademicDate, ClassOccurrence, Module, ScheduleRule, Semester, Setting, WorkSession } from '@/db/types'

export class StudentProductivityDatabase extends Dexie {
  academicDates!: EntityTable<AcademicDate, 'id'>
  semesters!: EntityTable<Semester, 'id'>
  modules!: EntityTable<Module, 'id'>
  scheduleRules!: EntityTable<ScheduleRule, 'id'>
  classOccurrences!: EntityTable<ClassOccurrence, 'id'>
  workSessions!: EntityTable<WorkSession, 'id'>
  settings!: EntityTable<Setting, 'key'>

  constructor(name = 'StudentProductivityDB') {
    super(name)
    this.version(1).stores(schemaV1)
    this.version(2).stores(schemaV2)
    // v1/v2 used JavaScript weekdays (Sunday = 0). Preserve saved class days.
    this.version(3).stores(schemaV2).upgrade(async transaction => {
      await transaction.table<ScheduleRule>('scheduleRules').toCollection().modify(rule => {
        rule.dayOfWeek = (rule.dayOfWeek + 6) % 7
      })
    })
    // Index creation runs before an upgrade callback, so cleanup needs its own version.
    this.version(4).stores(schemaV2).upgrade(async transaction => {
      await deduplicateOccurrences(transaction.table<ClassOccurrence, string>('classOccurrences'))
    })
    this.version(5).stores(schemaV5)
  }
}

export const db = new StudentProductivityDatabase()
