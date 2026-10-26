import { Receiver } from '@upstash/qstash'
import { dueReminders } from '../../src/lib/reminders.js'
import { configured, deviceSet, expiredSubscription, getDevice, hash, json, redis, removeDevice, sendPush } from '../../server/reminders.js'

export async function POST(request: Request) {
  if (!configured()) return json({ error: 'Reminders unavailable.' }, 503)
  const text = await request.text(), signature = request.headers.get('upstash-signature')
  if (text.length > 1024 || !signature) return json({ error: 'Invalid scheduler request.' }, 401)
  const receiver = new Receiver({ currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!, nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY! })
  try { if (!await receiver.verify({ signature, body: text, url: `${process.env.APP_ORIGIN}/api/reminders/dispatch` })) return json({ error: 'Invalid signature.' }, 401) }
  catch { return json({ error: 'Invalid signature.' }, 401) }
  const store = redis(), now = Date.now()
  let failed = false, attempts = 0
  try {
    const ids = await store.smembers<string[]>(deviceSet)
    for (const id of ids) {
      const device = await getDevice(id)
      if (!device) { await removeDevice(id); continue }
      for (const reminder of dueReminders(device, now)) {
        const key = `attendance-reminders:sent:${hash(`${id}:${reminder.rule.id}:${reminder.date}`)}`
        // Lease before sending; mark sent afterwards. A crash can cause a retry, never promise exactly-once push.
        if (!await store.set(key, 'pending', { nx: true, ex: 60 })) continue
        if (attempts >= 5) { await store.del(key); return json({ processed: true, morePending: true }, failed ? 503 : 200) }
        attempts++
        try {
          const latest = await getDevice(id)
          if (!latest || latest.updatedAt !== device.updatedAt) { await store.del(key); continue }
          await sendPush(device, { title: reminder.rule.label, body: `Did you attend your ${reminder.rule.type} on ${reminder.date}?`, ruleId: reminder.rule.id, date: reminder.date, tag: `attendance:${reminder.rule.id}:${reminder.date}` }, (reminder.dueAt + 1800000 - now) / 1000)
          await store.set(key, 'sent', { ex: 7 * 86400 })
        } catch (error) {
          await store.del(key)
          if (expiredSubscription(error)) { await removeDevice(id); break }
          failed = true
        }
      }
    }
    return json({ processed: true }, failed ? 503 : 200)
  } catch { return json({ error: 'Reminder delivery failed.' }, 503) }
}
