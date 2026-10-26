# Attendance reminders: approved minimal design and setup

The application remains a local-first Vite PWA on Vercel. Optional reminders add four small Vercel functions, one Upstash Redis database, and one QStash schedule. No attendance or work-session database is hosted remotely.

## iPhone limitations

An iOS/iPadOS 16.4+ Home Screen web app can request Web Push permission after a direct tap. Safari does not support silent push; the worker must display a notification when a push arrives. An installed web app is not a dependable future local-alarm scheduler: JavaScript timers and worker lifetime cannot schedule arbitrary notifications while closed. A remote scheduler sends Web Push, waking the worker briefly. Delivery can be late or unavailable because of connectivity, permissions, Focus, platform behavior, or provider outages. This is an attendance prompt, not an exact alarm. See [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) and [Apple Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers).

## What runs where

```text
Home Screen PWA --opt-in subscription + minimal rules--> Vercel device function --> Redis
QStash --signed call every 5 minutes--> Vercel dispatcher --encrypted Web Push--> iPhone
notification tap --> /attendance?rule=...&date=YYYY-MM-DD --> local Dexie attendance upsert
```

- Local: semester/modules, complete timetable, academic dates, attendance, work sessions, backups. Notification links load the original rule/date locally, even on a later day; existing status can be changed. No occurrence is generated until the user marks attendance. Clearing local data or opening on another device does not recover it from the reminder server.
- Remote: push endpoint and encryption keys, minimal lecture/lab reminder rules (ID, module label, class type, weekday, end time, interval, anchor and inclusive date bounds), explicit IANA timezone, last sync time, hashed device credential, rate limits and deduplication metadata. Tutorial/other rules are not reminders in this step. No module IDs, class start times, locations, attendance statuses or work sessions are uploaded.
- Vercel Functions handle device registration/sync/deletion, a test push, and dispatch. They are request handlers, not always-running timers. QStash triggers the dispatcher independently of whether the phone/app is open.
- Redis retains connected-device configuration for 90 days since last successful sync; the app renews it on foreground sync at least daily. The scheduler prunes expired/revoked devices. Delivery keys expire after seven days. Disabling deletes this installation's remote record and unsubscribes locally; offline deletion stays pending and retries when the app next runs online. Queued/in-flight platform delivery is not an exact cancellation guarantee.
- The custom worker uses `injectManifest`, retains offline precaching/navigation fallback and prompt-driven updates, and adds push/click handlers. API requests are excluded from SPA fallback and caches. No second worker registration is added.

## Dates, recurrence and reliability

Timetable dates stay `YYYY-MM-DD`, with Monday = 0. Recurrence reuses `occursOnDate`. End time is combined with the class date in the saved IANA timezone (default Asia/Colombo), then converted to a UTC instant with date-fns-tz. The timezone remains fixed when travelling. DST gaps are rejected instead of shifted; repeated wall-clock times resolve deterministically to one instant. The attendance link also saves occurrence timestamps using the timetable timezone.

One dispatcher call every five minutes means normal scheduling delay up to about five minutes plus provider/phone delay. The sender catches up only the preceding 30 minutes, sets a remaining TTL, and carries the original date in its message/link. A leased deduplication record and stable notification tag reduce retries/duplicates; crashes can still cause a duplicate delivery. No exactly-once or exact-time promise is made. Each invocation attempts at most five pushes to bound serverless work; additional due reminders wait for the next call. Temporary push failures release the lease; later scheduler calls/retries may try again. Push-service 404/410 responses remove the subscription. Timetable edits and backup imports sync when the app next runs online; until then the server uses its last synced timetable. Academic breaks/holidays currently do not suppress recurrence, matching the existing engine rather than adding new exception behavior.

Attendance remains local, so the server cannot know whether it is already recorded or cancelled. It may remind you anyway. The attendance screen shows your local saved status. Suppressing those pushes would require synchronizing additional completion information, deliberately excluded here. Notification action buttons are not required; tap opens normal accessible local attendance controls.

## Protection and privacy

Connecting a new device requires the owner's private setup key, entered explicitly in Settings. There is no public anonymous registration or bundled admin key. A random per-installation bearer credential is stored in this origin's localStorage; only its hash is used remotely. The setup key is used transiently and cleared from the field. Device credentials and subscription state are not Dexie settings and are excluded from backup export/import. Existing device updates/deletion require that installation's credential. Registration/test routes have rate limits and the personal service is capped at five installations. Pair only your own devices; do not publish the setup key.

QStash callbacks require signature verification against the fixed production URL. Subscription endpoints are restricted to HTTPS hosts for supported browser push services to prevent arbitrary server-side requests. VAPID private key, Redis credentials, setup key and scheduler signing secrets remain server environment variables; never use a VITE_ prefix. The PWA receives only the public VAPID key. Requests/responses are not cached and endpoint/token/payload values are not logged by app code.

