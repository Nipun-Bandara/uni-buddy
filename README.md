# Student Productivity

A local-first, mobile-first student productivity PWA with semester, module, academic-date, and timetable-rule management. Recurrence matching is provided as pure logic. No backend, authentication, remote data, seed records, timer, or attendance features.

## Development

Requires Node.js 22.12+ (Node 24 recommended) and npm.

```sh
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

Development serves source code; use the production preview to check service-worker caching and offline navigation. A deployed PWA requires HTTPS (localhost is supported for testing). On iPhone, open the deployed site in Safari and choose Share → Add to Home Screen. This project has not been deployed.

## Structure

```text
public/                      Temporary PNG PWA and Apple icons
src/
  app/                       App.tsx and router.tsx
  components/
    layout/                  app-shell.tsx
    navigation/              bottom-nav.tsx
    ui/                      Empty; ready for your shadcn components
  pages/                     Today, Sessions, Schedule, Insights, Settings
  db/                        db.ts, schema.ts, types.ts
  lib/                       utils.ts, dates.ts, ids.ts
  hooks/                     Empty; ready for hooks
  styles/globals.css         Tailwind integration and shadcn tokens
  main.tsx                   Local DB initialization and PWA registration
```

## Theme and components

Replace the `:root` token block in `src/styles/globals.css` with your generated shadcn theme. Add its `.dark` block immediately after it if included. Keep the imports, `@custom-variant`, `@theme inline` mappings, and base layer; merge additional mappings from your theme if it introduces more tokens. There is no dark-mode switching logic.

`components.json`, Vite, and TypeScript all use `@/*` → `src/*`. No individual shadcn components are installed. You can now manually add your preferred components, for example:

```sh
npx shadcn@latest add button
```

PWA theme/background colors are independent browser metadata: update them in `vite.config.ts` and the theme-color in `index.html` when changing your theme. Replace the temporary icons in `public/` when ready.

## Local data conventions

One Dexie instance opens `StudentProductivityDB`, schema version 3, before rendering. Tables: semesters, modules, scheduleRules, classOccurrences, workSessions, settings, academicDates. Records start empty. Forms use Zod validation and reference guards protect related records during deletion. Dexie live queries keep lists current.

- Calendar dates: `YYYY-MM-DD`, interpreted locally; never parse with `new Date(dateString)` or serialize date-only values to UTC.
- Local times: `HH:mm`, 24-hour clock.
- Timestamps: ISO 8601 instants; helpers serialize to UTC.
- Weekdays: Monday = 0 through Sunday = 6. Database version 3 migrates older Sunday-based values while preserving the actual weekday.
- Repeat interval: 1 = weekly, 2 = alternate weeks; anchorDate is a date in a known occurrence week. Pure recurrence matching is implemented in `src/lib/recurrence.ts`; occurrence generation is not implemented.
- A work session without endedAt is active. Missing values are not indexed; future active-session queries should filter records rather than query an undefined index key.
- Settings use recursively JSON-compatible values. Zod date/time validators are provided; database writes are not automatically validated.

IndexedDB stays in the browser on the device. Clearing site data removes it. No persistence/backup feature is implemented.

## Routing and offline behavior

Routes: `/`, `/sessions`, `/schedule`, `/insights`, `/settings`. Settings is reached from the header; the other four routes share the bottom navigation. The 28rem shell includes safe-area padding and navigation in document flow.

The production service worker precaches the application shell and falls back to index.html for navigation, enabling offline routes after the first successful load and service-worker activation. Updates activate automatically when detected, following the [Vite PWA auto-update strategy](https://vite-pwa-org.netlify.app/guide/auto-update). Revisit this policy when adding unsaved form state.

`vercel.json` rewrites extensionless SPA routes to index.html while preserving static asset requests. No deployment was performed.

The latest Vite React TypeScript starter uses Oxlint; `npm run lint` retains that current starter tool rather than introducing ESLint. Tailwind uses its current Vite plugin; shadcn is manually configured following the [official Vite setup](https://ui.shadcn.com/docs/installation/vite) to avoid adding UI components.

## Verification performed

Production TypeScript/build and Oxlint passed. Headless Chromium checks passed for all five direct routes in development and production, all four bottom navigation links and active states, six empty IndexedDB stores, generated manifest/service-worker control, all five production routes and navigation while offline, mobile horizontal overflow, and absence of browser console/runtime errors. Actual iPhone Home Screen installation and hosted Vercel rewrites still require device/deployment verification.

## Timetable rules

Schedule → Classes lists rules for the current semester, grouped Monday–Sunday and sorted by start time. Add or tap a class to open the mobile Drawer. Start/end dates default to the semester; the first occurrence must match the selected weekday and lie within that period. Times are stored as HH:mm, and dates stay YYYY-MM-DD.

Database version 3 converts saved v1/v2 weekdays from Sunday = 0 to Monday = 0 without changing their meaning. Class deletion requires confirmation and protects any existing linked occurrences. The timetable UI manages rules only. Pure recurrence helpers are available separately; the Today screen does not yet use them, and no occurrences/attendance are generated.

The academic calendar remains available in its own Schedule tab; Today’s View calendar link opens it directly. Timetable checks covered create/edit/delete/reload, weekday/time sorting, validation, mobile Drawer layout, empty states, and the v2→v3 migration.

## Recurrence helpers and tests

`src/lib/recurrence.ts` exports `occursOnDate(rule, date)` and `getScheduleForDate(rules, date)`. Dates are YYYY-MM-DD calendar labels. The helpers use explicit Gregorian components on a fixed arithmetic axis, without converting date-only values through a device timezone. Rules match inclusive start/end dates, Monday-based weekdays, and weekly/fortnightly intervals. The anchor identifies an occurrence week (Monday–Sunday); earlier matching weeks inside the period also qualify. Invalid date fields, reversed ranges, invalid weekdays, and unsupported intervals return false. The schedule helper returns a new array sorted by HH:mm start time; equal times retain input order.

These helpers do not query storage, apply break/holiday exceptions, mutate rules, generate occurrences, or update the UI.

```sh
npm test                 # Run unit tests once
npm run test:watch       # Watch mode
npm run test:timezones   # Run the suite in six separate timezone environments
```

The 56-case suite covers weekly/fortnightly matching, inclusive bounds, anchor weeks, Monday/Sunday transitions, dates before anchors, month/year changes, leap days, DST, malformed dates, and stable non-mutating sorting. The timezone matrix runs UTC, Asia/Colombo, America/New_York, Europe/Berlin, Pacific/Kiritimati, and Pacific/Apia (including its historical skipped day). Vitest uses its own configuration and does not load production/PWA plugins.
