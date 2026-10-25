# Student Productivity

A local-first, mobile-first student productivity PWA with semester, module, academic-date, and timetable-rule management. Recurrence matching is provided as pure logic. Manual attendance is recorded on demand. A persistent work timer is available on Today. No backend, authentication, remote data, seed records, or push notifications.

## Development

Requires Node.js 24.x and npm (the same major version selected for Vercel builds).

```sh
npm ci
npm run dev
npm run build
npm run lint
npm run preview
```

Development serves source code; use the production preview to check service-worker caching and offline navigation. A deployed PWA requires HTTPS (localhost is supported for testing). On iPhone, open the deployed site in Safari and choose Share → Add to Home Screen. This project has not been deployed.

## Deploy to Vercel

This is a static Vite app. No server, environment variables, database credentials, or Vercel runtime packages are required. `vercel.json` selects Vite, runs `npm ci` and `npm run build`, serves `dist`, and rewrites extensionless SPA routes to `/index.html`. Requests for assets, the manifest, and service-worker scripts retain their real paths ([Vercel Vite guide](https://vercel.com/docs/frameworks/frontend/vite)). `package.json` selects Node 24.x for builds ([Node version configuration](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)).

### 1. Push to GitHub

The existing checkout is on `main`, with `origin` already pointing to `https://github.com/Nipun-Bandara/uni-buddy.git`. Keep that remote; no new repository initialization is needed. Sign in to GitHub when prompted, then run:

```sh
cd /home/nipun/Desktop/uni-buddy
git status
git add .gitignore README.md package.json package-lock.json vercel.json src/hooks/.gitkeep src/components/ui/.gitkeep
git diff --cached --stat
git commit -m "Prepare static Vercel deployment"
git push -u origin main
```

The explicit paths above stage only deployment preparation, including removal of the two unused placeholders. If everything is already committed, skip the add/commit commands and push `main`. Keep `package-lock.json` committed. Build output, dependencies, environment files, `.vercel`, and downloaded personal backups are ignored. Export personal data through Settings → Data before moving to another device or origin; Git does not contain your IndexedDB data.

### 2. Import into Vercel

Sign in at [Vercel](https://vercel.com/new), choose Add New → Project (or Import Git Repository), connect GitHub, and import `Nipun-Bandara/uni-buddy`. If it is missing, grant the Vercel GitHub app access to that repository. Use the repository root and `main` as the production branch ([GitHub import guide](https://vercel.com/docs/git/vercel-for-github)).

### 3. Confirm build settings

The checked-in configuration supplies these values. If the dashboard asks for settings or detection fails, use:

| Setting | Value |
| --- | --- |
| Framework Preset | Vite |
| Root Directory | Repository root (`./`); leave the default unchanged |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js Version | `24.x` |
| Environment Variables | None |

Choose Deploy and wait for Ready. Open the resulting production HTTPS URL and directly load/refresh each path: `/`, `/sessions`, `/schedule`, `/insights`, `/settings`. Each should render its page rather than a 404. Use a fresh browser/private tab for this hosted check so an existing service worker does not hide server routing problems. The generated `dist` includes `index.html`, hashed JS/CSS assets, icons, `manifest.webmanifest`, and service-worker files. Do not upload `node_modules` or commit `dist`.

### 4. Open on iPhone

Copy the production HTTPS URL from Vercel and open it in Safari on the iPhone. Use the stable production domain for daily use: local data belongs to each browser/device/origin, so localhost, preview URLs, and the production URL have separate data. To transfer existing records, export a backup from the old app and import it in Settings → Data at the production URL. Nothing is uploaded automatically.

### 5. Add to Home Screen

In Safari, tap Share (or More → Share, depending on the Safari layout), then Add to Home Screen. Leave Open as Web App enabled if shown, choose a name, and tap Add. If the action is missing, use Share → Edit Actions to add it ([Apple instructions](https://support.apple.com/en-lamr/guide/iphone/iphea86e5236/ios)). Open the new icon online once and let the app finish loading, then close it, turn on Airplane Mode, and reopen it to check the cached app. Saved local data should remain available. Updates offer Reload/Later; finish edits before reloading.

Deployment preparation checks: lint and `npm run build` pass without warnings; `dist` contains the static app and generated PWA files. A local production server applying the checked-in rewrite rules rendered all five direct routes and refreshes with service workers blocked, served assets/manifest/worker intact, and returned 404 for a missing asset. Ignore rules were checked and a scan of tracked files found no common credential patterns or tracked environment/build files. No GitHub push or Vercel deployment was performed by the agent. Confirm hosted routing and real iPhone installation after deploying.

## Structure

```text
public/                      PNG PWA, maskable, and Apple icons
src/
  app/                       App.tsx and router.tsx
  components/
    layout/                  app-shell.tsx
    navigation/              bottom-nav.tsx
    ui/                      Installed shadcn components
  pages/                     Today, Sessions, Schedule, Insights, Settings
  db/                        db.ts, schema.ts, types.ts
  lib/                       utils.ts, dates.ts, ids.ts
  hooks/                     Local clock and visible-viewport hooks
  styles/globals.css         Tailwind integration and shadcn tokens
  main.tsx                   Local DB initialization
```

## Theme and components

The existing `src/styles/globals.css` supplies the shadcn theme and remains unchanged by the PWA polish. There is no dark-mode switching logic.

`components.json`, Vite, and TypeScript all use `@/*` → `src/*`. Existing shadcn components live in `src/components/ui`. Shared component variants are exported from separate files to keep React Fast Refresh checks clean.

PWA theme/background colors are independent browser metadata: update them in `vite.config.ts` and the theme-color in `index.html` when changing your theme. The existing 192px/512px PNGs, separate 512px maskable icon, and 180px Apple touch icon are configured in `public/`.

## Local data conventions

One Dexie instance opens `StudentProductivityDB`, schema version 5, before rendering. Tables: semesters, modules, scheduleRules, classOccurrences, workSessions, settings, academicDates. Records start empty. Forms use Zod validation and reference guards protect related records during deletion. Dexie live queries keep lists current.

- Calendar dates: `YYYY-MM-DD`, interpreted locally; never parse with `new Date(dateString)` or serialize date-only values to UTC.
- Local times: `HH:mm`, 24-hour clock.
- Timestamps: ISO 8601 instants; helpers serialize to UTC.
- Weekdays: Monday = 0 through Sunday = 6. Database version 3 migrates older Sunday-based values while preserving the actual weekday.
- Repeat interval: 1 = weekly, 2 = alternate weeks; anchorDate is a date in a known occurrence week. Pure recurrence matching is implemented in `src/lib/recurrence.ts`; occurrence generation is not implemented.
- A work session without endedAt is active. Missing values are not indexed; active-session queries filter records rather than querying an undefined index key.
- Settings use recursively JSON-compatible values. Zod date/time validators are provided; database writes are not automatically validated.

IndexedDB stays in the browser on the device. Clearing site data removes it. Local JSON backup/restore is available in Settings → Data.

## Routing and offline behavior

Routes: `/`, `/sessions`, `/schedule`, `/insights`, `/settings`. Settings is reached from the header; the other four routes share the bottom navigation. The 28rem shell fills the dynamic viewport. Its header and bottom navigation reserve their own space around a scrolling main region; bottom padding keeps the last row reachable above navigation. Header/navigation include top, bottom, left, and right safe-area padding, alongside `viewport-fit=cover` ([WebKit guidance](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)).

The production service worker precaches the application shell, every lazy route chunk, styles, and icons, then falls back to index.html for navigation. All routes can reopen offline after the first successful load and service-worker activation. IndexedDB needs no network. Pages are split into smaller production bundles.

Updates follow the [Vite PWA prompt strategy](https://vite-pwa-org.netlify.app/guide/prompt-for-update.html). A ready update offers Reload or Later, allowing open forms to remain intact until an explicit reload. Returning to the foreground or going online checks for updates at most once per minute. Offline update-check failures retain the cached app. No notifications are requested or implemented.

Inputs and selection controls use 16px text; primary buttons, navigation, and select options have comfortable tap targets. Long selected module names wrap. Date popovers fit a 320px screen; native time inputs retain their iOS picker. Drawers use dynamic viewport bounds, scrollable forms, and a safe-area footer. Dialogs also follow the [Visual Viewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport) to stay scrollable above the software keyboard.

`vercel.json` rewrites extensionless SPA routes to index.html while preserving static asset requests. No deployment was performed.

The latest Vite React TypeScript starter uses Oxlint; `npm run lint` retains that current starter tool rather than introducing ESLint. Tailwind uses its current Vite plugin; shadcn is manually configured following the [official Vite setup](https://ui.shadcn.com/docs/installation/vite) using the installed UI components.

## Verification performed

Production TypeScript/build and Oxlint passed. Headless Chromium checks passed for all five direct routes in development and production, all four bottom navigation links and active states, six empty IndexedDB stores, generated manifest/service-worker control, all five production routes and navigation while offline, mobile horizontal overflow, and absence of browser console/runtime errors. Actual iPhone Home Screen installation and hosted Vercel rewrites still require device/deployment verification.

## Timetable rules

Schedule → Classes shows current-semester rules on a Monday–Sunday time grid. Swipe within the timetable to reach later weekdays; the time axis and weekday headers stay visible while scrolling. Slots use a light module-color tint, the saved module code (or automatic initials), and exact times. A module key gives full names. Alternating rules remain labeled Every 2 weeks; this is a weekly-pattern overview rather than a dated recurrence view. Overlapping classes use separate lanes, and short classes retain at least 48px touch targets. Add or tap a class to open the existing mobile Drawer. Start/end dates default to the semester; the first occurrence must match the selected weekday and lie within that period. Times are stored as HH:mm, and dates stay YYYY-MM-DD.

Database version 3 converts saved v1/v2 weekdays from Sunday = 0 to Monday = 0 without changing their meaning. Class deletion requires confirmation and protects any existing linked occurrences. The timetable UI manages rules only. Pure recurrence helpers are available separately; the Today screen uses them to display classes; occurrence records are created only by explicit attendance actions.

The academic calendar remains available in its own Schedule tab; Today’s View calendar link opens it directly. Timetable checks covered create/edit/delete/reload, weekday/time sorting, validation, mobile Drawer layout, empty states, and the v2→v3 migration.

## Recurrence helpers and tests

`src/lib/recurrence.ts` exports `occursOnDate(rule, date)` and `getScheduleForDate(rules, date)`. Dates are YYYY-MM-DD calendar labels. The helpers use explicit Gregorian components on a fixed arithmetic axis, without converting date-only values through a device timezone. Rules match inclusive start/end dates, Monday-based weekdays, and weekly/fortnightly intervals. The anchor identifies an occurrence week (Monday–Sunday); earlier matching weeks inside the period also qualify. Invalid date fields, reversed ranges, invalid weekdays, and unsupported intervals return false. The schedule helper returns a new array sorted by HH:mm start time; equal times retain input order.

These helpers do not query storage, apply break/holiday exceptions, mutate rules, or generate occurrences. Today reads saved rules and uses the helpers for display.

```sh
npm test                 # Run unit tests once
npm run test:watch       # Watch mode
npm run test:timezones   # Run the suite in six separate timezone environments
```

The 56-case suite covers weekly/fortnightly matching, inclusive bounds, anchor weeks, Monday/Sunday transitions, dates before anchors, month/year changes, leap days, DST, malformed dates, and stable non-mutating sorting. The timezone matrix runs UTC, Asia/Colombo, America/New_York, Europe/Berlin, Pacific/Kiritimati, and Pacific/Apia (including its historical skipped day). Vitest uses its own configuration and does not load production/PWA plugins.

## Today screen

Today shows the device's local weekday/date and the active semester's classes, matched with `getScheduleForDate()` and sorted by start time. Module accents stay small. Each class shows its time, module, type, and optional location. A slot is current from its start (inclusive) until its end (exclusive); labels distinguish NOW, Ended, and Upcoming without implying attendance.

The local clock refreshes on minute boundaries, focus, and return to the foreground, including day rollover. Dexie live queries update saved timetable/module changes. Academic dates remain below the classes, and the empty state says No classes today. Rendering does not write ClassOccurrence records. Ended classes offer manual attendance controls.

Verification covered weekly and alternating lab weeks, skipped/no-class days, chronological sorting, state boundaries, live foreground/minute/midnight updates, bottom navigation, and a local date west of UTC. Unit tests include eight additional class-time-state cases.

## Manual attendance

Ended classes on Today offer Attended, Missed, and Cancelled. Recorded statuses can be tapped to change them. Attendance is distinct from the time-slot labels; future unrecorded classes show no attendance controls. Browsing/reloading never generates occurrence rows.

`src/db/attendance.ts` provides `getAttendanceForClass(ruleId, date)` and `setAttendance(rule, date, status)`. Reads return undefined when unrecorded. The setter uses a read/write transaction and the saved rule, creating an occurrence only on a matching date; subsequent status changes keep the same ID and original timestamps. It supports pending explicitly, too. New records combine local calendar-date and HH:mm components before serializing ISO instants; nonexistent DST wall-clock times are rejected instead of silently shifted.

Database version 4 removes legacy rule/date duplicates before version 5 adds `&[scheduleRuleId+date]`. Since old records lack modification timestamps, migration prefers a non-pending record, then the greatest primary-key ID as a deterministic tie-breaker. The unique index also protects writes outside the attendance service. Existing timetable deletion guards preserve linked occurrences.

Attendance service/migration tests use development-only fake-indexeddb. The attendance milestone brought the suite to 79 cases; the DST-gap case runs specifically in America/New_York and is skipped in other zones. Browser checks covered all statuses, editing/cancelling edits, reloads, no writes until action, concurrent updates without duplicates, Colombo ISO timestamps, navigation, and mobile layout. No push notifications are implemented.

## Work timer

Today → Start work opens a Drawer with an optional current-semester module and optional title. General work is available even without a semester. The reusable `WorkTimer` component lives in `src/components/work/work-timer.tsx`.

`src/db/work-sessions.ts` provides `getActiveWorkSession()`, `startWorkSession({ moduleId?, title? })`, and `stopWorkSession(id)`. A read/write transaction checks for any record without endedAt before adding a session, preventing simultaneous starts across tabs. Stop records the current ISO timestamp and is idempotent: repeated taps preserve the original endedAt. The existing schema is sufficient; no migration or new counter fields are needed.

The display calculates elapsed seconds from current time minus the saved startedAt. Visible refreshes run once per second; foreground/focus events recompute immediately. No seconds are incremented or written to storage. Reloading, closing/reopening, and navigating back restore the stored active session. Durations can exceed 24 hours.

The timer milestone brought the test suite to 93 cases, including one timezone-specific DST test. Timer tests cover optional fields, trimming, persistence, concurrent starts/stops, module validation, long elapsed gaps, and midnight/multiday formatting. Isolated browser checks also covered General/module/title flows, ticking, foreground catch-up, reload, page close/reopen, two-tab concurrency, stopping, and absence of counter writes.

## Sessions history and correction

Sessions lists completed work grouped by its local start date, newest dates and starts first, with Today/Yesterday headings. Rows show module (or General), optional title, derived duration, and local start/end times. Overnight rows also show the end date. The active timer is displayed separately and can be stopped; completed-history operations do not alter it.

Add session or tap a history row to open the editor Drawer. Module and title are optional. Date, start/end time, and end date support overnight and multiday corrections. Zod validates real local dates/times, requires end after start, and rejects future completions and nonexistent DST wall-clock times. Metadata-only edits preserve the original seconds, fractional seconds, and ambiguous-DST instants. All saves/deletes are transactional; active sessions cannot be edited/deleted through history. Delete requires confirmation.

`src/lib/session-history.ts` contains grouping, labels, duration formatting, and validation. `src/db/session-history.ts` persists completed entries. The existing schema is sufficient; no duplicate duration field or migration is added. A shared local-date/time-to-ISO helper in `src/lib/dates.ts` is also reused by attendance.

The Sessions milestone brought the suite to 105 cases (two DST-specific tests run in America/New_York). Checks passed across six timezones. Mobile browser verification covered ordering, manual entry, editing module/title/times, confirmation cancellation/deletion, reload persistence, hour and overnight boundaries, active-timer separation, and navigation.

## Insights

Insights supports This week (local Monday 00:00 through the next Monday, exclusive) and This month (local month start through the next month start, exclusive). Results update through Dexie live queries and the local clock. No chart library, generated records, or persisted aggregates are used.

Calculations in `src/lib/insights.ts` are pure and documented:

- Attendance = attended / (attended + missed), rounded to a whole percent. Pending, cancelled, and unrecorded classes are excluded; no denominator displays a dash. Classes shows attended / (attended + missed). Counts use the saved occurrence calendar date, within the selected period through today.
- Class time uses saved startAt/endAt for attended occurrences only. Missed/cancelled/pending classes contribute no time.
- Independent work uses completed WorkSession timestamps; active sessions are excluded.
- Productive time = attended class time + completed independent work, including General. Recorded intervals are additive; they are not deduplicated against one another.
- Durations are clipped to the period boundaries and current time, so overnight/boundary-spanning work contributes only its overlap. Raw milliseconds are summed before formatting minutes.
- Module totals combine their class and independent work. Work without a module is shown separately as General. Missing old module/rule references retain their totals under explicit fallback labels.

Hand-checked weekly fixture (all records stay in an isolated test database):

| Module | Attended class time | Independent work | Total |
| --- | --- | --- | --- |
| Data Mining | 4h | 5h 20m | 9h 20m |
| Software Engineering | 2h | 0m | 2h |
| General | 0m | 2h 10m | 2h 10m |
| Total | 6h | 7h 30m | 13h 30m |

Three attended and one missed class give 75% and 3 / 4. A cancelled 4h class, a pending class, and an active work timer contribute no productive time. Adding an earlier-month attended 2h class and 1h of General work yields a month total of 16h 30m, 80%, and 4 / 5.

The Insights milestone brought the suite to 118 cases, with three DST-specific cases running in America/New_York. Checks across six timezones cover week/month and year boundaries, DST, clipped sessions, partial minutes, cancelled/pending exclusion, General work, percentage rounding, missing references, invalid durations, and empty data. Mobile browser checks confirmed the fixture totals, tab switching, live updates, reload, navigation, and no database writes when viewing insights.

## Local backup and restore

Settings → Data exports a downloadable `student-productivity-backup-YYYY-MM-DD.json` using the device's local date. The JSON envelope includes backup format `version: 1`, ISO `exportedAt`, and arrays for semesters, modules, scheduleRules, classOccurrences, workSessions, settings, and academicDates. The active timer is included without an endedAt; timestamp precision and date-only values remain unchanged. Backup format version 1 uses Monday = 0 weekdays independently of the current IndexedDB schema version.

`src/lib/backup.ts` uses Zod to validate every record, date/time range, nested JSON setting value, unique ID/key, compound occurrence key, relation, and the single-active-timer invariant. Unsupported format versions, invalid JSON, and invalid records show separate useful messages. Six-table v1 backups may omit academicDates; they restore that table as empty. Other required tables must be present. Future schemas/backup formats should be explicitly versioned rather than silently accepting unknown fields.

`src/db/backup.ts` reads all tables inside one read transaction for a consistent export. Restore revalidates before writing, then clears and inserts all seven tables inside one read/write transaction. Any failure rolls back the complete replacement. The Settings AlertDialog explains that all local data, including the current active timer state, will be replaced and requires explicit confirmation; cancellation does not write anything.

The full suite now has 130 cases (three DST-specific tests run in America/New_York), passing across six timezones. Backup checks cover full export/change/import round trips, persistence after reopening, nested settings, active timers, academic dates, invalid/missing fields, unsupported versions, duplicates, broken references, empty backups, and forced-failure rollback. An isolated mobile browser additionally verified the actual file download/name, validation errors without changes, confirmation cancellation, transactional rollback, retry, reload, and restored timer state. Test fixtures stay outside the production database.

## PWA / iPhone polish verification

Lint, TypeScript, production build, and the full unit suite pass without build/lint warnings. Production browser checks use an isolated database: install/control the worker online, close the page, go offline, and reopen an unvisited Settings route. All five pages and the academic calendar load offline at 320px, 375px, and 430px widths with long module names and no horizontal page overflow. Navigation stays separate from content and the final history row remains fully reachable. Manual session writes and a work timer survive offline reloads.

A reduced-height 320px viewport checks scrolling Dialogs/Drawers, reachable actions, 16px text, long module selection, and calendar popover fit. A simulated second production build verifies that an open form retains its unsaved title, Later defers activation, and Reload explicitly activates the waiting worker. No browser runtime/console errors were observed. These are Chromium mobile checks; actual iPhone Safari keyboard behavior, Home Screen installation, and physical notch/home-indicator insets still require device verification.
