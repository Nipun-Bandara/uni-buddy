import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db/db'
import { startWorkSession, stopWorkSession } from '@/db/work-sessions'
import { saveCompletedSession } from '@/db/session-history'
import { createBackup, restoreBackup } from '@/db/backup'
import { validateBackup } from '@/lib/backup'
import { sessionFormValues } from '@/lib/session-history'
import { workCategories, workSelectionFields, workSelectionValue, workSessionLabel } from '@/lib/work-categories'
import { calculateInsights } from '@/lib/insights'

beforeEach(async () => { await db.delete(); await db.open(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-29T10:00:00Z')) })
afterEach(async () => { vi.useRealTimers(); await db.delete() })
const fields = { moduleId: '', title: '', date: '2026-10-28', endDate: '2026-10-28', startTime: '10:00', endTime: '11:00' }

describe('work category persistence', () => {
  it.each(workCategories)('starts, ends and restores $label without a module or title', async item => {
    const session = await startWorkSession({ category: item.value })
    expect(session.moduleId).toBeUndefined(); expect(session.title).toBeUndefined()
    expect(workSessionLabel(session)).toBe(item.label)
    vi.setSystemTime(new Date('2026-10-29T11:00:00Z'))
    await stopWorkSession(session.id)
    db.close(); await db.open()
    expect((await db.workSessions.get(session.id))?.category).toBe(item.value)
  })
  it('edits a category, changes to a module, and clears to General without stale fields', async () => {
    await db.modules.add({ id: 'general', semesterId: 's', name: 'Data Mining' })
    const session = await saveCompletedSession({ ...fields, category: 'competitions' })
    expect(workSelectionValue(sessionFormValues(session))).toBe('category:competitions')
    const edited = await saveCompletedSession({ ...sessionFormValues(session), ...workSelectionFields('category:project-development'), title: 'Website' }, session.id)
    expect(edited.category).toBe('project-development'); expect(edited.title).toBe('Website')
    const moduleSession = await saveCompletedSession({ ...sessionFormValues(edited), ...workSelectionFields('module:general') }, session.id)
    expect(moduleSession.moduleId).toBe('general'); expect(moduleSession.category).toBeUndefined()
    const general = await saveCompletedSession({ ...sessionFormValues(moduleSession), ...workSelectionFields('general') }, session.id)
    expect(general.moduleId).toBeUndefined(); expect(general.category).toBeUndefined(); expect(general.title).toBe('Website')
    expect(workSessionLabel(general)).toBe('General')
  })
  it('exports/restores categories and rejects invalid or mixed module/category records', async () => {
    const session = await saveCompletedSession({ ...fields, category: 'university-work', title: 'Research' })
    const backup = await createBackup()
    await db.workSessions.clear(); await restoreBackup(JSON.parse(JSON.stringify(backup)))
    expect(await db.workSessions.get(session.id)).toEqual(session)
    expect(() => validateBackup({ ...backup, data: { ...backup.data, workSessions: [{ ...session, category: 'invalid' }] } })).toThrow()
    await expect(startWorkSession({ moduleId: 'm', category: 'competitions' })).rejects.toThrow('module or a work category')
    await expect(saveCompletedSession({ ...fields, moduleId: 'm', category: 'competitions' })).rejects.toThrow('module or a work category')
  })
  it('counts category time once and keeps it distinct from General and modules', async () => {
    const sessions = await Promise.all(workCategories.map(item => saveCompletedSession({ ...fields, category: item.value })))
    sessions.push(await saveCompletedSession(fields))
    const totals = calculateInsights({ sessions, occurrences: [], rules: [], modules: [] }, 'week', new Date(2026, 9, 29, 22))
    expect(totals.productiveMs).toBe(4 * 3600000)
    expect(totals.generalMs).toBe(3600000)
    expect(totals.categoryBreakdown.map(row => row.durationMs)).toEqual([3600000, 3600000, 3600000])
    expect(totals.moduleBreakdown).toEqual([])
  })
})
