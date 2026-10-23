import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'

export function useAcademicDates() {
  return useLiveQuery(async () => {
    try {
      const semester = await db.semesters.toCollection().first()
      const dates = semester ? await db.academicDates.where('semesterId').equals(semester.id).sortBy('startDate') : []
      return { semester, dates, failed: false }
    } catch { return { semester: undefined, dates: [], failed: true } }
  })
}
