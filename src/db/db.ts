import Dexie, { type EntityTable } from 'dexie'
import { schemaV1, schemaV2 } from '@/db/schema'
import type { AcademicDate, ClassOccurrence, Module, ScheduleRule, Semester, Setting, WorkSession } from '@/db/types'

class StudentProductivityDatabase extends Dexie {
  academicDates!: EntityTable<AcademicDate, 'id'>
  semesters!: EntityTable<Semester, 'id'>
  modules!: EntityTable<Module, 'id'>
  scheduleRules!: EntityTable<ScheduleRule, 'id'>
  classOccurrences!: EntityTable<ClassOccurrence, 'id'>
  workSessions!: EntityTable<WorkSession, 'id'>
  settings!: EntityTable<Setting, 'key'>

  constructor() {
    super('StudentProductivityDB')
    this.version(1).stores(schemaV1)
    this.version(2).stores(schemaV2)
    // v1/v2 used JavaScript weekdays (Sunday = 0). Preserve saved class days.
    this.version(3).stores(schemaV2).upgrade(async transaction => {
      await transaction.table<ScheduleRule>('scheduleRules').toCollection().modify(rule => {
        rule.dayOfWeek = (rule.dayOfWeek + 6) % 7
      })
    })
  }
}

export const db = new StudentProductivityDatabase()
