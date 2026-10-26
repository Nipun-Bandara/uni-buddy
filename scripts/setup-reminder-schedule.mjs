import { Client } from '@upstash/qstash'
const origin = process.env.APP_ORIGIN, token = process.env.QSTASH_TOKEN
if (!origin || !token || (new URL(origin).protocol !== 'https:' || new URL(origin).origin !== origin)) throw new Error('Set APP_ORIGIN (HTTPS, no trailing slash) and QSTASH_TOKEN.')
const client = new Client({ token })
const result = await client.schedules.create({ scheduleId: 'student-attendance-reminders', destination: `${origin}/api/reminders/dispatch`, cron: '*/5 * * * *', retries: 2, body: '{}' })
console.log(`Reminder schedule configured: ${result.scheduleId}. Check the Upstash console; this schedules production HTTP calls.`)
