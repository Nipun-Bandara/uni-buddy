/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { attendanceReminderUrl, notificationPayloadSchema } from './lib/notification-payload'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }
clientsClaim()
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }))
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting() })
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let value: unknown
    try { value = event.data?.json() } catch { /* Always show a visible fallback; Safari forbids silent pushes. */ }
    const parsed = notificationPayloadSchema.safeParse(value)
    const payload = parsed.success ? parsed.data : { title: 'Attendance reminder', body: 'Open the app to check your classes.', tag: 'attendance-reminder' }
    await self.registration.showNotification(payload.title, {
      body: payload.body, icon: '/pwa-192.png', tag: payload.tag,
      data: { url: attendanceReminderUrl('ruleId' in payload ? payload.ruleId : undefined, 'date' in payload ? payload.date : undefined) },
    })
  })())
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil((async () => {
    const candidate = new URL(event.notification.data?.url || '/', self.location.origin)
    const url = candidate.origin === self.location.origin && (candidate.pathname === '/attendance' || candidate.pathname === '/') ? candidate.href : self.location.origin
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin)
    if (existing) { await existing.navigate(url); await existing.focus() }
    else await self.clients.openWindow(url)
  })())
})
