import Dexie, { type EntityTable } from 'dexie'
import { schemaV1 } from '@/db/schema'
import type { ClassOccurrence, Module, ScheduleRule, Semester, Setting, WorkSession } from '@/db/types'

class StudentProductivityDatabase extends Dexie {
  semesters!: EntityTable<Semester, 'id'>
  modules!: EntityTable<Module, 'id'>
  scheduleRules!: EntityTable<ScheduleRule, 'id'>
  classOccurrences!: EntityTable<ClassOccurrence, 'id'>
  workSessions!: EntityTable<WorkSession, 'id'>
  settings!: EntityTable<Setting, 'key'>

  constructor() {
    super('StudentProductivityDB')
    this.version(1).stores(schemaV1)
  }
}

export const db = new StudentProductivityDatabase()
