/** Derived from timestamps; never increment or persist elapsed seconds. */
export function getElapsedSeconds(startedAt: string, now = Date.now()): number {
  const elapsed = now - Date.parse(startedAt)
  return Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed / 1000)) : 0
}

/** Hours may exceed 24 for sessions that span midnight or multiple days. */
export function formatWorkDuration(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60]
    .map(value => String(value).padStart(2, '0')).join(':')
}
