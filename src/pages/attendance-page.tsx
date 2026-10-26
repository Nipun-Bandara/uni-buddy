import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useSearchParams } from 'react-router'
import { AttendanceControls } from '@/components/today/attendance-controls'
import { db } from '@/db/db'
import { calendarDateSchema, localDateTimeToIso } from '@/lib/dates'
import { occursOnDate } from '@/lib/recurrence'
import { readReminderState } from '@/lib/reminder-client'
import { timeZoneSchema } from '@/lib/reminders'
import { useLocalNow } from '@/hooks/use-local-now'
import { classTypes } from '@/lib/schedule-rules'

/** Notifications identify the original rule/date, even when opened on a later day. */
export function AttendancePage() {
  const now = useLocalNow()
  const savedZone = readReminderState()?.timeZone
  const timeZone = timeZoneSchema.safeParse(savedZone).success ? savedZone : Intl.DateTimeFormat().resolvedOptions().timeZone
  const [params] = useSearchParams(), ruleId = params.get('rule') ?? '', date = params.get('date') ?? ''
  const result = useLiveQuery(async () => {
    try {
      if (!calendarDateSchema.safeParse(date).success || !ruleId || ruleId.length > 100) return { missing: true }
      const rule = await db.scheduleRules.get(ruleId)
      if (!rule || !occursOnDate(rule, date)) return { missing: true }
      const module = await db.modules.get(rule.moduleId)
      const occurrence = await db.classOccurrences.where('[scheduleRuleId+date]').equals([rule.id, date]).first()
      return { rule, module, occurrence }
    } catch { return { failed: true } }
  }, [ruleId, date])
  let ended = false
  if (result?.rule) {
    try { ended = Date.parse(localDateTimeToIso(date, result.rule.endTime, timeZone)) <= now.getTime() } catch { /* Invalid DST time: do not offer attendance for a shifted instant. */ }
  }
  return <section className="space-y-4"><h1 className="text-2xl font-semibold">Attendance</h1>
    {!result ? <p role="status">Loading class…</p> : 'failed' in result ? <p role="alert">Could not load this class. Please try again.</p> : !result.rule || !result.module ? <p>This class is no longer available on this device. Check your timetable or import your backup.</p> : <>
      <h2 className="break-words text-lg font-semibold">{result.module.name}</h2>
      <p className="text-sm text-muted-foreground">{date} · {result.rule.startTime} – {result.rule.endTime} · {classTypes[result.rule.type]} · {timeZone}</p>
      {!ended && <p>This class has not ended yet.</p>}
      <AttendanceControls rule={result.rule} date={date} occurrence={result.occurrence} ended={ended} timeZone={timeZone} label={`${result.module.name}, ${date}`} />
    </>}
    <Link to="/" className="inline-flex min-h-11 items-center text-sm underline">Back to Today</Link>
  </section>
}
