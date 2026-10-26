import { createBrowserRouter } from 'react-router'
import { AppShell } from '@/components/layout/app-shell'

export const router = createBrowserRouter([{
  element: <AppShell />,
  hydrateFallbackElement: <p role="status" className="p-5 text-sm text-muted-foreground">Loading app…</p>,
  children: [
    { path: '/', lazy: async () => ({ Component: (await import('@/pages/today-page')).TodayPage }) },
    { path: '/sessions', lazy: async () => ({ Component: (await import('@/pages/sessions-page')).SessionsPage }) },
    { path: '/schedule', lazy: async () => ({ Component: (await import('@/pages/schedule-page')).SchedulePage }) },
    { path: '/insights', lazy: async () => ({ Component: (await import('@/pages/insights-page')).InsightsPage }) },
    { path: '/attendance', lazy: async () => ({ Component: (await import('@/pages/attendance-page')).AttendancePage }) },
    { path: '/settings', lazy: async () => ({ Component: (await import('@/pages/settings-page')).SettingsPage }) },
  ],
}])
