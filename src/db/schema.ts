/** Version 1: primary keys and only the indexes needed for basic relationships/queries. */
export const schemaV1 = {
  semesters: 'id',
  modules: 'id, semesterId',
  scheduleRules: 'id, moduleId',
  classOccurrences: 'id, scheduleRuleId, date',
  workSessions: 'id, moduleId, startedAt',
  settings: 'key',
}

/** Additive migration: preserve all existing version 1 records. */
export const schemaV2 = {
  ...schemaV1,
  academicDates: 'id, semesterId',
}
