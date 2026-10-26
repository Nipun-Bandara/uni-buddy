/** Date-only fields use YYYY-MM-DD; local times use HH:mm. Timestamps use ISO 8601. */
export interface Semester {
  id: string
  name: string
  startDate: string
  endDate: string
}
export interface Module {
  id: string
  semesterId: string
  code?: string
  name: string
  color?: string
}
export type ClassType = 'lecture' | 'tutorial' | 'lab' | 'other'
export interface ScheduleRule {
  id: string
  moduleId: string
  type: ClassType
  /** Monday = 0, Tuesday = 1, … Sunday = 6 (database version 3 onward). */
  dayOfWeek: number
  startTime: string
  endTime: string
  /** Positive integer: 1 = weekly, 2 = every other week. */
  repeatEveryWeeks: number
  /** YYYY-MM-DD in a known week when the class occurs. */
  anchorDate: string
  startDate: string
  endDate: string
  location?: string
}
export type AttendanceStatus = 'pending' | 'attended' | 'missed' | 'cancelled'
/** On-demand per-date attendance record/override; (scheduleRuleId, date) is unique. */
export interface ClassOccurrence {
  id: string
  scheduleRuleId: string
  date: string
  startAt: string
  endAt: string
  status: AttendanceStatus
}
export type WorkCategory = 'competitions' | 'project-development' | 'university-work'
export interface WorkSession {
  id: string
  moduleId?: string
  /** Standalone work category; absent for General and module sessions. */
  category?: WorkCategory
  title?: string
  startedAt: string
  /** Absent while the session is active. Missing values are not indexed by IndexedDB. */
  endedAt?: string
}
export type SettingValue = null | boolean | number | string | SettingValue[] | { [key: string]: SettingValue }
export interface Setting {
  key: string
  value: SettingValue
}

export type AcademicDateType = 'break' | 'holiday' | 'exam-week' | 'exam' | 'assignment'
/** Inclusive date-only range. Exams and assignments have matching start/end dates. */
export interface AcademicDate {
  id: string
  semesterId: string
  type: AcademicDateType
  title: string
  startDate: string
  endDate: string
}
