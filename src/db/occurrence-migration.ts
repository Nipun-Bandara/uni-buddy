import type { Table } from 'dexie'
import type { ClassOccurrence } from '@/db/types'

/**
 * Legacy records have no updatedAt. Prefer a recorded status over pending;
 * otherwise keep the greatest primary-key ID as a deterministic tie-breaker.
 */
export async function deduplicateOccurrences(table: Table<ClassOccurrence, string>) {
  const winners = new Map<string, ClassOccurrence>()
  const discarded: string[] = []
  for (const row of await table.toArray()) {
    const key = JSON.stringify([row.scheduleRuleId, row.date])
    const previous = winners.get(key)
    if (!previous) { winners.set(key, row); continue }
    const rowRecorded = row.status !== 'pending'
    const previousRecorded = previous.status !== 'pending'
    if ((rowRecorded && !previousRecorded) || (rowRecorded === previousRecorded && row.id > previous.id)) {
      discarded.push(previous.id)
      winners.set(key, row)
    } else discarded.push(row.id)
  }
  await table.bulkDelete(discarded)
}