Opt-in exposes class labels/times to your Vercel/Upstash service; transport encryption does not hide the stored timetable from those providers. Web Push payloads are encrypted in transit to the browser's subscription, but notifications may reveal class names/dates on the Lock Screen. Check the providers' current data/security policies before using sensitive labels. Nobody can reconstruct attendance history from this service because it is never sent.

## Free-tier fit

Vercel Hobby cron runs only once a day with coarse timing, so it is not used. A small Vercel function is sufficient for each check/send, with Redis providing durable storage between invocations. QStash's free allowance currently includes 1,000 messages/day and 10 active schedules; one five-minute schedule uses 288 deliveries/day before retries. The script limits automatic retries to two, but monitor usage and outages. Redis currently offers 256 MB and 500,000 monthly commands, ample for a small personal timetable at this cadence. Free tiers have quotas and no delivery SLA; usage or policies can change. Sources: [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [QStash pricing](https://upstash.com/pricing/qstash), [Redis pricing](https://upstash.com/pricing/redis).

## Setup (owner performs once)

1. In one Upstash account create a **free Redis database** and enable **QStash**. Keep the free plans selected. Copy the Redis REST URL/token and QStash current/next signing keys into Vercel's **Production** environment variables.
2. Generate VAPID keys locally (do not commit the private output):

   ```sh
   npx web-push generate-vapid-keys
   ```

3. Generate a separate private pairing key locally:

   ```sh
   node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url') + '\n')"
   ```

4. Use [.env.example](../.env.example) as the variable checklist. Set APP_ORIGIN to your stable production HTTPS origin, with no trailing slash or path. Set VAPID_SUBJECT to a real `mailto:` contact. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, REMINDER_SETUP_KEY, both QStash signing keys, and both Redis REST variables. Do not paste these secrets into chat or commit an actual .env file. Keep the same VAPID keys on later deployments; changing them requires device reconnection.
5. Push/deploy the code to Vercel. No Vercel cron entry is needed. Verify `/api/reminders/config` returns `available: true` and only the public key. Preview deployments without these Production variables remain usable with reminders unavailable. If Vercel deployment protection blocks scheduler access, allow the public production callback to reach its signature-protected route; do not disable its signature validation.
6. Copy the QStash API token into a private local `.env.reminders.local` together with APP_ORIGIN, using the same stable origin. Create/update the single schedule:

   ```sh
   node --env-file=.env.reminders.local scripts/setup-reminder-schedule.mjs
   ```

   This is an explicit remote mutation. Run it only for your actual production origin, not preview URLs. The fixed schedule ID updates the same schedule rather than adding duplicates. In Upstash confirm the callback is `/api/reminders/dispatch`, cadence is five minutes, retries are two, and signed calls return 200. See [QStash schedules](https://upstash.com/docs/qstash/features/schedules) and [signature verification](https://upstash.com/docs/qstash/howto/signature).
7. On iPhone, open the deployed Home Screen app online, accept the app update if offered, then Settings → Attendance reminders. Confirm Asia/Colombo (or the timetable's own IANA timezone), enter the private setup key, tap Enable reminders and allow the system permission request. Tap Send test notification. Check iOS Settings → Notifications if denied or hidden by Focus. The app does not request permission on startup.
8. Add a test lecture/lab with a real matching occurrence ending a few minutes ahead, sync, close the app, and wait for push delivery. Tap it and mark attendance; reload and check persistence and no duplicate occurrence. Test opening a reminder the following day too. Change/delete a rule and verify sync; disable and confirm the remote device record is removed.

To stop the backend completely, disable each connected device and delete/pause the named QStash schedule in the Upstash console. A future setup key rotation blocks new pairing with the old key; existing per-device credentials remain valid until those device records are deleted.

## Verification boundary

Local automated checks can cover recurrence/timezones, validated payloads, protected APIs, mocked push dispatch/retry/expiry, opt-in UI, deep links, offline shell and update preservation. Actual APNs delivery with the app closed must be checked on the installed iPhone after the owner configures provider credentials and deploys. No live external account resources or real-device notifications are created by simply building this repository.

Implemented verification: 160 automated cases (157 pass in Colombo, three DST-specific cases additionally pass in New York), with the suite checked across six timezone environments. Production browser tests used isolated local data and mocked remote/push APIs to verify explicit permission opt-in, minimal configuration sync, private-key exclusion, original-date attendance and timezone correctness after travel, edit/delete sync, offline deletion retry, and unconfigured-service behavior. The bundled worker's push handler was exercised through Chromium's debugging API with its platform display API mocked. Browser checks also cover offline deep links and custom-worker update deferral. No real APNs notification was sent; final iPhone delivery remains a deployment/device test.
