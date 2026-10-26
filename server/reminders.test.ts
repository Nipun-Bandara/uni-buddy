import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ get: vi.fn(), incr: vi.fn(), expire: vi.fn(), eval: vi.fn(), smembers: vi.fn(), set: vi.fn(), del: vi.fn(), multi: vi.fn(), send: vi.fn(), verify: vi.fn() }))
vi.mock('@upstash/redis', () => ({ Redis: { fromEnv: () => mocks } }))
vi.mock('web-push', () => ({ default: { sendNotification: mocks.send } }))
vi.mock('@upstash/qstash', () => ({ Receiver: class { verify = mocks.verify } }))
import { POST as register, DELETE as remove } from '../api/reminders/device'
import { POST as dispatch } from '../api/reminders/dispatch'
import { POST as testPush } from '../api/reminders/test'
import { GET as config } from '../api/reminders/config'
import { deviceKey, hash } from './reminders'

const token = 'a'.repeat(43), origin = 'https://student.example.com'
const device = { subscription: { endpoint: 'https://web.push.apple.com/test', keys: { p256dh: 'A'.repeat(87), auth: 'B'.repeat(22) } }, timeZone: 'Asia/Colombo', rules: [{ id: 'r', label: 'Data Mining', type: 'lecture', dayOfWeek: 3, endTime: '12:00', repeatEveryWeeks: 1, anchorDate: '2026-10-29', startDate: '2026-10-01', endDate: '2027-02-28' }] }
const saved = { ...device, updatedAt: '2026-10-28T00:00:00Z' }
function request(path: string, body?: unknown, headers: Record<string, string> = {}) { return new Request(`${origin}/api/reminders/${path}`, { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${token}`, ...headers }, body: JSON.stringify(body ?? {}) }) }
beforeEach(() => {
  vi.clearAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers()
  for (const key of ['APP_ORIGIN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'REMINDER_SETUP_KEY', 'QSTASH_CURRENT_SIGNING_KEY', 'QSTASH_NEXT_SIGNING_KEY']) vi.stubEnv(key, key === 'APP_ORIGIN' ? origin : 's'.repeat(40))
  mocks.get.mockResolvedValue(null); mocks.incr.mockResolvedValue(1); mocks.eval.mockResolvedValue(1); mocks.expire.mockResolvedValue(1); mocks.set.mockResolvedValue('OK'); mocks.smembers.mockResolvedValue([hash(token)]); mocks.verify.mockResolvedValue(true); mocks.send.mockResolvedValue({ statusCode: 201 })
  const transaction = { del: vi.fn().mockReturnThis(), srem: vi.fn().mockReturnThis(), exec: vi.fn().mockResolvedValue([]) }; mocks.multi.mockReturnValue(transaction)
})

describe('protected reminder functions', () => {
  it('reports unavailable without server configuration and never exposes secrets', async () => {
    vi.stubEnv('VAPID_PRIVATE_KEY', '')
    expect(await config().json()).toEqual({ available: false })
    expect((await register(request('device', { device }))).status).toBe(503)
  })
  it('requires setup key for new devices and a valid same-origin bearer credential', async () => {
    expect((await register(request('device', { device }))).status).toBe(401)
    expect((await register(request('device', { device, setupKey: 'wrong' }))).status).toBe(401)
    expect((await register(request('device', { device }, { Origin: 'https://evil.com' }))).status).toBe(403)
    expect((await register(request('device', { device }, { Authorization: 'Bearer bad' }))).status).toBe(401)
    expect(mocks.eval).not.toHaveBeenCalled()
  })
  it('registers a device atomically with a cap and expiry, without storing its bearer/setup key', async () => {
    expect((await register(request('device', { device, setupKey: 's'.repeat(40) }))).status).toBe(200)
    expect(mocks.eval).toHaveBeenCalledOnce()
    const args = mocks.eval.mock.calls[0]
    expect(args[1]).toEqual([deviceKey(hash(token)), 'attendance-reminders:devices'])
    expect(args[2][0]).not.toContain('s'.repeat(40)); expect(args[2][0]).not.toContain(token)
    mocks.eval.mockResolvedValue(0)
    expect((await register(request('device', { device, setupKey: 's'.repeat(40) }))).status).toBe(409)
  })
  it('replaces existing rules without requiring setup again, including an empty timetable', async () => {
    mocks.get.mockResolvedValue(saved)
    expect((await register(request('device', { device: { ...device, rules: [] } }))).status).toBe(200)
    expect(JSON.parse(mocks.eval.mock.calls[0][2][0]).rules).toEqual([])
  })
  it('rejects invalid payloads and rate limits registration/test requests', async () => {
    expect((await register(request('device', { device: { ...device, attendance: [] } }))).status).toBe(400)
    mocks.incr.mockResolvedValue(121)
    expect((await register(request('device', { device }))).status).toBe(429)
    mocks.get.mockResolvedValue(saved)
    expect((await testPush(request('test'))).status).toBe(429)
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it('deletes only the credential-scoped device and supports retrying deletion', async () => {
    const req = new Request(`${origin}/api/reminders/device`, { method: 'DELETE', headers: { Origin: origin, Authorization: `Bearer ${token}` } })
    expect((await remove(req)).status).toBe(200)
    expect(mocks.multi).toHaveBeenCalledOnce()
  })
  it('refuses unsigned or invalidly signed dispatcher requests', async () => {
    expect((await dispatch(request('dispatch'))).status).toBe(401)
    mocks.verify.mockRejectedValue(new Error('signature invalid'))
    expect((await dispatch(request('dispatch', {}, { 'upstash-signature': 'bad' }))).status).toBe(401)
    expect(mocks.smembers).not.toHaveBeenCalled()
  })
  it('sends the original date, excludes unrelated local data, and deduplicates deliveries', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-29T06:35:00Z'))
    mocks.get.mockResolvedValue(saved)
    expect((await dispatch(request('dispatch', {}, { 'upstash-signature': 'signed' }))).status).toBe(200)
    expect(mocks.send).toHaveBeenCalledOnce()
    const payload = JSON.parse(mocks.send.mock.calls[0][1]); expect(payload.ruleId).toBe('r'); expect(payload.date).toBe('2026-10-29')
    expect(payload).not.toHaveProperty('status'); expect(payload).not.toHaveProperty('workSessions')
    mocks.set.mockResolvedValue(null)
    await dispatch(request('dispatch', {}, { 'upstash-signature': 'signed' }))
    expect(mocks.send).toHaveBeenCalledOnce()
  })
  it('bounds each invocation to five push attempts', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-29T06:35:00Z'))
    mocks.get.mockResolvedValue({ ...saved, rules: Array.from({ length: 6 }, (_, i) => ({ ...device.rules[0], id: `r${i}` })) })
    const response = await dispatch(request('dispatch', {}, { 'upstash-signature': 'signed' }))
    expect(mocks.send).toHaveBeenCalledTimes(5)
    expect(await response.json()).toEqual({ processed: true, morePending: true })
  })
  it('releases delivery leases on a temporary failure and removes expired subscriptions', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-29T06:35:00Z')); mocks.get.mockResolvedValue(saved)
    mocks.send.mockRejectedValue({ statusCode: 503 })
    expect((await dispatch(request('dispatch', {}, { 'upstash-signature': 'signed' }))).status).toBe(503)
    expect(mocks.del).toHaveBeenCalledOnce()
    mocks.send.mockRejectedValue({ statusCode: 410 })
    expect((await dispatch(request('dispatch', {}, { 'upstash-signature': 'signed' }))).status).toBe(200)
    expect(mocks.multi).toHaveBeenCalled()
  })
  it('does not send an outdated snapshot after a sync/delete and does not send before end time', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-29T06:35:00Z')); mocks.get.mockResolvedValueOnce(saved).mockResolvedValueOnce(null)
    await dispatch(request('dispatch', {}, { 'upstash-signature': 'signed' })); expect(mocks.send).not.toHaveBeenCalled()
    vi.setSystemTime(new Date('2026-10-29T06:29:00Z')); mocks.get.mockResolvedValue(saved)
    await dispatch(request('dispatch', {}, { 'upstash-signature': 'signed' })); expect(mocks.send).not.toHaveBeenCalled()
  })
})
