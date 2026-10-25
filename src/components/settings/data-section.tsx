import { useRef, useState, type ChangeEvent } from 'react'
import { Download, Upload } from 'lucide-react'
import { format } from 'date-fns'
import { createBackup, restoreBackup } from '@/db/backup'
import { BackupValidationError, parseBackup, type Backup } from '@/lib/backup'
import { toCalendarDate } from '@/lib/dates'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'

export function DataSection() {
  const [pendingBackup, setPendingBackup] = useState<{ backup: Backup; filename: string }>()
  const [busy, setBusy] = useState<'export' | 'read' | 'import' | null>(null)
  const [failure, setFailure] = useState('')
  const [message, setMessage] = useState('')
  const locked = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const importButton = useRef<HTMLButtonElement>(null)

  async function exportFile() {
    if (locked.current) return
    locked.current = true; setBusy('export'); setFailure(''); setMessage('')
    try {
      const backup = await createBackup()
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `student-productivity-backup-${toCalendarDate(new Date())}.json`
      document.body.append(link); link.click(); link.remove()
      // Give Safari time to start reading the download before releasing its object URL.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setMessage('Backup download started. Save the file somewhere you can find it.')
    } catch (error) { setFailure(error instanceof BackupValidationError ? error.message : 'Could not export the backup. Your local data has not changed. Please try again.') }
    finally { locked.current = false; setBusy(null) }
  }
  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || locked.current) return
    locked.current = true; setBusy('read'); setFailure(''); setMessage(''); setPendingBackup(undefined)
    try { setPendingBackup({ backup: parseBackup(await file.text()), filename: file.name }) }
    catch (error) { setFailure(error instanceof BackupValidationError ? error.message : 'Could not read this backup file. Please select it again.') }
    finally { locked.current = false; setBusy(null) }
  }
  async function importFile() {
    if (!pendingBackup || locked.current) return
    locked.current = true; setBusy('import'); setFailure('')
    try {
      await restoreBackup(pendingBackup.backup)
      setPendingBackup(undefined)
      setMessage('Backup restored. Your local data now matches the selected backup.')
    } catch (error) { setFailure(error instanceof BackupValidationError ? error.message : 'Import failed. Your previous local data was kept. Please try again.') }
    finally { locked.current = false; setBusy(null) }
  }
  const totalRecords = pendingBackup ? Object.values(pendingBackup.backup.data).reduce((total, rows) => total + rows.length, 0) : 0
  return <section aria-labelledby="data-heading" className="mt-8 space-y-4">
    <h2 id="data-heading" className="border-b pb-3 text-lg font-semibold">Data</h2>
    <p className="text-sm leading-6 text-muted-foreground">Save a local JSON copy of your data, including academic dates and any active work timer.</p>
    <div className="flex flex-col gap-3">
      <Button variant="outline" className="min-h-11 justify-start" disabled={busy !== null} onClick={() => { void exportFile() }}><Download aria-hidden="true" />{busy === 'export' ? 'Exporting…' : 'Export backup'}</Button>
      <Button ref={importButton} variant="outline" className="min-h-11 justify-start" disabled={busy !== null} onClick={() => input.current?.click()}><Upload aria-hidden="true" />{busy === 'read' ? 'Checking backup…' : 'Import backup'}</Button>
    </div>
    <input ref={input} type="file" accept=".json,application/json" className="hidden" aria-label="Choose backup JSON file" onChange={event => { void selectFile(event) }} />
    {failure && !pendingBackup && <p role="alert" className="text-sm text-destructive">{failure}</p>}
    <p role="status" className="text-sm text-muted-foreground">{message}</p>
    <AlertDialog open={!!pendingBackup} onOpenChange={next => { if (!next && !locked.current) { setPendingBackup(undefined); setFailure('') } }}>
      <AlertDialogContent className="max-h-[85dvh] overflow-y-auto" onCloseAutoFocus={event => { event.preventDefault(); importButton.current?.focus() }}>
        <AlertDialogHeader>
          <AlertDialogTitle>Replace all local data?</AlertDialogTitle>
          <AlertDialogDescription>This replaces your semesters, modules, timetable rules, attendance, work sessions, settings, and academic dates with the selected backup. Any active timer is replaced by the backup's timer state. Export your current data first if you want to keep it. This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        {pendingBackup && <div className="space-y-1 text-sm">
          <p className="break-words font-medium">{pendingBackup.filename}</p>
          <p className="text-muted-foreground">Exported {format(new Date(pendingBackup.backup.exportedAt), 'd MMM yyyy, h:mm a')}</p>
          <p className="text-muted-foreground">{totalRecords} records · {pendingBackup.backup.data.modules.length} modules · {pendingBackup.backup.data.workSessions.length} work sessions</p>
        </div>}
        {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11" disabled={busy === 'import'}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" className="min-h-11" disabled={busy === 'import'} onClick={event => { event.preventDefault(); void importFile() }}>{busy === 'import' ? 'Importing…' : 'Replace local data'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
}
