import { configured, deviceId, expiredSubscription, getDevice, json, rateLimit, removeDevice, sameOrigin, sendPush } from '../../server/reminders.js'
export async function POST(request: Request) {
  if (!configured()) return json({ error: 'Reminder server is not configured yet.' }, 503)
  if (!sameOrigin(request)) return json({ error: 'Origin not allowed.' }, 403)
  const id = deviceId(request)
  if (!id) return json({ error: 'Invalid device credential.' }, 401)
  try {
    const device = await getDevice(id)
    if (!device) return json({ error: 'Connect this device again.' }, 401)
    if (!await rateLimit(`test:${id}`, 5, 3600)) return json({ error: 'Test limit reached. Try again later.' }, 429)
    await sendPush(device, { title: 'Attendance reminders', body: 'Notifications are working. Tap to open the app.', tag: 'attendance-test' }, 60)
    return json({ sent: true })
  } catch (error) { if (expiredSubscription(error)) { await removeDevice(id); return json({ error: 'Push subscription expired. Disable, then enable reminders again.' }, 410) } return json({ error: 'Could not send the test notification.' }, 503) }
}
