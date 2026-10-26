import { z } from 'zod'
import { reminderDeviceSchema } from '../../src/lib/reminders.js'
import { body, configured, deviceId, deviceKey, deviceSet, getDevice, hash, json, rateLimit, redis, removeDevice, sameOrigin, setupMatches } from '../../server/reminders.js'

export async function POST(request: Request) {
  if (!configured()) return json({ error: 'Reminder server is not configured yet.' }, 503)
  if (!sameOrigin(request)) return json({ error: 'Origin not allowed.' }, 403)
  const id = deviceId(request)
  if (!id) return json({ error: 'Invalid device credential.' }, 401)
  try {
    if (!await rateLimit(hash(request.headers.get('x-forwarded-for') ?? 'unknown'), 120, 3600)) return json({ error: 'Too many requests. Try again later.' }, 429)
    const input = z.object({ device: reminderDeviceSchema, setupKey: z.string().max(256).optional() }).strict().parse(await body(request))
    if (!await getDevice(id) && !setupMatches(input.setupKey)) return json({ error: 'Enter the private setup key to connect this device.' }, 401)
    const record = { ...input.device, updatedAt: new Date().toISOString() }
    // Atomic capacity check + replacement, including zero rules after deleting a semester.
    const result = await redis().eval(`
      if redis.call('EXISTS', KEYS[1]) == 0 and redis.call('SCARD', KEYS[2]) >= 5 then return 0 end
      redis.call('SET', KEYS[1], ARGV[1], 'EX', 7776000)
      redis.call('SADD', KEYS[2], ARGV[2])
      return 1`, [deviceKey(id), deviceSet], [JSON.stringify(record), id])
    return result ? json({ syncedAt: record.updatedAt, ruleCount: record.rules.length }) : json({ error: 'Five devices are already connected. Disable reminders on an unused device.' }, 409)
  } catch (error) { return json({ error: error instanceof z.ZodError || error instanceof SyntaxError ? 'Invalid reminder configuration.' : 'Could not save reminders. Try again online.' }, error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 503) }
}
export async function DELETE(request: Request) {
  if (!configured()) return json({ error: 'Reminder server is not configured yet.' }, 503)
  if (!sameOrigin(request)) return json({ error: 'Origin not allowed.' }, 403)
  const id = deviceId(request)
  if (!id) return json({ error: 'Invalid device credential.' }, 401)
  try { await removeDevice(id); return json({ removed: true }) } catch { return json({ error: 'Could not remove remote reminders. Retry online.' }, 503) }
}
