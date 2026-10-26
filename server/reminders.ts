import { createHash, timingSafeEqual } from 'node:crypto'
import { Redis } from '@upstash/redis'
import webpush from 'web-push'
import { reminderDeviceSchema, type ReminderDevice } from '../src/lib/reminders.js'

export const deviceSet = 'attendance-reminders:devices'
export const deviceKey = (id: string) => `attendance-reminders:device:${id}`
export const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export const redis = () => Redis.fromEnv()
export function configured() {
  try {
    const origin = process.env.APP_ORIGIN ?? ''
    if (new URL(origin).protocol !== 'https:' || new URL(origin).origin !== origin || (process.env.REMINDER_SETUP_KEY?.length ?? 0) < 32) return false
  } catch { return false }
  return ['APP_ORIGIN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'REMINDER_SETUP_KEY', 'QSTASH_CURRENT_SIGNING_KEY', 'QSTASH_NEXT_SIGNING_KEY'].every(key => !!process.env[key])
}
export function json(value: unknown, status = 200) { return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } }) }
export function sameOrigin(request: Request) { return request.headers.get('origin') === process.env.APP_ORIGIN }
export function deviceId(request: Request): string | null {
  const token = request.headers.get('authorization')?.match(/^Bearer ([\w-]{43})$/)?.[1]
  return token ? hash(token) : null
}
export function setupMatches(value: unknown) {
  const expected = process.env.REMINDER_SETUP_KEY
  return typeof value === 'string' && !!expected && expected.length >= 32 && timingSafeEqual(Buffer.from(hash(value)), Buffer.from(hash(expected)))
}
export async function body(request: Request) {
  if (Number(request.headers.get('content-length')) > 100_000) throw new Error('Request too large')
  const text = await request.text()
  if (text.length > 100_000) throw new Error('Request too large')
  return JSON.parse(text) as unknown
}
export type StoredDevice = ReminderDevice & { updatedAt: string }
export async function getDevice(id: string): Promise<StoredDevice | null> {
  const value = await redis().get<StoredDevice>(deviceKey(id))
  return value && reminderDeviceSchema.safeParse({ subscription: value.subscription, timeZone: value.timeZone, rules: value.rules }).success ? value : null
}
export async function removeDevice(id: string) {
  await redis().multi().del(deviceKey(id)).srem(deviceSet, id).exec()
}
export async function rateLimit(key: string, maximum: number, seconds: number) {
  const store = redis(), count = await store.incr(`attendance-reminders:limit:${key}`)
  if (count === 1) await store.expire(`attendance-reminders:limit:${key}`, seconds)
  return count <= maximum
}
export async function sendPush(device: ReminderDevice, payload: unknown, ttl = 1800) {
  return webpush.sendNotification(device.subscription, JSON.stringify(payload), {
    vapidDetails: { subject: process.env.VAPID_SUBJECT!, publicKey: process.env.VAPID_PUBLIC_KEY!, privateKey: process.env.VAPID_PRIVATE_KEY! },
    TTL: Math.max(1, Math.floor(ttl)), urgency: 'normal', timeout: 8000,
  })
}
export function expiredSubscription(error: unknown) { return !!error && typeof error === 'object' && 'statusCode' in error && (error.statusCode === 404 || error.statusCode === 410) }
