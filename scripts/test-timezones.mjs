import { spawnSync } from 'node:child_process'

const timezones = ['UTC', 'Asia/Colombo', 'America/New_York', 'Europe/Berlin', 'Pacific/Kiritimati', 'Pacific/Apia']
for (const timezone of timezones) {
  console.log(`\nTesting calendar recurrence in ${timezone}`)
  const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run'], {
    env: { ...process.env, TZ: timezone }, stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
