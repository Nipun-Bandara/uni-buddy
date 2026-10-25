import type { Backup } from '@/lib/backup'

export function backupFixture(): Backup {
  return {
    version: 1, exportedAt: '2026-10-29T10:00:00.000Z', data: {
      semesters: [{ id: 's', name: 'Semester 7', startDate: '2026-10-01', endDate: '2027-02-28' }],
      modules: [{ id: 'm', semesterId: 's', code: 'IT4010', name: 'Data Mining', color: '#3b82f6' }],
      scheduleRules: [{ id: 'r', moduleId: 'm', type: 'lecture', dayOfWeek: 3, startTime: '10:00', endTime: '12:00', repeatEveryWeeks: 1, anchorDate: '2026-10-29', startDate: '2026-10-01', endDate: '2027-02-28', location: 'Hall 2' }],
      classOccurrences: [{ id: 'o', scheduleRuleId: 'r', date: '2026-10-22', startAt: '2026-10-22T04:30:00.000Z', endAt: '2026-10-22T06:30:00.000Z', status: 'attended' }],
      workSessions: [{ id: 'completed', moduleId: 'm', title: 'Review', startedAt: '2026-10-28T10:00:00.123Z', endedAt: '2026-10-28T11:00:00.789Z' }, { id: 'active', startedAt: '2026-10-29T09:00:00.000Z' }],
      settings: [{ key: 'preferences', value: { enabled: true, count: 3, label: 'Study', nested: [null, false, { key: 'value' }] } }],
      academicDates: [{ id: 'break', semesterId: 's', type: 'break', title: 'Mid-semester break', startDate: '2026-11-02', endDate: '2026-11-08' }],
    },
  }
}
