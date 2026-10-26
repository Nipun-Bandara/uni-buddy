import { configured, json } from '../../server/reminders.js'
export function GET() { return json({ available: configured(), publicKey: configured() ? process.env.VAPID_PUBLIC_KEY : undefined }) }
