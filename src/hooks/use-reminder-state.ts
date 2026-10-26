import { useEffect, useState } from 'react'
import { readReminderState } from '@/lib/reminder-client'
export function useReminderState() {
  const [state, setState] = useState(readReminderState)
  useEffect(() => {
    const refresh = () => setState(readReminderState())
    window.addEventListener('reminder-settings-change', refresh)
    window.addEventListener('storage', refresh)
    return () => { window.removeEventListener('reminder-settings-change', refresh); window.removeEventListener('storage', refresh) }
  }, [])
  return state
}
