import { createBrowserRouter } from 'react-router'
import { AppShell } from '@/components/layout/app-shell'
import { TodayPage } from '@/pages/today-page'
import { SessionsPage } from '@/pages/sessions-page'
import { SchedulePage } from '@/pages/schedule-page'
import { InsightsPage } from '@/pages/insights-page'
import { SettingsPage } from '@/pages/settings-page'

export const router = createBrowserRouter([{ element: <AppShell />, children: [
  { path: '/', element: <TodayPage /> },
  { path: '/sessions', element: <SessionsPage /> },
  { path: '/schedule', element: <SchedulePage /> },
  { path: '/insights', element: <InsightsPage /> },
  { path: '/settings', element: <SettingsPage /> },
] }])
